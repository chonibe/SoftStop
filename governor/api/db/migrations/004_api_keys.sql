-- Tenant-scoped API keys for secure report access
-- Keys are hashed (SHA-256); raw key shown once on creation.

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_idx ON tenant_api_keys (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_api_keys_hash_idx ON tenant_api_keys (key_hash);
