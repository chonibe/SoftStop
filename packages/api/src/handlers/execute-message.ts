/**
 * @governor/api - Execute Message Handler
 * 
 * Handles message execution with permit validation.
 */

import { verifyPermit, executeMessageSchema, GovernorPermit } from '@governor/core';
import { Env, jsonResponse, createError } from '../types';
import { createMessageProvider } from '../providers';
import { SupabaseStorage } from '../storage/supabase';

export async function handleExecuteMessage(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();

  // Parse and validate request
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createError(400, 'Invalid JSON body', 'PARSE_ERROR').toResponse();
  }

  const parsed = executeMessageSchema.safeParse(body);

  if (!parsed.success) {
    return createError(400, 'Invalid request', 'VALIDATION_ERROR').toResponse();
  }

  const { permit: token, message } = parsed.data;
  const storage = new SupabaseStorage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Verify permit signature & claims
  let permitClaims: GovernorPermit | null;
  try {
    permitClaims = await verifyPermit(token, {
      privateKey: env.PERMIT_PRIVATE_KEY,
      publicKey: env.PERMIT_PUBLIC_KEY,
      algorithm: 'RS256',
      issuer: 'governor-api'
    });
  } catch (verifyError) {
    await logExecution(storage, token, 'rejected', 'verification_failed', startTime);
    return jsonResponse({ success: false, error: 'Invalid permit' }, 403);
  }

  if (!permitClaims) {
    await logExecution(storage, token, 'rejected', 'invalid_signature', startTime);
    return jsonResponse({ success: false, error: 'Invalid permit signature' }, 403);
  }

  // 2. Check permit expiry
  const now = Math.floor(Date.now() / 1000);
  if (permitClaims.expiresAt < now) {
    await logExecution(storage, token, 'rejected', 'expired', startTime, {
      permitNonce: permitClaims.nonce,
      userId: permitClaims.userId,
      actionType: permitClaims.actionType
    });
    return jsonResponse({ success: false, error: 'Permit expired' }, 403);
  }

  // 3. Consume nonce via Durable Object (prevent replay)
  const nonceId = env.PERMIT_NONCE.idFromName('nonce-store');
  const nonceStub = env.PERMIT_NONCE.get(nonceId);

  const nonceResponse = await nonceStub.fetch('https://nonce/', {
    method: 'POST',
    body: JSON.stringify({ type: 'consume', nonce: permitClaims.nonce })
  });

  const nonceResult = await nonceResponse.json() as { valid: boolean; reason?: string };

  if (!nonceResult.valid) {
    await logExecution(storage, token, 'rejected', nonceResult.reason || 'nonce_invalid', startTime, {
      permitNonce: permitClaims.nonce,
      userId: permitClaims.userId,
      actionType: permitClaims.actionType
    });
    return jsonResponse({
      success: false,
      error: `Permit ${nonceResult.reason || 'already used'}`
    }, 403);
  }

  // 4. Send message via provider
  try {
    const provider = createMessageProvider(env);
    const { messageId } = await provider.send(message);
    const executionTimeMs = Date.now() - startTime;
    const executionId = crypto.randomUUID();

    // 5. Log successful execution
    await storage.logExecution({
      permitNonce: permitClaims.nonce,
      userId: permitClaims.userId,
      actionType: permitClaims.actionType,
      surface: 'message',
      outcome: 'executed',
      gateway: provider.name,
      executionTimeMs,
      context: { providerMessageId: messageId }
    });

    // Mark permit as consumed
    await storage.markPermitConsumed(permitClaims.nonce);

    return jsonResponse({
      success: true,
      executionId,
      permitNonce: permitClaims.nonce,
      provider: provider.name,
      providerMessageId: messageId,
      executedAt: new Date().toISOString(),
      executionTimeMs
    });

  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    await storage.logExecution({
      permitNonce: permitClaims.nonce,
      userId: permitClaims.userId,
      actionType: permitClaims.actionType,
      surface: 'message',
      outcome: 'failed',
      gateway: 'resend',
      executionTimeMs,
      error: (error as Error).message
    });

    return jsonResponse({
      success: false,
      error: 'Message sending failed',
      details: (error as Error).message
    }, 500);
  }
}

async function logExecution(
  storage: SupabaseStorage,
  token: string,
  outcome: 'executed' | 'rejected' | 'failed',
  errorReason: string | null,
  startTime: number,
  overrides: Partial<{
    permitNonce: string;
    userId: string;
    actionType: string;
  }> = {}
): Promise<void> {
  try {
    // Decode permit to get claims (even if invalid, for logging)
    const parts = token.split('.');
    const payload = parts.length >= 2 ? JSON.parse(atob(parts[1])) : {};

    await storage.logExecution({
      permitNonce: overrides.permitNonce || payload.nonce || 'unknown',
      userId: overrides.userId || payload.userId || 'unknown',
      actionType: overrides.actionType || payload.actionType || 'unknown',
      surface: 'message',
      outcome,
      gateway: 'resend',
      executionTimeMs: Date.now() - startTime,
      error: errorReason || undefined
    });
  } catch (logError) {
    console.error('Failed to log execution:', logError);
  }
}
