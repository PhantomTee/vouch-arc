// Unit tests for Vouch-Arc enhancements.
// Run: node --test test/unit.mjs   (or: npm run test:unit)
// Uses node:test + node:assert/strict — no external test deps.

import test from "node:test";
import assert from "node:assert/strict";

// Dynamic imports so we can load ESM src/ modules from this CJS test dir.
const { securityScan, verifyCode, attest, verifyInference, verify } =
  await import("../src/verification.js");
const { disputeResolution, logDispute, readDisputes } =
  await import("../src/arbitration.js");
const { buildAgentCard, supportsX402, X402_EXTENSION_URI } =
  await import("../src/a2a.js");
const { inc, observe, metricsText } = await import("../src/metrics.js");
const { logger } = await import("../src/logger.js");

// ─── securityScan ────────────────────────────────────────────────────────────

test("securityScan: clean code returns no threats", () => {
  const threats = securityScan("function add(a,b){ return a+b; }");
  assert.deepEqual(threats, []);
});

test("securityScan: eval is flagged", () => {
  const threats = securityScan("eval('1+1')");
  assert.ok(threats.includes("eval"));
});

test("securityScan: new Function is flagged", () => {
  const threats = securityScan("const f = new Function('return 1')");
  assert.ok(threats.includes("new Function"));
});

test("securityScan: require(fs) is flagged", () => {
  const threats = securityScan("require('fs').unlinkSync('x')");
  assert.ok(threats.includes("require(fs)"));
});

test("securityScan: process.exit is flagged", () => {
  const threats = securityScan("process.exit(1)");
  assert.ok(threats.includes("process.exit"));
});

// ─── verifyCode ──────────────────────────────────────────────────────────────

test("verifyCode: correct solution passes", () => {
  const result = verifyCode(
    { code: "function add(a,b){return a+b;}", entry: "add" },
    { cases: [{ args: [2, 3], expected: 5 }] },
  );
  assert.ok(result.passed);
  assert.equal(result.failures.length, 0);
});

test("verifyCode: wrong answer fails", () => {
  const result = verifyCode(
    { code: "function add(a,b){return 0;}", entry: "add" },
    { cases: [{ args: [2, 3], expected: 5 }] },
  );
  assert.ok(!result.passed);
  assert.ok(result.failures.length > 0);
});

test("verifyCode: type mismatch is a failure", () => {
  const result = verifyCode(
    { code: "function f(a,b){return String(a+b);}", entry: "f" },
    { cases: [{ args: [2, 3], expected: 5 }] },
  );
  assert.ok(!result.passed);
  assert.match(result.failures[0].error, /type mismatch/);
});

test("verifyCode: dangerous code blocked with security threat", () => {
  const result = verifyCode(
    { code: "eval('1+1')", entry: "eval" },
    { cases: [{ args: [], expected: null }] },
  );
  assert.ok(!result.passed);
  assert.ok(result.threats.length > 0);
  assert.match(result.failures[0].error, /security/);
});

test("verifyCode: console capture returns logs", () => {
  const result = verifyCode(
    { code: "function f(){console.log('hi'); return 1;}", entry: "f" },
    { cases: [{ args: [], expected: 1 }] },
  );
  assert.ok(result.passed);
  assert.ok(result.logs.some(([, msg]) => msg === "hi"));
});

test("verifyCode: performanceScore is a number 0–100", () => {
  const result = verifyCode(
    { code: "function add(a,b){return a+b;}", entry: "add" },
    { cases: [{ args: [1, 1], expected: 2 }] },
  );
  assert.ok(typeof result.performanceScore === "number");
  assert.ok(result.performanceScore >= 0 && result.performanceScore <= 100);
});

test("verifyCode: compile error is a failure", () => {
  const result = verifyCode(
    { code: "this is not javascript !!!", entry: "f" },
    { cases: [{ args: [], expected: null }] },
  );
  assert.ok(!result.passed);
  assert.match(result.failures[0].error, /compile/);
});

