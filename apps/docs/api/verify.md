# verify

Smoke-test that SoftStop API + storage can complete a check/record round-trip.

| Environment | Method | Path |
|---|---|---|
| Local | `POST` | `/v1/verify` |
| Hosted | `POST` | `/api/verify` |

## Success

```json
{
  "ok": true,
  "decisionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Integration verification passed"
}
```

## CLI

```bash
SOFTSTOP_API_URL=http://localhost:3000 pnpm softstop verify
```

## When to run

- After first local boot  
- After wiring touchpoints  
- In CI before claiming SoftStop is integrated  

`verify` alone is not enough — also watch [health](/api/health) / [orphan rate](/ops/orphan-rate).

## Next

- [health](/api/health)
- [Getting started](/start/getting-started)
