// Agent discovery registry. Providers register their A2A AgentCards; clients
// discover candidates by skill, ranked by on-chain reputation (and price). The
// reputation source is injected so it can read WorkEscrow.reputationScore
// on Arc — discovery is therefore grounded in verified, paid-for outcomes.

import { supportsX402 } from "./a2a.js";

export class AgentRegistry {
  /**
   * @param {object} opts
   * @param {(address:string)=>Promise<number>} [opts.reputationOf] on-chain reputation lookup
   * @param {boolean} [opts.requireX402] only register cards that declare the x402 extension
   */
  constructor({ reputationOf, requireX402 = true } = {}) {
    this.cards = new Map(); // address -> AgentCard
    this.reputationOf = reputationOf ?? (async () => 0);
    this.requireX402 = requireX402;
  }

  register(card) {
    const address = card.provider?.address;
    if (!address) throw new Error("AgentCard missing provider.address");
    if (this.requireX402 && !supportsX402(card)) {
      throw new Error("AgentCard does not declare the x402 extension");
    }
    this.cards.set(address, card);
    return address;
  }

  unregister(address) {
    this.cards.delete(address);
  }

  list() {
    return [...this.cards.values()];
  }

  cardHasSkill(card, skill) {
    if (!skill) return true;
    return (card.skills ?? []).some(
      (s) => s.id === skill || (s.tags ?? []).includes(skill),
    );
  }

  priceUsdc(card) {
    const atomic = Number(card.x402?.accepts?.[0]?.maxAmountRequired ?? 0);
    return atomic / 1_000_000;
  }

  /**
   * Discover providers for a skill, ranked by reputation (desc) then price (asc).
   * @param {object} q
   * @param {string} [q.skill]          skill id or tag to match
   * @param {number} [q.minReputation]  minimum on-chain reputation
   * @param {number} [q.maxPriceUsdc]   budget ceiling
   * @returns {Promise<Array<{card, address, reputation, priceUsdc}>>}
   */
  async discover({ skill, minReputation = -Infinity, maxPriceUsdc = Infinity } = {}) {
    const matches = this.list().filter((c) => this.cardHasSkill(c, skill));

    const scored = await Promise.all(
      matches.map(async (card) => ({
        card,
        address: card.provider.address,
        reputation: await this.reputationOf(card.provider.address),
        priceUsdc: this.priceUsdc(card),
      })),
    );

    return scored
      .filter((r) => r.reputation >= minReputation && r.priceUsdc <= maxPriceUsdc)
      .sort((a, b) => b.reputation - a.reputation || a.priceUsdc - b.priceUsdc);
  }

  // Convenience: the single best provider for a skill, or null.
  async best(query) {
    const ranked = await this.discover(query);
    return ranked[0] ?? null;
  }
}
