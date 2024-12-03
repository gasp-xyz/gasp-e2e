// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./FiatTokenV1_1.sol";
import "./EIP3009.sol";
import "./EIP2612.sol";

contract USDT is FiatTokenV1_1, EIP3009, EIP2612 {
    constructor(
        string memory name,
        string memory symbol,
        string memory currency,
        uint8 decimals_,
        address masterMinter,
        address pauser,
        address blacklister,
        address owner
    ) FiatTokenV1_1(name, symbol, currency, decimals_, masterMinter, pauser, blacklister, owner) {
        // Mint initial supply of tokens to the deployer for testing
        _mint(msg.sender, 1_000_000_000 * 10**decimals_); // 1 billion tokens
    }

    // Function to mint more tokens for testing
    function mintTestTokens(address to, uint256 amount) external {
        _mint(to, amount);
    }
}