// A2A discovery primitives, aligned with A2A x402 Payments Extension v0.2.
// Providers publish an AgentCard that declares the x402 extension and advertises
// skills + PaymentRequirements; clients discover by skill and engage via x402.

// Canonical extension URI agents MUST declare to signal x402 support.
export const X402_EXTENSION_URI =
  "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2";

// HTTP header a client sends to activate the extension.
export const X402_ACTIVATION_HEADER = "X-A2A-Extensions";

// Arc testnet payment constants.
export const ARC = {
  network: "eip155:5042002",
  usdc: "0x3600000000000000000000000000000000000000", // 6 decimals
  gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
};

export const PAYMENT_STATUS = {
  REQUIRED: "payment-required",
  SUBMITTED: "payment-submitted",
  REJECTED:  "payment-rejected",
  VERIFIED:  "payment-verified",
  COMPLETED: "payment-completed",
  FAILED:    "payment-failed",
};
export const META = {
  STATUS:   "x402.payment.status",
  REQUIRED: "x402.payment.required",
  PAYLOAD:  "x402.payment.payload",
  RECEIPTS: "x402.payment.receipts",
  ERROR:    "x402.payment.error",
};

const usdcToAtomic = (usd) => Math.round(usd * 1_000_000).toString();

// A single accepted payment option (x402 PaymentRequirements) priced on Arc.
export function buildPaymentRequirements(priceUsdc, payTo) {
  return {
    scheme: "exact",
    network: ARC.network,
    asset: ARC.usdc,
    payTo,
    maxAmountRequired: usdcToAtomic(priceUsdc),
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: ARC.gatewayWallet,
    },
  };
}

/**
 * Build a full A2A AgentCard v0.2 for a marketplace provider.
 *
 * Required fields (v0.2 compliant):
 *   id, name, description, url, type, version, capabilities, skills,
 *   reputation, pricingTerms, availabilityStatus, discoveryEndpoint, provider, x402.
 *
 * @param {object} p
 * @param {string}   p.name
 * @param {string}   [p.description]
 * @param {string}   p.url               agent endpoint
 * @param {string}   p.address           provider wallet (payTo + reputation key)
 * @param {Array}    [p.skills]          [{ id, name, description, tags:[] }]
 * @param {number}   p.priceUsdc         price advertised per call
 * @param {string}   [p.agentType]       "worker" | "client" (default "worker")
 * @param {object}   [p.reputation]      on-chain reputation object
 * @param {string}   [p.availabilityStatus] "available" | "busy" | "offline"
 * @param {object}   [p.proficiencyBySkill] { skillId: 0.0–1.0 }
 * @param {string}   [p.discoveryEndpoint] URL where the card can be fetched
 */
export function buildAgentCard({
  name, description, url, address, skills, priceUsdc,
  agentType = "worker",
  reputation = null,
  availabilityStatus = "available",
  proficiencyBySkill = {},
  discoveryEndpoint = null,
}) {
  return {
    protocolVersion: "0.2.0",
    id:   address,
    name,
    description: description ?? `${name} on Vouch marketplace`,
    url,
    type: agentType,
    version: "0.1.0",
    capabilities: {
      streaming: false,
      artifacts: true,
      extensions: [
        {
          uri: X402_EXTENSION_URI,
          description: "Supports payments using the x402 protocol for on-chain settlement on Arc.",
          required: true,
        },
      ],
    },
    skills: (skills ?? []).map((s) => ({
      ...s,
      proficiency: proficiencyBySkill[s.id] ?? 0.7,
    })),
    reputation: reputation ?? { score: 0, delivered: 0, disputesLost: 0 },
    pricingTerms: {
      model: "per-artifact",
      basePrice_usdc: priceUsdc,
      currency: "USDC",
      chain: "Arc",
      paymentAddress: address,
    },
    availabilityStatus,
    discoveryEndpoint,
    provider: { address },
    x402: { accepts: [buildPaymentRequirements(priceUsdc, address)] },
  };
}

// Does this card declare the x402 extension as required?
export function supportsX402(card) {
  return (card.capabilities?.extensions ?? []).some((e) => e.uri === X402_EXTENSION_URI);
}

// Construct the standalone-flow "payment-required" metadata for a task message.
export function paymentRequiredMetadata(accepts) {
  return {
    [META.STATUS]: PAYMENT_STATUS.REQUIRED,
    [META.REQUIRED]: { x402Version: 1, accepts },
  };
}
