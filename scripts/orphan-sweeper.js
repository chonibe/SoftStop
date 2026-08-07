#!/usr/bin/env node
/**
 * SoftStop orphan sweeper — alert-only by default.
 *
 * Polls GET …/health; exits nonzero when orphanRate or expiredReserveRate > 0.05.
 * Optional --auto-record-blocked records expired orphans as outcome:blocked /
 * blockReason:orphan_timeout — never invents executed.
 *
 * Usage:
 *   node scripts/orphan-sweeper.js
 *   SOFTSTOP_API_URL=http://localhost:3000 node scripts/orphan-sweeper.js --periodHours=24
 *   node scripts/orphan-sweeper.js --auto-record-blocked
 *
 * Cron example (hourly):
 *   0 * * * * cd /path/to/softstop && node scripts/orphan-sweeper.js >> /var/log/softstop-orphan.log 2>&1
 *
 * @see apps/docs/ops/orphan-rate.md
 */

const {
  buildBlockedRecordPayload,
  evaluateHealthMetrics,
  filterExpiredOrphans,
  parseSweeperArgs
} = require("./lib/orphan-sweeper-core.js");

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`);
  }
  return data;
}

/**
 * @param {ReturnType<typeof parseSweeperArgs>} opts
 */
async function runOrphanSweeper(opts) {
  const headers = {
    accept: "application/json",
    ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {})
  };

  const healthUrl =
    `${opts.url}${opts.prefix}/health` +
    `?periodHours=${opts.periodHours}` +
    (opts.autoRecordBlocked ? "&includeOrphans=1" : "");

  const health = await fetchJson(healthUrl, { headers });
  const metrics = health.metrics ?? {};
  const evaluation = evaluateHealthMetrics(metrics);

  for (const alert of evaluation.alerts) {
    console.error(
      `ALERT ${alert.metric}=${alert.value} (threshold ${alert.threshold})`
    );
  }
  if (evaluation.ok) {
    console.log(
      `ok orphanRate=${evaluation.orphanRate} expiredReserveRate=${evaluation.expiredReserveRate}`
    );
  } else {
    console.log(
      `fail orphanRate=${evaluation.orphanRate} expiredReserveRate=${evaluation.expiredReserveRate}`
    );
  }

  let recorded = 0;
  if (opts.autoRecordBlocked) {
    const orphans = Array.isArray(health.orphanedChecks)
      ? health.orphanedChecks
      : [];
    const reserveTtlMs = Number(
      process.env.SOFTSTOP_RESERVE_TTL_MS ??
        (process.env.SOFTSTOP_RESERVE === "1" ? 120_000 : 0)
    );
    const expired = filterExpiredOrphans(orphans, {
      reserveTtlMs,
      minAgeMs: opts.minAgeMs
    });

    for (const orphan of expired) {
      if (!orphan.decisionId || !orphan.userId || !orphan.actionType) {
        console.error(`skip orphan missing fields: ${JSON.stringify(orphan)}`);
        continue;
      }
      const payload = buildBlockedRecordPayload(orphan);
      try {
        await fetchJson(`${opts.url}${opts.prefix}/record`, {
          method: "POST",
          headers: {
            ...headers,
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        recorded += 1;
        console.log(
          `recorded blocked orphan_timeout decisionId=${orphan.decisionId}`
        );
      } catch (err) {
        console.error(
          `record failed decisionId=${orphan.decisionId}: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    }
    console.log(
      `auto-record-blocked recorded=${recorded} candidates=${expired.length}`
    );
  }

  return {
    ok: evaluation.ok,
    evaluation,
    recorded,
    exitCode: evaluation.ok ? 0 : 1
  };
}

async function main() {
  const opts = parseSweeperArgs(process.argv.slice(2));
  try {
    const result = await runOrphanSweeper(opts);
    process.exit(result.exitCode);
  } catch (err) {
    console.error(
      `orphan-sweeper error: ${err instanceof Error ? err.message : err}`
    );
    process.exit(2);
  }
}

module.exports = { runOrphanSweeper };

if (require.main === module) {
  main();
}
