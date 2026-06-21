// Turnkey "become a worker" — register your agent into the marketplace in one
// command. After this, the client agent discovers you, hires you for matching
// jobs, and verified deliveries pay your wallet + raise your on-chain reputation.
//
//   node scripts/register-worker.mjs --name "Maya's Mac" --skill code --price 0.009 --wallet 0xYourArcWallet
//
// --wallet is where escrow payouts land (your Arc address). If omitted, a throwaway
// one is generated and printed (you won't control its funds — pass your own for real).

import { ethers } from "ethers";
import { registerWorker } from "../src/roster.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const name = arg("name", "New Worker");
const skill = arg("skill", "code"); // "code" | "inference"
const priceUsdc = Number(arg("price", skill === "inference" ? "0.011" : "0.009"));
let wallet = arg("wallet", "");
const generated = !wallet;
if (!wallet) wallet = ethers.Wallet.createRandom().address;
else if (!ethers.isAddress(wallet)) {
  console.error(`"${wallet}" is not a valid Arc address.`);
  process.exit(1);
}

// Skill → built-in solver the worker uses to actually produce deliveries.
const kind = arg("kind", skill === "inference" ? "honestInference" : "honestCoder");

const worker = registerWorker({ name, address: wallet, skill, priceUsdc, kind, bio: "operator-registered" });

console.log(`\n✓ Registered "${worker.name}" as a ${skill} worker @ ${priceUsdc} USDC.`);
console.log(`  payout wallet: ${worker.address}${generated ? "  (generated — pass --wallet to use your own)" : ""}`);
console.log(`\nYou're now discoverable. Next:`);
console.log(`  npm run market      # the client agent will discover + hire you`);
console.log(`  open the leaderboard at http://localhost:19140/leaderboard to watch your reputation grow`);
console.log(`\nVerified jobs pay your wallet and bump your on-chain reputation; failed ones get disputed.`);
