// Automated dispute resolution + persistent job/dispute archival.
//
// Resolution logic:
//   verification failed  → auto_worker_loses (clear bad delivery, no human needed)
//   verification passed  → human_review (work looks correct but client disputes)
//
// Persistence: data/disputes.jsonl and data/jobs.jsonl (JSONL append-only).

import { appendFile, readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const DATA_DIR      = resolve("data");
const DISPUTES_FILE = resolve("data/disputes.jsonl");
const JOBS_FILE     = resolve("data/jobs.jsonl");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true }).catch(() => {});
}

/**
 * Classify how a disputed job should be resolved.
 * @param {{ passed: boolean, failures?: Array, reasons?: string[] }} verifyResult
 * @returns {{ resolution: "auto_worker_loses" | "human_review", reason: string }}
 */
export function disputeResolution(verifyResult) {
  if (!verifyResult.passed) {
    const detail =
      (verifyResult.failures ?? []).map((f) => f.error ?? JSON.stringify(f)).join("; ") ||
      (verifyResult.reasons ?? []).join("; ") ||
      "verification_failed";
    return { resolution: "auto_worker_loses", reason: detail };
  }
  return { resolution: "human_review", reason: "verification_passed_but_client_disputed" };
}

/**
 * Persist a dispute event to data/disputes.jsonl.
 * @param {object} record — jobId, worker, client, reason, resolution, ...
 * @returns {object} stored entry with ts field
 */
export async function logDispute(record) {
  await ensureDir();
  const entry = { ts: new Date().toISOString(), ...record };
  await appendFile(DISPUTES_FILE, JSON.stringify(entry) + "\n", "utf8").catch(() => {});
  return entry;
}

/**
 * Archive a completed job to data/jobs.jsonl.
 * @param {object} jobRecord
 * @returns {object} stored entry with ts field
 */
export async function archiveJob(jobRecord) {
  await ensureDir();
  const entry = { ts: new Date().toISOString(), ...jobRecord };
  await appendFile(JOBS_FILE, JSON.stringify(entry) + "\n", "utf8").catch(() => {});
  return entry;
}

/**
 * Read recent dispute entries from data/disputes.jsonl (newest first).
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function readDisputes(limit = 50) {
  try {
    const raw = await readFile(DISPUTES_FILE, "utf8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}
