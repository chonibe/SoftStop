/**
 * @governor/api - Cloudflare Worker Entry Point
 * 
 * Main entry point for the Governor API running on Cloudflare Workers.
 * Provides sub-2ms latency for cached users via edge KV.
 */

import { Env, corsHeaders, jsonResponse, createError } from './types';
import {
  handleCheck,
  handleRecord,
  handleCheckBatch,
  handleDecide,
  handleVerify,
  handleExecuteMessage,
  handleGetRules,
  handlePutRules,
  handlePatchRules,
  handleDeleteRules,
  handleStream,
  handleStreamBroadcast,
  handleStateBatch,
  handleStateSync,
  handleGetState,
  handlePutState,
  handleDeleteState,
  handleListWebhooks,
  handleCreateWebhook,
  handleGetWebhook,
  handleUpdateWebhook,
  handleDeleteWebhook,
  handleTestWebhook
} from './handlers';
import { handleWebhookQueue } from './webhooks/dispatcher';

// Export Durable Objects
export { GovernorUserDO, DecisionStreamDO, PermitNonceDO } from './storage/durable';

/**
 * Main fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Store waitUntil in globalThis for handlers
    (globalThis as any).waitUntil = ctx.waitUntil.bind(ctx);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Route requests
      return await route(request, env, path, method);
    } catch (error) {
      console.error('Request error:', error);
      
      if (error instanceof Error && 'status' in error) {
        return (error as any).toResponse();
      }
      
      return createError(500, 'Internal server error', 'INTERNAL_ERROR').toResponse();
    }
  },

  // Queue consumer for webhooks
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    await handleWebhookQueue(batch, env);
  }
};

/**
 * Request router
 */
async function route(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  // Health check
  if (path === '/health' || path === '/api/health') {
    return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // Core endpoints
  if (path === '/api/check' && method === 'POST') {
    return handleCheck(request, env);
  }

  if (path === '/api/record' && method === 'POST') {
    return handleRecord(request, env);
  }

  if (path === '/api/check-batch' && method === 'POST') {
    return handleCheckBatch(request, env);
  }

  if (path === '/api/decide' && method === 'POST') {
    return handleDecide(request, env);
  }

  if (path === '/api/verify' && method === 'POST') {
    return handleVerify(request, env);
  }

  if (path === '/api/execute/message' && method === 'POST') {
    return handleExecuteMessage(request, env);
  }

  // State endpoints
  if (path === '/api/state/batch' && method === 'POST') {
    return handleStateBatch(request, env);
  }

  if (path === '/api/state/sync' && method === 'POST') {
    return handleStateSync(request, env);
  }

  // State by user ID
  const stateMatch = path.match(/^\/api\/state\/([^\/]+)$/);
  if (stateMatch) {
    const userId = decodeURIComponent(stateMatch[1]);
    if (method === 'GET') return handleGetState(request, env, userId);
    if (method === 'PUT') return handlePutState(request, env, userId);
    if (method === 'DELETE') return handleDeleteState(request, env, userId);
  }

  // Stream endpoint
  if (path === '/api/stream') {
    return handleStream(request, env);
  }

  if (path === '/api/stream/broadcast' && method === 'POST') {
    return handleStreamBroadcast(request, env);
  }

  // Tenet rules endpoints
  const rulesMatch = path.match(/^\/api\/tenets\/([^\/]+)\/rules$/);
  if (rulesMatch) {
    const tenetId = decodeURIComponent(rulesMatch[1]);
    if (method === 'GET') return handleGetRules(request, env, tenetId);
    if (method === 'PUT') return handlePutRules(request, env, tenetId);
    if (method === 'PATCH') return handlePatchRules(request, env, tenetId);
    if (method === 'DELETE') return handleDeleteRules(request, env, tenetId);
  }

  // Webhook endpoints
  const webhooksMatch = path.match(/^\/api\/tenets\/([^\/]+)\/webhooks$/);
  if (webhooksMatch) {
    const tenetId = decodeURIComponent(webhooksMatch[1]);
    if (method === 'GET') return handleListWebhooks(request, env, tenetId);
    if (method === 'POST') return handleCreateWebhook(request, env, tenetId);
  }

  const webhookMatch = path.match(/^\/api\/tenets\/([^\/]+)\/webhooks\/([^\/]+)$/);
  if (webhookMatch) {
    const tenetId = decodeURIComponent(webhookMatch[1]);
    const webhookId = decodeURIComponent(webhookMatch[2]);
    if (method === 'GET') return handleGetWebhook(request, env, tenetId, webhookId);
    if (method === 'PATCH') return handleUpdateWebhook(request, env, tenetId, webhookId);
    if (method === 'DELETE') return handleDeleteWebhook(request, env, tenetId, webhookId);
  }

  const webhookTestMatch = path.match(/^\/api\/tenets\/([^\/]+)\/webhooks\/([^\/]+)\/test$/);
  if (webhookTestMatch && method === 'POST') {
    const tenetId = decodeURIComponent(webhookTestMatch[1]);
    const webhookId = decodeURIComponent(webhookTestMatch[2]);
    return handleTestWebhook(request, env, tenetId, webhookId);
  }

  // Legacy v1 endpoints (for backwards compatibility)
  if (path === '/v1/check' && method === 'POST') {
    return handleCheck(request, env);
  }

  if (path === '/v1/record' && method === 'POST') {
    return handleRecord(request, env);
  }

  // Not found
  return createError(404, 'Not found', 'NOT_FOUND').toResponse();
}
