// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDC is ERC20 {
    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        // Mint initial tokens
        _mint(msg.sender, 1_000_000_000 * 10**decimals());
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mintTestTokens(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
