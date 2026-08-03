# SoftStop CI (example)

GitHub OAuth apps without the `workflow` scope cannot push `.github/workflows/*.yml`.

To enable CI:

1. Copy this file to `.github/workflows/ci.yml`
2. Push with a token that has the `workflow` scope, or add the file via the GitHub UI

```bash
cp docs/ci/governor-tests.yml.example .github/workflows/ci.yml
```

Then rename the workflow `name:` to SoftStop Tests if desired.
