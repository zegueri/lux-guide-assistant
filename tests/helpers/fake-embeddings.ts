import type { EmbeddingProvider } from "@/lib/embeddings/types";

/**
 * Faux fournisseur d'embeddings, déterministe et instantané, pour les tests.
 * Chaque mot est haché vers une des `dimension` cases (« sac de mots ») : deux textes
 * qui partagent des mots ont des vecteurs proches. Aucun modèle à télécharger.
 */
export function createFakeEmbeddings(dimension = 64): EmbeddingProvider {
  const embed = (text: string): number[] => {
    const vector = new Array<number>(dimension).fill(0);
    const words = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[a-z0-9]{3,}/g) ?? [];
    for (const word of words) {
      let hash = 0;
      for (const char of word) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      vector[hash % dimension]! += 1;
    }
    const norm = Math.hypot(...vector) || 1;
    return vector.map((x) => x / norm);
  };
  return {
    id: `fake:bag-of-words-${dimension}`,
    dimension,
    embedDocuments: async (texts) => texts.map(embed),
    embedQuery: async (text) => embed(text),
  };
}
