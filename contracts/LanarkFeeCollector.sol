// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LanarkFeeCollector
/// @notice Receives protocol fees from escrows and lets the owner sweep them to
/// the treasury. Holds no business logic beyond custody + withdrawal.
contract LanarkFeeCollector is Ownable {
    using SafeERC20 for IERC20;

    address public treasury;

    event TreasuryUpdated(address indexed treasury);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error NothingToWithdraw();

    constructor(address owner_, address treasury_) Ownable(owner_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Sweep the full balance of `token` to the treasury.
    function withdrawAll(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert NothingToWithdraw();
        IERC20(token).safeTransfer(treasury, bal);
        emit Withdrawn(token, treasury, bal);
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert NothingToWithdraw();
        IERC20(token).safeTransfer(treasury, amount);
        emit Withdrawn(token, treasury, amount);
    }
}
