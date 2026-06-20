const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const USDC = (n) => ethers.parseUnits(String(n), 6);
const FEE_BIPS = 250; // 2.5%
const DAY = 24 * 60 * 60;

async function deploy() {
  const [arbiter, client, worker, other] = await ethers.getSigners();

  const Mock = await ethers.getContractFactory("MockERC20");
  const usdc = await Mock.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();

  const WorkEscrow = await ethers.getContractFactory("WorkEscrow");
  const escrow = await WorkEscrow.connect(arbiter).deploy(await usdc.getAddress(), arbiter.address, FEE_BIPS);
  await escrow.waitForDeployment();

  await usdc.mint(client.address, USDC(10_000));
  await usdc.connect(client).approve(await escrow.getAddress(), ethers.MaxUint256);

  return { escrow, usdc, arbiter, client, worker, other };
}

const future = async () => (await time.latest()) + DAY;

describe("WorkEscrow", function () {
  describe("deployment", function () {
    it("stores token, arbiter and fee", async function () {
      const { escrow, usdc, arbiter } = await loadFixture(deploy);
      expect(await escrow.usdc()).to.equal(await usdc.getAddress());
      expect(await escrow.arbiter()).to.equal(arbiter.address);
      expect(await escrow.feeBips()).to.equal(FEE_BIPS);
      expect(await escrow.dealCount()).to.equal(0);
    });

    it("rejects a zero usdc or arbiter address", async function () {
      const [a] = await ethers.getSigners();
      const W = await ethers.getContractFactory("WorkEscrow");
      await expect(W.deploy(ethers.ZeroAddress, a.address, FEE_BIPS)).to.be.revertedWithCustomError(W, "ZeroAddress");
    });

    it("rejects a fee above 10%", async function () {
      const { usdc, arbiter } = await loadFixture(deploy);
      const W = await ethers.getContractFactory("WorkEscrow");
      await expect(W.deploy(await usdc.getAddress(), arbiter.address, 1001)).to.be.revertedWithCustomError(W, "FeeTooHigh");
    });
  });

  describe("opening a deal", function () {
    it("locks USDC and emits DealOpened", async function () {
      const { escrow, usdc, client, worker } = await loadFixture(deploy);
      const dl = await future();
      await expect(escrow.connect(client).createEscrow(worker.address, USDC(100), dl))
        .to.emit(escrow, "DealOpened")
        .withArgs(0, client.address, worker.address, USDC(100), dl);
      expect(await escrow.dealCount()).to.equal(1);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(USDC(100));
      const d = await escrow.getEscrow(0);
      expect(d.client).to.equal(client.address);
      expect(d.completed).to.equal(false);
      expect(d.disputed).to.equal(false);
    });

    it("rejects bad inputs", async function () {
      const { escrow, client, worker } = await loadFixture(deploy);
      const dl = await future();
      await expect(escrow.connect(client).createEscrow(ethers.ZeroAddress, USDC(1), dl)).to.be.revertedWithCustomError(escrow, "ZeroAddress");
      await expect(escrow.connect(client).createEscrow(client.address, USDC(1), dl)).to.be.revertedWithCustomError(escrow, "SelfDeal");
      await expect(escrow.connect(client).createEscrow(worker.address, 0, dl)).to.be.revertedWithCustomError(escrow, "ZeroAmount");
      await expect(escrow.connect(client).createEscrow(worker.address, USDC(1), (await time.latest()) - 1)).to.be.revertedWithCustomError(escrow, "DeadlineInPast");
    });
  });

  describe("releasing payment", function () {
    it("pays the worker minus fee and bumps reputation", async function () {
      const { escrow, usdc, arbiter, client, worker } = await loadFixture(deploy);
      await escrow.connect(client).createEscrow(worker.address, USDC(100), await future());

      const fee = (USDC(100) * BigInt(FEE_BIPS)) / 10000n;
      await expect(escrow.connect(client).completeEscrow(0))
        .to.emit(escrow, "Released")
        .withArgs(0, worker.address, USDC(100) - fee, fee);

      expect(await usdc.balanceOf(worker.address)).to.equal(USDC(100) - fee);
      expect(await usdc.balanceOf(arbiter.address)).to.equal(fee);
      expect(await escrow.reputationScore(worker.address)).to.equal(1);
      const rep = await escrow.reputationOf(worker.address);
      expect(rep.delivered).to.equal(1);
    });

    it("only the client can release, and only once", async function () {
      const { escrow, client, worker } = await loadFixture(deploy);
      await escrow.connect(client).createEscrow(worker.address, USDC(50), await future());
      await expect(escrow.connect(worker).completeEscrow(0)).to.be.revertedWithCustomError(escrow, "OnlyClient");
      await escrow.connect(client).completeEscrow(0);
      await expect(escrow.connect(client).completeEscrow(0)).to.be.revertedWithCustomError(escrow, "NotOpen");
    });
  });

  describe("disputes", function () {
    it("either party can dispute; an outsider cannot", async function () {
      const { escrow, client, worker, other } = await loadFixture(deploy);
      await escrow.connect(client).createEscrow(worker.address, USDC(80), await future());
      await expect(escrow.connect(other).raiseDispute(0)).to.be.revertedWithCustomError(escrow, "NotAParty");
      await expect(escrow.connect(worker).raiseDispute(0)).to.emit(escrow, "Disputed").withArgs(0, worker.address);
    });

    it("arbiter rules for the worker", async function () {
      const { escrow, usdc, arbiter, client, worker } = await loadFixture(deploy);
      await escrow.connect(client).createEscrow(worker.address, USDC(80), await future());
      await escrow.connect(client).raiseDispute(0);
      await expect(escrow.connect(arbiter).resolveDispute(0, true))
        .to.emit(escrow, "Arbitrated")
        .withArgs(0, true, worker.address, USDC(80));
      expect(await usdc.balanceOf(worker.address)).to.equal(USDC(80)); // no fee on disputes
      expect(await escrow.reputationScore(worker.address)).to.equal(1);
      expect(await escrow.reputationScore(client.address)).to.equal(-1);
      expect((await escrow.reputationOf(client.address)).disputesLost).to.equal(1);
    });

    it("arbiter rules for the client and refunds", async function () {
      const { escrow, usdc, arbiter, client, worker } = await loadFixture(deploy);
      const before = await usdc.balanceOf(client.address);
      await escrow.connect(client).createEscrow(worker.address, USDC(80), await future());
      await escrow.connect(client).raiseDispute(0);
      await escrow.connect(arbiter).resolveDispute(0, false);
      expect(await usdc.balanceOf(client.address)).to.equal(before); // fully refunded
      expect(await escrow.reputationScore(worker.address)).to.equal(-1);
    });

    it("only the arbiter resolves, only when disputed", async function () {
      const { escrow, arbiter, client, worker, other } = await loadFixture(deploy);
      await escrow.connect(client).createEscrow(worker.address, USDC(80), await future());
      await expect(escrow.connect(arbiter).resolveDispute(0, true)).to.be.revertedWithCustomError(escrow, "NotDisputed");
      await escrow.connect(client).raiseDispute(0);
      await expect(escrow.connect(other).resolveDispute(0, true)).to.be.revertedWithCustomError(escrow, "OnlyArbiter");
    });
  });

  describe("reclaim after deadline (new)", function () {
    it("lets the client recover funds once the deadline passes", async function () {
      const { escrow, usdc, client, worker } = await loadFixture(deploy);
      const before = await usdc.balanceOf(client.address);
      await escrow.connect(client).createEscrow(worker.address, USDC(60), await future());
      await expect(escrow.connect(client).reclaim(0)).to.be.revertedWithCustomError(escrow, "DeadlineNotReached");
      await time.increase(DAY + 1);
      await expect(escrow.connect(client).reclaim(0)).to.emit(escrow, "Reclaimed").withArgs(0, client.address, USDC(60));
      expect(await usdc.balanceOf(client.address)).to.equal(before);
    });
  });

  describe("reputation", function () {
    it("accrues across multiple delivered jobs", async function () {
      const { escrow, client, worker } = await loadFixture(deploy);
      for (let i = 0; i < 3; i++) {
        await escrow.connect(client).createEscrow(worker.address, USDC(10), await future());
        await escrow.connect(client).completeEscrow(i);
      }
      expect(await escrow.reputationScore(worker.address)).to.equal(3);
      expect((await escrow.reputationOf(worker.address)).delivered).to.equal(3);
    });
  });
});
