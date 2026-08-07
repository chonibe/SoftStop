/**
 * Local microbench: POST /v1/check against in-memory SoftStop.
 *
 *   pnpm bench:check
 *   pnpm exec tsx scripts/microbench-check.ts [--iters=500] [--warmup=50]
 *
 * Prints JSON + a short human line. Does not claim hosted / Supabase latency.
 */
import { createServer } from "node:http";
import { createApp } from "../governor/api/src/app";
import { MemoryStorage } from "../governor/api/src/storage/memoryStorage";

function parseArgs(argv: string[]) {
  const out = { iters: 500, warmup: 50, port: 0 };
  for (const a of argv) {
    if (a.startsWith("--iters=")) out.iters = Math.max(1, Number(a.slice(8)) || out.iters);
    else if (a.startsWith("--warmup=")) out.warmup = Math.max(0, Number(a.slice(9)) || out.warmup);
    else if (a.startsWith("--port=")) out.port = Number(a.slice(7)) || 0;
  }
  return out;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function postCheck(baseUrl: string, body: Record<string, string>): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(`${baseUrl}/v1/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  const ms = performance.now() - t0;
  if (!res.ok) {
    throw new Error(`check HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return ms;
}

async function main() {
  const { iters, warmup, port } = parseArgs(process.argv.slice(2));
  process.env.GOVERNOR_STORAGE = "memory";

  const app = createApp(new MemoryStorage(), { policySource: "microbench:default" });
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("expected TCP listen address");
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    for (let i = 0; i < warmup; i++) {
      await postCheck(baseUrl, {
        userId: `bench_warm_${i % 8}`,
        actionType: "reminder",
        surface: "bench",
        actor: "microbench"
      });
    }

    const samples: number[] = [];
    for (let i = 0; i < iters; i++) {
      const ms = await postCheck(baseUrl, {
        userId: `bench_user_${i % 32}`,
        actionType: i % 4 === 0 ? "urgency" : "reminder",
        surface: "bench",
        actor: "microbench"
      });
      samples.push(ms);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((a, b) => a + b, 0);
    const result = {
      storage: "memory",
      transport: "http",
      endpoint: "POST /v1/check",
      host: "127.0.0.1",
      warmup,
      iters,
      ms: {
        min: Number(sorted[0]!.toFixed(3)),
        p50: Number(percentile(sorted, 50)!.toFixed(3)),
        p95: Number(percentile(sorted, 95)!.toFixed(3)),
        p99: Number(percentile(sorted, 99)!.toFixed(3)),
        max: Number(sorted[sorted.length - 1]!.toFixed(3)),
        mean: Number((sum / samples.length).toFixed(3))
      },
      note: "Local in-process HTTP + MemoryStorage only. Not hosted / Supabase."
    };

    console.log(JSON.stringify(result, null, 2));
    console.error(
      `local/memory POST /v1/check: p50=${result.ms.p50}ms p95=${result.ms.p95}ms (n=${iters})`
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
