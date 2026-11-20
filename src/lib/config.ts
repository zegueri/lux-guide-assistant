import { z } from "zod";

/**
 * Lecture et validation des variables d'environnement, en un seul endroit.
 * Si une variable est absente ou mal formée, on échoue tôt avec un message clair
 * plutôt que de découvrir l'erreur au milieu d'une requête.
 */

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(["local", "voyage"]).default("local"),
  VOYAGE_API_KEY: z.string().optional(),
  VOYAGE_BASE_URL: z.url().default("https://ai.mongodb.com/v1"),
});

export type EmbeddingProviderName = "local" | "voyage";

export interface AppConfig {
  anthropicApiKey: string | undefined;
  /** Vide = PGlite local ; sinon chaîne de connexion Postgres (Neon, Supabase...). */
  databaseUrl: string | undefined;
  embeddingProvider: EmbeddingProviderName;
  voyageApiKey: string | undefined;
  voyageBaseUrl: string;
}

/** Dans un fichier .env, `CLE=` donne une chaîne vide : on la traite comme absente. */
function dropEmptyValues(env: Record<string, string | undefined>) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const trimmed = value?.trim();
    if (trimmed) cleaned[key] = trimmed;
  }
  return cleaned;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(dropEmptyValues(env));
  if (!parsed.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  if (e.EMBEDDING_PROVIDER === "voyage" && !e.VOYAGE_API_KEY) {
    throw new Error("EMBEDDING_PROVIDER=voyage nécessite VOYAGE_API_KEY dans .env.local.");
  }
  return {
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    databaseUrl: e.DATABASE_URL,
    embeddingProvider: e.EMBEDDING_PROVIDER,
    voyageApiKey: e.VOYAGE_API_KEY,
    voyageBaseUrl: e.VOYAGE_BASE_URL,
  };
}

let cached: AppConfig | undefined;

/** Configuration du processus courant, lue une seule fois (lecture paresseuse). */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}
