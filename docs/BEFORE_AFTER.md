# SoftStop before / after

## The failure mode

Three teams (or three agents) each push the same shopper in one session:

1. Lifecycle email — “Cart expires in 2 hours” (`urgency`)  
2. Product UI — upgrade modal (`interruption`)  
3. Growth SMS — “20% off today” (`discount`)  

Each decision is locally rational. Together they **stack pressure**. Frequency caps inside one ESP do not see the modal or the SMS. Agents make it worse.

## Before SoftStop (chaos)

```text
email  → send
modal  → show
sms    → send
         ─── 3/3 fired, user feels harassed
```

Reproduce:

```bash
pnpm dev   # repo root
cd examples/sample-shop && node index.js --mode=chaos
```

## After SoftStop (wired)

Every path asks SoftStop first, then records the outcome:

```text
email  → check(urgency)     → allow  → send  → record(executed)
modal  → check(interruption)→ deny   → skip  → record(blocked)
sms    → check(discount)    → deny   → skip  → record(blocked)
         ─── soft-stop; policy pack owns the caps
```

```bash
cd examples/sample-shop && node index.js --mode=softstop
# or full compare + health:
node index.js --mode=compare
```

## Adoption metrics (don’t ship false confidence)

After a SoftStop run, inspect health:

```bash
curl -s 'http://localhost:3000/v1/health?periodHours=1' | jq .metrics
```

| Metric | Healthy | Meaning |
|--------|---------|---------|
| `orphanRate` | &lt; 0.05 | Checks without a matching `record` |
| `blockRate` | ~0.05–0.40 | Soft-stops are actually firing |
| `healthScore` | &gt; 70 | Overall integration hygiene |

**False confidence:** SoftStop is only in email; modal still fires freely; dashboard looks fine. Wire **every** escalation touchpoint. See [ADOPTION_CONTRACT.md](ADOPTION_CONTRACT.md).

## What to change vs what not to

- **Do:** map each touchpoint to `urgency` / `discount` / `interruption` / `reminder`  
- **Do:** tune caps via `policies/*.json` or `SOFTSTOP_POLICY=strict`  
- **Don’t:** invent per-touchpoint ML or copy inside SoftStop — it only authorizes  

## Links

- Live scroll story: https://softstop.vercel.app (or `http://localhost:3000/demo`)  
- Sample shop: [examples/sample-shop](../examples/sample-shop)  
- Integration workflow: [GOVERNOR_INTEGRATION_WORKFLOW.md](GOVERNOR_INTEGRATION_WORKFLOW.md)
