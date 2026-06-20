// Marketplace server: serves the UI pages and an API backed by the LIVE Arc
// contract. A client agent runs jobs on demand (POST /api/run) — discovering a
// worker, escrowing real USDC, verifying, and paying or disputing — and the pages
// read on-chain reputation + escrows. Run: npm run market

import http from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Market } from "./chain.js";
import { WorkerAgent, ClientAgent, solvers } from "./agents.js";
import { AgentRegistry } from "./registry.js";
import { loadRoster } from "./roster.js";
import { boardPage, leaderboardPage, feedPage, agentPage } from "./pages.js";

const PORT = Number(process.env.MARKET_PORT || 19140);
if (!process.env.PRIVATE_KEY || !process.env.ESCROW_ADDRESS) {
  console.error("Set PRIVATE_KEY and ESCROW_ADDRESS in .env first.");
  process.exit(1);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const jobsFile = join(root, "jobs.json");
const jobMeta = existsSync(jobsFile) ? JSON.parse(readFileSync(jobsFile, "utf8")) : {};
const saveJobs = () => writeFileSync(jobsFile, JSON.stringify(jobMeta, null, 2));

const roster = loadRoster();
const byAddr = new Map(roster.map((r) => [r.address.toLowerCase(), r]));
const workers = roster.map(
  (r) => new WorkerAgent({ name: r.name, address: r.address, skill: r.skill, priceUsdc: r.priceUsdc, solve: solvers[r.kind] }),
);
const workerMap = new Map(workers.map((w) => [w.address, w]));

const market = new Market({ clientKey: process.env.PRIVATE_KEY, escrowAddress: process.env.ESCROW_ADDRESS });
const registry = new AgentRegistry({ reputationOf: (a) => market.reputationScore(a) });
for (const w of workers) registry.register(w.card());
const client = new ClientAgent({ registry, escrow: market, workers: workerMap });

const codeJob = { title: "implement add(a,b)", kind: "code", spec: { cases: [{ args: [2, 3], expected: 5 }, { args: [4, 4], expected: 8 }] } };
const inferenceJob = () => ({
  title: "summarize Arc",
  kind: "inference",
  prompt: "Summarize Arc in one line.",
  output: "Arc is Circle's USDC-native L1.",
  spec: { model: "qwen2.5-0.5b-instruct", providerSecret: "lex-key", challenge: { question: "Capital of France?", expectedIncludes: "paris" } },
});

let running = false;
let nextInference = false;
async function runJob() {
  if (running) return { error: "a job is already running" };
  running = true;
  try {
    await market.ensureApproval(0.2);
    const useInference = nextInference;
    nextInference = !nextInference;
    const job = useInference ? inferenceJob() : codeJob;
    const result = await client.runJob(job, { skill: job.kind, deadlineSecs: 3600 });
    if (result.id !== undefined) {
      const id = String(result.id);
      jobMeta[id] = {
        title: job.title,
        kind: job.kind,
        providerName: result.provider,
        providerAddr: result.address,
        outcome: result.ok ? "paid" : "disputed",
        amountUsdc: jobMeta[id]?.amountUsdc, // filled from chain on read
        ts: new Date().toISOString(),
        txHash: result.txHash ?? null,
      };
      saveJobs();
    }
    return result;
  } catch (e) {
    return { error: e.message };
  } finally {
    running = false;
  }
}

// Cache terminal escrows to limit RPC load against the flaky public node.
const escrowCache = new Map();
async function readEscrows() {
  const count = await market.escrowCount();
  const out = [];
  const start = Math.max(0, count - 40);
  for (let id = start; id < count; id++) {
    let e = escrowCache.get(id);
    if (!e || !e.completed) {
      try {
        e = await market.getEscrow(id);
        if (e.completed) escrowCache.set(id, e);
      } catch {
        if (!e) continue;
      }
    }
    out.push(e);
  }
  return out;
}

async function buildState() {
  const escrows = await readEscrows();
  const feed = escrows.map((e) => {
    const m = jobMeta[String(e.id)] || {};
    return {
      id: Number(e.id),
      client: e.client,
      provider: e.provider,
      providerName: byAddr.get(e.provider.toLowerCase())?.name ?? m.providerName ?? null,
      amountUsdc: e.amountUsdc,
      completed: e.completed,
      disputed: e.disputed,
      title: m.title ?? null,
      kind: m.kind ?? null,
      txHash: m.txHash ?? null,
    };
  });

  const reputations = await Promise.all(roster.map((r) => market.reputationScore(r.address).catch(() => 0)));
  const agents = roster.map((r, i) => {
    const paid = feed.filter((f) => f.provider.toLowerCase() === r.address.toLowerCase() && f.completed && !f.disputed);
    const earned = paid.reduce((s, f) => s + Number(f.amountUsdc), 0);
    return {
      name: r.name, address: r.address, skill: r.skill, priceUsdc: r.priceUsdc,
      reputation: reputations[i], completed: paid.length, earnedUsdc: Number(earned.toFixed(6)),
    };
  });

  const settled = feed.filter((f) => f.completed && !f.disputed).length;
  const disputes = feed.filter((f) => f.disputed).length;
  const escrowedUsdc = Number(feed.reduce((s, f) => s + Number(f.amountUsdc), 0).toFixed(6));
  return { escrow: market.address, agents, feed, summary: { settled, disputes, escrowedUsdc, jobs: feed.length } };
}

function html(res, body) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}
function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;
    if (req.method === "GET" && p === "/") return html(res, boardPage());
    if (req.method === "GET" && p === "/leaderboard") return html(res, leaderboardPage());
    if (req.method === "GET" && p === "/feed") return html(res, feedPage());
    if (req.method === "GET" && p === "/agent") return html(res, agentPage(url.searchParams.get("name") || ""));
    if (req.method === "GET" && p === "/api/state") return json(res, 200, await buildState());
    if (req.method === "POST" && p === "/api/run") return json(res, 200, await runJob());
    json(res, 404, { error: "not_found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Work-market UI on http://localhost:${PORT}  (escrow ${process.env.ESCROW_ADDRESS})`));
