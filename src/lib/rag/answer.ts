import type Anthropic from "@anthropic-ai/sdk";
import type { ChatEvent, CitationInfo, SourceInfo, UsageInfo } from "@/lib/chat/protocol";
import { chunkText } from "./chunker";
import { buildHighlightUrl } from "./highlight";
import { sourceTitle } from "./prompt";
import type { RetrievedChunk } from "./types";

/**
 * Claude Haiku 5.5 : le modèle le plus économique de la gamme actuelle. Pour répondre à
 * partir d'extraits fournis, il suffit largement, pour un coût ~40 fois plus faible
 * qu'Opus 5.5 (environ 0,04 centime par question au lieu de 1 à 2 centimes).
 */
export const MODEL = "claude-haiku-5-5";

/** Tarif public de claude-haiku-5-5 (requêtes de moins de 100K tokens), en $ par million. */
const PRICE_PER_MTOK = { input: 0.1, output: 0.5 } as const;

export const REFUSAL_MESSAGE =
  "Je ne peux pas répondre à cette demande. Posez-moi une question sur l'installation " +
  "ou la vie au Luxembourg.";

/** Résumé d'un passage pour l'interface (carte de source). */
export function toSourceInfo(chunks: RetrievedChunk[]): SourceInfo[] {
  return chunks.map((chunk, index) => {
    const text = chunkText(chunk).replace(/\s+/g, " ");
    return {
      index,
      id: chunk.id,
      url: chunk.url,
      pageTitle: chunk.pageTitle,
      section: chunk.section,
      kind: chunk.kind,
      similarity: Math.round(chunk.similarity * 1000) / 1000,
      excerpt: text.length > 240 ? `${text.slice(0, 237)}…` : text,
    };
  });
}

/** Transforme une citation de l'API en citation affichable, avec le lien de surlignage. */
export function toCitation(
  citation: Anthropic.Beta.BetaCitationSearchResultLocation,
  chunks: RetrievedChunk[],
): CitationInfo | null {
  const chunk = chunks[citation.search_result_index];
  if (!chunk) return null;
  const first = chunk.paragraphs[citation.start_block_index] ?? chunk.paragraphs[0] ?? "";
  const last = chunk.paragraphs[citation.end_block_index - 1] ?? first;
  return {
    sourceIndex: citation.search_result_index,
    url: chunk.url,
    title: citation.title ?? sourceTitle(chunk),
    citedText: citation.cited_text,
    highlightUrl: buildHighlightUrl(chunk.url, first, last),
  };
}

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const cost = (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1e6;
  return Math.round(cost * 1e5) / 1e5;
}

/**
 * Traduit le flux d'événements de l'API Claude en événements de notre protocole.
 * Fonction pure sur un itérable : elle se teste avec des événements fabriqués à la main.
 */
export async function* toChatEvents(
  stream: AsyncIterable<Anthropic.Beta.BetaRawMessageStreamEvent>,
  chunks: RetrievedChunk[],
): AsyncGenerator<ChatEvent> {
  let stopReason: Anthropic.Beta.BetaStopReason | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    switch (event.type) {
      case "message_start":
        inputTokens = event.message.usage.input_tokens;
        break;
      case "content_block_start":
        // Les blocs de réflexion (thinking) et de bascule (fallback) ne sont pas affichés.
        if (event.content_block.type === "text") yield { type: "text-start" };
        break;
      case "content_block_delta":
        if (event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        } else if (
          event.delta.type === "citations_delta" &&
          event.delta.citation.type === "search_result_location"
        ) {
          const citation = toCitation(event.delta.citation, chunks);
          if (citation) yield { type: "citation", citation };
        }
        break;
      case "message_delta":
        stopReason = event.delta.stop_reason ?? stopReason;
        outputTokens = event.usage.output_tokens;
        break;
    }
  }

  // Refus des garde-fous du modèle : la réponse partielle éventuelle doit être jetée.
  if (stopReason === "refusal") {
    yield { type: "refusal", message: REFUSAL_MESSAGE };
    return;
  }
  const usage: UsageInfo = {
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(inputTokens, outputTokens),
  };
  yield { type: "done", reason: stopReason === "max_tokens" ? "max_tokens" : "complete", usage };
}
