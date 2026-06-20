// Live Arc integration for the deployed WorkEscrow contract. `Market` exposes the
// same adapter interface the agents already use (createEscrow / completeEscrow /
// raiseDispute / resolveDispute / reputationScore), but against the real contract
// on Arc testnet with real test-USDC — so the autonomous loop and the demo on a
// local Hardhat node share identical agent code.

import { ethers } from "ethers";

const RPC = process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
const USDC = "0x3600000000000000000000000000000000000000";
export const EXPLORER = "https://testnet.arcscan.app";

const ESCROW_ABI = [
  "function createEscrow(address provider, uint256 amount, uint256 deadline) returns (uint256)",
  "function completeEscrow(uint256 escrowId)",
  "function raiseDispute(uint256 escrowId)",
  "function resolveDispute(uint256 escrowId, bool providerWins)",
  "function getEscrow(uint256 escrowId) view returns (address client, address provider, uint256 amount, uint256 deadline, bool completed, bool disputed)",
  "function reputationScore(address) view returns (int256)",
  "function escrowCount() view returns (uint256)",
  "event DealOpened(uint256 indexed id, address indexed client, address indexed worker, uint128 amount, uint64 deadline)",
  "event Released(uint256 indexed id, address indexed worker, uint128 paid, uint128 fee)",
  "event Disputed(uint256 indexed id, address indexed by)",
  "event Arbitrated(uint256 indexed id, bool workerWon, address indexed paidTo, uint128 amount)",
];
const USDC_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

export class Market {
  constructor({ clientKey, arbiterKey, escrowAddress, log = () => {} }) {
    // Harden against a flaky/slow RPC: long timeout, no JSON-RPC batching (Arc's
    // RPC is happier one-at-a-time), static network, and brisk polling for receipts.
    const req = new ethers.FetchRequest(RPC);
    req.timeout = 180000;
    this.provider = new ethers.JsonRpcProvider(
      req,
      { chainId: 5042002, name: "arc-testnet" },
      { staticNetwork: true, batchMaxCount: 1, pollingInterval: 1500 },
    );
    this.client = new ethers.Wallet(clientKey, this.provider);
    this.arbiter = arbiterKey ? new ethers.Wallet(arbiterKey, this.provider) : this.client;
    this.address = escrowAddress;
    this.read = new ethers.Contract(escrowAddress, ESCROW_ABI, this.provider);
    this.asClient = new ethers.Contract(escrowAddress, ESCROW_ABI, this.client);
    this.asArbiter = new ethers.Contract(escrowAddress, ESCROW_ABI, this.arbiter);
    this.usdc = new ethers.Contract(USDC, USDC_ABI, this.client);
    this.log = log;
  }

  _amt(usd) {
    return ethers.parseUnits(String(usd), 6);
  }
  _link(hash) {
    return `${EXPLORER}/tx/${hash}`;
  }

