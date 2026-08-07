# Production Runtime

> **ARCHIVED / NON-CANONICAL (Wave 4).**  
> This document describes an MCP daemon / tool-proxy direction that is **not** SoftStop OSS core.  
> SoftStop is **authorize-only** (`check` → caller sends → `record`).  
> **Canonical runtime:** [`governor/api`](../governor/api).  
> MCP gateway experiments live under [`archive/mcp-gateway`](../archive/mcp-gateway).  
> Do not treat this file as the production SoftStop architecture.

---

Governor uses decentralized enforcement with centralized control.

In production, the policy decision must happen where the tool call is about to execute. A cloud service can manage policies and approvals, but the security boundary should live inside the customer's infrastructure.

## Components

### Governor Daemon / Sidecar

The daemon is the open source runtime enforcement point. It can run as a sidecar, local MCP proxy, service mesh hop, or tool dispatcher middleware.

Responsibilities:

- intercept MCP JSON-RPC tool calls
- enrich requests with trusted runtime context
- evaluate cached policies locally
- return `allow`, `deny`, or `escalate`
- record decision metadata
- forward allowed calls to target tools

The daemon should be fast, stateless where possible, and deployable inside a private VPC.

### Governor Control Plane

The control plane is the commercial management layer.

Responsibilities:

- policy dashboard
- policy distribution
- immutable audit ledger
- human approval workflows
- Slack, PagerDuty, ticketing, and SIEM integrations
- compliance exports
- organization, tenant, and role management

The control plane should not be required for ordinary low-latency policy checks. Local enforcement must continue from cached policies if the control plane is unreachable.

```text
Enterprise Agent
  |
  | 1. MCP JSON-RPC tool call
  v
Governor Daemon / Sidecar
  |
  +-- local policy cache
  +-- local state cache
  +-- audit buffer
  |
  +------ policy sync / logs / approvals ------+
  |                                            |
  v                                            v
Target Tool                              Control Plane
Database / GitHub / API                  Dashboard / Audit / HITL
```

## Execution Flow

Scenario: an AI support agent is asked to cancel a subscription and refund the last invoice.

### 1. Intercept

The agent decides to call:

- `stripe.refund_invoice`
- `stripe.void_subscription`

Instead of calling Stripe directly, the agent calls its local MCP gateway. Governor intercepts the tool call before it leaves the environment.

### 2. Enrich

Governor adds trusted context that the model cannot alter:

```json
{
  "actor": {
    "id": "support_bot_v2",
    "type": "agent"
  },
  "tool": {
    "server": "stripe",
    "name": "refund_invoice",
    "risk": "high"
  },
  "context": {
    "tenantId": "acme",
    "customerId": "cus_987",
    "payload": {
      "invoice_id": "in_1122",
      "amount_cents": 15000
    }
  }
}
```

It also reads local state, such as how many refunds this agent has issued in the last hour.

### 3. Evaluate

Governor evaluates active policies:

```yaml
policies:
  - name: support-refund-hourly-limit
    tool: stripe.refund_invoice
    actor: support_bot_v2
    limit:
      count: 10
      window: hourly

  - name: manager-approval-for-large-refunds
    tool: stripe.refund_invoice
    where:
      payload.amount_cents:
        gt: 10000
    require:
      approval: true
```

The hourly limit passes. The approval threshold triggers because the refund is $150.00.

### 4. Escalate

Governor returns a pending approval response instead of allowing or permanently denying the call.

```json
{
  "allowed": false,
  "action": "escalate",
  "reason": "approval_required",
  "policy": "manager-approval-for-large-refunds",
  "approvalId": "esc_abc123",
  "message": "This transaction requires manager sign-off."
}
```

The control plane sends the approval request to a manager through Slack, PagerDuty, or a ticketing workflow.

```text
Support-Bot is requesting a $150.00 refund for Acme Corp.

[Approve] [Deny]
```

### 5. Pause

The agent framework stores the pending approval state and moves on to other work. The LLM does not need to idle while waiting for a human.

### 6. Resume

When the manager approves, Governor records:

- approval ID
- approving identity
- policy that required approval
- signed decision metadata
- timestamp

The agent resubmits the tool call with the approval token. Governor matches the token to the request, records the approval chain, and allows the call through to Stripe.

## Result

Governor gives enterprises a runtime policy boundary for agents:

- The model can be compromised without bypassing external tool policy.
- Developers can build tools without embedding custom authorization logic in every API.
- Compliance teams get a structured record of what happened, why it was allowed, and who approved it.

## State Machine

```text
requested
  |
  v
evaluating
  |
  +--> allowed -----> executed -----> recorded
  |
  +--> denied ------> recorded
  |
  +--> escalated ---> pending_approval
                         |
                         +--> approved ---> resumed ---> executed ---> recorded
                         |
                         +--> rejected ----------------> recorded
                         |
                         +--> expired -----------------> recorded
```
