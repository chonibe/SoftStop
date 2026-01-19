"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordSchema = exports.checkSchema = exports.actionTypeSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
exports.actionTypeSchema = zod_1.z.enum(types_1.ACTION_TYPES);
exports.checkSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    actionType: exports.actionTypeSchema,
    surface: zod_1.z.string().optional(),
    context: zod_1.z.record(zod_1.z.unknown()).optional()
});
exports.recordSchema = zod_1.z.object({
    decisionId: zod_1.z.string().uuid().optional(),
    userId: zod_1.z.string().min(1),
    actionType: exports.actionTypeSchema,
    outcome: zod_1.z.enum(["executed", "blocked", "downgraded"]),
    signals: zod_1.z
        .object({
        hesitated: zod_1.z.boolean().optional(),
        ignored: zod_1.z.boolean().optional(),
        dismissed: zod_1.z.boolean().optional()
    })
        .optional(),
    context: zod_1.z.record(zod_1.z.unknown()).optional()
});
