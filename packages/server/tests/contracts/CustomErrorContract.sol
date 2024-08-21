// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract CustomErrorContract {
    error NativeCurrencyNotAccepted();

    receive() external payable {
        revert NativeCurrencyNotAccepted();
    }

    // A function to check the contract's balance (for testing purposes)
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}