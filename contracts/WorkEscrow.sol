// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title WorkEscrow
/// @notice USDC escrow for agent-to-agent jobs. A client funds a "deal" for a
///         worker; the worker is paid on release; either party can dispute; an
///         arbiter settles. Reputation accrues on-chain. A client can reclaim
///         funds if the deadline lapses while the deal is still open.
/// @dev    State is modelled as a single Status enum (rather than separate flags),
///         and reputation is a struct tracking score + deliveries + lost disputes.
contract WorkEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Open, // funded, awaiting release / dispute / reclaim
        Released, // client released payment to the worker
        Disputed, // a party flagged it for the arbiter
        Settled // arbiter ruled, or client reclaimed after deadline
    }

    struct Deal {
        address client;
        address worker;
        uint128 amount; // USDC (6dp) — comfortably within uint128
        uint64 deadline; // unix seconds
        Status status;
    }

    struct Reputation {
        int64 score; // +1 delivered, -1 lost dispute
        uint32 delivered; // jobs paid out
        uint32 disputesLost; // disputes ruled against
    }

    IERC20 public immutable token; // USDC
    address public immutable arbiter; // rules disputes, collects the fee
    uint16 public immutable feeBips; // protocol fee in basis points (<=1000)

    uint256 public dealCount;
    mapping(uint256 => Deal) private _deals;
    mapping(address => Reputation) public reputationOf;

    uint16 private constant BIPS = 10_000;
    uint16 private constant MAX_FEE = 1_000; // 10% ceiling

    error ZeroAddress();
    error SelfDeal();
    error ZeroAmount();
    error DeadlineInPast();
    error FeeTooHigh();
    error AllowanceTooLow();
    error NoSuchDeal();
    error OnlyClient();
    error OnlyArbiter();
    error NotAParty();
    error NotOpen();
    error NotDisputed();
    error DeadlineNotReached();

    event DealOpened(uint256 indexed id, address indexed client, address indexed worker, uint128 amount, uint64 deadline);
    event Released(uint256 indexed id, address indexed worker, uint128 paid, uint128 fee);
    event Disputed(uint256 indexed id, address indexed by);
    event Arbitrated(uint256 indexed id, bool workerWon, address indexed paidTo, uint128 amount);
    event Reclaimed(uint256 indexed id, address indexed client, uint128 amount);

    constructor(address usdc, address arbiter_, uint16 feeBips_) {
        if (usdc == address(0) || arbiter_ == address(0)) revert ZeroAddress();
        if (feeBips_ > MAX_FEE) revert FeeTooHigh();
        token = IERC20(usdc);
        arbiter = arbiter_;
        feeBips = feeBips_;
    }

    /// @notice Fund a new deal for `worker`, returning its id.
    function createEscrow(address worker, uint256 amount, uint256 deadline)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (worker == address(0)) revert ZeroAddress();
        if (worker == msg.sender) revert SelfDeal();
        if (amount == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (token.allowance(msg.sender, address(this)) < amount) revert AllowanceTooLow();

        token.safeTransferFrom(msg.sender, address(this), amount);

        id = dealCount;
        unchecked {
            dealCount = id + 1;
        }
        _deals[id] = Deal(msg.sender, worker, uint128(amount), uint64(deadline), Status.Open);
        emit DealOpened(id, msg.sender, worker, uint128(amount), uint64(deadline));
    }

    /// @notice Client releases payment to the worker; worker reputation +1.
    function completeEscrow(uint256 id) external nonReentrant {
        Deal storage d = _load(id);
        if (msg.sender != d.client) revert OnlyClient();
        if (d.status != Status.Open) revert NotOpen();

        d.status = Status.Released;
        (uint128 paid, uint128 fee) = _split(d.amount);

        Reputation storage r = reputationOf[d.worker];
        unchecked {
            r.score += 1;
            r.delivered += 1;
        }

        token.safeTransfer(d.worker, paid);
        if (fee > 0) token.safeTransfer(arbiter, fee);
        emit Released(id, d.worker, paid, fee);
    }

    /// @notice Either party flags the deal for arbitration.
    function raiseDispute(uint256 id) external {
        Deal storage d = _load(id);
        if (msg.sender != d.client && msg.sender != d.worker) revert NotAParty();
        if (d.status != Status.Open) revert NotOpen();
        d.status = Status.Disputed;
        emit Disputed(id, msg.sender);
    }

    /// @notice Arbiter rules a disputed deal; loser's reputation -1.
    function resolveDispute(uint256 id, bool workerWins) external nonReentrant {
        if (msg.sender != arbiter) revert OnlyArbiter();
        Deal storage d = _load(id);
        if (d.status != Status.Disputed) revert NotDisputed();

        d.status = Status.Settled;
        address winner = workerWins ? d.worker : d.client;
        address loser = workerWins ? d.client : d.worker;
        unchecked {
            reputationOf[winner].score += 1;
            reputationOf[loser].score -= 1;
            reputationOf[loser].disputesLost += 1;
        }
        token.safeTransfer(winner, d.amount);
        emit Arbitrated(id, workerWins, winner, d.amount);
    }

    /// @notice Client recovers funds if the deadline passed and the deal is still open.
    function reclaim(uint256 id) external nonReentrant {
        Deal storage d = _load(id);
        if (msg.sender != d.client) revert OnlyClient();
        if (d.status != Status.Open) revert NotOpen();
        if (block.timestamp <= d.deadline) revert DeadlineNotReached();
        d.status = Status.Settled;
        token.safeTransfer(d.client, d.amount);
        emit Reclaimed(id, d.client, d.amount);
    }

    // ---- views ----

    /// @notice Backwards-friendly tuple view (status flattened to two booleans).
    function getEscrow(uint256 id)
        external
        view
        returns (address client, address worker, uint256 amount, uint256 deadline, bool completed, bool disputed)
    {
        Deal storage d = _deals[id];
        return (
            d.client,
            d.worker,
            d.amount,
            d.deadline,
            d.status == Status.Released || d.status == Status.Settled,
            d.status == Status.Disputed
        );
    }

    function reputationScore(address who) external view returns (int256) {
        return reputationOf[who].score;
    }

    function escrowCount() external view returns (uint256) {
        return dealCount;
    }

    function usdc() external view returns (address) {
        return address(token);
    }

    // ---- internals ----

    function _load(uint256 id) private view returns (Deal storage d) {
        d = _deals[id];
        if (d.client == address(0)) revert NoSuchDeal();
    }

    function _split(uint128 amount) private view returns (uint128 paid, uint128 fee) {
        fee = uint128((uint256(amount) * feeBips) / BIPS);
        paid = amount - fee;
    }
}
