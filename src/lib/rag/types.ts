import type { PageKind } from "@/lib/crawler/types";

/**
 * Un morceau (« chunk ») : l'unité que l'on vectorise, stocke et retrouve.
 * Il garde ses paragraphes séparés pour que Claude puisse citer un paragraphe précis.
 */
export interface Chunk {
  /** `${pageId}:${index}`, stable tant que la page ne change pas. */
  id: string;
  pageId: string;
  /** Fiche liée (pour une question de FAQ), sinon null. */
  relatedPageId: string | null;
  kind: PageKind;
  url: string;
  pageTitle: string;
  /** Nom de la section (« À retenir », un sous-titre...), null pour une FAQ. */
  section: string | null;
  category: string | null;
  paragraphs: string[];
}

/** Un morceau retrouvé par la recherche, avec sa similarité cosinus (1 = identique). */
export interface RetrievedChunk extends Chunk {
  similarity: number;
}
