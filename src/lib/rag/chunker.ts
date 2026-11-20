import type { GuidePage } from "@/lib/crawler/types";
import type { Chunk } from "./types";

/**
 * Découpage des pages en morceaux, en suivant leur structure.
 *
 * Règles :
 * - un morceau = une section (un sous-titre et ses paragraphes) ;
 * - l'introduction (chapô + paragraphes avant le premier sous-titre) forme un morceau ;
 * - l'encadré « À retenir » forme un morceau ;
 * - une section trop longue est coupée entre deux paragraphes, avec un paragraphe de
 *   recouvrement pour ne pas perdre le fil ;
 * - un paragraphe seul trop long est coupé entre deux phrases.
 */

export interface ChunkerOptions {
  /** Taille maximale visée d'un morceau, en caractères (~4 caractères par token). */
  maxChars: number;
  /** Nombre de paragraphes repris au début du morceau suivant. */
  overlapParagraphs: number;
}

export const DEFAULT_CHUNKER_OPTIONS: ChunkerOptions = { maxChars: 1200, overlapParagraphs: 1 };

/** Longueur du texte d'un groupe de paragraphes, séparés par une ligne vide. */
function joinedLength(paragraphs: string[]): number {
  return paragraphs.reduce((sum, p) => sum + p.length, 0) + Math.max(0, paragraphs.length - 1) * 2;
}

/** Coupe un paragraphe trop long entre deux phrases. */
export function splitLongParagraph(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph];
  const sentences = paragraph.match(/[^.!?]+(?:[.!?]+|$)\s*/g) ?? [paragraph];
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxChars) {
      parts.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Regroupe des paragraphes en fenêtres d'au plus `maxChars` caractères.
 * Chaque fenêtre contient au moins un paragraphe nouveau, ce qui garantit d'avancer
 * même si un paragraphe dépasse la limite à lui seul.
 */
export function groupParagraphs(paragraphs: string[], options: ChunkerOptions): string[][] {
  const pieces = paragraphs.flatMap((p) => splitLongParagraph(p, options.maxChars));
  const windows: string[][] = [];
  let current: string[] = [];
  let newInCurrent = 0;

  for (const piece of pieces) {
    if (newInCurrent > 0 && joinedLength([...current, piece]) > options.maxChars) {
      windows.push(current);
      // Recouvrement : on reprend les derniers paragraphes, sauf s'ils remplissent déjà tout.
      const overlap = options.overlapParagraphs > 0 ? current.slice(-options.overlapParagraphs) : [];
      current = joinedLength([...overlap, piece]) <= options.maxChars ? [...overlap] : [];
      newInCurrent = 0;
    }
    current.push(piece);
    newInCurrent++;
  }
  if (newInCurrent > 0) windows.push(current);
  return windows;
}

/** Découpe une page du guide en morceaux prêts à être vectorisés. */
export function chunkPage(
  page: GuidePage,
  options: ChunkerOptions = DEFAULT_CHUNKER_OPTIONS,
): Chunk[] {
  const parts: Array<{ section: string | null; paragraphs: string[] }> = [];

  page.sections.forEach((section, index) => {
    const isIntro = index === 0 && section.heading === null;
    const paragraphs =
      isIntro && page.summary ? [page.summary, ...section.paragraphs] : section.paragraphs;
    const name = section.heading ?? (page.kind === "fiche" ? "Introduction" : null);
    parts.push({ section: name, paragraphs });
  });
  // Fiche sans paragraphe d'introduction : le chapô forme quand même son morceau.
  if (page.summary && page.sections[0]?.heading !== null) {
    parts.unshift({ section: "Introduction", paragraphs: [page.summary] });
  }
  if (page.keyPoints.length > 0) {
    parts.push({ section: "À retenir", paragraphs: page.keyPoints });
  }

  const chunks: Chunk[] = [];
  for (const part of parts) {
    for (const paragraphs of groupParagraphs(part.paragraphs, options)) {
      chunks.push({
        id: `${page.pageId}:${chunks.length}`,
        pageId: page.pageId,
        relatedPageId: page.relatedPageId,
        kind: page.kind,
        url: page.url,
        pageTitle: page.title,
        section: part.section,
        category: page.category,
        paragraphs,
      });
    }
  }
  return chunks;
}

/** Texte complet d'un morceau (paragraphes séparés par une ligne vide). */
export function chunkText(chunk: Pick<Chunk, "paragraphs">): string {
  return chunk.paragraphs.join("\n\n");
}

/**
 * Texte réellement vectorisé : on ajoute le titre de la page et de la section en tête.
 * Un paragraphe isolé (« Le délai est de huit jours ») est ambigu ; avec son contexte
 * (« Les huit premiers jours — Trois délais, pas un seul »), il est bien mieux retrouvé.
 */
export function embeddingInput(chunk: Chunk): string {
  const heading = chunk.section ? `${chunk.pageTitle} — ${chunk.section}` : chunk.pageTitle;
  return `${heading}\n${chunkText(chunk)}`;
}
