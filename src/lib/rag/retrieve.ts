import type { HistoryMessage } from "@/lib/chat/protocol";
import type { Queryable } from "@/lib/db/client";
import { readIndexMeta, searchChunks } from "@/lib/db/chunks";
import type { EmbeddingProvider } from "@/lib/embeddings/types";
import type { RetrievedChunk } from "./types";

/** Nombre de passages donnés à Claude. */
export const RETRIEVAL_K = 6;

/**
 * Similarité minimale du meilleur passage pour appeler le LLM. En dessous, la question
 * est considérée hors du guide et on répond « je ne sais pas » sans appel payant.
 * Calibré sur le jeu d'évaluation (questions hors sujet incluses) : voir eval/README.md.
 * Valeur propre au modèle multilingual-e5-small, dont les similarités sont tassées
 * entre ~0,75 et ~0,90 ; à recalibrer si l'on change de modèle.
 */
export const MIN_SIMILARITY: Record<string, number> = {
  "local:Xenova/multilingual-e5-small": 0.845,
  "voyage:voyage-4": 0.35,
};

/** Bonus de score pour les passages de la fiche que l'utilisateur est en train de lire. */
export const CURRENT_PAGE_BOOST = 0.02;

export class IndexNotReadyError extends Error {}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  topSimilarity: number | null;
  /** Le meilleur passage dépasse-t-il le seuil de pertinence ? */
  enoughContext: boolean;
}

/**
 * Texte utilisé pour la recherche. Une question de relance (« et pour la Belgique ? »)
 * n'a pas de sens seule : on la complète avec la question précédente de l'utilisateur.
 */
export function buildRetrievalQuery(question: string, history: HistoryMessage[]): string {
  const previous = [...history].reverse().find((m) => m.role === "user");
  return previous ? `${previous.content}\n${question}` : question;
}

export async function retrieve(
  deps: { db: Queryable; embeddings: EmbeddingProvider },
  query: string,
  options: { k?: number; minSimilarity?: number; currentPageId?: string } = {},
): Promise<RetrievalResult> {
  const k = options.k ?? RETRIEVAL_K;

  // Garde-fou : la question doit être vectorisée par le même modèle que les documents.
  const meta = await readIndexMeta(deps.db);
  if (!meta.embedding_model) {
    throw new IndexNotReadyError("L'index est vide : lancez `npm run ingest`.");
  }
  if (meta.embedding_model !== deps.embeddings.id) {
    throw new IndexNotReadyError(
      `L'index a été construit avec ${meta.embedding_model}, mais l'application utilise ` +
        `${deps.embeddings.id}. Relancez \`npm run ingest\`.`,
    );
  }

  const vector = await deps.embeddings.embedQuery(query);
  // On prend un peu plus de candidats pour pouvoir favoriser la fiche en cours de lecture.
  const candidates = await searchChunks(deps.db, vector, k * 2);
  const isCurrentPage = (c: RetrievedChunk) =>
    !!options.currentPageId &&
    (c.pageId === options.currentPageId || c.relatedPageId === options.currentPageId);
  const chunks = candidates
    .map((chunk) => ({ chunk, score: chunk.similarity + (isCurrentPage(chunk) ? CURRENT_PAGE_BOOST : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk }) => chunk);

  const topSimilarity = candidates[0]?.similarity ?? null;
  const minSimilarity = options.minSimilarity ?? MIN_SIMILARITY[deps.embeddings.id] ?? 0;
  return {
    chunks,
    topSimilarity,
    enoughContext: topSimilarity !== null && topSimilarity >= minSimilarity,
  };
}
