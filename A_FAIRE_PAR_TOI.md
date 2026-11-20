# Ce qui t'attend (actions que je ne peux pas faire à ta place)

1. **Clé Anthropic** : crée une clé sur https://platform.claude.com, puis
   `cp .env.example .env.local` et remplis `ANTHROPIC_API_KEY=`. Teste : `npm run dev`,
   pose une question. Le coût de chaque question s'affiche dans le terminal (`[chat] ... ~$...`).
2. **Base Neon** (gratuite) : crée un projet sur https://neon.tech, copie la chaîne de
   connexion *pooled* dans `DATABASE_URL=` de `.env.local`, puis `npm run ingest -- --cache`
   (remplit Neon avec le crawl déjà fait). Remets `DATABASE_URL=` vide pour revenir à PGlite.
3. **Vercel** : importe le dépôt GitHub sur https://vercel.com/new, ajoute les variables
   `ANTHROPIC_API_KEY` et `DATABASE_URL` (Neon), déploie. Si la première question échoue
   ou est trop lente (modèle e5 téléchargé au démarrage à froid), passe à Voyage :
   `EMBEDDING_PROVIDER=voyage` + `VOYAGE_API_KEY`, relance `npm run ingest -- --cache`
   contre Neon, recalibre le seuil avec `npm run eval` (valeur `voyage:voyage-4` dans
   `src/lib/rag/retrieve.ts`).
4. **Dépôt GitHub** : il est **privé**. Passe-le en public quand tu as relu
   (Settings > General > Change visibility).
5. **Vérifier la CI** : onglet Actions du dépôt ; elle doit être verte.
6. **Me donner l'URL Vercel** pour finir le README (FR/EN) et les lignes de CV.

Points d'arrêt à valider (voir `docs/PLAN.md`) : phases 0 à 4 faites, phase 5 partielle.