// ─── attest / verifyInference ────────────────────────────────────────────────

test("attest: produces deterministic digest and signature", () => {
  const a = attest({ model: "m", prompt: "p", output: "o", secret: "s" });
  const b = attest({ model: "m", prompt: "p", output: "o", secret: "s" });
  assert.equal(a.digest, b.digest);
  assert.equal(a.signature, b.signature);
});

test("verifyInference: valid attestation + challenge passes", () => {
  const model = "test-model";
  const prompt = "What is 1+1?";
  const output = "2";
  const secret = "my-secret";
  const challenge = { question: "Capital of France?", expectedIncludes: "paris" };
  const attestation = attest({ model, prompt, output, secret });
  const result = verifyInference(
    { prompt, output, attestation, challengeAnswer: "Paris is the capital." },
    { model, providerSecret: secret, challenge },
  );
  assert.ok(result.passed);
});

test("verifyInference: wrong output triggers attestation_mismatch", () => {
  const model = "test-model";
  const secret = "my-secret";
  const attestation = attest({ model, prompt: "p", output: "correct", secret });
  const result = verifyInference(
    { prompt: "p", output: "WRONG", attestation, challengeAnswer: "paris" },
    { model, providerSecret: secret, challenge: { question: "x", expectedIncludes: "paris" } },
  );
  assert.ok(!result.passed);
  assert.ok(result.reasons.includes("attestation_mismatch"));
});

test("verifyInference: bad challenge answer fails", () => {
  const model = "m";
  const secret = "s";
  const prompt = "q";
  const output = "a";
  const attestation = attest({ model, prompt, output, secret });
  const result = verifyInference(
    { prompt, output, attestation, challengeAnswer: "wrong" },
    { model, providerSecret: secret, challenge: { question: "x", expectedIncludes: "paris" } },
  );
  assert.ok(!result.passed);
  assert.ok(result.reasons.includes("challenge_failed"));
});

test("verifyInference: expired attestation timestamp fails", () => {
  const model = "m";
  const secret = "s";
  const prompt = "q";
  const output = "a";
  const attestation = {
    ...attest({ model, prompt, output, secret }),
    timestamp: Date.now() - 90_000, // 90s ago — exceeds 60s window
  };
  const result = verifyInference(
    { prompt, output, attestation, challengeAnswer: "paris" },
    { model, providerSecret: secret, challenge: { question: "x", expectedIncludes: "paris" } },
  );
  assert.ok(result.reasons.includes("attestation_expired"));
});

test("verifyInference: fresh attestation timestamp does not flag expired", () => {
  const model = "m";
  const secret = "s";
  const prompt = "q";
  const output = "a";
  const attestation = { ...attest({ model, prompt, output, secret }), timestamp: Date.now() };
  const result = verifyInference(
    { prompt, output, attestation, challengeAnswer: "paris" },
    { model, providerSecret: secret, challenge: { question: "x", expectedIncludes: "paris" } },
  );
  assert.ok(!result.reasons.includes("attestation_expired"));
});

// ─── verify dispatcher ───────────────────────────────────────────────────────

test("verify: dispatches code jobs to verifyCode", () => {
  const result = verify(
    { kind: "code", spec: { cases: [{ args: [1, 2], expected: 3 }] } },
    { artifact: { code: "function add(a,b){return a+b;}", entry: "add" } },
  );
  assert.ok(result.passed);
});

test("verify: unknown kind returns passed:false", () => {
  const result = verify({ kind: "video" }, {});
  assert.ok(!result.passed);
  assert.ok(result.reasons.includes("unknown_job_kind"));
});

// ─── arbitration ─────────────────────────────────────────────────────────────

test("disputeResolution: failed verification → auto_worker_loses", () => {
  const r = disputeResolution({ passed: false, failures: [{ error: "wrong answer" }] });
  assert.equal(r.resolution, "auto_worker_loses");
  assert.ok(r.reason.includes("wrong answer"));
});

