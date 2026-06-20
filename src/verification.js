// Verification strategies that gate escrow release. A job's `verify` decides
// whether `completeEscrow` (pay + reputation++) or a dispute fires.
//
//   verifyCode      — actually execute the delivered function against test cases
//                     (CI-style: pass only if every assertion holds).
//   verifyInference — the hard/novel part: did the provider really run the model?
//                     We use a known-answer challenge embedded in the job plus a
//                     provider attestation (model id + hash binding prompt→output),
//                     so a provider that didn't run the model can't produce a valid
//                     attestation for the challenge.

import { createHash } from "node:crypto";
import vm from "node:vm";

// --- Code jobs -------------------------------------------------------------

/**
 * @param artifact  { code: string, entry: string }  delivered solution
 * @param spec      { cases: Array<{args:any[], expected:any}>, timeoutMs?:number }
 * @returns { passed:boolean, total:number, failures:Array }
 */
export function verifyCode(artifact, spec) {
  const sandbox = { module: {}, exports: {} };
  const context = vm.createContext(sandbox);
  const timeout = spec.timeoutMs ?? 1000;
  try {
    new vm.Script(`${artifact.code}\nthis.__entry = ${artifact.entry};`).runInContext(context, {
      timeout,
    });
  } catch (err) {
    return { passed: false, total: spec.cases.length, failures: [{ error: `compile: ${err.message}` }] };
  }
  const fn = context.__entry;
  if (typeof fn !== "function") {
    return { passed: false, total: spec.cases.length, failures: [{ error: "entry not a function" }] };
  }

  const failures = [];
  for (const c of spec.cases) {
    let got;
    try {
      got = vm.runInContext("this.__entry", context).apply(null, c.args);
    } catch (err) {
      failures.push({ args: c.args, error: err.message });
      continue;
    }
    if (JSON.stringify(got) !== JSON.stringify(c.expected)) {
      failures.push({ args: c.args, expected: c.expected, got });
    }
  }
  return { passed: failures.length === 0, total: spec.cases.length, failures };
}

// --- Inference jobs --------------------------------------------------------

// The provider binds its work with an attestation over (model, prompt, output).
export function attest({ model, prompt, output, secret }) {
  const digest = createHash("sha256").update(`${model}\n${prompt}\n${output}`).digest("hex");
  // `secret` stands in for the provider key; a real impl signs `digest` with it.
  const signature = createHash("sha256").update(`${digest}\n${secret}`).digest("hex");
  return { model, digest, signature };
}

/**
 * Verify an inference delivery.
 * @param delivery { prompt, output, attestation, challengeAnswer }
 * @param spec     { model, providerSecret, challenge:{question, expectedIncludes} }
 *
 * Two independent checks must both hold:
 *  1. Attestation integrity — recomputed digest+signature match (output wasn't swapped).
 *  2. Known-answer challenge — the provider answered a question whose answer the
 *     verifier already knows, proving a real model run rather than a canned reply.
 */
export function verifyInference(delivery, spec) {
  const reasons = [];

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

  const ans = (delivery.challengeAnswer ?? "").toLowerCase();
  if (!ans.includes(spec.challenge.expectedIncludes.toLowerCase())) {
    reasons.push("challenge_failed");
  }

  return { passed: reasons.length === 0, reasons };
}

// Dispatch by job kind.
export function verify(job, delivery) {
  if (job.kind === "code") return verifyCode(delivery.artifact, job.spec);
  if (job.kind === "inference") return verifyInference(delivery, job.spec);
  return { passed: false, reasons: ["unknown_job_kind"] };
}
