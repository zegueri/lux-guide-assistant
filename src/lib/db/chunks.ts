import { chunkText } from "@/lib/rag/chunker";
import type { Chunk, RetrievedChunk } from "@/lib/rag/types";
import type { Queryable } from "./client";

/** pgvector lit un vecteur écrit comme un tableau texte : "[0.12,-0.03,...]". */
export function toVectorLiteral(vector: number[]): string {
  if (!vector.every(Number.isFinite)) throw new Error("Vecteur contenant NaN ou Infinity.");
  return `[${vector.join(",")}]`;
}

const COLUMNS = [
  "id",
  "page_id",
  "related_page_id",
  "kind",
  "url",
  "page_title",
  "section",
  "category",
  "paragraphs",
  "content",
  "embedding",
] as const;

/** Insère les morceaux par paquets (un INSERT de plusieurs lignes = moins d'allers-retours). */
export async function insertChunks(
  tx: Queryable,
  rows: Array<{ chunk: Chunk; embedding: number[] }>,
  batchSize = 50,
): Promise<void> {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const params: unknown[] = [];
    const tuples = batch.map(({ chunk, embedding }) => {
      const values = [
        chunk.id,
        chunk.pageId,
        chunk.relatedPageId,
        chunk.kind,
        chunk.url,
        chunk.pageTitle,
        chunk.section,
        chunk.category,
        JSON.stringify(chunk.paragraphs),
        chunkText(chunk),
        toVectorLiteral(embedding),
      ];
      const placeholders = values.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      // Les paramètres arrivent en texte : on précise le type des colonnes jsonb et vector.
      placeholders[8] += "::jsonb";
      placeholders[10] += "::vector";
      return `(${placeholders.join(", ")})`;
    });
    // Requête paramétrée : les valeurs ne sont jamais concaténées dans le SQL (pas d'injection).
    await tx.query(`INSERT INTO chunks (${COLUMNS.join(", ")}) VALUES ${tuples.join(", ")}`, params);
  }
}

export async function writeIndexMeta(tx: Queryable, meta: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(meta)) {
    await tx.query(
      `INSERT INTO index_meta (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
  }
}

/** Lit les métadonnées de l'index ; objet vide si l'ingestion n'a jamais été lancée. */
export async function readIndexMeta(db: Queryable): Promise<Record<string, string>> {
  try {
    const { rows } = await db.query<{ key: string; value: string }>(
      "SELECT key, value FROM index_meta",
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

interface ChunkRow {
  id: string;
  page_id: string;
  related_page_id: string | null;
  kind: "fiche" | "faq";
  url: string;
  page_title: string;
  section: string | null;
  category: string | null;
  paragraphs: unknown;
  similarity: number | string;
}

/**
 * Les k morceaux les plus proches du vecteur de la question.
 * `<=>` est la distance cosinus de pgvector (0 = même direction) ; la similarité vaut
 * donc 1 - distance. ORDER BY ... LIMIT k est la recherche des k plus proches voisins.
 */
export async function searchChunks(
  db: Queryable,
  queryEmbedding: number[],
  k: number,
): Promise<RetrievedChunk[]> {
  const { rows } = await db.query<ChunkRow>(
    `SELECT id, page_id, related_page_id, kind, url, page_title, section, category, paragraphs,
            1 - (embedding <=> $1::vector) AS similarity
       FROM chunks
      ORDER BY embedding <=> $1::vector
      LIMIT $2`,
    [toVectorLiteral(queryEmbedding), k],
  );
  return rows.map((row) => ({
    id: row.id,
    pageId: row.page_id,
    relatedPageId: row.related_page_id,
    kind: row.kind,
    url: row.url,
    pageTitle: row.page_title,
    section: row.section,
    category: row.category,
    paragraphs: Array.isArray(row.paragraphs) ? row.paragraphs.map(String) : [],
    similarity: Number(row.similarity),
  }));
}
