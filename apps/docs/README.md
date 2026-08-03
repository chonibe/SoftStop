# SoftStop Docs

Node.js ≥ 18, pnpm ≥ 8.

```bash
pnpm install
pnpm docs:dev      # http://localhost:5173
pnpm docs:build    # build + smoke
pnpm docs:preview
```

Deploy `apps/docs` as its **own** Vercel project (see `vercel.json`). Do not serve this from the demo project’s `outputDirectory: "demo"`.

Public IA lives here. Repo markdown under `/docs` at the monorepo root remains source material / internal notes.
