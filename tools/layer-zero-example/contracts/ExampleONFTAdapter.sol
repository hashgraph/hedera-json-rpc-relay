// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.22;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ONFT721Adapter} from "@layerzerolabs/onft-evm/contracts/onft721/ONFT721Adapter.sol";

contract ExampleONFTAdapter is ONFT721Adapter {
    constructor(
        address _token,
        address _lzEndpoint,
        address _owner
    ) ONFT721Adapter(_token, _lzEndpoint, _owner) { }
}
