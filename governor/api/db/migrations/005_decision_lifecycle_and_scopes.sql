-- Wave 2: decision lifecycle, atomic RPCs, scoped API keys
-- SoftStop production stop guarantees

-- ---------------------------------------------------------------------------
-- Decision journal (lifecycle: reserved → executed|blocked|released|expired)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS softstop_decisions (
  decision_id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  action_type text NOT NULL,
  status text NOT NULL CHECK (
    status IN ('reserved', 'executed', 'blocked', 'released', 'expired', 'downgraded')
  ),
  cost double precision,
  reserve_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  terminal_at timestamptz
);

CREATE INDEX IF NOT EXISTS softstop_decisions_tenant_user_idx
  ON softstop_decisions (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS softstop_decisions_status_idx
  ON softstop_decisions (tenant_id, status);

-- Stronger uniqueness than (decision_id, event_type) alone: one row per decision.
-- Terminal outcomes are idempotent via status CAS below.

-- ---------------------------------------------------------------------------
-- API key scopes, expiry, revocation, last_used_at
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_api_keys
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY[
    'check',
    'record',
    'read:pressure',
    'read:audit',
    'merge:users'
  ];

ALTER TABLE tenant_api_keys
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE tenant_api_keys
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

ALTER TABLE tenant_api_keys
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- ---------------------------------------------------------------------------
-- Atomic check_and_reserve
-- Locks user row, CAS version, writes state + check event + decision row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION softstop_check_and_reserve(
  p_tenant_id text,
  p_user_id text,
  p_decision_id uuid,
  p_action_type text,
  p_expected_version integer,
  p_next_state jsonb,
  p_event_context jsonb,
  p_reserve_expires_at timestamptz,
  p_cost double precision
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_current jsonb;
  v_version integer;
  v_rows integer;
BEGIN
  -- Serialize per (tenant, user)
  PERFORM 1
  FROM governor_user_state
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id
  FOR UPDATE;

  SELECT state INTO v_current
  FROM governor_user_state
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id;

  IF v_current IS NULL THEN
    v_version := 0;
  ELSE
    v_version := COALESCE((v_current->>'stateVersion')::integer, 0);
  END IF;

  IF v_version <> p_expected_version THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict', 'version', v_version);
  END IF;

  INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
  VALUES (p_tenant_id, p_user_id, p_next_state, now())
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET state = EXCLUDED.state, updated_at = now();

  INSERT INTO softstop_decisions (
    decision_id, tenant_id, user_id, action_type, status, cost, reserve_expires_at
  ) VALUES (
    p_decision_id, p_tenant_id, p_user_id, p_action_type, 'reserved', p_cost, p_reserve_expires_at
  )
  ON CONFLICT (decision_id) DO NOTHING;

  INSERT INTO governor_events (
    user_id, action_type, event_type, decision_id, context, tenant_id, created_at
  ) VALUES (
    p_user_id, p_action_type, 'check', p_decision_id, p_event_context, p_tenant_id, now()
  );

  RETURN jsonb_build_object('ok', true, 'decisionId', p_decision_id, 'status', 'reserved');
END;
$$;

-- ---------------------------------------------------------------------------
-- Atomic record_decision (terminal CAS; idempotent same terminal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION softstop_record_decision(
  p_tenant_id text,
  p_user_id text,
  p_decision_id uuid,
  p_action_type text,
  p_outcome text,
  p_expected_version integer,
  p_next_state jsonb,
  p_event_context jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_current jsonb;
  v_version integer;
  v_status text;
  v_updated integer;
BEGIN
  IF p_outcome NOT IN ('executed', 'blocked', 'downgraded') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_outcome');
  END IF;

  PERFORM 1
  FROM governor_user_state
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id
  FOR UPDATE;

  SELECT status INTO v_status
  FROM softstop_decisions
  WHERE decision_id = p_decision_id
  FOR UPDATE;

  IF v_status IS NOT NULL AND v_status = p_outcome THEN
    -- Idempotent success: already applied this terminal
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'status', v_status,
      'decisionId', p_decision_id
    );
  END IF;

  IF v_status IS NOT NULL AND v_status IN ('executed', 'blocked', 'released', 'expired', 'downgraded')
     AND v_status <> p_outcome THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'already_terminal',
      'status', v_status
    );
  END IF;

  SELECT state INTO v_current
  FROM governor_user_state
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id;

  IF v_current IS NULL THEN
    v_version := 0;
  ELSE
    v_version := COALESCE((v_current->>'stateVersion')::integer, 0);
  END IF;

  IF v_version <> p_expected_version THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict', 'version', v_version);
  END IF;

  INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
  VALUES (p_tenant_id, p_user_id, p_next_state, now())
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET state = EXCLUDED.state, updated_at = now();

  INSERT INTO softstop_decisions (
    decision_id, tenant_id, user_id, action_type, status, terminal_at, updated_at
  ) VALUES (
    p_decision_id, p_tenant_id, p_user_id, p_action_type, p_outcome, now(), now()
  )
  ON CONFLICT (decision_id) DO UPDATE
    SET status = EXCLUDED.status,
        terminal_at = now(),
        updated_at = now()
    WHERE softstop_decisions.status = 'reserved'
       OR softstop_decisions.status IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Re-check if conflict on terminal race
  SELECT status INTO v_status FROM softstop_decisions WHERE decision_id = p_decision_id;
  IF v_status IS NOT NULL AND v_status <> p_outcome AND v_status <> 'reserved' THEN
    IF v_status = p_outcome THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', v_status);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'already_terminal', 'status', v_status);
  END IF;

  INSERT INTO governor_events (
    user_id, action_type, event_type, decision_id, context, tenant_id, created_at
  ) VALUES (
    p_user_id, p_action_type, p_outcome, p_decision_id, p_event_context, p_tenant_id, now()
  );

  RETURN jsonb_build_object('ok', true, 'status', p_outcome, 'decisionId', p_decision_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Atomic merge_users (locks both identities)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION softstop_merge_users(
  p_tenant_id text,
  p_from_user_id text,
  p_to_user_id text,
  p_from_expected_version integer,
  p_to_expected_version integer,
  p_merged_state jsonb,
  p_tombstone_state jsonb,
  p_event_context jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_from jsonb;
  v_to jsonb;
  v_from_ver integer;
  v_to_ver integer;
BEGIN
  -- Lock in stable order to avoid deadlocks
  IF p_from_user_id < p_to_user_id THEN
    PERFORM 1 FROM governor_user_state
      WHERE tenant_id = p_tenant_id AND user_id = p_from_user_id FOR UPDATE;
    PERFORM 1 FROM governor_user_state
      WHERE tenant_id = p_tenant_id AND user_id = p_to_user_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM governor_user_state
      WHERE tenant_id = p_tenant_id AND user_id = p_to_user_id FOR UPDATE;
    PERFORM 1 FROM governor_user_state
      WHERE tenant_id = p_tenant_id AND user_id = p_from_user_id FOR UPDATE;
  END IF;

  SELECT state INTO v_from FROM governor_user_state
    WHERE tenant_id = p_tenant_id AND user_id = p_from_user_id;
  SELECT state INTO v_to FROM governor_user_state
    WHERE tenant_id = p_tenant_id AND user_id = p_to_user_id;

  v_from_ver := COALESCE((v_from->>'stateVersion')::integer, 0);
  v_to_ver := COALESCE((v_to->>'stateVersion')::integer, 0);

  IF v_from_ver <> p_from_expected_version OR v_to_ver <> p_to_expected_version THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict');
  END IF;

  INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
  VALUES (p_tenant_id, p_to_user_id, p_merged_state, now())
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET state = EXCLUDED.state, updated_at = now();

  INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
  VALUES (p_tenant_id, p_from_user_id, p_tombstone_state, now())
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET state = EXCLUDED.state, updated_at = now();

  INSERT INTO governor_events (
    user_id, action_type, event_type, context, tenant_id, created_at
  ) VALUES (
    p_to_user_id, 'reminder', 'merged', p_event_context, p_tenant_id, now()
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;
