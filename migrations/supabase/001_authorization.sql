create table if not exists governor_decisions (
  id text primary key,
  tenant_id text not null,
  actor_id text not null,
  actor_type text,
  tool_server text,
  tool_name text not null,
  tool_risk text,
  action text not null,
  allowed boolean not null,
  reason text not null,
  policy text,
  escalation_id text,
  request jsonb not null,
  decision jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists governor_decisions_tenant_created_idx
  on governor_decisions (tenant_id, created_at desc);

create index if not exists governor_decisions_actor_idx
  on governor_decisions (tenant_id, actor_id, created_at desc);

create index if not exists governor_decisions_tool_idx
  on governor_decisions (tenant_id, tool_server, tool_name, created_at desc);

create index if not exists governor_decisions_escalation_idx
  on governor_decisions (tenant_id, escalation_id)
  where escalation_id is not null;

create table if not exists governor_approvals (
  escalation_id text primary key,
  tenant_id text not null,
  status text not null check (status in ('pending', 'approved', 'denied', 'expired')),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists governor_approvals_tenant_status_idx
  on governor_approvals (tenant_id, status, updated_at desc);

create table if not exists governor_counters (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null,
  window_end timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function governor_increment_counter(
  counter_key text,
  window_seconds integer,
  max_count integer
)
returns table(allowed boolean, current_count integer, retry_after timestamptz)
language plpgsql
as $$
declare
  now_ts timestamptz := now();
  row_record governor_counters%rowtype;
begin
  insert into governor_counters as c (key, count, window_start, window_end, updated_at)
  values (
    counter_key,
    1,
    now_ts,
    now_ts + make_interval(secs => window_seconds),
    now_ts
  )
  on conflict (key) do update
    set count = case
        when c.window_end <= now_ts then 1
        else c.count + 1
      end,
      window_start = case
        when c.window_end <= now_ts then now_ts
        else c.window_start
      end,
      window_end = case
        when c.window_end <= now_ts then now_ts + make_interval(secs => window_seconds)
        else c.window_end
      end,
      updated_at = now_ts
  returning * into row_record;

  allowed := row_record.count <= max_count;
  current_count := row_record.count;
  retry_after := case when allowed then null else row_record.window_end end;
  return next;
end;
$$;
