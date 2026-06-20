// Autonomous marketplace agents. A ClientAgent discovers a provider for each job
// (ranked by on-chain reputation), opens escrow, receives the WorkerAgent's
// delivery, verifies it, and either releases payment or disputes — with no human
// in the loop. Over many jobs, reputation steers the client toward reliable
// providers (emergent behavior).
//
// Agents operate on an injected `escrow` adapter so the same logic runs against a
// real on-chain contract (demo) or an in-memory fake (tests).

import { buildAgentCard } from "./a2a.js";
import { verify, attest } from "./verification.js";

export class WorkerAgent {
  /**
   * @param {object} p
   * @param {string} p.name
   * @param {string} p.address     wallet (payTo + reputation key)
   * @param {string} p.skill       "code" | "inference"
   * @param {number} p.priceUsdc
   * @param {(job:object)=>object} p.solve  produces a delivery for a job
   */
  constructor({ name, address, skill, priceUsdc, solve }) {
    this.name = name;
    this.address = address;
    this.skill = skill;
    this.priceUsdc = priceUsdc;
    this.solve = solve;
  }

  card() {
    return buildAgentCard({
      name: this.name,
      description: `${this.skill} agent`,
      url: `http://${this.name.toLowerCase()}.local`,
      address: this.address,
      priceUsdc: this.priceUsdc,
      skills: [{ id: this.skill, name: this.skill, description: `${this.skill} work`, tags: [this.skill] }],
    });
  }

  deliver(job) {
    return this.solve(job);
  }
}

export class ClientAgent {
  /**
   * @param {object} p
   * @param {import('./registry.js').AgentRegistry} p.registry
   * @param {object} p.escrow   adapter: createEscrow/completeEscrow/raiseDispute/resolveDispute/reputationScore
   * @param {Map<string,WorkerAgent>} p.workers  address -> worker
   * @param {(s:string)=>void} [p.log]
   */
  constructor({ registry, escrow, workers, log = () => {} }) {
    this.registry = registry;
    this.escrow = escrow;
    this.workers = workers;
    this.log = log;
  }

  /**
   * Run one job autonomously: discover -> escrow -> deliver -> verify -> pay/dispute.
   * @returns {Promise<object>} outcome summary
   */
  async runJob(job, { skill, maxPriceUsdc = Infinity, deadlineSecs = 86400 } = {}) {
    const best = await this.registry.best({ skill, maxPriceUsdc });
    if (!best) return { ok: false, reason: "no_provider" };

    const worker = this.workers.get(best.address);
    this.log(`  job "${job.title}" → discovered ${best.card.name} (rep ${best.reputation}, ${best.priceUsdc} USDC)`);

    const id = await this.escrow.createEscrow(best.address, best.priceUsdc, deadlineSecs);
    const delivery = worker.deliver(job);
    const result = verify(job, delivery);

    if (result.passed) {
      await this.escrow.completeEscrow(id);
      this.log(`    ✓ verified → released ${best.priceUsdc} USDC, ${best.card.name} reputation++`);
      return { ok: true, provider: best.card.name, address: best.address, id, paidUsdc: best.priceUsdc };
    }

    await this.escrow.raiseDispute(id);
    await this.escrow.resolveDispute(id, false); // provider loses
    this.log(`    ✗ verification failed → dispute upheld, refund, ${best.card.name} reputation--`);
    return {
      ok: false,
      provider: best.card.name,
      address: best.address,
      id,
      disputed: true,
      reasons: result.failures ?? result.reasons,
    };
  }
}

// --- Ready-made worker behaviors for demos/tests ---------------------------

export const solvers = {
  honestCoder: (job) => ({ artifact: { code: "function f(a,b){return a+b;}", entry: "f" } }),
  buggyCoder: (job) => ({ artifact: { code: "function f(a,b){return a-b;}", entry: "f" } }),
  honestInference: (job) => {
    const output = job.output ?? "ok";
    return {
      prompt: job.prompt,
      output,
      challengeAnswer: job.spec.challenge.expectedIncludes, // a real run produces the known answer
      attestation: attest({
        model: job.spec.model,
        prompt: job.prompt,
        output,
        secret: job.spec.providerSecret,
      }),
    };
  },
};
