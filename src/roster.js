// A persistent roster of worker agents. Their wallet addresses are generated once
// and saved to agents.json so on-chain reputation accrues to stable identities
// across runs (and the marketplace UI can show their history). Happy-path workers
// only receive USDC, so they don't need funded keys — just stable addresses.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ethers } from "ethers";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "agents.json"); // built-in demo roster
const registryFile = join(root, "registry.json"); // operator-registered workers

const DEFS = [
  { name: "Ada", skill: "code", priceUsdc: 0.01, kind: "honestCoder", bio: "reliable code agent" },
  { name: "Bender", skill: "code", priceUsdc: 0.008, kind: "buggyCoder", bio: "cheap, cuts corners" },
  { name: "Lex", skill: "inference", priceUsdc: 0.012, kind: "honestInference", bio: "inference specialist" },
];

// The built-in roster plus any workers an operator registered (`npm run worker`).
export function loadRoster() {
  let base;
  if (existsSync(file)) {
    base = JSON.parse(readFileSync(file, "utf8"));
  } else {
    base = DEFS.map((d) => ({ ...d, address: ethers.Wallet.createRandom().address }));
    writeFileSync(file, JSON.stringify(base, null, 2));
  }
  const seen = new Set(base.map((w) => w.address.toLowerCase()));
  for (const w of readRegistry()) {
    if (w.address && !seen.has(w.address.toLowerCase())) {
      base.push(w);
      seen.add(w.address.toLowerCase());
    }
  }
  return base;
}

function readRegistry() {
  if (!existsSync(registryFile)) return [];
  try {
    return JSON.parse(readFileSync(registryFile, "utf8"));
  } catch {
    return [];
  }
}

// Add (or update) an operator's worker so the marketplace discovers and hires it.
export function registerWorker(worker) {
  const list = readRegistry().filter((w) => w.address?.toLowerCase() !== worker.address.toLowerCase());
  list.push(worker);
  writeFileSync(registryFile, JSON.stringify(list, null, 2));
  return worker;
}

export const rosterFile = file;
