# Actions de l'auteur

## Fait

- Clé API Claude créée (platform.claude.com) et ajoutée à Vercel et à `.env.local`.
- Base Neon créée et remplie (`npm run ingest -- --cache`), `DATABASE_URL` sur Vercel.
- Projet Vercel relié au dépôt GitHub : https://lux-guide-assistant.vercel.app
- Dépôt GitHub public.

## Reste conseillé

1. **Plafond de dépense** dans la console Anthropic (Settings > Limits), par exemple 5 $
   par mois, si ce n'est pas déjà fait.
2. **Double authentification Vercel** :
   https://vercel.com/account/settings/authentication?setup=authenticator
3. Pour mettre l'index à jour quand le site change : `npm run ingest` (avec `DATABASE_URL`
   de Neon dans `.env.local`), puis `npm run eval` pour vérifier les scores.
