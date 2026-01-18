create table if not exists governor_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  action_type text not null,
  event_type text not null,
  decision_id uuid null,
  context jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists governor_events_user_id_idx on governor_events (user_id);
create index if not exists governor_events_created_at_idx on governor_events (created_at);
create index if not exists governor_events_action_type_idx on governor_events (action_type);

create unique index if not exists governor_events_decision_event_idx
  on governor_events (decision_id, event_type)
  where decision_id is not null;

create table if not exists governor_user_state (
  user_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
