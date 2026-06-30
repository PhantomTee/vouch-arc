// Continuous autonomous job loop.
// Polls for jobs, runs client.runJob(), handles SIGTERM gracefully.
// Embedded: import { runAutonomousLoop } from "./autonomousDriver.js"
// Daemon:   see src/loop.js (npm start)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Start the autonomous job loop. Runs forever until SIGTERM/SIGINT.
 *
 * @param {object} opts
 * @param {object}   opts.client           ClientAgent instance
 * @param {Function} opts.jobQueue         () => object | null — next job or null
 * @param {Function} [opts.log]            (obj) => void — structured log sink
 * @param {number}   [opts.pollIntervalMs] ms between polls when queue empty (default 5000)
 * @param {Function} [opts.onResult]       async (job, result, durationMs) => void
 */
export async function runAutonomousLoop({
  client,
  jobQueue,
  log = (obj) => process.stderr.write(JSON.stringify({ time: Date.now(), ...obj }) + "\n"),
  pollIntervalMs = Number(process.env.CLIENT_JOB_POLL_INTERVAL_MS) || 5000,
  onResult = async () => {},
} = {}) {
  let running = true;
  let currentJobPromise = null;

  const shutdown = () => {
    log({ msg: "autonomous loop shutting down — finishing current job", phase: "shutdown" });
    running = false;
    if (!currentJobPromise) {
      process.exit(0);
    } else {
      currentJobPromise.then(() => process.exit(0)).catch(() => process.exit(1));
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);

  log({ msg: "autonomous loop started", pollIntervalMs });

  while (running) {
    let job = null;
    try {
      job = await Promise.resolve(jobQueue());
    } catch (err) {
      log({ msg: "job queue error", err: err.message });
      await sleep(pollIntervalMs);
      continue;
    }

    if (job) {
      const t0 = Date.now();
      log({ msg: "job started", title: job.title, kind: job.kind, ts: new Date().toISOString() });

      try {
        currentJobPromise = client.runJob(job, {
          skill: job.kind,
          maxPriceUsdc: job.budgetUsdc ?? Infinity,
          deadlineSecs: job.deadlineSecs ?? 3600,
        });
        const result = await currentJobPromise;
        const durationMs = Date.now() - t0;

        log({
          msg:       result.ok ? "job completed" : "job failed",
          title:     job.title,
          provider:  result.provider ?? null,
          ok:        result.ok,
          disputed:  result.disputed ?? false,
          durationMs,
          txHash:    result.txHash ?? null,
          ts:        new Date().toISOString(),
        });

        await onResult(job, result, durationMs).catch((e) =>
          log({ msg: "onResult error", err: e.message }),
        );
      } catch (err) {
        log({ msg: "job error", title: job.title, err: err.message, ts: new Date().toISOString() });
      } finally {
        currentJobPromise = null;
      }
    } else {
      log({ msg: "no jobs queued", pollIntervalMs });
    }

    if (running) await sleep(pollIntervalMs);
  }
}
