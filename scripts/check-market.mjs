// Sanity check the live Arc deployment: read escrowCount + reputation, and confirm
// the funder wallet has USDC + native gas to run real jobs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ethers } from "ethers";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const RPC = "https://rpc.testnet.arc.network";
const USDC = "0x3600000000000000000000000000000000000000";
const provider = new ethers.JsonRpcProvider(RPC, { chainId: 5042002, name: "arc-testnet" });
const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);

const escrow = new ethers.Contract(
  env.ESCROW_ADDRESS,
  ["function escrowCount() view returns (uint256)", "function usdc() view returns (address)", "function arbiter() view returns (address)"],
  provider,
);
const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], provider);

console.log("escrow:", env.ESCROW_ADDRESS);
console.log("  escrowCount:", (await escrow.escrowCount()).toString());
console.log("  usdc():", await escrow.usdc());
console.log("  arbiter:", await escrow.arbiter());
console.log("funder:", wallet.address);
console.log("  native gas (USDC):", ethers.formatEther(await provider.getBalance(wallet.address)));
console.log("  ERC-20 USDC:", ethers.formatUnits(await usdc.balanceOf(wallet.address), 6));
