# Troubleshooting

## SoftStop unreachable

```bash
pnpm dev
curl -X POST http://localhost:3000/v1/verify
```

Clients should point at `SOFTSTOP_API_URL=http://localhost:3000` locally.

## Everything allowed (never blocks)

- Confirm `record` runs after successful escalations (state never advances without it)  
- Check policy preset isn’t `lenient` for production  
- Confirm `actionType` isn’t always `reminder` with high caps  

## Everything blocked

- `strict` preset or custom file with very low caps  
- Stacking window after a recent hard escalation  
- Wrong `userId` collapsing many people into one  

## High orphan rate

See [Orphan rate](/ops/orphan-rate). Most often: blocked paths that skip `record`.

## Wrong path prefix (`/v1` vs `/api`)

| Host | Prefix |
|---|---|
| `localhost` / `127.0.0.1` | `/v1` |
| Hosted demo | `/api` |

The JS SDK picks this automatically from the URL hostname.

## Policy not loading

Precedence: `*_POLICY_FILE` → `*_POLICY` preset → builtins. Confirm with:

```bash
curl -s http://localhost:3000/v1/policy
```

## Still stuck

- [Adoption contract](/start/adoption-contract)  
- [Errors](/api/errors)  
- [GitHub issues](https://github.com/chonibe/SoftStop/issues)  
