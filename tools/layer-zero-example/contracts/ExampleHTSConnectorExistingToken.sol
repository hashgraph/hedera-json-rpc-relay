// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./hts/HederaTokenService.sol";
import "./hts/IHederaTokenService.sol";
import "./hts/KeyHelper.sol";
import "./HTSConnectorExistingToken.sol";

contract ExampleHTSConnectorExistingToken is Ownable, HTSConnectorExistingToken {
    constructor(
        address _tokenAddress,
        address _lzEndpoint,
        address _delegate
    ) payable HTSConnectorExistingToken(_tokenAddress, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
