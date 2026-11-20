# Plan par phases

Chaque phase se termine par un **point d'arrêt** : ce qu'il faut tester pour la valider.

## Phase 0 — Plan, architecture, création du projet

- Lecture du sujet officiel (sujet n°3 : chatbot pour les nouveaux arrivants).
- Exploration du site : application à page unique, 36 fiches + 55 questions de FAQ,
  pas de `robots.txt` (404 = tout autorisé), pas de sitemap.
- Choix argumentés : `docs/ARCHITECTURE.md`.
- Projet Next.js 16 (App Router, TypeScript strict, Tailwind 4), dépôt Git, GitHub,
  `CLAUDE.md`, `.env.example`.

**Point d'arrêt** : `npm install && npm run dev`, la page s'affiche sur
http://localhost:3000.

## Phase 1 — Ingestion et index

- `src/lib/crawler/` : lecture de `robots.txt`, rendu des fiches avec Playwright,
  extraction titre / sections / paragraphes / FAQ.
- `src/lib/rag/chunker.ts` : découpage par section avec métadonnées.
- `src/lib/embeddings/` : fournisseur local (transformers.js) et Voyage AI.
- `src/lib/db/` : schéma pgvector, client `pg` ou PGlite.
- `scripts/ingest.ts` : chaîne complète, idempotente.

**Point d'arrêt** : `npm run ingest` remplit la base ; `npm run search -- "ma question"`
affiche les passages les plus proches.

## Phase 2 — API de chat RAG avec citations

- `src/lib/rag/retrieve.ts` : k plus proches voisins, seuil « je ne sais pas ».
- `src/lib/rag/prompt.ts` : prompt système, blocs `search_result`.
- `src/app/api/chat/route.ts` : streaming NDJSON, citations, refus, erreurs.

**Point d'arrêt** : avec `ANTHROPIC_API_KEY`, une requête `curl` sur `/api/chat` renvoie
un flux avec texte et citations.

## Phase 3 — Interface

- Chat en streaming, rendu Markdown, citations numérotées, cartes de sources avec lien
  « ouvrir et surligner », exemples de questions, bouton stop, mode sombre.

**Point d'arrêt** : poser une question dans le navigateur, cliquer une source.

## Phase 4 — Évaluation, tests, CI

- `eval/questions.json` (15-20 questions + questions hors sujet), `scripts/eval.ts`.
- Tests Vitest, test Playwright, workflow GitHub Actions.

**Point d'arrêt** : `npm test`, `npm run test:e2e`, `npm run eval` passent ; la CI est
verte sur GitHub.

## Phase 5 — Déploiement et README

- Vercel (variables d'environnement, base Neon, ingestion sur Neon).
- README français / anglais, schéma, compromis, résultats, lancement, lien de démo.
- Deux lignes de CV.

**Point d'arrêt** : l'URL publique répond à une question avec ses sources.
