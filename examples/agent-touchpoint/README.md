# SoftStop agent touchpoint

Call SoftStop **before** an agent escalates pressure on a human (email, SMS, modal).

Uses SDK `beforeContact` (check → act → record).

```bash
pnpm --filter softstop build
pnpm dev   # repo root

cd examples/agent-touchpoint
node index.js
```

For a reusable tool wrapper, see [agent-tool-wrapper](../agent-tool-wrapper).
