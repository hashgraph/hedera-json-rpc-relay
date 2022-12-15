// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ExampleERC721 is ERC721 {
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;

  constructor() ERC721("Example", "EXP") {
  }

  function mint(address to) public {
    _tokenIds.increment();

    _mint(to, _tokenIds.current());
  }
}
