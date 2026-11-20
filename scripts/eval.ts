/**
 * Évaluation de la recherche : la bonne fiche remonte-t-elle dans les k premiers ?
 *
 *   npm run eval
 *
 * Pour chaque question du jeu (eval/questions.json) :
 * - question du guide : on cherche le rang de la première fiche attendue dans les
 *   10 premiers passages (un passage de FAQ compte s'il renvoie à la fiche attendue) ;
 * - question hors sujet : on vérifie que la meilleure similarité reste sous le seuil
 *   « je ne sais pas » (MIN_SIMILARITY), donc que le LLM ne serait pas appelé.
 *
 * Métriques : hit@k (part des questions dont la bonne fiche est dans les k premiers)
 * et MRR (moyenne de 1/rang : 1 si premier, 0,5 si deuxième...). On évalue la
 * recherche seule, sans LLM : gratuit, déterministe, et c'est le maillon décisif.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";

loadEnvConfig(process.cwd());

const questionsSchema = z.array(
  z.object({
    id: z.string(),
    theme: z.string(),
    question: z.string(),
    expected: z.array(z.string()),
  }),
);

const MAX_RANK = 10;
const KS = [1, 3, 5] as const;

interface QuestionResult {
  id: string;
  theme: string;
  question: string;
  expected: string[];
  /** Rang (1 à 10) de la première fiche attendue, null si absente. */
  rank: number | null;
  topSimilarity: number;
  topPage: string;
  /** La question franchit-elle le seuil (le LLM serait-il appelé) ? */
  aboveThreshold: boolean;
  latencyMs: number;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

