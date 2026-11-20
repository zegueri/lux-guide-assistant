import { connection } from "next/server";
import { getConfig } from "@/lib/config";
import { readIndexMeta } from "@/lib/db/chunks";
import { getSharedDb } from "@/lib/db/client";
import { MODEL } from "@/lib/rag/answer";

/**
 * GET /api/status : état de l'index, affiché en pied de page
 * (« 196 passages indexés le ... »). Ne renvoie aucun secret.
 */
export async function GET(): Promise<Response> {
  // Réponse calculée à chaque requête (jamais pré-rendue au moment du build).
  await connection();
  try {
    const config = getConfig();
    const meta = await readIndexMeta(await getSharedDb(config.databaseUrl));
    return Response.json({
      ready: Boolean(meta.embedding_model),
      chunkCount: Number(meta.chunk_count ?? 0),
      pageCount: Number(meta.page_count ?? 0),
      embeddingModel: meta.embedding_model ?? null,
      ingestedAt: meta.ingested_at ?? null,
      model: MODEL,
      llmConfigured: Boolean(config.anthropicApiKey),
    });
  } catch (error) {
    console.error("Statut indisponible", error);
    return Response.json({ ready: false }, { status: 503 });
  }
}
