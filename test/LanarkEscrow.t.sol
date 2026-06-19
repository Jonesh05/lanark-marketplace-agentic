// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LanarkEscrow} from "../contracts/LanarkEscrow.sol";
import {LanarkEscrowFactory} from "../contracts/LanarkEscrowFactory.sol";
import {LanarkFeeCollector} from "../contracts/LanarkFeeCollector.sol";
import {MockERC20} from "../contracts/MockERC20.sol";

contract LanarkEscrowTest is Test {
    LanarkEscrowFactory factory;
    LanarkFeeCollector feeCollector;
    MockERC20 token;

    address owner = address(0xA11CE); // factory owner / settlement worker
    address treasury = address(0x7EEA);
    address arbiter = address(0xA4B1);
    address buyer = address(0xB0B);
    address seller = address(0x5E11E2);

    uint16 constant FEE_BPS = 100; // 1%
    uint256 constant AMOUNT = 100 ether; // 100 mcUSD (18 decimals)
    bytes32 constant ORDER = keccak256("order-1");

    function setUp() public {
        token = new MockERC20("Mock cUSD", "mcUSD", 18);
        feeCollector = new LanarkFeeCollector(owner, treasury);
        vm.prank(owner);
        factory = new LanarkEscrowFactory(owner, address(token), address(feeCollector), arbiter, FEE_BPS);

        token.mint(buyer, 1_000 ether);
    }

    function _create() internal returns (address escrow, uint256 deadline) {
        deadline = block.timestamp + 7 days;
        address predicted = factory.computeEscrowAddress(buyer, seller, AMOUNT, ORDER);
        vm.prank(owner);
        escrow = factory.createEscrow(buyer, seller, AMOUNT, deadline, ORDER);
        assertEq(escrow, predicted, "predicted address must match deployed clone");
        assertEq(factory.escrowOf(ORDER), escrow, "registry must record clone");
    }

    function testCreatePredictDepositRelease() public {
        (address escrow,) = _create();

        vm.startPrank(buyer);
        token.approve(escrow, AMOUNT);
        LanarkEscrow(escrow).deposit();
        vm.stopPrank();

        assertEq(token.balanceOf(escrow), AMOUNT, "escrow funded");
        assertEq(uint256(LanarkEscrow(escrow).state()), uint256(LanarkEscrow.State.Funded));

        vm.prank(buyer);
        LanarkEscrow(escrow).release();

        uint256 fee = (AMOUNT * FEE_BPS) / 10_000; // 1 ether
        assertEq(token.balanceOf(address(feeCollector)), fee, "fee to collector");
        assertEq(token.balanceOf(seller), AMOUNT - fee, "net to seller");
        assertEq(token.balanceOf(escrow), 0, "escrow drained");
        assertEq(uint256(LanarkEscrow(escrow).state()), uint256(LanarkEscrow.State.Released));
    }

    function testBuyerRefundAfterDeadline() public {
        (address escrow, uint256 deadline) = _create();

        vm.startPrank(buyer);
        token.approve(escrow, AMOUNT);
        LanarkEscrow(escrow).deposit();
        vm.stopPrank();

        // Before deadline: buyer cannot self-refund.
        vm.prank(buyer);
        vm.expectRevert(LanarkEscrow.RefundNotAvailable.selector);
        LanarkEscrow(escrow).refund();

        vm.warp(deadline + 1);
        vm.prank(buyer);
        LanarkEscrow(escrow).refund();

        assertEq(token.balanceOf(buyer), 1_000 ether, "buyer made whole");
        assertEq(uint256(LanarkEscrow(escrow).state()), uint256(LanarkEscrow.State.Refunded));
    }

    function testArbiterResolveDispute() public {
        (address escrow,) = _create();

        vm.startPrank(buyer);
        token.approve(escrow, AMOUNT);
        LanarkEscrow(escrow).deposit();
        vm.stopPrank();

        vm.prank(buyer);
        LanarkEscrow(escrow).raiseDispute();
        assertEq(uint256(LanarkEscrow(escrow).state()), uint256(LanarkEscrow.State.Disputed));

        uint256 buyerShare = 40 ether;
        uint256 sellerGross = 60 ether;
        vm.prank(arbiter);
        LanarkEscrow(escrow).resolveDispute(buyerShare, sellerGross);

        uint256 fee = (sellerGross * FEE_BPS) / 10_000; // 0.6 ether
        assertEq(token.balanceOf(buyer), 940 ether, "buyer refund portion (fee-free)");
        assertEq(token.balanceOf(seller), sellerGross - fee, "seller net of fee");
        assertEq(token.balanceOf(address(feeCollector)), fee, "fee on seller share only");
        assertEq(uint256(LanarkEscrow(escrow).state()), uint256(LanarkEscrow.State.Resolved));
    }

    function testOnlyBuyerCanDeposit() public {
        (address escrow,) = _create();
        vm.prank(seller);
        vm.expectRevert(LanarkEscrow.Unauthorized.selector);
        LanarkEscrow(escrow).deposit();
    }

    function testCannotCreateDuplicateOrder() public {
        _create();
        vm.prank(owner);
        vm.expectRevert(LanarkEscrowFactory.EscrowExists.selector);
        factory.createEscrow(buyer, seller, AMOUNT, block.timestamp + 1 days, ORDER);
    }
}
