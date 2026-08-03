# Experimental MCP gateway (archived from launch surface)

This directory documents the **experimental** MCP / tool-call authorization extraction. It is **not** the SoftStop v0.1 product.

## SoftStop (what to use)

SoftStop is the shared **pressure permit** for end users:

- Working API: [`governor/`](../../governor/)
- Docs: [root README](../../README.md), [ADOPTION_CONTRACT.md](../../docs/ADOPTION_CONTRACT.md)
- Agent that escalates a user: [`examples/agent-touchpoint`](../../examples/agent-touchpoint)

## What lives here historically

Source for the experimental library extraction remains under [`packages/`](../../packages/) in this monorepo (`@governor/core`, `@governor/gateway`, etc.). Those packages explore allow/deny/escalate for **tool calls**, which is a different category (crowded MCP gateway space).

Do not lead README, press, or HN with this material.

## If you need an agent + SoftStop pattern

Prefer: agent decides to nudge/email/discount a user → SoftStop `check` / `record` → only then send.

See [examples/agent-touchpoint](../../examples/agent-touchpoint).
