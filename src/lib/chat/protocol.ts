import { z } from "zod";

/**
 * Protocole entre l'interface et la route /api/chat, partagé par le client et le serveur.
 *
 * Requête : JSON validé par zod.
 * Réponse : NDJSON (un objet JSON par ligne), lu au fil de l'eau par le navigateur.
 *   {"type":"sources",...}   les passages retrouvés, envoyés en premier
 *   {"type":"text-start"}    début d'un bloc de texte (Claude découpe sa réponse en blocs)
 *   {"type":"text",...}      un morceau de texte
 *   {"type":"citation",...}  une citation, rattachée au bloc de texte en cours
 *   {"type":"done",...}      fin normale  |  {"type":"refusal"}  |  {"type":"error"}
 */

export const MAX_QUESTION_CHARS = 1000;
/** Nombre de messages d'historique renvoyés au modèle (3 échanges question/réponse). */
export const MAX_HISTORY_MESSAGES = 6;

export const chatRequestSchema = z.object({
  question: z.string().trim().min(2, "Question trop courte.").max(MAX_QUESTION_CHARS),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .default([]),
  /** Fiche que l'utilisateur est en train de lire (paramètre ?fiche=...), si connue. */
  currentPageId: z
    .string()
    .regex(/^[a-z0-9_-]{1,60}$/)
    .optional(),
});

export type ChatRequest = z.input<typeof chatRequestSchema>;
export type HistoryMessage = z.infer<typeof chatRequestSchema>["history"][number];

/** Un passage retrouvé, tel qu'affiché dans les cartes de sources. */
export interface SourceInfo {
  /** Position dans la liste envoyée à Claude (= search_result_index des citations). */
  index: number;
  id: string;
  url: string;
  pageTitle: string;
  section: string | null;
  kind: "fiche" | "faq";
  similarity: number;
  excerpt: string;
}

/** Une citation renvoyée par Claude, enrichie du lien qui surligne le passage. */
export interface CitationInfo {
  sourceIndex: number;
  url: string;
  title: string;
  citedText: string;
  /** URL avec « text fragment » : ouvre la page et surligne le passage cité. */
  highlightUrl: string;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  /** Estimation du coût de la question en dollars (tarif public du modèle). */
  costUsd: number;
}

export type ChatEvent =
  | { type: "sources"; sources: SourceInfo[] }
  | { type: "text-start" }
  | { type: "text"; text: string }
  | { type: "citation"; citation: CitationInfo }
  | { type: "done"; reason: "complete" | "max_tokens" | "no_context"; usage?: UsageInfo }
  | { type: "refusal"; message: string }
  | { type: "error"; message: string };

export function encodeEvent(event: ChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Lit un flux NDJSON et produit les événements un par un.
 * Un morceau réseau peut couper une ligne en deux : on garde la fin incomplète dans un
 * tampon jusqu'au morceau suivant.
 */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as ChatEvent;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer) as ChatEvent;
  } finally {
    reader.releaseLock();
  }
}
