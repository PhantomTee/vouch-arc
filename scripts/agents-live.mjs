// Runs the autonomous agent marketplace against the LIVE Arc contract with real
// test-USDC. The client agent discovers workers, escrows USDC on-chain, verifies
// deliveries, and pays or disputes — every step a real Arc transaction.
//
//   node --env-file-if-exists=.env scripts/agents-live.mjs [--jobs 2]

import { Market } from "../src/chain.js";
import { WorkerAgent, ClientAgent, solvers } from "../src/agents.js";
import { AgentRegistry } from "../src/registry.js";
import { loadRoster } from "../src/roster.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

if (!process.env.PRIVATE_KEY || !process.env.ESCROW_ADDRESS) {
  console.error("Set PRIVATE_KEY and ESCROW_ADDRESS in .env first.");
  process.exit(1);
}

const roster = loadRoster();
const workers = roster.map(
  (r) => new WorkerAgent({ name: r.name, address: r.address, skill: r.skill, priceUsdc: r.priceUsdc, solve: solvers[r.kind] }),
);
const workerMap = new Map(workers.map((w) => [w.address, w]));

const market = new Market({
  clientKey: process.env.PRIVATE_KEY,
  escrowAddress: process.env.ESCROW_ADDRESS,
  log: (s) => console.log(`  ⛓ ${s}`),
});

const registry = new AgentRegistry({ reputationOf: (a) => market.reputationScore(a) });
for (const w of workers) registry.register(w.card());

const client = new ClientAgent({ registry, escrow: market, workers: workerMap, log: (s) => console.log(s) });

const codeJob = {
  title: "implement add(a,b)",
  kind: "code",
  spec: { cases: [{ args: [2, 3], expected: 5 }, { args: [4, 4], expected: 8 }] },
};

const jobs = Number(arg("jobs", "2"));

console.log("\n=== Autonomous agent marketplace — LIVE on Arc ===");
console.log(`escrow ${process.env.ESCROW_ADDRESS}\n`);

await market.ensureApproval(0.2);

for (let i = 1; i <= jobs; i++) {
  console.log(`\nJob ${i}:`);
  await client.runJob(codeJob, { skill: "code", deadlineSecs: 3600 });
}

console.log("\nOn-chain reputation:");
for (const w of workers) {
  console.log(`  ${w.name} (${w.address.slice(0, 10)}…) → ${await market.reputationScore(w.address)}`);
}
console.log(`\n${await market.escrowCount()} escrows on chain · https://testnet.arcscan.app/address/${process.env.ESCROW_ADDRESS}`);
process.exit(0);
