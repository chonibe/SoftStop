# Examples

Copy patterns from the repo — don’t invent integration shapes.

| Example | Use when |
|---|---|
| [`examples/agent-email-collision`](https://github.com/chonibe/SoftStop/tree/main/examples/agent-email-collision) | Multi-agent + channel collision on one user |
| [`examples/agent-tool-wrapper`](https://github.com/chonibe/SoftStop/tree/main/examples/agent-tool-wrapper) | `wrapUserFacingTool` in a tool / function-call loop |
| [`examples/agent-touchpoint`](https://github.com/chonibe/SoftStop/tree/main/examples/agent-touchpoint) | `beforeContact` before escalating a **human** |
| [`examples/sample-shop`](https://github.com/chonibe/SoftStop/tree/main/examples/sample-shop) | Compare chaos vs SoftStop (`node index.js --mode=compare`) |
| [`examples/nodejs`](https://github.com/chonibe/SoftStop/tree/main/examples/nodejs) | Server-side email / SMS / jobs |
| [`examples/python`](https://github.com/chonibe/SoftStop/tree/main/examples/python) | Python / Flask / Django |
| [`examples/browser`](https://github.com/chonibe/SoftStop/tree/main/examples/browser) | In-app modals, popups, banners |

Agent positioning + patterns: [Governing AI agents](/start/governing-ai-agents).

## Local first

```bash
pnpm dev   # SoftStop API on :3000
export SOFTSTOP_API_URL=http://localhost:3000
```

Hosted demo (`https://softstop.vercel.app`) is optional evaluation only.

## Live story

The [scroll demo](https://softstop.vercel.app) shows marketing chaos (email / SMS / push / in-app) stacking on one person, then SoftStop on. SoftStop itself is still authorize-only — the demo makes the failure mode obvious.

## Next

- [Integration workflow](/integrate/workflow)
- [JS SDK](/integrate/sdk-js)
