// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/Script.sol";
import {USDC} from "../src/USDC.sol";
import {USDT} from "../src/USDT.sol";

contract DeployTokens is Script {
    function run() external {
        // Fetch the deployer's private key from environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcast for transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy TestERC20
        TestERC20 testERC20 = new USDC("Test USDC", "USDC", "cUSDC",10);
        console.log("USDC deployed to:", address(testERC20));

        // Deploy TestCustomToken
        TestCustomToken testCustomToken = new USDT("Test USDT", "USDT", "cUSDT",6);
        console.log("USDT deployed to:", address(testCustomToken));

        vm.stopBroadcast();
    }
}