# CLAUDE.md

Guide pour Claude Code (et pour tout développeur) qui travaille sur ce dépôt.

@AGENTS.md

## Le projet

Lux-Guide Assistant : chatbot RAG en Next.js qui répond en français, uniquement à partir
des fiches de https://lux-guide.github.io, en citant ses sources. Architecture et choix
argumentés : `docs/ARCHITECTURE.md`. Plan par phases : `docs/PLAN.md`.

## Commandes

```bash
npm run dev          # serveur de développement (http://localhost:3000)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (TypeScript strict)
npm test             # tests unitaires Vitest
npm run test:e2e     # test Playwright (API simulée, aucune clé nécessaire)
npm run ingest       # crawl du site -> découpage -> embeddings -> base
npm run search -- "question"   # affiche les passages les plus proches
npm run eval         # mesure hit@k / MRR de la recherche sur eval/questions.json
```

## Règles

- **Secrets** : uniquement dans `.env.local` (ignoré par Git). Ne jamais écrire une clé
  dans le code, un test, un commit ou un log. Toute nouvelle variable va dans
  `.env.example` (sans valeur) et dans `src/lib/config.ts` (validation zod).
- **TypeScript strict** : pas de `any`, pas de `@ts-ignore`. Les types de l'API Claude
  viennent du SDK (`Anthropic.Beta...`), pas de redéfinition maison.
- **Claude** : SDK officiel `@anthropic-ai/sdk`, modèle `claude-opus-5-5`, streaming,
  `output_config.effort`, gestion de `stop_reason === "refusal"`. Ne pas utiliser
  `budget_tokens` ni `thinking: {type: "disabled"}` (refusés par Opus 5.5).
- **Embeddings** : la question et les documents doivent venir du même modèle. Changer
  `EMBEDDING_PROVIDER` impose `npm run ingest`.
- **Base** : `DATABASE_URL` vide = PGlite local dans `.data/pglite` ; sinon Postgres
  (Neon). Le SQL doit rester compatible avec les deux. PGlite n'accepte **qu'un seul
  processus** à la fois : arrêter `npm run dev` avant `npm run ingest`, `search` ou `eval`.
- **Seuil « je ne sais pas »** (`MIN_SIMILARITY` dans `src/lib/rag/retrieve.ts`) : propre
  au modèle d'embeddings ; le recalibrer avec `npm run eval` après tout changement.
- **Langue** : interface, prompts et réponses en français. Commentaires de code en
  français, identifiants en anglais.
- **Next.js 16** : `cacheComponents` est activé ; pas d'export `runtime` dans les routes.
  Lire `node_modules/next/dist/docs/` avant d'utiliser une API Next inconnue.
- **Commits** : petits, au présent, préfixés (`feat:`, `fix:`, `test:`, `docs:`, `chore:`,
  `ci:`). Lancer lint + typecheck + tests avant de committer.

## Structure

- `src/app/` : pages et Route Handlers (`api/chat/route.ts`).
- `src/components/` : composants React (client).
- `src/lib/` : logique métier testable sans Next (crawler, rag, embeddings, db, chat).
- `scripts/` : ingestion, recherche et évaluation (lancés avec `tsx`).
- `tests/` : Vitest ; `e2e/` : Playwright ; `eval/` : jeu d'évaluation et résultats.
