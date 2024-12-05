// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/Script.sol";
import {USDC} from "../src/USDC.sol";

contract DeployTokens is Script {
    function run() external {
        // Fetch the deployer's private key from environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcast for transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy TestERC20
        USDC testERC20 = new USDC("Test USDC", "USDC");
        console.log("USDC deployed to:", address(testERC20));

        vm.stopBroadcast();
    }
}