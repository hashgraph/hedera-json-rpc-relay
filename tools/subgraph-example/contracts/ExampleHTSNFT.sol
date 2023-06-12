// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ExampleHTSNFT is ERC721 {
  constructor() ERC721("Example", "F") {
  }
}
