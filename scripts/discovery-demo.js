// A2A discovery demo on a local Hardhat network (no creds).
//   npx hardhat run scripts/discovery-demo.js
//
// Providers publish A2A AgentCards (declaring the x402 extension); a client
// discovers candidates for a skill, ranked by REAL on-chain reputation read from
// WorkEscrow, then engages the winner by opening a USDC escrow.

const hre = require("hardhat");
const { buildAgentCard } = require("../src/a2a.js");
const { AgentRegistry } = require("../src/registry.js");

const USDC = (n) => hre.ethers.parseUnits(String(n), 6);
const DAY = 24 * 60 * 60;

async function main() {
  const [client, coderA, coderB, inferC, arbiter] = await hre.ethers.getSigners();

  // Deploy USDC + escrow.
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  const Escrow = await hre.ethers.getContractFactory("WorkEscrow");
  const escrow = await Escrow.connect(arbiter).deploy(await usdc.getAddress(), arbiter.address, 250);
  await escrow.waitForDeployment();
  await usdc.mint(client.address, USDC(100_000));
  await usdc.connect(client).approve(await escrow.getAddress(), hre.ethers.MaxUint256);

  // Build on-chain reputation history: coderA completes 3 jobs, coderB 1, inferC 2.
  const deadline = () => Math.floor(Date.now() / 1000) + DAY;
  async function buildRep(provider, count) {
    for (let i = 0; i < count; i++) {
      await (await escrow.connect(client).createEscrow(provider, USDC(10), deadline())).wait();
      const id = (await escrow.escrowCount()) - 1n;
      await (await escrow.connect(client).completeEscrow(id)).wait();
    }
  }
  await buildRep(coderA.address, 3);
  await buildRep(coderB.address, 1);
  await buildRep(inferC.address, 2);

  // Providers publish AgentCards declaring the x402 extension + their skills/price.
  const cards = [
    buildAgentCard({
      name: "CoderA", description: "Senior code agent", url: "http://coderA.local",
      address: coderA.address, priceUsdc: 5,
      skills: [{ id: "code", name: "Code tasks", description: "writes + tests code", tags: ["code", "python", "js"] }],
    }),
    buildAgentCard({
      name: "CoderB", description: "Budget code agent", url: "http://coderB.local",
      address: coderB.address, priceUsdc: 2,
      skills: [{ id: "code", name: "Code tasks", description: "writes code", tags: ["code", "js"] }],
    }),
    buildAgentCard({
      name: "InferC", description: "Inference agent", url: "http://inferC.local",
      address: inferC.address, priceUsdc: 3,
      skills: [{ id: "inference", name: "LLM inference", description: "runs models", tags: ["inference", "llm"] }],
    }),
  ];

  // Registry discovers via the live contract's reputationScore.
  const registry = new AgentRegistry({
    reputationOf: async (addr) => Number(await escrow.reputationScore(addr)),
  });
  for (const c of cards) registry.register(c);

  console.log("\n=== A2A discovery — ranked by on-chain reputation ===\n");

  console.log('Client needs a "code" agent, budget ≤ 6 USDC:\n');
  const ranked = await registry.discover({ skill: "code", maxPriceUsdc: 6 });
  for (const r of ranked) {
    console.log(`  ${r.card.name.padEnd(7)} reputation=${r.reputation}  price=${r.priceUsdc} USDC  payTo=${r.address.slice(0, 8)}…`);
  }

  const winner = ranked[0];
  console.log(`\n→ selected ${winner.card.name} (highest reputation). Engaging via x402 escrow…`);
  const req = winner.card.x402.accepts[0];
  console.log(`   payment terms: ${Number(req.maxAmountRequired) / 1e6} USDC on ${req.network} asset ${req.asset.slice(0, 8)}…`);
  await (await escrow.connect(client).createEscrow(winner.address, USDC(winner.priceUsdc), deadline())).wait();
  console.log(`   ✓ escrow opened to ${winner.card.name} for ${winner.priceUsdc} USDC (id ${(await escrow.escrowCount()) - 1n})`);

  console.log('\nClient needs an "inference" agent:');
  const best = await registry.best({ skill: "inference" });
  console.log(`→ ${best.card.name} (reputation=${best.reputation}, ${best.priceUsdc} USDC)\n`);
  console.log("=== discovery grounded in verified, paid-for reputation ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
