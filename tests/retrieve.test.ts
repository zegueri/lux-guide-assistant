import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, PGLITE_IN_MEMORY, type Db } from "@/lib/db/client";
import { insertChunks, writeIndexMeta } from "@/lib/db/chunks";
import { recreateSchema } from "@/lib/db/schema";
import { embeddingInput } from "@/lib/rag/chunker";
import { buildRetrievalQuery, IndexNotReadyError, retrieve } from "@/lib/rag/retrieve";
import type { Chunk } from "@/lib/rag/types";
import { createFakeEmbeddings } from "./helpers/fake-embeddings";

const embeddings = createFakeEmbeddings();

const chunk = (pageId: string, text: string): Chunk => ({
  id: `${pageId}:0`,
  pageId,
  relatedPageId: null,
  kind: "fiche",
  url: `https://lux-guide.github.io/#fiche/${pageId}`,
  pageTitle: pageId,
  section: null,
  category: null,
  paragraphs: [text],
});

// « transport » et « permis » ont chacun 4 mots dont « bus » (titre compris) : pour la
// question « bus », leurs similarités sont égales, ce qui permet de tester le bonus.
const CHUNKS = [
  chunk("transport", "Bus trains gratuits"),
  chunk("permis", "Bus examen conduite"),
  chunk("bail", "Garantie locative loyer"),
];

let db: Db;
let emptyDb: Db;

beforeAll(async () => {
  db = await createDb(PGLITE_IN_MEMORY);
  emptyDb = await createDb(PGLITE_IN_MEMORY);
  const vectors = await embeddings.embedDocuments(CHUNKS.map(embeddingInput));
  await db.transaction(async (tx) => {
    await recreateSchema(tx, embeddings.dimension);
    await insertChunks(tx, CHUNKS.map((c, i) => ({ chunk: c, embedding: vectors[i]! })));
    await writeIndexMeta(tx, { embedding_model: embeddings.id });
  });
});

afterAll(async () => {
  await Promise.all([db.close(), emptyDb.close()]);
});

describe("retrieve", () => {
  it("renvoie les k passages les plus proches et signale un contexte suffisant", async () => {
    const result = await retrieve({ db, embeddings }, "bus gratuits", { k: 2, minSimilarity: 0.1 });
    expect(result.chunks.map((c) => c.pageId)).toEqual(["transport", "permis"]);
    expect(result.enoughContext).toBe(true);
  });

  it("dit « contexte insuffisant » sous le seuil de similarité", async () => {
    const result = await retrieve({ db, embeddings }, "recette tarte pommes", { minSimilarity: 0.5 });
    expect(result.enoughContext).toBe(false);
  });

  it("favorise la fiche que l'utilisateur est en train de lire", async () => {
    const neutral = await retrieve({ db, embeddings }, "bus", { k: 2, minSimilarity: 0 });
    const second = neutral.chunks[1]!.pageId;
    const boosted = await retrieve({ db, embeddings }, "bus", {
      k: 2,
      minSimilarity: 0,
      currentPageId: second,
    });
    // Les deux passages ont presque le même score : le bonus fait passer la fiche lue devant.
    expect(boosted.chunks[0]!.pageId).toBe(second);
  });

  it("refuse d'interroger un index construit avec un autre modèle", async () => {
    const other = { ...createFakeEmbeddings(), id: "autre-modele" };
    await expect(retrieve({ db, embeddings: other }, "bus")).rejects.toThrow(IndexNotReadyError);
  });

  it("explique quoi faire quand l'index est vide", async () => {
    await expect(retrieve({ db: emptyDb, embeddings }, "bus")).rejects.toThrow(/npm run ingest/);
  });
});

describe("buildRetrievalQuery", () => {
  it("complète une question de relance avec la question précédente", () => {
    expect(
      buildRetrievalQuery("Et pour la Belgique ?", [
        { role: "user", content: "Télétravail des frontaliers français ?" },
        { role: "assistant", content: "..." },
      ]),
    ).toBe("Télétravail des frontaliers français ?\nEt pour la Belgique ?");
  });

  it("garde la question telle quelle sans historique", () => {
    expect(buildRetrievalQuery("Bus gratuit ?", [])).toBe("Bus gratuit ?");
  });
});
