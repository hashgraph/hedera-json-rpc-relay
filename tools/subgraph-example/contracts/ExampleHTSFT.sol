// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract ExampleHTSFT is ERC20 {
    constructor(uint256 initialSupply) ERC20("ffff", "F") {
    _mint(msg.sender, initialSupply);
  }
}
