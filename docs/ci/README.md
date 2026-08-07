# CI

Canonical workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — runs `pnpm test:governor` on push/PR to `main`.

Badge: `https://github.com/chonibe/SoftStop/actions/workflows/ci.yml/badge.svg`

## Note on `workflow` OAuth scope

GitHub OAuth apps without the `workflow` scope cannot push `.github/workflows/*.yml`. Prefer a PAT / SSH deploy key with workflow write, or create the file in the GitHub UI once and then update via an allowed credential.

Historical copy path (if you still need it):

```bash
cp docs/ci/governor-tests.yml.example .github/workflows/ci.yml
```
