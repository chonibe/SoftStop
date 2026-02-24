-- Multi-tenant support: add tenant_id for pilot isolation
-- Existing data uses tenant_id = 'default'. New pilots use unique tenant ids.

-- governor_events: add tenant_id (DEFAULT backfills existing rows in Postgres)
ALTER TABLE governor_events ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT 'default' NOT NULL;

-- governor_user_state: add tenant_id
ALTER TABLE governor_user_state ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT 'default';

-- Ensure backfill for edge cases
UPDATE governor_user_state SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE governor_events SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE governor_user_state ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE governor_events ALTER COLUMN tenant_id SET NOT NULL;

-- governor_user_state: change PK from (user_id) to (tenant_id, user_id)
ALTER TABLE governor_user_state DROP CONSTRAINT IF EXISTS governor_user_state_pkey;
ALTER TABLE governor_user_state ADD PRIMARY KEY (tenant_id, user_id);

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS governor_events_tenant_id_idx ON governor_events (tenant_id);
CREATE INDEX IF NOT EXISTS governor_events_tenant_created_idx ON governor_events (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS governor_user_state_tenant_idx ON governor_user_state (tenant_id);
