// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Factory event sink so all per-order lifecycle events are observable
/// from a single indexed contract address (the factory) by the off-chain indexer.
interface ILanarkEscrowFactorySink {
    function emitDeposited(bytes32 orderRef, address buyer, uint256 amount) external;
    function emitReleased(bytes32 orderRef, address seller, uint256 sellerAmount, uint256 feeAmount) external;
    function emitRefunded(bytes32 orderRef, address buyer, uint256 amount) external;
    function emitDisputed(bytes32 orderRef, address raisedBy) external;
    function emitResolved(bytes32 orderRef, uint256 buyerAmount, uint256 sellerGross, uint256 feeAmount) external;
}

/// @title LanarkEscrow
/// @notice One EIP-1167 clone per order. Holds a single order's cUSD-class
/// ERC-20 escrow and enforces a strict state machine. Funds are never custodied
/// by LANARK's backend; they live in this clone until release/refund/resolution.
contract LanarkEscrow is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        Created,
        Funded,
        Released,
        Refunded,
        Disputed,
        Resolved
    }

    uint16 public constant MAX_FEE_BPS = 1_000; // 10%
    uint16 public constant BPS_DENOMINATOR = 10_000;

    bytes32 public orderRef;
    address public buyer;
    address public seller;
    IERC20 public token;
    uint256 public amount;
    uint256 public deadline;
    uint16 public feeBps;
    address public feeCollector;
    address public arbiter;
    address public factory;
    State public state;

    event Initialized(
        bytes32 indexed orderRef,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        uint256 deadline
    );
    event Deposited(bytes32 indexed orderRef, address indexed buyer, uint256 amount);
    event Released(bytes32 indexed orderRef, address indexed seller, uint256 sellerAmount, uint256 feeAmount);
    event Refunded(bytes32 indexed orderRef, address indexed buyer, uint256 amount);
    event Disputed(bytes32 indexed orderRef, address indexed raisedBy);
    event Resolved(bytes32 indexed orderRef, uint256 buyerAmount, uint256 sellerGross, uint256 feeAmount);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidDeadline();
    error InvalidFee();
    error InvalidState(State expected, State actual);
    error Unauthorized();
    error DepositExpired();
    error RefundNotAvailable();
    error InvalidSplit();
    error InvalidDepositAmount();

    constructor() {
        // Lock the implementation so it can never be initialized directly.
        _disableInitializers();
    }

    function initialize(
        address buyer_,
        address seller_,
        address token_,
        uint256 amount_,
        uint256 deadline_,
        uint16 feeBps_,
        address feeCollector_,
        address arbiter_,
        bytes32 orderRef_,
        address factory_
    ) external initializer {
        if (
            buyer_ == address(0) ||
            seller_ == address(0) ||
            token_ == address(0) ||
            feeCollector_ == address(0) ||
            arbiter_ == address(0) ||
            factory_ == address(0)
        ) revert ZeroAddress();
        if (buyer_ == seller_) revert Unauthorized();
        if (amount_ == 0) revert ZeroAmount();
        if (deadline_ <= block.timestamp) revert InvalidDeadline();
        if (feeBps_ > MAX_FEE_BPS) revert InvalidFee();
        if (orderRef_ == bytes32(0)) revert ZeroAmount();

        buyer = buyer_;
        seller = seller_;
        token = IERC20(token_);
        amount = amount_;
        deadline = deadline_;
        feeBps = feeBps_;
        feeCollector = feeCollector_;
        arbiter = arbiter_;
        orderRef = orderRef_;
        factory = factory_;
        state = State.Created;

        emit Initialized(orderRef_, buyer_, seller_, token_, amount_, deadline_);
    }

    /// @notice Buyer funds the escrow. Verifies the exact received amount to
    /// reject fee-on-transfer/rebasing tokens that would underfund the order.
    function deposit() external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (state != State.Created) revert InvalidState(State.Created, state);
        if (block.timestamp > deadline) revert DepositExpired();

        state = State.Funded;

        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - beforeBalance;
        if (received != amount) revert InvalidDepositAmount();

        emit Deposited(orderRef, buyer, amount);
        ILanarkEscrowFactorySink(factory).emitDeposited(orderRef, buyer, amount);
    }

    /// @notice Release funds to the seller (net of protocol fee). Buyer or
    /// arbiter confirm fulfillment; seller is also allowed for flows where
    /// off-chain business logic already gates release.
    function release() external nonReentrant {
        if (msg.sender != seller && msg.sender != buyer && msg.sender != arbiter) revert Unauthorized();
        if (state != State.Funded) revert InvalidState(State.Funded, state);

        state = State.Released;
        (uint256 feeAmount, uint256 sellerAmount) = _feeSplit(amount);

        emit Released(orderRef, seller, sellerAmount, feeAmount);
        ILanarkEscrowFactorySink(factory).emitReleased(orderRef, seller, sellerAmount, feeAmount);

        if (feeAmount > 0) token.safeTransfer(feeCollector, feeAmount);
        token.safeTransfer(seller, sellerAmount);
    }

    /// @notice Refund the buyer. Buyer may self-refund only after the deadline;
    /// the arbiter may refund at any time while funded.
    function refund() external nonReentrant {
        if (state != State.Funded) revert InvalidState(State.Funded, state);

        bool arbiterRefund = msg.sender == arbiter;
        bool buyerTimeoutRefund = msg.sender == buyer && block.timestamp > deadline;
        if (!arbiterRefund && !buyerTimeoutRefund) revert RefundNotAvailable();

        state = State.Refunded;
        emit Refunded(orderRef, buyer, amount);
        ILanarkEscrowFactorySink(factory).emitRefunded(orderRef, buyer, amount);

        token.safeTransfer(buyer, amount);
    }

    function raiseDispute() external {
        if (msg.sender != buyer && msg.sender != seller) revert Unauthorized();
        if (state != State.Funded) revert InvalidState(State.Funded, state);

        state = State.Disputed;
        emit Disputed(orderRef, msg.sender);
        ILanarkEscrowFactorySink(factory).emitDisputed(orderRef, msg.sender);
    }

    /// @notice Arbiter splits the escrow. The fee is taken only from the
    /// seller's gross share; the buyer refund portion is fee-free.
    function resolveDispute(uint256 buyerAmount, uint256 sellerGross) external nonReentrant {
        if (msg.sender != arbiter) revert Unauthorized();
        if (state != State.Disputed) revert InvalidState(State.Disputed, state);
        if (buyerAmount + sellerGross != amount) revert InvalidSplit();

        state = State.Resolved;
        (uint256 feeAmount, uint256 sellerNet) = _feeSplit(sellerGross);

        emit Resolved(orderRef, buyerAmount, sellerGross, feeAmount);
        ILanarkEscrowFactorySink(factory).emitResolved(orderRef, buyerAmount, sellerGross, feeAmount);

        if (buyerAmount > 0) token.safeTransfer(buyer, buyerAmount);
        if (feeAmount > 0) token.safeTransfer(feeCollector, feeAmount);
        if (sellerNet > 0) token.safeTransfer(seller, sellerNet);
    }

    function _feeSplit(uint256 gross) internal view returns (uint256 feeAmount, uint256 net) {
        feeAmount = (gross * feeBps) / BPS_DENOMINATOR;
        net = gross - feeAmount;
    }
}
