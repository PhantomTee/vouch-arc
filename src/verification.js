// Verification strategies that gate escrow release.
//
//   verifyCode      — execute the delivered function against test cases;
//                     also performs a security scan and performance score.
//   verifyInference — did the provider really run the model? Checks attestation
//                     integrity, known-answer challenge, and a 60-second freshness
//                     window on time-stamped attestations.

import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import vm from "node:vm";

// --- Security scan -----------------------------------------------------------

const DANGEROUS_PATTERNS = [
  { name: "eval",            re: /\beval\s*\(/ },
  { name: "new Function",    re: /\bnew\s+Function\s*\(/ },
  { name: "require(fs)",     re: /require\s*\(\s*['"`]fs/ },
  { name: "require(child_process)", re: /require\s*\(\s*['"`]child_process/ },
  { name: "process.exit",    re: /process\s*\.\s*exit/ },
  { name: "process.env",     re: /process\s*\.\s*env/ },
  { name: "__dirname",       re: /__dirname/ },
  { name: "__filename",      re: /__filename/ },
];

/**
 * Scan code for dangerous patterns before execution.
 * @param {string} code
 * @returns {string[]} names of matched threats (empty = safe)
 */
export function securityScan(code) {
  return DANGEROUS_PATTERNS.filter((p) => p.re.test(code)).map((p) => p.name);
}

// --- Code jobs ---------------------------------------------------------------

/**
 * @param artifact  { code: string, entry: string }  delivered solution
 * @param spec      { cases: Array<{args:any[], expected:any}>, timeoutMs?:number }
 * @returns { passed, total, failures, logs, threats, performanceScore }
 */
export function verifyCode(artifact, spec) {
  const threats = securityScan(artifact.code);
  if (threats.length > 0) {
    return {
      passed: false, total: spec.cases.length,
      failures: [{ error: `security violation: ${threats.join(", ")}` }],
      threats, logs: [], performanceScore: 0,
    };
  }

  // Capture console output from the sandbox.
  const logs = [];
  const sandbox = {
    module: {}, exports: {},
    console: {
      log:   (...a) => logs.push(["log",   a.join(" ")]),
      warn:  (...a) => logs.push(["warn",  a.join(" ")]),
      error: (...a) => logs.push(["error", a.join(" ")]),
    },
  };
  const context = vm.createContext(sandbox);
  const timeout = spec.timeoutMs ?? 1000;

  try {
    new vm.Script(`${artifact.code}\nthis.__entry = ${artifact.entry};`).runInContext(context, { timeout });
  } catch (err) {
    return { passed: false, total: spec.cases.length, failures: [{ error: `compile: ${err.message}` }], logs, threats: [], performanceScore: 0 };
  }

  if (typeof context.__entry !== "function") {
    return { passed: false, total: spec.cases.length, failures: [{ error: "entry not a function" }], logs, threats: [], performanceScore: 0 };
  }

  const failures = [];
  const t0 = performance.now();
  for (const c of spec.cases) {
    let got;
    try {
      got = vm.runInContext("this.__entry", context).apply(null, c.args);
    } catch (err) {
      failures.push({ args: c.args, error: err.message });
      continue;
    }
    if (typeof got !== typeof c.expected) {
      failures.push({ args: c.args, expected: c.expected, got, error: `type mismatch: got ${typeof got}, expected ${typeof c.expected}` });
      continue;
    }
    if (JSON.stringify(got) !== JSON.stringify(c.expected)) {
      failures.push({ args: c.args, expected: c.expected, got });
    }
  }
  const elapsedMs = performance.now() - t0;
  const performanceScore = Math.max(0, Math.round(100 - Math.log10(elapsedMs + 1) * 25));

  return { passed: failures.length === 0, total: spec.cases.length, failures, logs, threats: [], performanceScore };
}

// --- Inference jobs ----------------------------------------------------------

// SHA-256 attestation binding (model, prompt, output) to a provider secret.
export function attest({ model, prompt, output, secret }) {
  const digest = createHash("sha256").update(`${model}\n${prompt}\n${output}`).digest("hex");
  const signature = createHash("sha256").update(`${digest}\n${secret}`).digest("hex");
  return { model, digest, signature };
}

/**
 * Verify an inference delivery.
 * @param delivery { prompt, output, attestation, challengeAnswer }
 *   attestation may include an optional `timestamp` (ms) for freshness check.
 * @param spec     { model, providerSecret, challenge:{question, expectedIncludes} }
 *
 * Three independent checks:
 *  1. Freshness   — if attestation carries a timestamp, it must be < 60 s old.
 *  2. Integrity   — recomputed digest+signature match (output wasn't swapped).
 *  3. Challenge   — known-answer proves a real model run, not a canned reply.
 */
export function verifyInference(delivery, spec) {
  const reasons = [];

  // 1. Freshness window (only enforced when timestamp is present).
  if (delivery.attestation?.timestamp != null) {
    const ageMs = Date.now() - delivery.attestation.timestamp;
    if (ageMs > 60_000) reasons.push("attestation_expired");
  }

  // 2. Integrity.
  const expected = attest({
    model: spec.model,
    prompt: delivery.prompt,
    output: delivery.output,
    secret: spec.providerSecret,
  });
  if (
    !delivery.attestation ||
    delivery.attestation.digest !== expected.digest ||
    delivery.attestation.signature !== expected.signature
  ) {
    reasons.push("attestation_mismatch");
  }

  // 3. Known-answer challenge.
  const ans = (delivery.challengeAnswer ?? "").toLowerCase();
  if (!ans.includes(spec.challenge.expectedIncludes.toLowerCase())) {
    reasons.push("challenge_failed");
  }

  return { passed: reasons.length === 0, reasons };
}

// Dispatch by job kind.
export function verify(job, delivery) {
  if (job.kind === "code")      return verifyCode(delivery.artifact, job.spec);
  if (job.kind === "inference") return verifyInference(delivery, job.spec);
  return { passed: false, reasons: ["unknown_job_kind"] };
}
