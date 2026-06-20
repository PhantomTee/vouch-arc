const { expect } = require("chai");
const {
  buildAgentCard,
  buildPaymentRequirements,
  supportsX402,
  paymentRequiredMetadata,
  X402_EXTENSION_URI,
  PAYMENT_STATUS,
  META,
  ARC,
} = require("../src/a2a.js");
const { AgentRegistry } = require("../src/registry.js");

const card = (name, address, priceUsdc, tags) =>
  buildAgentCard({
    name,
    description: name,
    url: `http://${name}.local`,
    address,
    priceUsdc,
    skills: [{ id: tags[0], name, description: name, tags }],
  });

describe("a2a", function () {
  it("AgentCard declares the x402 extension as required", function () {
    const c = card("A", "0xA", 5, ["code"]);
    expect(supportsX402(c)).to.equal(true);
    const ext = c.capabilities.extensions[0];
    expect(ext.uri).to.equal(X402_EXTENSION_URI);
    expect(ext.required).to.equal(true);
  });

  it("PaymentRequirements target Arc USDC + GatewayWallet with atomic amount", function () {
    const r = buildPaymentRequirements(1.5, "0xMerchant");
    expect(r.scheme).to.equal("exact");
    expect(r.network).to.equal(ARC.network);
    expect(r.asset).to.equal(ARC.usdc);
    expect(r.payTo).to.equal("0xMerchant");
    expect(r.maxAmountRequired).to.equal("1500000"); // 1.5 * 1e6
    expect(r.extra.verifyingContract).to.equal(ARC.gatewayWallet);
  });

  it("paymentRequiredMetadata uses the standalone-flow keys", function () {
    const m = paymentRequiredMetadata([buildPaymentRequirements(1, "0xM")]);
    expect(m[META.STATUS]).to.equal(PAYMENT_STATUS.REQUIRED);
    expect(m[META.REQUIRED].accepts).to.have.length(1);
  });
});

describe("AgentRegistry", function () {
  const reputation = { "0xHi": 5, "0xMid": 2, "0xLo": 0, "0xInf": 3 };
  const reputationOf = async (a) => reputation[a] ?? 0;

  function seeded() {
    const reg = new AgentRegistry({ reputationOf });
    reg.register(card("Hi", "0xHi", 5, ["code"]));
    reg.register(card("Mid", "0xMid", 2, ["code"]));
    reg.register(card("Lo", "0xLo", 1, ["code"]));
    reg.register(card("Inf", "0xInf", 3, ["inference"]));
    return reg;
  }

  it("filters by skill", async function () {
    const reg = seeded();
    const r = await reg.discover({ skill: "inference" });
    expect(r).to.have.length(1);
    expect(r[0].card.name).to.equal("Inf");
  });

  it("ranks by reputation descending", async function () {
    const reg = seeded();
    const r = await reg.discover({ skill: "code" });
    expect(r.map((x) => x.card.name)).to.deep.equal(["Hi", "Mid", "Lo"]);
  });

  it("applies budget and minReputation filters", async function () {
    const reg = seeded();
    const r = await reg.discover({ skill: "code", minReputation: 2 });
    expect(r.map((x) => x.card.name)).to.deep.equal(["Hi", "Mid"]);
  });

  it("rejects cards without the x402 extension", function () {
    const reg = new AgentRegistry({ reputationOf });
    const bad = card("Bad", "0xBad", 1, ["code"]);
    bad.capabilities.extensions = [];
    expect(() => reg.register(bad)).to.throw(/x402 extension/);
  });

  it("best() returns the top-ranked provider", async function () {
    const reg = seeded();
    const b = await reg.best({ skill: "code" });
    expect(b.card.name).to.equal("Hi");
  });
});
