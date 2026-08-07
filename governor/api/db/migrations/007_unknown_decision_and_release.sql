-- SoftStop production follow-ups:
-- 1) Reject record on unknown decision_id (unless p_allow_unknown).
-- 2) Atomic release derives action_type from the decision journal.
-- Safe to re-run (CREATE OR REPLACE). Apply after 006.

-- Drop prior 8-arg overload so calls with defaults are unambiguous.
DROP FUNCTION IF EXISTS softstop_record_decision(text, text, uuid, text, text, integer, jsonb, jsonb);

-- ---------------------------------------------------------------------------
-- Atomic record_decision — reject inventing terminals without a prior check
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION softstop_record_decision(
  p_tenant_id text,
  p_user_id text,
  p_decision_id uuid,
  p_action_type text,
  p_outcome text,
  p_expected_version integer,
  p_next_state jsonb,
  p_event_context jsonb,
  p_allow_unknown boolean DEFAULT false
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

  IF v_status IS NULL THEN
    IF NOT COALESCE(p_allow_unknown, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'unknown_decision');
    END IF;
  ELSE
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

-- ---------------------------------------------------------------------------
-- Atomic release — action_type always taken from softstop_decisions journal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION softstop_release_decision(
  p_tenant_id text,
  p_user_id text,
  p_decision_id uuid,
  p_expected_version integer,
  p_next_state jsonb,
  p_event_context jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
  v_dec_tenant text;
  v_dec_user text;
  v_action_type text;
  v_result jsonb;
BEGIN
  SELECT status, tenant_id, user_id, action_type
    INTO v_status, v_dec_tenant, v_dec_user, v_action_type
  FROM softstop_decisions
  WHERE decision_id = p_decision_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_decision');
  END IF;

  IF v_dec_tenant IS DISTINCT FROM p_tenant_id
     OR v_dec_user IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'decision_mismatch',
      'status', v_status
    );
  END IF;

  -- Delegate to record_decision with trusted journal action_type.
  v_result := softstop_record_decision(
    p_tenant_id,
    p_user_id,
    p_decision_id,
    v_action_type,
    'released',
    p_expected_version,
    p_next_state,
    p_event_context,
    false
  );
  RETURN v_result;
END;
$$;

-- Cheap readiness probe (SELECT 1 equivalent via RPC).
CREATE OR REPLACE FUNCTION softstop_ping()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object('ok', true, 'ts', now());
$$;
