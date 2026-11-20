/**
 * Un fournisseur d'embeddings transforme un texte en vecteur de nombres.
 * Deux textes proches par le sens donnent des vecteurs proches (similarité cosinus).
 *
 * Questions et documents sont vectorisés différemment (préfixe « query: » / « passage: »
 * pour e5, paramètre input_type pour Voyage) : d'où deux méthodes distinctes.
 */
export interface EmbeddingProvider {
  /** Identifiant du modèle, stocké dans la base pour détecter un mélange de modèles. */
  readonly id: string;
  readonly dimension: number;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

/** Vérifie qu'une sortie de modèle est bien une liste de vecteurs de la bonne taille. */
export function assertVectors(value: unknown, count: number, dimension: number): number[][] {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error(`Embeddings : ${count} vecteurs attendus.`);
  }
  for (const vector of value) {
    if (
      !Array.isArray(vector) ||
      vector.length !== dimension ||
      !vector.every((x) => typeof x === "number" && Number.isFinite(x))
    ) {
      throw new Error(`Embeddings : vecteur invalide (dimension ${dimension} attendue).`);
    }
  }
  return value as number[][];
}
