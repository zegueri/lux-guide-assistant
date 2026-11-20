import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, PGLITE_IN_MEMORY, type Db } from "@/lib/db/client";
import { insertChunks, readIndexMeta, searchChunks, toVectorLiteral, writeIndexMeta } from "@/lib/db/chunks";
import { recreateSchema } from "@/lib/db/schema";
import { embeddingInput } from "@/lib/rag/chunker";
import type { Chunk } from "@/lib/rag/types";
import { createFakeEmbeddings } from "./helpers/fake-embeddings";

/**
 * Recherche vectorielle de bout en bout sur un vrai Postgres + pgvector (PGlite en
 * mémoire) : même SQL qu'en production, sans service externe.
 */

const embeddings = createFakeEmbeddings();

function chunk(id: string, pageTitle: string, paragraphs: string[]): Chunk {
  return {
    id: `${id}:0`,
    pageId: id,
    relatedPageId: null,
    kind: "fiche",
    url: `https://lux-guide.github.io/#fiche/${id}`,
    pageTitle,
    section: "Introduction",
    category: null,
    paragraphs,
  };
}

const CHUNKS = [
  chunk("frontalier", "Habiter en France", ["Le télétravail des frontaliers est plafonné en jours."]),
  chunk("transport", "Les transports publics", ["Bus et trains sont gratuits dans tout le pays."]),
  chunk("bail", "Le bail d'habitation", ["La garantie locative est limitée à deux mois de loyer."]),
];

let db: Db;

beforeAll(async () => {
  db = await createDb(PGLITE_IN_MEMORY);
  const vectors = await embeddings.embedDocuments(CHUNKS.map(embeddingInput));
  await db.transaction(async (tx) => {
    await recreateSchema(tx, embeddings.dimension);
    await insertChunks(tx, CHUNKS.map((c, i) => ({ chunk: c, embedding: vectors[i]! })), 2);
    await writeIndexMeta(tx, { embedding_model: embeddings.id });
  });
});

afterAll(async () => {
  await db.close();
});

describe("searchChunks", () => {
  it("renvoie d'abord le morceau le plus proche de la question", async () => {
    const results = await searchChunks(db, await embeddings.embedQuery("transports gratuits ?"), 3);
    expect(results[0]?.pageId).toBe("transport");
  });

  it("respecte k et trie par similarité décroissante", async () => {
    const results = await searchChunks(db, await embeddings.embedQuery("garantie loyer bail"), 2);
    expect(results).toHaveLength(2);
    expect(results[0]?.pageId).toBe("bail");
    expect(results[0]!.similarity).toBeGreaterThanOrEqual(results[1]!.similarity);
  });

  it("relit les métadonnées et les paragraphes stockés en jsonb", async () => {
    const [top] = await searchChunks(db, await embeddings.embedQuery("télétravail frontaliers"), 1);
    expect(top).toMatchObject({
      url: "https://lux-guide.github.io/#fiche/frontalier",
      pageTitle: "Habiter en France",
      section: "Introduction",
      paragraphs: ["Le télétravail des frontaliers est plafonné en jours."],
    });
    expect(top!.similarity).toBeGreaterThan(0);
    expect(top!.similarity).toBeLessThanOrEqual(1.000001);
  });

  it("garde le modèle d'embeddings dans index_meta", async () => {
    expect(await readIndexMeta(db)).toEqual({ embedding_model: embeddings.id });
  });
});

describe("toVectorLiteral", () => {
  it("écrit le format attendu par pgvector", () => {
    expect(toVectorLiteral([0.5, -1, 0])).toBe("[0.5,-1,0]");
  });
  it("refuse NaN", () => {
    expect(() => toVectorLiteral([Number.NaN])).toThrow();
  });
});
