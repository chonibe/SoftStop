/**
 * Pure helpers for SoftStop orphan sweeper (alert-only by default).
 * @see apps/docs/ops/orphan-rate.md
 */

const ORPHAN_RATE_THRESHOLD = 0.05;

/**
 * @param {{ orphanRate?: number, expiredReserveRate?: number }} metrics
 * @param {number} [threshold]
 */
function evaluateHealthMetrics(metrics, threshold = ORPHAN_RATE_THRESHOLD) {
  const orphanRate = Number(metrics?.orphanRate ?? 0);
  const expiredReserveRate = Number(metrics?.expiredReserveRate ?? 0);
  /** @type {{ metric: string, value: number, threshold: number }[]} */
  const alerts = [];
  if (orphanRate > threshold) {
    alerts.push({ metric: "orphanRate", value: orphanRate, threshold });
  }
  if (expiredReserveRate > threshold) {
    alerts.push({
      metric: "expiredReserveRate",
      value: expiredReserveRate,
      threshold
    });
  }
  return { ok: alerts.length === 0, alerts, orphanRate, expiredReserveRate };
}

/**
 * Only orphans whose age ≥ reserve TTL (or minAgeMs when reserve is off).
 * Never selects “still within lease” checks for auto-record.
 *
 * @param {{ decisionId: string, userId: string, actionType: string, createdAt?: string }[]} orphans
 * @param {{ now?: number, reserveTtlMs?: number, minAgeMs?: number }} opts
 */
function filterExpiredOrphans(orphans, opts = {}) {
  const now = opts.now ?? Date.now();
  const reserveTtlMs = Number(opts.reserveTtlMs ?? 0);
  const minAgeMs =
    reserveTtlMs > 0 ? reserveTtlMs : Number(opts.minAgeMs ?? 60 * 60 * 1000);
  return orphans.filter((o) => {
    const created = o.createdAt ? Date.parse(o.createdAt) : NaN;
    if (!Number.isFinite(created)) return false;
    return now - created >= minAgeMs;
  });
}

/**
 * @param {{ decisionId: string, userId: string, actionType: string }} orphan
 */
function buildBlockedRecordPayload(orphan) {
  return {
    decisionId: orphan.decisionId,
    userId: orphan.userId,
    actionType: orphan.actionType,
    outcome: "blocked",
    blockReason: "orphan_timeout"
  };
}

/**
 * @param {string[]} argv
 */
function parseSweeperArgs(argv) {
  /** @type {{ autoRecordBlocked: boolean, periodHours: number, url: string, prefix: string, minAgeMs: number, apiKey?: string }} */
  const opts = {
    autoRecordBlocked: false,
    periodHours: 24,
    url:
      process.env.SOFTSTOP_API_URL ||
      process.env.GOVERNOR_API_URL ||
      "http://localhost:3000",
    prefix: "",
    minAgeMs: 60 * 60 * 1000
  };

  for (const arg of argv) {
    if (arg === "--auto-record-blocked") {
      opts.autoRecordBlocked = true;
    } else if (arg.startsWith("--periodHours=")) {
      opts.periodHours = parseInt(arg.slice("--periodHours=".length), 10) || 24;
    } else if (arg.startsWith("--url=")) {
      opts.url = arg.slice("--url=".length).replace(/\/$/, "");
    } else if (arg.startsWith("--prefix=")) {
      opts.prefix = arg.slice("--prefix=".length);
    } else if (arg.startsWith("--minAgeMs=")) {
      opts.minAgeMs =
        parseInt(arg.slice("--minAgeMs=".length), 10) || opts.minAgeMs;
    } else if (arg.startsWith("--apiKey=")) {
      opts.apiKey = arg.slice("--apiKey=".length);
    }
  }

  if (!opts.prefix) {
    try {
      const host = new URL(opts.url).hostname;
      opts.prefix = /localhost|127\.0\.0\.1/.test(host) ? "/v1" : "/api";
    } catch {
      opts.prefix = "/v1";
    }
  }

  return opts;
}

module.exports = {
  ORPHAN_RATE_THRESHOLD,
  evaluateHealthMetrics,
  filterExpiredOrphans,
  buildBlockedRecordPayload,
  parseSweeperArgs
};
