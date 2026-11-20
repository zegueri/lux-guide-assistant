/**
 * Ingestion : crawl du site -> découpage -> embeddings -> base Postgres/pgvector.
 *
 *   npm run ingest                  # crawl complet puis indexation
 *   npm run ingest -- --cache       # réutilise le dernier crawl (.data/pages.json)
 *   npm run ingest -- --max-chars 800
 *
 * L'ingestion reconstruit tout l'index dans une transaction : pendant l'opération,
 * l'application continue de lire l'ancien index ; à la fin, le nouveau le remplace.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import type { GuidePage } from "@/lib/crawler/types";

loadEnvConfig(process.cwd()); // lit .env.local comme le fait Next.js

const CACHE_FILE = path.join(process.cwd(), ".data", "pages.json");

async function main() {
  const { values } = parseArgs({
    options: {
      cache: { type: "boolean", default: false },
      "max-chars": { type: "string" },
      limit: { type: "string" },
      delay: { type: "string", default: "1000" },
    },
  });

  // Imports après loadEnvConfig : la configuration lit process.env.
  const { getConfig } = await import("@/lib/config");
  const { crawlGuide } = await import("@/lib/crawler/crawl");
  const { chunkPage, embeddingInput, DEFAULT_CHUNKER_OPTIONS } = await import("@/lib/rag/chunker");
  const { createEmbeddingProvider } = await import("@/lib/embeddings");
  const { createDb } = await import("@/lib/db/client");
  const { recreateSchema } = await import("@/lib/db/schema");
  const { insertChunks, writeIndexMeta } = await import("@/lib/db/chunks");

  const config = getConfig();
  const started = Date.now();

  // 1. Crawl (ou cache du dernier crawl).
  let pages: GuidePage[];
  if (values.cache && fs.existsSync(CACHE_FILE)) {
    pages = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as GuidePage[];
    console.log(`Pages lues depuis le cache : ${pages.length}`);
  } else {
    console.log("Crawl de lux-guide.github.io...");
    pages = await crawlGuide({
      delayMs: Number(values.delay),
      limit: values.limit ? Number(values.limit) : undefined,
      log: (m) => console.log(`  ${m}`),
    });
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(pages, null, 2));
  }

  // 2. Découpage.
  const options = {
    ...DEFAULT_CHUNKER_OPTIONS,
    ...(values["max-chars"] ? { maxChars: Number(values["max-chars"]) } : {}),
  };
  const chunks = pages.flatMap((page) => chunkPage(page, options));
  const sizes = chunks.map((c) => c.paragraphs.join("\n\n").length);
  console.log(
    `${chunks.length} morceaux (taille max ${options.maxChars}) : ` +
      `moyenne ${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)} car., ` +
      `min ${Math.min(...sizes)}, max ${Math.max(...sizes)}`,
  );

  // 3. Embeddings.
  const provider = createEmbeddingProvider(config);
  console.log(`Embeddings avec ${provider.id} (dimension ${provider.dimension})...`);
  const embeddings = await provider.embedDocuments(chunks.map(embeddingInput));

  // 4. Écriture dans la base, en une transaction.
  const db = await createDb(config.databaseUrl);
  try {
    await db.transaction(async (tx) => {
      await recreateSchema(tx, provider.dimension);
      await insertChunks(
        tx,
        chunks.map((chunk, i) => ({ chunk, embedding: embeddings[i]! })),
      );
      await writeIndexMeta(tx, {
        embedding_model: provider.id,
        dimension: String(provider.dimension),
        chunk_count: String(chunks.length),
        page_count: String(pages.length),
        max_chars: String(options.maxChars),
        ingested_at: new Date().toISOString(),
      });
    });
  } finally {
    await db.close();
  }

  const fiches = pages.filter((p) => p.kind === "fiche").length;
  console.log(
    `Terminé en ${((Date.now() - started) / 1000).toFixed(1)} s : ${fiches} fiches, ` +
      `${pages.length - fiches} questions de FAQ, ${chunks.length} morceaux dans ${db.kind}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
