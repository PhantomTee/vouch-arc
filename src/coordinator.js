// Vouch worker coordinator — a live directory of REAL remote worker agents.
//
// Unlike registry.json (which just records a worker *identity*), this tracks
// workers that are actually running a process somewhere: each one registers
// outbound with its AgentCard (including its deliver URL) and heartbeats. The
// client discovers live workers here and sends jobs to their machines over HTTP.
//
//   npm run coordinator          (default :19160)

import http from "node:http";

// Render/Railway/Fly inject PORT for the platform's own routing; COORDINATOR_PORT
// is the local-dev override so it doesn't collide with other Vouch services.
const PORT = Number(process.env.PORT || process.env.COORDINATOR_PORT || 19160);
const TTL_MS = 40_000; // a worker is "live" if seen within this window

const workers = new Map(); // address -> { card, lastSeen }

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

function live() {
  const now = Date.now();
  return [...workers.values()].filter((w) => now - w.lastSeen < TTL_MS);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  const send = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (req.method === "POST" && req.url === "/register") {
    const { card } = await readJson(req);
    const address = card?.provider?.address;
    if (!address) return send(400, { error: "card.provider.address required" });
    workers.set(address, { card, lastSeen: Date.now() });
    console.log(`+ registered ${card.name} @ ${address.slice(0, 10)}… (${card.url})`);
    return send(200, { ok: true });
  }

  if (req.method === "POST" && req.url === "/heartbeat") {
    const { address, card } = await readJson(req);
    const existing = workers.get(address);
    if (existing) {
      existing.lastSeen = Date.now();
      if (card) existing.card = card;
    } else if (card) {
      workers.set(address, { card, lastSeen: Date.now() });
    }
    return send(200, { ok: true });
  }

  if (req.method === "GET" && req.url === "/workers") {
    return send(200, { count: live().length, workers: live().map((w) => w.card) });
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/healthz")) {
    return send(200, { service: "vouch-coordinator", live: live().length, total: workers.size });
  }

  send(404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`Vouch coordinator on http://localhost:${PORT}  (workers register + heartbeat here)`);
});
