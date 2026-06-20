const { expect } = require("chai");
const { verifyCode, verifyInference, attest, verify } = require("../src/verification.js");

describe("verification", function () {
  describe("verifyCode", function () {
    const spec = { cases: [{ args: [2, 3], expected: 5 }, { args: [-1, 1], expected: 0 }] };

    it("passes correct solutions", function () {
      const r = verifyCode({ code: "function sum(a,b){return a+b;}", entry: "sum" }, spec);
      expect(r.passed).to.equal(true);
      expect(r.total).to.equal(2);
    });

    it("fails wrong solutions with failure detail", function () {
      const r = verifyCode({ code: "function sum(a,b){return a-b;}", entry: "sum" }, spec);
      expect(r.passed).to.equal(false);
      expect(r.failures.length).to.be.greaterThan(0);
    });

    it("fails code that does not compile", function () {
      const r = verifyCode({ code: "function sum(a,b){return", entry: "sum" }, spec);
      expect(r.passed).to.equal(false);
    });
  });

  describe("verifyInference", function () {
    const spec = {
      model: "qwen2.5-0.5b-instruct",
      providerSecret: "k",
      challenge: { question: "Capital of France?", expectedIncludes: "paris" },
    };
    const prompt = "p";
    const output = "o";
    const goodAttestation = attest({ model: spec.model, prompt, output, secret: spec.providerSecret });

    it("passes with valid attestation and correct challenge answer", function () {
      const r = verifyInference(
        { prompt, output, attestation: goodAttestation, challengeAnswer: "It's Paris." },
        spec,
      );
      expect(r.passed).to.equal(true);
    });

    it("fails when the output was swapped after attestation", function () {
      const r = verifyInference(
        { prompt, output: "tampered", attestation: goodAttestation, challengeAnswer: "Paris" },
        spec,
      );
      expect(r.passed).to.equal(false);
      expect(r.reasons).to.include("attestation_mismatch");
    });

    it("fails when the challenge answer is wrong", function () {
      const r = verifyInference(
        { prompt, output, attestation: goodAttestation, challengeAnswer: "London" },
        spec,
      );
      expect(r.passed).to.equal(false);
      expect(r.reasons).to.include("challenge_failed");
    });
  });

  it("verify() dispatches by job kind", function () {
    const job = { kind: "code", spec: { cases: [{ args: [1, 1], expected: 2 }] } };
    const r = verify(job, { artifact: { code: "function sum(a,b){return a+b;}", entry: "sum" } });
    expect(r.passed).to.equal(true);
  });
});
