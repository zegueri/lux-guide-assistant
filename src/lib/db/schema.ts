import type { Queryable } from "./client";

/**
 * Schéma de l'index.
 *
 * - `chunks` : un morceau par ligne, avec ses métadonnées et son vecteur (pgvector).
 *   La dimension du vecteur dépend du modèle d'embeddings (384 pour e5-small, 1024 pour
 *   voyage-4) : la table est donc recréée à chaque ingestion.
 * - `index_meta` : informations sur l'index (modèle utilisé, date...), lues à chaque
 *   question pour vérifier qu'on interroge avec le même modèle qu'à l'ingestion.
 */
export async function recreateSchema(tx: Queryable, dimension: number): Promise<void> {
  if (!Number.isInteger(dimension) || dimension < 1 || dimension > 4000) {
    throw new Error(`Dimension d'embedding invalide : ${dimension}`);
  }
  await tx.query("CREATE EXTENSION IF NOT EXISTS vector");
  await tx.query("DROP TABLE IF EXISTS chunks");
  await tx.query(`
    CREATE TABLE chunks (
      id              text PRIMARY KEY,
      page_id         text NOT NULL,
      related_page_id text,
      kind            text NOT NULL CHECK (kind IN ('fiche', 'faq')),
      url             text NOT NULL,
      page_title      text NOT NULL,
      section         text,
      category        text,
      paragraphs      jsonb NOT NULL,
      content         text NOT NULL,
      embedding       vector(${dimension}) NOT NULL
    )
  `);
  // Index HNSW : recherche approchée des plus proches voisins en distance cosinus.
  // Inutile à quelques centaines de lignes (un parcours complet est instantané), mais
  // c'est ce qui permettrait de passer à des millions de morceaux.
  await tx.query(
    "CREATE INDEX chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops)",
  );
  await tx.query(`
    CREATE TABLE IF NOT EXISTS index_meta (
      key   text PRIMARY KEY,
      value text NOT NULL
    )
  `);
  await tx.query("DELETE FROM index_meta");
}
