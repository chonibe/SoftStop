# Agent tool wrapper

Thin SoftStop adapter for agent tools that contact humans.

```js
const { SoftStop, wrapUserFacingTool } = require('softstop')

const sendEmail = wrapUserFacingTool(
  new SoftStop({ url: process.env.SOFTSTOP_API_URL }),
  { userId: (args) => args.userId, actionType: 'urgency', surface: 'email', actor: 'my-agent' },
  async (args) => { /* Resend / SMTP / … */ }
)
```

Works with OpenAI function tools, LangChain tools, Mastra, or plain Node handlers — SoftStop only wraps the user-facing side effect.

```bash
# terminal 1
pnpm --filter softstop build
pnpm dev

# terminal 2
cd examples/agent-tool-wrapper
node index.js
```

Also see `SoftStop#beforeContact` in the SDK for an inline gate without wrapping a tool.
