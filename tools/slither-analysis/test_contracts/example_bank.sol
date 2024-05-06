// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract example_bank {
    mapping(address => uint256) public balances;

    // Allow users to deposit ether into their bank balance
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    // Allow users to withdraw ether from their bank balance
    function withdraw(uint256 _amount) public {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        (bool sent, ) = msg.sender.call{value: _amount}("");
        require(sent, "Failed to send Ether");
        balances[msg.sender] -= _amount;
    }

    // Get the balance of an account
    function getBalance() public view returns (uint256) {
        return balances[msg.sender];
    }
}