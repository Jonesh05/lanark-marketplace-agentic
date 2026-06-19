// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {LanarkEscrowFactory} from "../contracts/LanarkEscrowFactory.sol";
import {LanarkFeeCollector} from "../contracts/LanarkFeeCollector.sol";
import {MockERC20} from "../contracts/MockERC20.sol";

/// @notice Deploys the LANARK settlement stack to Celo Sepolia.
///
/// Required env:
///   PRIVATE_KEY          deployer key
///   LANARK_TREASURY      address that ultimately receives fees
///   LANARK_ARBITER       dispute arbiter
///   LANARK_FACTORY_OWNER owner (settlement worker) of the factory
///   LANARK_FEE_BPS       protocol fee (e.g. 100 = 1%)
///   LANARK_SETTLEMENT_TOKEN  optional; if empty, a MockERC20 is deployed
///
/// Run:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url celo_sepolia --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("LANARK_TREASURY");
        address arbiter = vm.envAddress("LANARK_ARBITER");
        address owner = vm.envAddress("LANARK_FACTORY_OWNER");
        uint16 feeBps = uint16(vm.envUint("LANARK_FEE_BPS"));
        address token = vm.envOr("LANARK_SETTLEMENT_TOKEN", address(0));

        vm.startBroadcast(pk);

        // If no settlement token is provided, deploy a testnet MockERC20 cUSD.
        if (token == address(0)) {
            MockERC20 mock = new MockERC20("Mock cUSD", "mcUSD", 18);
            token = address(mock);
            console2.log("MockERC20 (mcUSD):", token);
        }

        LanarkFeeCollector feeCollector = new LanarkFeeCollector(owner, treasury);
        LanarkEscrowFactory factory =
            new LanarkEscrowFactory(owner, token, address(feeCollector), arbiter, feeBps);

        vm.stopBroadcast();

        console2.log("SettlementToken:", token);
        console2.log("LanarkFeeCollector:", address(feeCollector));
        console2.log("LanarkEscrowFactory:", address(factory));
        console2.log("Set LANARK_ESCROW_FACTORY and LANARK_SETTLEMENT_TOKEN in .env to these.");
    }
}
