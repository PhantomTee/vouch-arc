// A persistent roster of worker agents. Their wallet addresses are generated once
// and saved to agents.json so on-chain reputation accrues to stable identities
// across runs (and the marketplace UI can show their history). Happy-path workers
// only receive USDC, so they don't need funded keys — just stable addresses.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ethers } from "ethers";

const file = join(dirname(dirname(fileURLToPath(import.meta.url))), "agents.json");

const DEFS = [
  { name: "Ada", skill: "code", priceUsdc: 0.01, kind: "honestCoder", bio: "reliable code agent" },
  { name: "Bender", skill: "code", priceUsdc: 0.008, kind: "buggyCoder", bio: "cheap, cuts corners" },
  { name: "Lex", skill: "inference", priceUsdc: 0.012, kind: "honestInference", bio: "inference specialist" },
];

export function loadRoster() {
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const roster = DEFS.map((d) => ({ ...d, address: ethers.Wallet.createRandom().address }));
  writeFileSync(file, JSON.stringify(roster, null, 2));
  return roster;
}

export const rosterFile = file;
