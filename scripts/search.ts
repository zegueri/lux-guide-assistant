/**
 * Recherche en ligne de commande, pour vérifier l'index sans passer par le LLM.
 *
 *   npm run search -- "combien de jours de télétravail pour un frontalier ?"
 *   npm run search -- "ma question" --k 8
 */
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { k: { type: "string", default: "5" } },
  });
  const question = positionals.join(" ").trim();
  if (!question) throw new Error('Usage : npm run search -- "votre question"');

  const { getConfig } = await import("@/lib/config");
  const { createEmbeddingProvider } = await import("@/lib/embeddings");
  const { createDb } = await import("@/lib/db/client");
  const { searchChunks } = await import("@/lib/db/chunks");

  const config = getConfig();
  const provider = createEmbeddingProvider(config);
  const db = await createDb(config.databaseUrl);
  try {
    const embedding = await provider.embedQuery(question);
    const results = await searchChunks(db, embedding, Number(values.k));
    for (const [i, r] of results.entries()) {
      console.log(
        `\n#${i + 1}  similarité ${r.similarity.toFixed(3)}  [${r.kind}] ${r.pageTitle}` +
          (r.section ? ` — ${r.section}` : ""),
      );
      console.log(`    ${r.url}`);
      console.log(`    ${r.paragraphs.join(" ").slice(0, 220)}...`);
    }
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
