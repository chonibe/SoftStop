"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRulesConfig = void 0;
exports.defaultRulesConfig = {
    cooldownHours: {
        urgency: 24,
        discount: 24,
        interruption: 12,
        reminder: 6
    },
    typeCap: {
        urgency: 1,
        discount: 1,
        interruption: 2,
        reminder: 2
    },
    globalCap: 4,
    windowHours: 24,
    stackingWindowMinutes: 10
};
