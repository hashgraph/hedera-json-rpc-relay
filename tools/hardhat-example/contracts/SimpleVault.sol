// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@hashgraph/smart-contracts/contracts/safe-hts-precompile/SafeHTS.sol";

import "@hashgraph/smart-contracts/contracts/exchange-rate-precompile/SelfFunding.sol";

contract SimpleVault is SelfFunding, SafeHTS {

    // the hedera json rpc relay is set up such that 1e18 is 1 HBAR however 1 HBAR = 1e8 tinybar
    // so multiply by 1e10 to get the value in a format that the relay expects
    uint256 constant VALUE_MULTIPLIER = 1e10;

    mapping(address => bool) public isAssociated;
    mapping(address => mapping(address => uint64)) public vaultBalances;

    function associate(address token) external {
        if (!isAssociated[token]) {
            SafeHTS.safeAssociateToken(token, address(this));
            isAssociated[token] = true;
        }
    }

    function depositAndWithdraw(address depositToken, uint64 depositAmount, address withdrawToken, uint64 withdrawAmount) public payable costsCents(3) {
        deposit(depositToken, depositAmount);
        withdraw(withdrawToken, withdrawAmount);
    }

    function deposit(address token, uint64 amount) public payable costsCents(2) {
        SafeHTS.safeTransferToken(token, msg.sender, address(this), int64(amount));
        vaultBalances[token][msg.sender] += amount;
    }

    function withdraw(address token, uint64 amount) public payable costsCents(1) {
        SafeHTS.safeTransferToken(token, address(this), msg.sender, int64(amount));
        vaultBalances[token][msg.sender] -= amount;
    }

    function getCentsInTinybar(uint256 cents) external returns (uint256 tinybar) {
        uint256 tinycents = cents * TINY_PARTS_PER_WHOLE;
        tinybar = tinycentsToTinybars(tinycents) * VALUE_MULTIPLIER;
    }
}
