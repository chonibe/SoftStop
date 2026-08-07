import { describe, expect, it } from "vitest";
import {
  ORPHAN_RATE_THRESHOLD,
  buildBlockedRecordPayload,
  evaluateHealthMetrics,
  filterExpiredOrphans,
  parseSweeperArgs
} from "./lib/orphan-sweeper-core.js";

describe("orphan-sweeper-core", () => {
  describe("evaluateHealthMetrics", () => {
    it("is ok when rates are at or below threshold", () => {
      const result = evaluateHealthMetrics({
        orphanRate: 0.05,
        expiredReserveRate: 0.01
      });
      expect(result.ok).toBe(true);
      expect(result.alerts).toEqual([]);
    });

    it("alerts when orphanRate exceeds threshold", () => {
      const result = evaluateHealthMetrics({
        orphanRate: 0.053,
        expiredReserveRate: 0
      });
      expect(result.ok).toBe(false);
      expect(result.alerts).toContainEqual({
        metric: "orphanRate",
        value: 0.053,
        threshold: ORPHAN_RATE_THRESHOLD
      });
    });

    it("alerts when expiredReserveRate exceeds threshold", () => {
      const result = evaluateHealthMetrics({
        orphanRate: 0,
        expiredReserveRate: 0.06
      });
      expect(result.ok).toBe(false);
      expect(result.alerts.some((a) => a.metric === "expiredReserveRate")).toBe(
        true
      );
    });
  });

  describe("filterExpiredOrphans", () => {
    it("keeps only orphans at or past reserve TTL", () => {
      const now = Date.parse("2026-08-07T12:00:00.000Z");
      const orphans = [
        {
          decisionId: "a",
          userId: "u1",
          actionType: "urgency",
          createdAt: "2026-08-07T11:59:00.000Z"
        },
        {
          decisionId: "b",
          userId: "u2",
          actionType: "reminder",
          createdAt: "2026-08-07T11:50:00.000Z"
        }
      ];
      const expired = filterExpiredOrphans(orphans, {
        now,
        reserveTtlMs: 5 * 60 * 1000
      });
      expect(expired.map((o) => o.decisionId)).toEqual(["b"]);
    });

    it("uses minAgeMs when reserve TTL is 0", () => {
      const now = Date.parse("2026-08-07T12:00:00.000Z");
      const orphans = [
        {
          decisionId: "fresh",
          userId: "u1",
          actionType: "urgency",
          createdAt: "2026-08-07T11:55:00.000Z"
        },
        {
          decisionId: "old",
          userId: "u2",
          actionType: "reminder",
          createdAt: "2026-08-07T10:00:00.000Z"
        }
      ];
      const expired = filterExpiredOrphans(orphans, {
        now,
        reserveTtlMs: 0,
        minAgeMs: 60 * 60 * 1000
      });
      expect(expired.map((o) => o.decisionId)).toEqual(["old"]);
    });
  });

  describe("buildBlockedRecordPayload", () => {
    it("records blocked with orphan_timeout — never executed", () => {
      const payload = buildBlockedRecordPayload({
        decisionId: "dec-1",
        userId: "u1",
        actionType: "urgency"
      });
      expect(payload).toEqual({
        decisionId: "dec-1",
        userId: "u1",
        actionType: "urgency",
        outcome: "blocked",
        blockReason: "orphan_timeout"
      });
      expect(payload.outcome).not.toBe("executed");
    });
  });

  describe("parseSweeperArgs", () => {
    it("defaults auto-record off", () => {
      const opts = parseSweeperArgs([]);
      expect(opts.autoRecordBlocked).toBe(false);
      expect(opts.periodHours).toBe(24);
    });

    it("parses --auto-record-blocked and period", () => {
      const opts = parseSweeperArgs([
        "--auto-record-blocked",
        "--periodHours=6",
        "--url=http://localhost:3000"
      ]);
      expect(opts.autoRecordBlocked).toBe(true);
      expect(opts.periodHours).toBe(6);
      expect(opts.url).toBe("http://localhost:3000");
    });
  });
});