  // The public RPC intermittently times out while polling for receipts. The send
  // already landed, so we just keep polling (a safe read to retry) until it shows.
  async _wait(hash, tries = 40) {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await this.provider.getTransactionReceipt(hash);
        if (r) return r;
      } catch {
        /* transient RPC timeout — retry */
      }
      await new Promise((res) => setTimeout(res, 2000));
    }
    throw new Error(`receipt not found after polling: ${hash}`);
  }

  // Send a tx with retry. If a send times out we check on-chain state before
  // retrying, so we never double-execute when the tx actually landed.
  async _send(sendFn, { label, alreadyDone }) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const tx = await sendFn();
        await this._wait(tx.hash);
        return tx.hash;
      } catch (e) {
        const msg = (e.shortMessage || e.message || "").toLowerCase();
        if (alreadyDone && (await alreadyDone().catch(() => false))) {
          this.log(`${label}: confirmed on-chain despite "${msg.slice(0, 36)}"`);
          return null;
        }
        if (/timeout|econnreset|network|server_error|detect network|socket|50\d/.test(msg) && attempt < 4) {
          this.log(`${label}: ${msg.slice(0, 48)} — retry ${attempt + 1}`);
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        throw e;
      }
    }
  }

  async ensureApproval(usd) {
    const need = this._amt(usd);
    const cur = await this._read(() => this.usdc.allowance(this.client.address, this.address));
    if (cur >= need) return;
    const hash = await this._send(() => this.usdc.approve(this.address, need), {
      label: "approve",
      alreadyDone: async () => (await this.usdc.allowance(this.client.address, this.address)) >= need,
    });
    this.log(`approved ${usd} USDC for escrow${hash ? ` (${this._link(hash)})` : ""}`);
  }

  // --- adapter interface used by ClientAgent ---

  async createEscrow(provider, amountUsdc, deadlineSecs = 3600) {
    const before = await this.escrowCount();
    const deadline = Math.floor(Date.now() / 1000) + deadlineSecs;
    const hash = await this._send(
      () => this.asClient.createEscrow(provider, this._amt(amountUsdc), deadline),
      { label: "createEscrow", alreadyDone: async () => (await this.escrowCount()) > before },
    );
    const id = BigInt(before); // sequential single client → the new escrow's id
    this.log(`createEscrow #${id} → ${provider.slice(0, 8)} ${amountUsdc} USDC${hash ? ` (${this._link(hash)})` : ""}`);
    return id;
  }

  async completeEscrow(id) {
    const hash = await this._send(() => this.asClient.completeEscrow(id), {
      label: `completeEscrow #${id}`,
      alreadyDone: async () => (await this.getEscrow(id)).completed,
    });
    this.log(`completeEscrow #${id}${hash ? ` (${this._link(hash)})` : ""}`);
    return hash;
  }

  async raiseDispute(id) {
    const hash = await this._send(() => this.asClient.raiseDispute(id), {
      label: `raiseDispute #${id}`,
      alreadyDone: async () => (await this.getEscrow(id)).disputed,
    });
    this.log(`raiseDispute #${id}${hash ? ` (${this._link(hash)})` : ""}`);
    return hash;
  }

  async resolveDispute(id, providerWins) {
    const hash = await this._send(() => this.asArbiter.resolveDispute(id, providerWins), {
      label: `resolveDispute #${id}`,
      alreadyDone: async () => (await this.getEscrow(id)).completed,
    });
    this.log(`resolveDispute #${id} providerWins=${providerWins}${hash ? ` (${this._link(hash)})` : ""}`);
    return hash;
  }

  // Retry reads on transient RPC timeouts.
  async _read(fn, tries = 5) {
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (e) {
        if (i === tries - 1) throw e;
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
  }

  async reputationScore(addr) {
    return Number(await this._read(() => this.read.reputationScore(addr)));
  }

  // --- reads for the marketplace UI ---

  async escrowCount() {
    return Number(await this._read(() => this.read.escrowCount()));
  }

  async getEscrow(id) {
    const e = await this._read(() => this.read.getEscrow(id));
    return {
      id,
      client: e[0],
      provider: e[1],
      amountUsdc: ethers.formatUnits(e[2], 6),
      deadline: Number(e[3]),
      completed: e[4],
      disputed: e[5],
    };
  }

  async usdcBalance(addr) {
    return ethers.formatUnits(await this.usdc.balanceOf(addr), 6);
  }

  // Classify each escrow by its terminal EVENT (not the flattened status flag):
  //   Released  → worker was paid          → { paid: id -> amount }
  //   Arbitrated/Disputed → went to dispute → { disputed: Set<id> }
  // This is how the UI distinguishes a paid job from a resolved dispute, since a
  // resolved dispute lands in Status.Settled (so getEscrow's `disputed` is false).
  async scanSettlements() {
    const paid = new Map();
    const disputed = new Set();
    // The RPC caps getLogs at ~9000 blocks, so we scan in chunks back from latest.
    const CHUNK = 9000;
    const CHUNKS = 6; // ~54k blocks ≈ enough to cover a freshly-deployed contract
    let latest;
    try {
      latest = await this._read(() => this.provider.getBlockNumber(), 3);
    } catch {
      return { paid, disputed };
    }
    for (let i = 0; i < CHUNKS; i++) {
      const to = latest - i * CHUNK;
      const from = Math.max(0, to - CHUNK + 1);
      try {
        const rel = await this._read(() => this.read.queryFilter(this.read.filters.Released(), from, to), 2);
        for (const ev of rel) paid.set(Number(ev.args.id), ethers.formatUnits(ev.args.paid, 6));
      } catch {}
      for (const name of ["Arbitrated", "Disputed"]) {
        try {
          const evs = await this._read(() => this.read.queryFilter(this.read.filters[name](), from, to), 2);
          for (const ev of evs) disputed.add(Number(ev.args.id));
        } catch {}
      }
      if (from === 0) break;
    }
    return { paid, disputed };
  }
}
