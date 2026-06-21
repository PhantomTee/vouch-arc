// A REAL Vouch worker — a standalone program an operator runs on their own
// machine. It exposes POST /deliver, so when the client hires it, the job is sent
// here over HTTP, the work runs in THIS process, and the artifact is returned for
// on-chain verification + payment. It announces itself to the coordinator
// (outbound, no port-forwarding) and heartbeats while alive.
//
//   node src/worker-node.js --name "Maya" --skill code --price 0.009 \
//        --wallet 0xYourArcWallet --coordinator http://localhost:19160 --port 19171
//
// --kind picks how it solves (honestCoder | buggyCoder | honestInference).

import http from "node:http";
import { ethers } from "ethers";
import { buildAgentCard } from "./a2a.js";
import { solvers } from "./agents.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const name = arg("name", "Worker");
const skill = arg("skill", "code");
const priceUsdc = Number(arg("price", skill === "inference" ? "0.011" : "0.009"));
const kind = arg("kind", skill === "inference" ? "honestInference" : "honestCoder");
const port = Number(arg("port", "19171"));
const host = arg("host", `http://localhost:${port}`);
const coordinator = arg("coordinator", process.env.COORDINATOR_URL || "http://localhost:19160");
let wallet = arg("wallet", "");
if (!wallet) {
  wallet = ethers.Wallet.createRandom().address;
  console.log(`(no --wallet given; generated throwaway ${wallet})`);
} else if (!ethers.isAddress(wallet)) {
  console.error(`"${wallet}" is not a valid Arc address.`);
  process.exit(1);
}

const solve = solvers[kind];
if (!solve) {
  console.error(`unknown --kind "${kind}". use one of: ${Object.keys(solvers).join(", ")}`);
  process.exit(1);
}

const card = buildAgentCard({
  name,
  description: `${skill} worker (${kind})`,
  url: host,
  address: wallet,
  priceUsdc,
  skills: [{ id: skill, name: skill, description: `${skill} work`, tags: [skill] }],
});

let delivered = 0;

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (req.method === "GET" && req.url === "/agent-card") return send(200, card);
  if (req.method === "GET" && req.url === "/healthz") return send(200, { ok: true, delivered });

  if (req.method === "POST" && req.url === "/deliver") {
    const { job } = await readJson(req);
    if (!job) return send(400, { error: "job required" });
    try {
      const delivery = solve(job); // the actual work, in this process
      delivered++;
      console.log(`→ delivered "${job.title}" (#${delivered})`);
      return send(200, delivery);
    } catch (err) {
      console.log(`✗ failed "${job?.title}": ${err.message}`);
      return send(500, { error: err.message });
    }
  }

  send(404, { error: "not found" });
});

async function announce(path) {
  try {
    await fetch(`${coordinator}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ card, address: wallet }),
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}

server.listen(port, async () => {
  console.log(`\n${name} — ${skill} worker (${kind}) @ ${priceUsdc} USDC`);
  console.log(`  serving on ${host}  ·  payout ${wallet}`);
  const ok = await announce("/register");
  console.log(ok ? `  ✓ registered with coordinator ${coordinator}` : `  ⚠ coordinator ${coordinator} unreachable (will retry)`);
  setInterval(() => announce("/heartbeat"), 10_000);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log("\nshutting down worker…");
    server.close(() => process.exit(0));
  });
}
