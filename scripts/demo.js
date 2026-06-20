// End-to-end A2A marketplace demo on a local Hardhat network (no creds needed).
//   npx hardhat run scripts/demo.js
//
// Drives the escrow + reputation contract through the full job lifecycle:
//   post job -> lock USDC escrow -> agent delivers -> verify -> release or dispute
// using the off-chain verification strategies in src/verification.js.

const hre = require("hardhat");
const { verifyCode, verifyInference, attest } = require("../src/verification.js");

const USDC = (n) => hre.ethers.parseUnits(String(n), 6);
const fmt = (x) => hre.ethers.formatUnits(x, 6);
const DAY = 24 * 60 * 60;

async function main() {
  const [client, providerA, providerB, arbiter] = await hre.ethers.getSigners();

  // Deploy mock USDC + escrow (arbiter is the protocol/dispute wallet).
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();

  const Escrow = await hre.ethers.getContractFactory("WorkEscrow");
  const escrow = await Escrow.connect(arbiter).deploy(await usdc.getAddress(), arbiter.address, 250);
  await escrow.waitForDeployment();

  await usdc.mint(client.address, USDC(10_000));
  await usdc.connect(client).approve(await escrow.getAddress(), hre.ethers.MaxUint256);

  const line = (s) => console.log(s);
  const deadline = () => Math.floor(Date.now() / 1000) + DAY;

  line("\n=== A2A Work Marketplace — escrow + verified delivery on Arc ===\n");

  // ---- Scenario 1: code job, honest provider, auto-verified release ----
  line("① CODE JOB  client posts \"implement sum(a,b)\", escrows 100 USDC to providerA");
  const job1 = {
    kind: "code",
    spec: { cases: [{ args: [2, 3], expected: 5 }, { args: [-1, 1], expected: 0 }] },
  };
  let tx = await escrow.connect(client).createEscrow(providerA.address, USDC(100), deadline());
  await tx.wait();
  const delivery1 = { artifact: { code: "function sum(a,b){return a+b;}", entry: "sum" } };
  const v1 = verifyCode(delivery1.artifact, job1.spec);
  line(`   providerA delivers → verify: ${v1.passed ? "PASS" : "FAIL"} (${v1.total} cases)`);
  if (v1.passed) {
    await (await escrow.connect(client).completeEscrow(0)).wait();
    line(`   ✓ released. providerA balance ${fmt(await usdc.balanceOf(providerA.address))} USDC, reputation ${await escrow.reputationScore(providerA.address)}`);
  }

  // ---- Scenario 2: inference job, attestation + known-answer challenge ----
  line("\n② INFERENCE JOB  client escrows 50 USDC to providerB, with a verification challenge");
  const providerSecret = "providerB-key";
  const job2 = {
    kind: "inference",
    spec: {
      model: "qwen2.5-0.5b-instruct",
      providerSecret,
      challenge: { question: "Capital of France?", expectedIncludes: "paris" },
    },
  };
  await (await escrow.connect(client).createEscrow(providerB.address, USDC(50), deadline())).wait();
  const prompt = "Summarize Arc in one line.";
  const output = "Arc is Circle's stablecoin-native L1 with USDC gas and sub-second finality.";
  const delivery2 = {
    prompt,
    output,
    challengeAnswer: "The capital of France is Paris.",
    attestation: attest({ model: job2.spec.model, prompt, output, secret: providerSecret }),
  };
  const v2 = verifyInference(delivery2, job2.spec);
  line(`   providerB delivers output + attestation → verify: ${v2.passed ? "PASS" : "FAIL"} ${v2.reasons?.length ? "(" + v2.reasons.join(",") + ")" : ""}`);
  if (v2.passed) {
    await (await escrow.connect(client).completeEscrow(1)).wait();
    line(`   ✓ released. providerB balance ${fmt(await usdc.balanceOf(providerB.address))} USDC, reputation ${await escrow.reputationScore(providerB.address)}`);
  }

  // ---- Scenario 3: bad delivery -> dispute -> arbiter refunds client ----
  line("\n③ DISPUTE  client escrows 80 USDC to providerA, who delivers broken code");
  await (await escrow.connect(client).createEscrow(providerA.address, USDC(80), deadline())).wait();
  const badDelivery = { artifact: { code: "function sum(a,b){return a-b;}", entry: "sum" } };
  const v3 = verifyCode(badDelivery.artifact, job1.spec);
  line(`   verify: ${v3.passed ? "PASS" : "FAIL"} → client raises dispute`);
  if (!v3.passed) {
    await (await escrow.connect(client).raiseDispute(2)).wait();
    const clientBefore = await usdc.balanceOf(client.address);
    await (await escrow.connect(arbiter).resolveDispute(2, false)).wait(); // providerWins=false
    const refunded = (await usdc.balanceOf(client.address)) - clientBefore;
    line(`   ✓ arbiter ruled for client. refunded ${fmt(refunded)} USDC`);
    line(`   reputations now → providerA ${await escrow.reputationScore(providerA.address)}, client ${await escrow.reputationScore(client.address)}`);
  }

  line("\n=== done: escrow funded, work verified, paid or refunded, reputation updated on-chain ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
