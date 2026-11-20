import type { AppConfig } from "@/lib/config";
import { localProvider } from "./local";
import type { EmbeddingProvider } from "./types";
import { createVoyageProvider } from "./voyage";

export type { EmbeddingProvider } from "./types";

/** Choisit le fournisseur d'embeddings selon EMBEDDING_PROVIDER. */
export function createEmbeddingProvider(
  config: Pick<AppConfig, "embeddingProvider" | "voyageApiKey" | "voyageBaseUrl">,
): EmbeddingProvider {
  if (config.embeddingProvider === "voyage") {
    if (!config.voyageApiKey) throw new Error("VOYAGE_API_KEY manquante.");
    return createVoyageProvider({ apiKey: config.voyageApiKey, baseUrl: config.voyageBaseUrl });
  }
  return localProvider;
}