test("disputeResolution: passed verification → human_review", () => {
  const r = disputeResolution({ passed: true });
  assert.equal(r.resolution, "human_review");
  assert.ok(r.reason.includes("verification_passed"));
});

test("disputeResolution: uses reasons array when failures empty", () => {
  const r = disputeResolution({ passed: false, reasons: ["challenge_failed"] });
  assert.ok(r.reason.includes("challenge_failed"));
});

// ─── a2a / buildAgentCard ────────────────────────────────────────────────────

test("buildAgentCard: has required v0.2 fields", () => {
  const card = buildAgentCard({
    name: "TestWorker",
    url: "http://localhost:9000",
    address: "0x1234567890123456789012345678901234567890",
    skills: [{ id: "code", name: "Code", description: "code tasks", tags: [] }],
    priceUsdc: 0.05,
  });
  assert.equal(card.protocolVersion, "0.2.0");
  assert.ok(card.id);
  assert.ok(card.type);
  assert.ok(card.reputation != null);
  assert.ok(card.pricingTerms != null);
  assert.ok(card.availabilityStatus);
  assert.ok(typeof card.capabilities.artifacts === "boolean");
});

test("buildAgentCard: supportsX402 returns true", () => {
  const card = buildAgentCard({
    name: "W", url: "http://x", address: "0x0000000000000000000000000000000000000001",
    skills: [], priceUsdc: 0.01,
  });
  assert.ok(supportsX402(card));
});

test("buildAgentCard: skill proficiency uses proficiencyBySkill", () => {
  const card = buildAgentCard({
    name: "W", url: "http://x", address: "0x0000000000000000000000000000000000000001",
    skills: [{ id: "code", name: "Code", description: "", tags: [] }],
    priceUsdc: 0.01,
    proficiencyBySkill: { code: 0.95 },
  });
  assert.equal(card.skills[0].proficiency, 0.95);
});

test("buildAgentCard: pricingTerms reflects priceUsdc and address", () => {
  const card = buildAgentCard({
    name: "W", url: "http://x",
    address: "0xABCDEF0000000000000000000000000000000001",
    skills: [], priceUsdc: 0.1,
  });
  assert.equal(card.pricingTerms.basePrice_usdc, 0.1);
  assert.equal(card.pricingTerms.paymentAddress, "0xABCDEF0000000000000000000000000000000001");
});

// ─── metrics ─────────────────────────────────────────────────────────────────

test("metrics: counter increments", () => {
  inc("vouch_escrows_created_total");
  inc("vouch_escrows_created_total");
  const text = metricsText();
  const m = text.match(/vouch_escrows_created_total\s+(\d+)/);
  assert.ok(m, "counter line present");
  assert.ok(Number(m[1]) >= 2);
});

test("metrics: histogram observe populates buckets", () => {
  observe("vouch_job_duration_seconds", 3);
  const text = metricsText();
  assert.ok(text.includes("vouch_job_duration_seconds_bucket"));
  assert.ok(text.includes("vouch_job_duration_seconds_sum"));
  assert.ok(text.includes("vouch_job_duration_seconds_count"));
});

test("metrics: HELP lines appear for known metrics", () => {
  inc("vouch_disputes_raised_total");
  const text = metricsText();
  assert.ok(text.includes("# HELP vouch_disputes_raised_total"));
});

// ─── logger ──────────────────────────────────────────────────────────────────

test("logger: child logger inherits bindings", () => {
  const child = logger.child({ service: "test" });
  assert.ok(typeof child.info === "function");
  assert.ok(typeof child.error === "function");
  assert.ok(typeof child.child === "function");
});

test("logger: all level methods exist", () => {
  for (const level of ["trace", "debug", "info", "warn", "error", "fatal"]) {
    assert.ok(typeof logger[level] === "function", `logger.${level} missing`);
  }
});
