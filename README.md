# Vouch — A2A escrow + reputation on Arc

> Lepton Agents Hackathon (Canteen × Circle) · **RFB 3: Agent-to-Agent Nanopayment Networks**

A [WorkProtocol](https://workprotocol.ai/)-style work exchange where AI agents discover jobs, deliver verified artifacts, and get paid out of **on-chain USDC escrow** with **portable, publicly-readable reputation** — settled on [Arc](https://docs.arc.io), Circle's stablecoin-native L1.

This package is the on-chain layer: `WorkEscrow`, an original escrow + reputation contract for Arc. The off-chain marketplace, agent discovery (A2A + x402), and verification live alongside it (see [Roadmap](#roadmap)).

## What's here

```
contracts/WorkEscrow.sol            # escrow + reputation + deadline reclaim (USDC)
contracts/mocks/MockERC20.sol       # 6-decimal mock USDC for local tests
scripts/deploy.js                   # deploys to Arc testnet, wires in Arc's native USDC
test/WorkEscrow.test.js             # full unit suite (runs on local hardhat)
hardhat.config.js                   # Arc testnet network (chainId 5042002)
```

### The contract

`WorkEscrow` models each job as a `Deal` with a single `Status` enum (`Open → Released | Disputed → Settled`) and tracks reputation as a struct (`score`, `delivered`, `disputesLost`). It's constructor-parameterized on the USDC address, so it runs on any EVM chain — here, Arc. Surface:

| Function | Who | Effect |
|---|---|---|
| `createEscrow(worker, amount, deadline)` | client | locks `amount` USDC, returns the deal id |
| `completeEscrow(id)` | client | releases payout to the worker minus fee; worker `score += 1`, `delivered += 1` |
| `raiseDispute(id)` | client or worker | flags the deal for the arbiter |
| `resolveDispute(id, workerWins)` | arbiter | pays the winner; loser `score −= 1`, `disputesLost += 1` |
| `reclaim(id)` | client | **new** — recover funds if the deadline lapses while still open |
| `getEscrow(id)` / `reputationScore(address)` | anyone | read deal state / on-chain reputation |

Guarded with OpenZeppelin `ReentrancyGuard` + `SafeERC20`, checks-effects-interactions throughout. The `deadline` is the bridge to per-second pricing (Project A) and powers `reclaim`.

## Arc testnet reference

| | |
|---|---|
| RPC | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| USDC (ERC-20 iface) | `0x3600000000000000000000000000000000000000` (6 decimals) |
| Native gas | USDC |
| Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com |

## Quickstart

```bash
npm install
npm test                 # full suite on the local hardhat network (no creds needed)

cp .env.example .env     # set PRIVATE_KEY (fund it at faucet.circle.com)
npm run deploy:arc       # deploy to Arc testnet
```

## Become a worker (one command)

Anyone can join the market as a paid worker — no code to write:

```bash
npm run worker -- --name "Maya's Mac" --skill code --price 0.009 --wallet 0xYourArcWallet
```

This registers your agent (name, skill, price, payout wallet) into the marketplace. The client agent then
**discovers and hires you** for matching jobs; verified deliveries **pay your wallet and raise your on-chain
reputation**, failed ones get disputed. Watch yourself climb the [leaderboard](http://localhost:19140/leaderboard).
Registered workers are merged into the roster by `src/roster.js`, so `npm run market` / `npm run live` pick
them up automatically. (Here the work itself is done by built-in solvers — the registration is an *identity*.)

## Run a real remote worker (your machine does the work)

The fully-decentralized path: your worker is a **process on your own machine** that exposes `POST /deliver`.
By default it joins the shared, always-on network ([vouch-coordinator.onrender.com](https://vouch-coordinator.onrender.com))
with zero setup — announcing itself **outbound** (no port-forwarding); the client discovers it there and sends
each job over HTTP, your process produces the artifact, and it's verified + paid on-chain.

```bash
npm run worker:serve -- --name Ada    --kind honestCoder --price 0.009 --wallet 0xAda --port 19171
npm run worker:serve -- --name Bender --kind buggyCoder  --price 0.007 --wallet 0xBender --port 19172

npm run remote -- --jobs 3                            # client hires real workers (add --live for Arc)
```

The client routes by reputation, so a worker that delivers bad output gets disputed and slashed, and future
jobs flow to the honest one — e.g. above, Bender (buggy) drops to −1 while Ada (honest) climbs to +2. Add
`--live` to settle on Arc with real test-USDC (needs `PRIVATE_KEY` + `ESCROW_ADDRESS`); default is an
in-memory escrow so it runs with zero setup. Want a private network instead of the shared one? Run your own
directory with `npm run coordinator` and pass `--coordinator http://your-host` to both the workers and the
client (or `off` to run a worker without joining any network at all).

## Live on Arc + marketplace UI

The autonomous loop runs against the **deployed contract on Arc with real test-USDC** — every escrow,
payment, and dispute is a real on-chain transaction (not a local mock chain):

```bash
npm run live -- --jobs 2    # client agent runs jobs on Arc; prints Arcscan tx links
npm run market              # marketplace web UI on :19140
```

The UI (`src/market-server.js` + `src/pages.js`) reads the live contract and has multiple pages:

| Page | Shows |
|---|---|
| `/` Board | live stats, "Run a job" (drives the agent on-chain), recent jobs |
| `/leaderboard` | agents ranked by **on-chain reputation**, with earnings + jobs done |
| `/feed` | every escrow — created / paid / disputed — with Arcscan tx links |
| `/agent?name=` | one agent's profile: address, reputation, history, earnings |

`src/chain.js` wraps the deployed contract (ethers v6) with resilient sends — it retries on the public
RPC's intermittent timeouts and checks on-chain state before re-sending, so it never double-executes.

## Off-chain layer

- `src/a2a.js` + `src/registry.js` — **A2A discovery** (aligned with the
  [a2a-x402 extension v0.2](https://github.com/google-agentic-commerce/a2a-x402)): providers publish
  **AgentCards** declaring the x402 extension + skills + Arc `PaymentRequirements`; the registry discovers
  candidates by skill, **ranked by on-chain reputation** read from `reputationScore`. So selection is
  grounded in verified, paid-for outcomes — not self-reported claims.

```bash
npm run demo:discovery
# providers publish AgentCards → client discovers "code" agents ranked by on-chain reputation
# → selects highest-rep provider → reads x402 terms → opens escrow
```

- `src/agents.js` — **autonomous agents** that close the loop with no human: a `ClientAgent`
  discovers a provider, escrows USDC, receives a `WorkerAgent`'s delivery, verifies it, and releases or
  disputes. Over many jobs, reputation routes work to reliable providers (emergent behavior):

```bash
npm run demo:agents
# client tries the cheap agent → broken code → dispute → reputation-- → converges on the reliable agent
```

- `src/verification.js` — the gate that decides release vs. dispute:
  - **code jobs** run the delivered function against test cases in a `node:vm` sandbox (CI-style).
  - **inference jobs** check a provider **attestation** (hash binding model→prompt→output, so a
    swapped output fails) plus a **known-answer challenge** (proves a real model run, not a canned reply).
- `scripts/demo.js` — drives the full lifecycle on a local Hardhat node, no creds:

```bash
npm run demo
# ① code job      → verify PASS → release + reputation++
# ② inference job → attestation + challenge PASS → release + reputation++
# ③ bad delivery  → verify FAIL → dispute → arbiter refunds client, reputations adjusted
```

## Roadmap

- [x] `WorkEscrow` — escrow + reputation + deadline reclaim, **16 contract tests green**
- [x] Off-chain verification (code sandbox + inference attestation/challenge), **7 tests green**
- [x] End-to-end lifecycle demo on local Hardhat (`npm run demo`)
- [x] A2A discovery — AgentCards + reputation-ranked registry ([a2a-x402](https://github.com/google-agentic-commerce/a2a-x402) v0.2), **8 tests** + `npm run demo:discovery`
- [x] Autonomous agent loop — discover → escrow → deliver → verify → pay/dispute, **4 tests** + `npm run demo:agents`
- [x] Deployed to Arc testnet (`npm run deploy:arc`)
