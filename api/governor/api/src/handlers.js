"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRecord = exports.handleCheck = void 0;
const crypto_1 = require("crypto");
const schemas_1 = require("./schemas");
const engine_1 = require("./rules/engine");
const handleCheck = async (storage, payload) => {
    const parsed = schemas_1.checkSchema.safeParse(payload);
    if (!parsed.success) {
        return { status: 400, body: { error: parsed.error.flatten() } };
    }
    const { userId, actionType, surface, context } = parsed.data;
    const now = new Date();
    const state = (await storage.getUserState(userId)) ?? (0, engine_1.emptyState)();
    const decision = (0, engine_1.evaluateCheck)(state, actionType, now);
    const decisionId = (0, crypto_1.randomUUID)();
    await storage.insertEvent({
        userId,
        actionType,
        eventType: "check",
        decisionId,
        context: context ? { surface, ...context } : { surface }
    });
    return {
        status: 200,
        body: {
            allowed: decision.allowed,
            reason: decision.reason,
            decisionId,
            cooldownUntil: decision.cooldownUntil,
            suggestedActionType: decision.suggestedActionType
        }
    };
};
exports.handleCheck = handleCheck;
const handleRecord = async (storage, payload) => {
    const parsed = schemas_1.recordSchema.safeParse(payload);
    if (!parsed.success) {
        return { status: 400, body: { error: parsed.error.flatten() } };
    }
    const { decisionId, userId, actionType, outcome, signals, context } = parsed.data;
    const now = new Date();
    const state = (await storage.getUserState(userId)) ?? (0, engine_1.emptyState)();
    const nextState = (0, engine_1.applyOutcome)(state, actionType, outcome, signals, now);
    await storage.insertEvent({
        userId,
        actionType,
        eventType: outcome,
        decisionId,
        context: context ? { ...context, signals } : { signals }
    });
    await storage.upsertUserState(userId, nextState);
    return { status: 200, body: { ok: true } };
};
exports.handleRecord = handleRecord;
