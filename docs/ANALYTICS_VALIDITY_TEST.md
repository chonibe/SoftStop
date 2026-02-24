# Analytics Validity Test

Upgrades the CrownCoins slot demo to measure whether **blocking clustered nudges improves retention** (D1/D7 return rates).

## Schema

### analytics_users
| Column      | Type    | Description                          |
|-------------|---------|--------------------------------------|
| user_id     | text PK | Persistent UUID (localStorage)        |
| variant     | text    | A \| B — A = Governor OFF, B = ON    |
| created_at  | timestamptz | First assignment                  |

### analytics_events
| Column     | Type    | Description                              |
|------------|---------|------------------------------------------|
| id         | uuid PK | Auto-generated                           |
| user_id    | text    | From analytics_users                      |
| ts         | timestamptz | Event time                            |
| session_id | text    | Per-tab session UUID                      |
| event_type | text    | See below                                 |
| context    | jsonb   | Optional: nudgeType, trigger, reason      |
| created_at | timestamptz | Insert time                           |

### Event Types
- `session_start` — User reached lobby/game
- `session_end` — User left (beforeunload/pagehide)
- `nudge_attempt` — Touchpoint triggered, before Governor check
- `nudge_allowed` — Governor allowed the nudge
- `nudge_blocked` — Governor blocked (cooldown/cap)
- `spin` — User spun the reels
- `bonus_claim` — User claimed daily bonus

## Migration

Run in Supabase SQL Editor (same project as Governor/casino):

```sql
-- Contents of governor/api/db/migrations/002_analytics.sql
```

Or copy the contents from `governor/api/db/migrations/002_analytics.sql` and run in the SQL Editor.

## API Endpoints

| Endpoint                  | Method | Body                                         |
|---------------------------|--------|----------------------------------------------|
| /api/analytics/user       | POST   | { userId, variant }                          |
| /api/analytics/event      | POST   | { userId, ts, sessionId, eventType, context }|

Local dev (Governor server): `/v1/analytics/user`, `/v1/analytics/event`

## D1/D7 Return Rate SQL

After 7–14 days of usage:

```sql
with sessions as (
  select user_id, session_id, min(ts) as first_ts
  from analytics_events
  where event_type = 'session_start'
  group by user_id, session_id
),
with_next as (
  select s.*, u.variant,
    lead(first_ts) over (partition by s.user_id order by first_ts) as next_session
  from sessions s
  join analytics_users u on s.user_id = u.user_id
)
select variant,
  count(*) as total_sessions,
  count(*) filter (where next_session - first_ts < interval '24 hours') as d1_returns,
  count(*) filter (where next_session - first_ts < interval '7 days') as d7_returns
from with_next
group by variant;
```

## Interpreting Results

- **Variant B has higher D1 and/or D7 return** → Blocking nudges improves retention
- **Variant B has more sessions per user over 7d** → Better engagement with less pressure
- **Higher nudge clustering (within A) correlates with lower return** → Supports thesis
- **No difference** → Thesis weakens, or manipulation not strong enough

## Key Trap to Avoid

Governor ON reduces nudges — which might also reduce short-term "fun." Compare:
- nudges blocked
- session length
- return rate

The claim is long-term improvement, not short-term clicks.
