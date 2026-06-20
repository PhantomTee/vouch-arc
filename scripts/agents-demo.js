// Autonomous agent marketplace on a local Hardhat network (no creds).
//   npx hardhat run scripts/agents-demo.js
//
// A client agent runs a stream of jobs with no human in the loop: for each job it
// discovers a provider (ranked by on-chain reputation), escrows USDC, gets the
// delivery, verifies it, and releases payment or disputes. Watch reputation steer
// the client away from the unreliable agent over time.

const hre = require("hardhat");
const { WorkerAgent, ClientAgent, solvers } = require("../src/agents.js");
const { AgentRegistry } = require("../src/registry.js");

const USDC = (n) => hre.ethers.parseUnits(String(n), 6);

class EscrowAdapter {
  constructor(escrow, client, arbiter) {
    this.escrow = escrow;
    this.client = client;
    this.arbiter = arbiter;
  }
  async createEscrow(provider, amountUsdc, deadlineSecs) {
    const deadline = Math.floor(Date.now() / 1000) + deadlineSecs;
    await (await this.escrow.connect(this.client).createEscrow(provider, USDC(amountUsdc), deadline)).wait();
    return (await this.escrow.escrowCount()) - 1n;
  }
  async completeEscrow(id) {
    await (await this.escrow.connect(this.client).completeEscrow(id)).wait();
  }
  async raiseDispute(id) {
    await (await this.escrow.connect(this.client).raiseDispute(id)).wait();
  }
  async resolveDispute(id, providerWins) {
    await (await this.escrow.connect(this.arbiter).resolveDispute(id, providerWins)).wait();
  }
  async reputationScore(addr) {
    return Number(await this.escrow.reputationScore(addr));
  }
}

async function main() {
  const [client, ada, bug, lex, arbiter] = await hre.ethers.getSigners();

  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  const Escrow = await hre.ethers.getContractFactory("WorkEscrow");
  const escrow = await Escrow.connect(arbiter).deploy(await usdc.getAddress(), arbiter.address, 250);
  await escrow.waitForDeployment();
  await usdc.mint(client.address, USDC(100_000));
  await usdc.connect(client).approve(await escrow.getAddress(), hre.ethers.MaxUint256);

  // Workers: a reliable coder, a cheaper-but-broken coder, an inference agent.
  const workers = [
    new WorkerAgent({ name: "Ada", address: ada.address, skill: "code", priceUsdc: 3, solve: solvers.honestCoder }),
    new WorkerAgent({ name: "Bug", address: bug.address, skill: "code", priceUsdc: 2, solve: solvers.buggyCoder }),
    new WorkerAgent({ name: "Lex", address: lex.address, skill: "inference", priceUsdc: 4, solve: solvers.honestInference }),
  ];
  const workerMap = new Map(workers.map((w) => [w.address, w]));

  const adapter = new EscrowAdapter(escrow, client, arbiter);
  const registry = new AgentRegistry({ reputationOf: (a) => adapter.reputationScore(a) });
  for (const w of workers) registry.register(w.card());

  const log = (s) => console.log(s);
  const clientAgent = new ClientAgent({ registry, escrow: adapter, workers: workerMap, log });

  console.log("\n=== Autonomous agent marketplace (no human in the loop) ===\n");

  const codeJob = {
    title: "add(a,b)",
    kind: "code",
    spec: { cases: [{ args: [2, 3], expected: 5 }, { args: [4, 4], expected: 8 }] },
  };

  for (let i = 1; i <= 4; i++) {
    console.log(`Job ${i}:`);
    await clientAgent.runJob(codeJob, { skill: "code" });
    console.log(`    reputations → Ada ${await adapter.reputationScore(ada.address)}, Bug ${await adapter.reputationScore(bug.address)}\n`);
  }

  console.log("Job 5 (inference):");
  const inferenceJob = {
    title: "summarize",
    kind: "inference",
    prompt: "Summarize Arc in one line.",
    output: "Arc is Circle's USDC-native L1.",
    spec: {
      model: "qwen2.5-0.5b-instruct",
      providerSecret: "lex-key",
      challenge: { question: "Capital of France?", expectedIncludes: "paris" },
    },
  };
  await clientAgent.runJob(inferenceJob, { skill: "inference" });

  console.log("\nFinal balances:");
  for (const w of workers) {
    const bal = hre.ethers.formatUnits(await usdc.balanceOf(w.address), 6);
    console.log(`  ${w.name}: ${bal} USDC earned, reputation ${await adapter.reputationScore(w.address)}`);
  }
  console.log("\n=== the client learned to route work to the reliable agent ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
