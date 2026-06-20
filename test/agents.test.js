const { expect } = require("chai");
const { WorkerAgent, ClientAgent, solvers } = require("../src/agents.js");
const { AgentRegistry } = require("../src/registry.js");

// In-memory escrow implementing the adapter interface the agents depend on.
class FakeEscrow {
  constructor() {
    this.rep = {};
    this.escrows = [];
  }
  async createEscrow(provider, amountUsdc) {
    this.escrows.push({ provider, amountUsdc, completed: false, disputed: false });
    return this.escrows.length - 1;
  }
  async completeEscrow(id) {
    this.escrows[id].completed = true;
    const p = this.escrows[id].provider;
    this.rep[p] = (this.rep[p] ?? 0) + 1;
  }
  async raiseDispute(id) {
    this.escrows[id].disputed = true;
  }
  async resolveDispute(id, providerWins) {
    const p = this.escrows[id].provider;
    if (!providerWins) this.rep[p] = (this.rep[p] ?? 0) - 1;
  }
  async reputationScore(addr) {
    return this.rep[addr] ?? 0;
  }
}

function setup() {
  const escrow = new FakeEscrow();
  const registry = new AgentRegistry({ reputationOf: (a) => escrow.reputationScore(a) });
  const workers = [
    new WorkerAgent({ name: "Ada", address: "0xAda", skill: "code", priceUsdc: 3, solve: solvers.honestCoder }),
    new WorkerAgent({ name: "Bug", address: "0xBug", skill: "code", priceUsdc: 2, solve: solvers.buggyCoder }),
  ];
  const map = new Map(workers.map((w) => [w.address, w]));
  for (const w of workers) registry.register(w.card());
  const client = new ClientAgent({ registry, escrow, workers: map });
  return { escrow, client };
}

const codeJob = {
  title: "add",
  kind: "code",
  spec: { cases: [{ args: [2, 3], expected: 5 }, { args: [4, 4], expected: 8 }] },
};

describe("autonomous agents", function () {
  it("disputes a broken delivery and penalizes the provider", async function () {
    const { escrow, client } = setup();
    // First job: equal reputation, cheaper Bug wins — and delivers broken code.
    const r1 = await client.runJob(codeJob, { skill: "code" });
    expect(r1.provider).to.equal("Bug");
    expect(r1.ok).to.equal(false);
    expect(r1.disputed).to.equal(true);
    expect(await escrow.reputationScore("0xBug")).to.equal(-1);
  });

  it("routes to the reliable agent once reputation diverges", async function () {
    const { escrow, client } = setup();
    await client.runJob(codeJob, { skill: "code" }); // Bug fails -> -1
    const r2 = await client.runJob(codeJob, { skill: "code" }); // Ada (0) now beats Bug (-1)
    expect(r2.provider).to.equal("Ada");
    expect(r2.ok).to.equal(true);
    expect(await escrow.reputationScore("0xAda")).to.equal(1);

    const r3 = await client.runJob(codeJob, { skill: "code" });
    expect(r3.provider).to.equal("Ada");
    expect(await escrow.reputationScore("0xAda")).to.equal(2);
  });

  it("respects the budget ceiling", async function () {
    const { client } = setup();
    const r = await client.runJob(codeJob, { skill: "code", maxPriceUsdc: 1 });
    expect(r.ok).to.equal(false);
    expect(r.reason).to.equal("no_provider"); // nothing under 1 USDC
  });

  it("completes an honest inference job", async function () {
    const escrow = new FakeEscrow();
    const registry = new AgentRegistry({ reputationOf: (a) => escrow.reputationScore(a) });
    const lex = new WorkerAgent({ name: "Lex", address: "0xLex", skill: "inference", priceUsdc: 4, solve: solvers.honestInference });
    registry.register(lex.card());
    const client = new ClientAgent({ registry, escrow, workers: new Map([[lex.address, lex]]) });

    const job = {
      title: "summarize",
      kind: "inference",
      prompt: "p",
      output: "o",
      spec: { model: "m", providerSecret: "lex-key", challenge: { question: "Capital?", expectedIncludes: "paris" } },
    };
    const r = await client.runJob(job, { skill: "inference" });
    expect(r.ok).to.equal(true);
    expect(await escrow.reputationScore("0xLex")).to.equal(1);
  });
});
