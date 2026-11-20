import Anthropic from "@anthropic-ai/sdk";
import {
  chatRequestSchema,
  encodeEvent,
  MAX_HISTORY_MESSAGES,
  type ChatEvent,
} from "@/lib/chat/protocol";
import { getConfig, type AppConfig } from "@/lib/config";
import { getSharedDb } from "@/lib/db/client";
import { createEmbeddingProvider } from "@/lib/embeddings";
import { MODEL, toChatEvents, toSourceInfo } from "@/lib/rag/answer";
import { buildMessages, NO_CONTEXT_MESSAGE, SYSTEM_PROMPT } from "@/lib/rag/prompt";
import {
  buildRetrievalQuery,
  IndexNotReadyError,
  retrieve,
  type RetrievalResult,
} from "@/lib/rag/retrieve";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/chat : le cœur du RAG.
 *   1. valider la requête ;
 *   2. retrouver les passages les plus proches de la question (pgvector) ;
 *   3. si rien n'est assez proche : « je ne sais pas », sans appeler le LLM ;
 *   4. sinon, demander à Claude une réponse fondée sur ces passages, en streaming,
 *      et relayer texte et citations au navigateur en NDJSON.
 */

// Durée maximale de la fonction sur Vercel (secondes).
export const maxDuration = 60;

/** Plafond de tokens générés (réflexion comprise) : démo publique, coût maîtrisé. */
const MAX_OUTPUT_TOKENS = 4096;

const rateLimit = createRateLimiter({ limit: 10, windowMs: 60_000 });

let anthropic: Anthropic | undefined;

function jsonError(status: number, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers });
}

/** Message d'erreur compréhensible, sans détail technique ni secret. */
function toUserMessage(error: unknown): string {
  // Du plus précis au plus général : les classes d'erreur du SDK héritent de APIError.
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "La clé API configurée sur le serveur est refusée.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Le service reçoit trop de demandes : réessayez dans un instant.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Impossible de joindre le modèle : réessayez dans un instant.";
  }
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) {
    return "Le modèle est momentanément indisponible : réessayez dans un instant.";
  }
  return "Une erreur est survenue pendant la réponse.";
}

export async function POST(request: Request): Promise<Response> {
  const limit = rateLimit(clientIp(request.headers));
  if (!limit.allowed) {
    return jsonError(429, "Trop de questions d'affilée : réessayez dans une minute.", {
      "Retry-After": String(limit.retryAfterS),
    });
  }

  // 1. Validation de la requête.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Corps de requête JSON invalide.");
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Requête invalide.");
  }
  const { question, currentPageId } = parsed.data;
  const history = parsed.data.history.slice(-MAX_HISTORY_MESSAGES);

  let config: AppConfig;
  try {
    config = getConfig();
  } catch (error) {
    console.error(error);
    return jsonError(500, "La configuration du serveur est invalide.");
  }

  // 2. Recherche des passages (avant de vérifier la clé : une question hors du guide
  //    reçoit « je ne sais pas » sans jamais avoir besoin de Claude).
  let retrieval: RetrievalResult;
  try {
    const db = await getSharedDb(config.databaseUrl);
    retrieval = await retrieve(
      { db, embeddings: createEmbeddingProvider(config) },
      buildRetrievalQuery(question, history),
      { currentPageId },
    );
  } catch (error) {
    if (error instanceof IndexNotReadyError) return jsonError(503, error.message);
    console.error("Recherche impossible", error);
    return jsonError(503, "La recherche dans le guide est indisponible pour le moment.");
  }

  const { chunks, enoughContext } = retrieval;
  const apiKey = config.anthropicApiKey;
  if (enoughContext && !apiKey) {
    return jsonError(503, "ANTHROPIC_API_KEY n'est pas configurée sur le serveur.");
  }
  const client = apiKey ? (anthropic ??= new Anthropic({ apiKey })) : null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // Le navigateur a fermé la connexion : plus personne n'écoute.
        }
      };

      try {
        // 3. Rien d'assez proche : réponse honnête, sans appel payant.
        if (!enoughContext || !client) {
          send({ type: "sources", sources: [] });
          send({ type: "text-start" });
          send({ type: "text", text: NO_CONTEXT_MESSAGE });
          send({ type: "done", reason: "no_context" });
          return;
        }

        // 4. Réponse de Claude, fondée sur les passages, en streaming.
        send({ type: "sources", sources: toSourceInfo(chunks) });
        const claudeStream = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: MAX_OUTPUT_TOKENS,
            system: SYSTEM_PROMPT,
            messages: buildMessages(history, question, chunks),
            // Opus 5.5 réfléchit toujours (réflexion adaptative) ; l'effort règle la
            // profondeur. « low » suffit pour répondre à partir d'extraits fournis.
            output_config: { effort: "low" },
            // Si les garde-fous du modèle refusent, l'API relance la demande sur le
            // modèle de repli recommandé par Anthropic.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          // Si l'utilisateur ferme la page ou clique « Arrêter », on coupe l'appel.
          { signal: request.signal },
        );

        for await (const event of toChatEvents(claudeStream, chunks)) {
          if (event.type === "done" && event.usage) {
            const { inputTokens, outputTokens, costUsd } = event.usage;
            console.info(`[chat] ${inputTokens} tokens entrée, ${outputTokens} sortie, ~$${costUsd}`);
          }
          send(event);
        }
      } catch (error) {
        if (!(error instanceof Anthropic.APIUserAbortError)) {
          console.error("Erreur pendant la réponse", error);
          send({ type: "error", message: toUserMessage(error) });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Désactive la mise en tampon des proxys : le texte arrive au fil de l'eau.
      "X-Accel-Buffering": "no",
    },
  });
}
