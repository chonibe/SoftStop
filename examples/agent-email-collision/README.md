# Agent + email collision (golden path)

Same human. Two actors. SoftStop tracks **user pressure**.

1. Sales agent wants to send an urgency email (+40)
2. Marketing wants to send a discount SMS (+30)
3. Support bot wants an in-app interruption (+25)

Fake sends only. SoftStop must be running.

```bash
# terminal 1 — repo root
pnpm install
pnpm dev

# terminal 2
cd examples/agent-email-collision
node index.js
```

You should see pressure fields on each `check`, a `GET .../pressure` readout between steps, and later contacts blocked when projected pressure exceeds the threshold (or stacking/caps fire first).

Env:

| Variable | Default |
|----------|---------|
| `SOFTSTOP_API_URL` | `http://localhost:3000` |
| `SOFTSTOP_DEMO_USER` | `lead_<timestamp>` |
