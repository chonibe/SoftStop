# Policies

> SoftStop v0.1: the product policy pack is the **pressure** pack in [default-policy-pack.md](default-policy-pack.md). YAML tool-match examples below describe experimental MCP-oriented extraction in `packages/` — not the launch hero.

SoftStop policies answer:

- Can this escalation type run for this user right now?
- Is the user in cooldown?
- Have type / global caps been hit?
- Is stacking protection active?

## Default pressure pack

See [default-policy-pack.md](default-policy-pack.md) and [`governor/api/src/rules/config.ts`](../governor/api/src/rules/config.ts).

## Decision actions

- `allow` — escalation may proceed; caller must `record`
- `deny` / not allowed — skip or downgrade; still `record` with `outcome: "blocked"`

## Experimental tool policies

```yaml
policies:
  - name: email-send-limit
    tool: gmail.send
    limit:
      count: 50
      window: daily
```

These belong to the archived MCP extraction path — [archive/mcp-gateway](../archive/mcp-gateway). SoftStop v0.1 does not lead with them.
