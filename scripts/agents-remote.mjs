// Client driving REAL remote workers. It discovers live workers from the
// coordinator, sends each job to the chosen worker's machine over HTTP, verifies
// the artifact that comes back, and pays or disputes — escrow + reputation steer
// future jobs toward workers that actually deliver.
//
//   npm run coordinator                 # terminal 1
//   npm run worker:serve -- --name ...  # terminals 2..n (the real workers)
//   npm run remote -- --jobs 3          # this client  (add --live for on-chain Arc)

import { ClientAgent, RemoteWorker } from "../src/agents.js";
import { AgentRegistry } from "../src/registry.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (f) => process.argv.includes(`--${f}`);

const coordinator = arg("coordinator", process.env.COORDINATOR_URL || "http://localhost:19160");
const jobs = Number(arg("jobs", "3"));
const live = has("live");

// In-memory escrow so the remote loop runs with zero setup; --live swaps in Arc.
class MemoryEscrow {
  constructor() {
    this.n = 0;
    this.byId = {};
    this.rep = {};
  }
  async createEscrow(addr) {
    const id = ++this.n;
    this.byId[id] = addr;
    return id;
  }
  async completeEscrow(id) {
    const a = this.byId[id];
    this.rep[a] = (this.rep[a] || 0) + 1;
  }
  async raiseDispute() {}
  async resolveDispute(id, providerWins) {
    if (!providerWins) {
      const a = this.byId[id];
      this.rep[a] = (this.rep[a] || 0) - 1;
    }
  }
  async reputationScore(a) {
    return this.rep[a] || 0;
  }
  async escrowCount() {
    return this.n;
  }
}

async function loadEscrow() {
  if (!live) return new MemoryEscrow();
  if (!process.env.PRIVATE_KEY || !process.env.ESCROW_ADDRESS) {
    console.error("--live needs PRIVATE_KEY and ESCROW_ADDRESS in .env");
    process.exit(1);
  }
  const { Market } = await import("../src/chain.js");
  const m = new Market({ clientKey: process.env.PRIVATE_KEY, escrowAddress: process.env.ESCROW_ADDRESS, log: (s) => console.log(`  ⛓ ${s}`) });
  await m.ensureApproval(0.2);
  return m;
}

const skillOf = (card) => (card.skills?.[0]?.id ?? "code");
const priceOf = (card) => Number(card.x402?.accepts?.[0]?.maxAmountRequired ?? 0) / 1_000_000;

const codeJob = {
  title: "implement add(a,b)",
  kind: "code",
  spec: { cases: [{ args: [2, 3], expected: 5 }, { args: [4, 4], expected: 8 }] },
};

console.log(`\n=== Vouch — real remote workers ${live ? "(LIVE on Arc)" : "(in-memory escrow)"} ===`);
console.log(`coordinator ${coordinator}\n`);

const dir = await fetch(`${coordinator}/workers`, { signal: AbortSignal.timeout(5000) })
  .then((r) => r.json())
  .catch(() => ({ workers: [] }));

if (!dir.workers?.length) {
  console.error("No live workers. Start the coordinator and at least one `npm run worker:serve` first.");
  process.exit(1);
}

const escrow = await loadEscrow();
const registry = new AgentRegistry({ reputationOf: (a) => escrow.reputationScore(a) });
const workerMap = new Map();
for (const card of dir.workers) {
  registry.register(card);
  workerMap.set(
    card.provider.address,
    new RemoteWorker({ name: card.name, address: card.provider.address, skill: skillOf(card), priceUsdc: priceOf(card), url: card.url }),
  );
  console.log(`discovered ${card.name} — ${skillOf(card)} @ ${priceOf(card)} USDC  (${card.url})`);
}

const client = new ClientAgent({ registry, escrow, workers: workerMap, log: (s) => console.log(s) });

for (let i = 1; i <= jobs; i++) {
  console.log(`\nJob ${i}:`);
  await client.runJob(codeJob, { skill: "code", deadlineSecs: 3600 });
}

console.log("\nReputation after run:");
for (const [addr, w] of workerMap) {
  console.log(`  ${w.name} (${addr.slice(0, 10)}…) → ${await escrow.reputationScore(addr)}`);
}
process.exit(0);