async function main() {
  const { getConfig } = await import("@/lib/config");
  const { createEmbeddingProvider } = await import("@/lib/embeddings");
  const { createDb } = await import("@/lib/db/client");
  const { readIndexMeta, searchChunks } = await import("@/lib/db/chunks");
  const { MIN_SIMILARITY } = await import("@/lib/rag/retrieve");

  const questions = questionsSchema.parse(
    JSON.parse(fs.readFileSync(path.join(process.cwd(), "eval", "questions.json"), "utf8")),
  );
  const config = getConfig();
  const provider = createEmbeddingProvider(config);
  const threshold = MIN_SIMILARITY[provider.id] ?? 0;
  const db = await createDb(config.databaseUrl);

  try {
    const meta = await readIndexMeta(db);
    if (meta.embedding_model !== provider.id) {
      throw new Error(`Index construit avec ${meta.embedding_model ?? "rien"} : lancez npm run ingest.`);
    }
    await provider.embedQuery("préchauffage du modèle"); // le premier appel charge le modèle

    const results: QuestionResult[] = [];
    for (const q of questions) {
      const started = performance.now();
      const vector = await provider.embedQuery(q.question);
      const hits = await searchChunks(db, vector, MAX_RANK);
      const latencyMs = performance.now() - started;
      const index = hits.findIndex(
        (h) => q.expected.includes(h.pageId) || (h.relatedPageId !== null && q.expected.includes(h.relatedPageId)),
      );
      const top = hits[0];
      results.push({
        ...q,
        rank: index >= 0 ? index + 1 : null,
        topSimilarity: top?.similarity ?? 0,
        topPage: top ? (top.kind === "faq" ? `FAQ → ${top.relatedPageId}` : top.pageId) : "-",
        aboveThreshold: (top?.similarity ?? 0) >= threshold,
        latencyMs,
      });
    }

    const inScope = results.filter((r) => r.expected.length > 0);
    const outOfScope = results.filter((r) => r.expected.length === 0);
    const hitAt = (k: number) => inScope.filter((r) => r.rank !== null && r.rank <= k).length / inScope.length;
    const mrr = inScope.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / inScope.length;
    const metrics = {
      hitAt1: hitAt(1),
      hitAt3: hitAt(3),
      hitAt5: hitAt(5),
      mrr,
      inScopeAnswered: inScope.filter((r) => r.aboveThreshold).length / inScope.length,
      outOfScopeRejected: outOfScope.filter((r) => !r.aboveThreshold).length / outOfScope.length,
      avgLatencyMs: results.reduce((s, r) => s + r.latencyMs, 0) / results.length,
    };
    const minInScope = Math.min(...inScope.map((r) => r.topSimilarity));
    const maxOutOfScope = Math.max(...outOfScope.map((r) => r.topSimilarity));

    // --- Affichage console ---
    console.log(`\nModèle : ${provider.id} · index : ${meta.chunk_count} morceaux (max ${meta.max_chars} car.)`);
    console.log(`Questions du guide : ${inScope.length} · hors sujet : ${outOfScope.length}\n`);
    for (const k of KS) console.log(`hit@${k}  ${pct(hitAt(k))}`);
    console.log(`MRR    ${mrr.toFixed(3)}`);
    console.log(`\nSeuil « je ne sais pas » : ${threshold}`);
    console.log(`  questions du guide au-dessus du seuil : ${pct(metrics.inScopeAnswered)}`);
    console.log(`  questions hors sujet rejetées         : ${pct(metrics.outOfScopeRejected)}`);
    console.log(`  plus faible similarité (guide) ${minInScope.toFixed(3)} · plus forte (hors sujet) ${maxOutOfScope.toFixed(3)}`);
    console.log(`Latence moyenne (embedding + recherche) : ${metrics.avgLatencyMs.toFixed(0)} ms\n`);
    for (const r of results) {
      const status = r.expected.length === 0 ? (r.aboveThreshold ? "✗ non rejetée" : "✓ rejetée") : r.rank ? `rang ${r.rank}` : "✗ absente";
      console.log(`${r.id}  ${status.padEnd(14)} sim ${r.topSimilarity.toFixed(3)}  ${r.question}`);
    }

    // --- Fichiers de résultats (versionnés, cités dans le README) ---
    const generatedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(process.cwd(), "eval", "results.json"),
      JSON.stringify(
        { generatedAt, embeddingModel: provider.id, chunkCount: Number(meta.chunk_count), maxChars: Number(meta.max_chars), threshold, metrics, minInScope, maxOutOfScope, questions: results },
        null,
        2,
      ),
    );
    const rows = results
      .map((r) => {
        const verdict =
          r.expected.length === 0
            ? r.aboveThreshold ? "non rejetée ✗" : "rejetée ✓"
            : r.rank ? `rang ${r.rank}${r.rank === 1 ? " ✓" : ""}` : "absente ✗";
        const expected = r.expected.length ? r.expected.join(", ") : "—";
        return `| ${r.id} | ${r.theme} | ${r.question} | ${expected} | ${verdict} | ${r.topSimilarity.toFixed(3)} |`;
      })
      .join("\n");
    const md = `# Résultats de l'évaluation de la recherche

Généré par \`npm run eval\` le ${generatedAt.slice(0, 10)}.
Modèle d'embeddings : \`${provider.id}\` · ${meta.chunk_count} morceaux (taille max ${meta.max_chars} caractères).

## Métriques

| Métrique | Valeur |
|---|---|
| hit@1 | ${pct(metrics.hitAt1)} |
| hit@3 | ${pct(metrics.hitAt3)} |
| hit@5 | ${pct(metrics.hitAt5)} |
| MRR | ${mrr.toFixed(3)} |
| Questions du guide au-dessus du seuil (${threshold}) | ${pct(metrics.inScopeAnswered)} |
| Questions hors sujet rejetées | ${pct(metrics.outOfScopeRejected)} |
| Latence moyenne embedding + recherche | ${metrics.avgLatencyMs.toFixed(0)} ms |

Similarité du meilleur passage : la plus faible pour une question du guide est ${minInScope.toFixed(3)},
la plus forte pour une question hors sujet est ${maxOutOfScope.toFixed(3)}.

## Détail

| Id | Thème | Question | Fiche attendue | Résultat | Similarité max |
|---|---|---|---|---|---|
${rows}
`;
    fs.writeFileSync(path.join(process.cwd(), "eval", "results.md"), md);
    console.log("\nRésultats écrits dans eval/results.md et eval/results.json");
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
