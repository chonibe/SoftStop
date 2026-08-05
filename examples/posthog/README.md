# SoftStop × PostHog (minimal)

```html
<script type="module">
  import { SoftStop, toSoftStopUserId, emitSoftStopDecisionToPostHog } from 'softstop'

  // Assume posthog-js is already initialized (EU host for Street Collector).
  const ss = new SoftStop({ url: 'http://localhost:3000' })

  async function maybeShowSurvey() {
    const userId = toSoftStopUserId(posthog)
    let decision
    try {
      decision = await ss.check({
        userId,
        actionType: 'interruption',
        surface: 'in-app',
        context: { actor: 'posthog-survey' }
      })
    } catch {
      posthog.capture('softstop_unavailable', { actor: 'posthog-survey' })
      // fail-open: show survey
      return showSurvey()
    }

    emitSoftStopDecisionToPostHog(posthog.capture.bind(posthog), {
      softstopUserId: userId,
      actionType: 'interruption',
      surface: 'in-app',
      actor: 'posthog-survey',
      decision
    })

    if (!decision.allowed) {
      await ss.record({
        decisionId: decision.decisionId,
        userId,
        actionType: 'interruption',
        outcome: 'blocked',
        blockReason: decision.reason,
        context: { actor: 'posthog-survey' }
      })
      return
    }

    showSurvey()
    await ss.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'interruption',
      outcome: 'executed',
      context: { actor: 'posthog-survey' }
    })
  }

  function showSurvey() {
    console.log('render survey / modal')
  }

  // On login:
  // await ss.merge({ fromUserId: toSoftStopUserId(posthog), toUserId: `sc:${user.id}` })
</script>
```

See [POSTHOG_SOFTSTOP.md](../../docs/integrations/POSTHOG_SOFTSTOP.md).
