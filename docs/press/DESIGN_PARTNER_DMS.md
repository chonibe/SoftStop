# Warm DMs — design partners (Outreach/Apollo + Mailchimp/Klaviyo + an agent)

Send to the person who got paged when a customer said stop messaging me — GTM eng, RevOps, or platform — not a spray list. No “we’re open source.” No ESP comparison. Offer: we help wire `check`/`record`; you get a public before/after (orphan rate, blocked urgency, complaints).

Target shape: **sequence tool + marketing ESP + something that sends without a human clicking Send.** Hunt in Clay/Apollo/Outreach circles, GTM Engineer / AI SDR Discords (gtmepulse-type), not general marketing Twitter.

## Shared close

> If that’s a bad week, ignore. If it’s the week you’re doing a frequency audit anyway, I’ll take 20 minutes on the collision example and we can decide if a public before/after is worth it. Demo: https://softstop.vercel.app — sales-then-SMS pressure print: https://github.com/chonibe/SoftStop/tree/main/examples/agent-email-collision

## 1. GTM eng — guardrails on the send path / domain burn

> Hey {{name}} — saw {{company}} running Apollo/Outreach plus an agent on the same book. Caps in the prompt don’t hold when the tool retries; that’s how domains get burned.
>
> SoftStop is a shared permit on the send path (`check` before Resend/Twilio, `record` after, including blocks). Not a new sequencer. We’d help you wire the agent + one marketing SMS path and publish orphan rate + blocked urgency if you’re willing. No ads, no CDP pitch.

## 2. RevOps — frequency audit / sales+marketing collision

> Hey {{name}} — if you’re mid frequency audit, the usual hole is HubSpot/Klaviyo caps that never see the SDR sequence or the AI follow-up. Sales + marketing collision on one contact, then a complaint, then a page.
>
> SoftStop is the shared journal when that list is >1 system. Pressure Index is literally GET pressure for that person. Happy to walk the checklist (https://github.com/chonibe/SoftStop/blob/main/docs/FREQUENCY_AUDIT.md) and wire check/record with you for a public before/after.

## 3. Platform eng — shared permit / orphan rate / self-host

> Hey {{name}} — looking for a design partner who already self-hosts the boring stuff and is tired of per-app rate limits that don’t compose.
>
> SoftStop is check/record in front of user-facing tools. Health is orphan rate, not a dashboard vanity metric. MIT, Docker/`pnpm dev`, policy on the server. We help you instrument; you can publish orphan rate + blocked urgency. Repo: https://github.com/chonibe/SoftStop

## 4. Lifecycle / RevOps on LinkedIn (comment first, DM second)

Comment on a post that already complains HubSpot caps miss sequences — don’t cold-pitch SoftStop.

> Caps in one tool never see the other tool. Frequency audit = list every system that can hit the contact; if that list is >1 you need a shared journal, not another sequence setting. We open-sourced that gate (check/record) if useful: demo in the repo, not a vendor webinar.

Then DM:

> Thanks for the thread — offering to help wire the journal on your send path (agent email + Klaviyo/Mailchimp) and put orphan rate / blocked urgency on a public before/after if {{company}} wants a logo-grade writeup. Checklist: FREQUENCY_AUDIT.md in the SoftStop repo.

## 5. Founder / Head of Sales who runs Clay + Apollo + Klaviyo

> Hey {{name}} — Clay/Apollo world: the failure mode isn’t “we need more personalization,” it’s the AI SDR and the lifecycle flow hitting the same person after SDR blackout.
>
> We’re looking for five companies with Outreach or Apollo + Mailchimp or Klaviyo + an agent. We help wire check/record; you get a public before/after (orphan rate, blocked urgency, complaints). 60-second canvas: https://softstop.vercel.app

## Tracking (internal)

Aim: 20 warm DMs in weeks 3–4. Log company, stack (sequence / ESP / agent), who got paged, reply, whether they will publish metrics. Logos beat posts. Do not convert this into an inbound ad campaign.
