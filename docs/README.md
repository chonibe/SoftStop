# SoftStop docs

**SoftStop** — the shared permit before any system raises pressure on a user.

## Start here

1. [Concept](CONCEPT.md) — what SoftStop is
2. [Self-host](SELF_HOST.md) — local + Docker
3. [Adoption contract](ADOPTION_CONTRACT.md) — verify / health (don't ship false confidence)
4. [Before / after](BEFORE_AFTER.md) — chaos vs SoftStop + orphan rate
5. [Default policy pack](default-policy-pack.md) — urgency / discount / interruption / reminder
6. [Integration workflow](GOVERNOR_INTEGRATION_WORKFLOW.md) — find touchpoints, wire check/record
7. [API reference](../governor/README.md) — HTTP surface
8. [Examples](../examples/README.md) — including [sample-shop](../examples/sample-shop)

## Experience the story

[Live scroll demo](https://softstop.vercel.app) — **example use case**: marketing chaos (email / SMS / push / in-app stacking), then SoftStop on. SoftStop itself is the authorize-only permit; the demo makes the failure mode obvious. Source: [`demo/index.html`](../demo/index.html).

## Brand

[Brand assets](brand/README.md) — mark, cover, before/after use-case diagram, where-it-fits strip.

## Also

- [One-pager](ONE_PAGER.md)
- [Roadmap](ROADMAP.md)
- [Architecture](architecture.md)
- [Security](../SECURITY.md)
- [Press kit](press/SOFTSTOP_PRESS_RELEASE.md) (for press, not product onboarding)

Internal / historical notes live under [archive-internal](archive-internal/).
