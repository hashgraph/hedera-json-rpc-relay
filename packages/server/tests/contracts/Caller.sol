//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Caller {
    constructor() {
    }

    function pureMultiply() public pure returns (int) {
        return 2*2;
    }

    function msgSender() public view returns (address) {
        return msg.sender;
    }

    function txOrigin() public view returns (address) {
        return tx.origin;
    }

    function msgSig() public view returns (bytes4) {
        return msg.sig;
    }

    function addressBalance(address addr) public view returns (uint256) {
        return addr.balance;
    }
}
