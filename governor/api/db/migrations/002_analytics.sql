-- Analytics tables for validity test: A/B variants, session tracking, return rates
-- Run in Supabase SQL Editor (same project as Governor/casino)

create table if not exists analytics_users (
  user_id text primary key,
  variant text not null check (variant in ('A', 'B')),
  created_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  ts timestamptz not null default now(),
  session_id text not null,
  event_type text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_id_idx on analytics_events (user_id);
create index if not exists analytics_events_ts_idx on analytics_events (ts);
create index if not exists analytics_events_event_type_idx on analytics_events (event_type);
create index if not exists analytics_events_session_id_idx on analytics_events (session_id);

comment on table analytics_users is 'A/B variant assignment; Variant A = Governor OFF, B = Governor ON';
comment on table analytics_events is 'Event log for session_start, nudge_*, spin, bonus_claim, session_end';
