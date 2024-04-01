//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract PiggyBank {
    uint256 private balance;
    address private owner;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        balance += msg.value;
    }

    function getBalance() external view returns (uint256) {
        return balance;
    }

    function getChainId() external view returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }
}
