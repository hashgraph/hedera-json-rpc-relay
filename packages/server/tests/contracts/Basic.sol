//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
contract Basic {

    constructor() {}

    function ping() public pure returns (int) {
        return 1;
    }

    receive() external payable { }
}
