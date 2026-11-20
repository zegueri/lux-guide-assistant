import path from "node:path";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import { assertVectors, type EmbeddingProvider } from "./types";

/**
 * Embeddings calculés localement avec transformers.js (ONNX Runtime), sans clé API.
 *
 * Modèle : multilingual-e5-small (384 dimensions, ~120 Mo en version quantifiée int8),
 * entraîné sur une centaine de langues dont le français. Les modèles e5 attendent un
 * préfixe : « query: » pour une question, « passage: » pour un document.
 */

const MODEL = "Xenova/multilingual-e5-small";
const BATCH_SIZE = 16;

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

/** Charge le modèle une seule fois par processus (le premier appel le télécharge). */
function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    // Sur Vercel, seul /tmp est accessible en écriture ; en local, on range le modèle
    // dans .data/models (ignoré par Git).
    env.cacheDir = process.env.VERCEL
      ? "/tmp/transformers-cache"
      : path.join(process.cwd(), ".data", "models");
    return pipeline("feature-extraction", MODEL, { dtype: "q8" });
  })().catch((error: unknown) => {
    extractorPromise = undefined; // on retentera au prochain appel
    throw error;
  });
  return extractorPromise;
}

async function embed(texts: string[], prefix: "query: " | "passage: "): Promise<number[][]> {
  const extractor = await getExtractor();
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => prefix + t);
    // Moyenne des vecteurs de tokens (mean pooling) puis normalisation à la longueur 1 :
    // la similarité cosinus devient alors un simple produit scalaire.
    const output = await extractor(batch, { pooling: "mean", normalize: true });
    vectors.push(...assertVectors(output.tolist(), batch.length, localProvider.dimension));
  }
  return vectors;
}

export const localProvider: EmbeddingProvider = {
  id: `local:${MODEL}`,
  dimension: 384,
  embedDocuments: (texts) => embed(texts, "passage: "),
  embedQuery: async (text) => (await embed([text], "query: "))[0]!,
};
