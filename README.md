# Lux-Guide Assistant

Assistant en français qui répond aux questions sur l'installation et le travail au
Luxembourg **uniquement à partir du guide [lux-guide.github.io](https://lux-guide.github.io)**,
en citant ses sources. Next.js + RAG (pgvector) + Claude.

> Projet en cours de construction. Architecture et choix : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
> Plan par phases : [docs/PLAN.md](docs/PLAN.md).

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner ANTHROPIC_API_KEY
npm run dev
```
