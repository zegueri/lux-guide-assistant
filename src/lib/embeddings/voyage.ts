import { z } from "zod";
import { assertVectors, type EmbeddingProvider } from "./types";

/**
 * Embeddings Voyage AI, le fournisseur recommandé par la documentation d'Anthropic
 * (Anthropic ne propose pas de modèle d'embeddings). voyage-4 : multilingue, 1024 dim.
 * L'API est servie par MongoDB Atlas (https://ai.mongodb.com/v1).
 */

const MODEL = "voyage-4";
const DIMENSION = 1024;
const BATCH_SIZE = 64;

const responseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number() })),
});

export function createVoyageProvider(options: {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): EmbeddingProvider {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function embed(texts: string[], inputType: "query" | "document"): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const response = await fetchImpl(`${options.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        // input_type ajoute le bon préfixe côté Voyage (question ou document).
        body: JSON.stringify({
          input: batch,
          model: MODEL,
          input_type: inputType,
          output_dimension: DIMENSION,
        }),
      });
      if (!response.ok) {
        // On ne journalise jamais la clé ; le corps de l'erreur suffit à diagnostiquer.
        throw new Error(`Voyage AI : HTTP ${response.status} ${await response.text()}`);
      }
      const { data } = responseSchema.parse(await response.json());
      const ordered = [...data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      vectors.push(...assertVectors(ordered, batch.length, DIMENSION));
    }
    return vectors;
  }

  return {
    id: `voyage:${MODEL}`,
    dimension: DIMENSION,
    embedDocuments: (texts) => embed(texts, "document"),
    embedQuery: async (text) => (await embed([text], "query"))[0]!,
  };
}
