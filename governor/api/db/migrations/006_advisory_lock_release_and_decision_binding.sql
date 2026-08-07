-- SoftStop P0 hardening: advisory lock for first-row race, released terminal,
-- and decision tenant/user/action_type binding on record.
-- Safe to re-run (CREATE OR REPLACE). Apply after 005.

-- ---------------------------------------------------------------------------
-- Atomic check_and_reserve — transaction-scoped advisory lock before read
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
BEGIN
  -- Serialize even when the user row does not exist yet (FOR UPDATE would no-op).
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id), hashtext(p_user_id));

  SELECT state INTO v_current
  FROM governor_user_state
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id
  FOR UPDATE;

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
-- Atomic record_decision — released terminal + tenant/user/action binding
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
  v_dec_tenant text;
  v_dec_user text;
  v_dec_action text;
  v_updated integer;
BEGIN
  IF p_outcome NOT IN ('executed', 'blocked', 'downgraded', 'released') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_outcome');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id), hashtext(p_user_id));

  PERFORM 1
  FROM governor_user_state
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id
  FOR UPDATE;

  SELECT status, tenant_id, user_id, action_type
    INTO v_status, v_dec_tenant, v_dec_user, v_dec_action
  FROM softstop_decisions
  WHERE decision_id = p_decision_id
  FOR UPDATE;

  IF v_status IS NOT NULL THEN
    IF v_dec_tenant IS DISTINCT FROM p_tenant_id
       OR v_dec_user IS DISTINCT FROM p_user_id
       OR v_dec_action IS DISTINCT FROM p_action_type THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'decision_mismatch',
        'status', v_status
      );
    END IF;
  END IF;

  IF v_status IS NOT NULL AND v_status = p_outcome THEN
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
