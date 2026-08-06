# SoftStop sample shop

A tiny commerce-shaped demo: three systems escalate the **same** shopper (urgency email, upgrade modal, discount SMS).

## Run

```bash
# terminal 1 — repo root
pnpm install
pnpm dev

# terminal 2
cd examples/sample-shop
node index.js --mode=compare
```

Modes:

| Flag | Behavior |
|------|----------|
| `--mode=chaos` | No SoftStop — all three escalations fire |
| `--mode=softstop` | SoftStop check/record on each path |
| `--mode=compare` | Both, then print `/health` (orphan rate, block rate) |

## What you should see

- **Chaos:** 3/3 sent — stacked pressure  
- **SoftStop:** first urgency may allow; interruption/discount often **blocked** (stack / caps)  
- **Health:** `orphanRate` near 0 when every check has a record  

Write-up: [docs/BEFORE_AFTER.md](../../docs/BEFORE_AFTER.md)
