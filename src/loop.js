// Daemon entry point — npm start
// Runs a continuous autonomous job loop against the live Arc contract.
// Requires PRIVATE_KEY and ESCROW_ADDRESS (.env or environment).

import { Market } from "./chain.js";
import { ClientAgent, WorkerAgent, solvers } from "./agents.js";
import { AgentRegistry } from "./registry.js";
import { loadRoster } from "./roster.js";
import { runAutonomousLoop } from "./autonomousDriver.js";
import { logger } from "./logger.js";
import { inc, observe } from "./metrics.js";
import { archiveJob } from "./arbitration.js";

if (!process.env.PRIVATE_KEY || !process.env.ESCROW_ADDRESS) {
  process.stderr.write("Set PRIVATE_KEY and ESCROW_ADDRESS first (.env or env vars).\n");
  process.exit(1);
}

const log = (obj) => logger.info(obj.msg ?? "event", obj);

const market = new Market({
  clientKey: process.env.PRIVATE_KEY,
  escrowAddress: process.env.ESCROW_ADDRESS,
});

const roster = loadRoster();
const workers = roster.map(
  (r) =>
    new WorkerAgent({
      name:      r.name,
      address:   r.address,
      skill:     r.skill,
      priceUsdc: r.priceUsdc,
      solve:     solvers[r.kind] ?? (r.skill === "inference" ? solvers.honestInference : solvers.honestCoder),
    }),
);
const workerMap = new Map(workers.map((w) => [w.address, w]));
const registry = new AgentRegistry({ reputationOf: (a) => market.reputationScore(a) });
for (const w of workers) registry.register(w.card());
const client = new ClientAgent({ registry, escrow: market, workers: workerMap });

// Alternating demo job queue — replace with a real job source for production.
const codeJob = {
  title: "implement add(a,b)",
  kind: "code",
  spec: { cases: [{ args: [2, 3], expected: 5 }, { args: [4, 4], expected: 8 }] },
};
const inferenceJob = {
  title: "summarize Arc",
  kind: "inference",
  prompt: "Summarize Arc in one line.",
  output: "Arc is Circle's USDC-native L1.",
  spec: {
    model: "qwen2.5-0.5b-instruct",
    providerSecret: "lex-key",
    challenge: { question: "Capital of France?", expectedIncludes: "paris" },
  },
};

let toggle = false;
const jobQueue = () => { toggle = !toggle; return toggle ? codeJob : inferenceJob; };

log({ msg: "vouch autonomous loop initialising", workers: roster.length });

await market.ensureApproval(1).catch((e) => log({ msg: "approval warning", err: e.message }));

await runAutonomousLoop({
  client,
  jobQueue,
  log,
  onResult: async (job, result, durationMs) => {
    inc("vouch_escrows_settled_total");
    observe("vouch_job_duration_seconds", durationMs / 1000);
    if (!result.ok) inc("vouch_disputes_raised_total");
    if (result.id !== undefined) {
      await archiveJob({
        id: String(result.id), title: job.title, kind: job.kind,
        ok: result.ok, durationMs, txHash: result.txHash ?? null,
      }).catch(() => {});
    }
  },
});
