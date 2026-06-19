// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {LanarkEscrow} from "./LanarkEscrow.sol";

/// @title LanarkEscrowFactory
/// @notice Deploys one EIP-1167 minimal-proxy clone of LanarkEscrow per order
/// using CREATE2 with salt = orderRef, so the escrow address is deterministic
/// and predictable off-chain BEFORE deployment. Re-emits per-clone lifecycle
/// events from this single address for the indexer.
contract LanarkEscrowFactory is Ownable {
    address public immutable implementation;
    address public defaultToken;
    address public feeCollector;
    address public arbiter;
    uint16 public defaultFeeBps;

    // orderRef => deployed escrow clone
    mapping(bytes32 => address) public escrowOf;

    event EscrowCreated(
        bytes32 indexed orderRef,
        address indexed escrow,
        address indexed buyer,
        address seller,
        address token,
        uint256 amount,
        uint256 deadline
    );
    event Deposited(bytes32 indexed orderRef, address indexed escrow, address buyer, uint256 amount);
    event Released(bytes32 indexed orderRef, address indexed escrow, address seller, uint256 sellerAmount, uint256 feeAmount);
    event Refunded(bytes32 indexed orderRef, address indexed escrow, address buyer, uint256 amount);
    event Disputed(bytes32 indexed orderRef, address indexed escrow, address raisedBy);
    event Resolved(bytes32 indexed orderRef, address indexed escrow, uint256 buyerAmount, uint256 sellerGross, uint256 feeAmount);
    event ConfigUpdated(address defaultToken, address feeCollector, address arbiter, uint16 defaultFeeBps);

    error ZeroAddress();
    error EscrowExists();
    error UnknownEscrow();
    error InvalidFee();

    constructor(
        address owner_,
        address defaultToken_,
        address feeCollector_,
        address arbiter_,
        uint16 defaultFeeBps_
    ) Ownable(owner_) {
        if (defaultToken_ == address(0) || feeCollector_ == address(0) || arbiter_ == address(0)) {
            revert ZeroAddress();
        }
        if (defaultFeeBps_ > 1_000) revert InvalidFee();
        implementation = address(new LanarkEscrow());
        defaultToken = defaultToken_;
        feeCollector = feeCollector_;
        arbiter = arbiter_;
        defaultFeeBps = defaultFeeBps_;
    }

    function setConfig(
        address defaultToken_,
        address feeCollector_,
        address arbiter_,
        uint16 defaultFeeBps_
    ) external onlyOwner {
        if (defaultToken_ == address(0) || feeCollector_ == address(0) || arbiter_ == address(0)) {
            revert ZeroAddress();
        }
        if (defaultFeeBps_ > 1_000) revert InvalidFee();
        defaultToken = defaultToken_;
        feeCollector = feeCollector_;
        arbiter = arbiter_;
        defaultFeeBps = defaultFeeBps_;
        emit ConfigUpdated(defaultToken_, feeCollector_, arbiter_, defaultFeeBps_);
    }

    /// @notice Predicted escrow address for an order, before it is created.
    /// Matches the address `createEscrow` will deploy for the same orderRef.
    function computeEscrowAddress(
        address, /* buyer */
        address, /* seller */
        uint256, /* amount */
        bytes32 orderRef
    ) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, orderRef, address(this));
    }

    /// @notice Create the escrow clone for an order. Restricted to the owner
    /// (LANARK's settlement worker) so order refs map 1:1 to validated orders.
    function createEscrow(
        address buyer,
        address seller,
        uint256 amount,
        uint256 deadline,
        bytes32 orderRef
    ) external onlyOwner returns (address escrow) {
        if (escrowOf[orderRef] != address(0)) revert EscrowExists();

        escrow = Clones.cloneDeterministic(implementation, orderRef);
        escrowOf[orderRef] = escrow;

        LanarkEscrow(escrow).initialize(
            buyer,
            seller,
            defaultToken,
            amount,
            deadline,
            defaultFeeBps,
            feeCollector,
            arbiter,
            orderRef,
            address(this)
        );

        emit EscrowCreated(orderRef, escrow, buyer, seller, defaultToken, amount, deadline);
    }

    // --- Event sink: only the clone for `orderRef` may emit its own events ---

    modifier onlyEscrow(bytes32 orderRef) {
        if (escrowOf[orderRef] != msg.sender) revert UnknownEscrow();
        _;
    }

    function emitDeposited(bytes32 orderRef, address buyer, uint256 amount) external onlyEscrow(orderRef) {
        emit Deposited(orderRef, msg.sender, buyer, amount);
    }

    function emitReleased(bytes32 orderRef, address seller, uint256 sellerAmount, uint256 feeAmount)
        external
        onlyEscrow(orderRef)
    {
        emit Released(orderRef, msg.sender, seller, sellerAmount, feeAmount);
    }

    function emitRefunded(bytes32 orderRef, address buyer, uint256 amount) external onlyEscrow(orderRef) {
        emit Refunded(orderRef, msg.sender, buyer, amount);
    }

    function emitDisputed(bytes32 orderRef, address raisedBy) external onlyEscrow(orderRef) {
        emit Disputed(orderRef, msg.sender, raisedBy);
    }

    function emitResolved(bytes32 orderRef, uint256 buyerAmount, uint256 sellerGross, uint256 feeAmount)
        external
        onlyEscrow(orderRef)
    {
        emit Resolved(orderRef, msg.sender, buyerAmount, sellerGross, feeAmount);
    }
}
