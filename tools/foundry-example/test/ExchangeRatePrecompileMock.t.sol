// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import './utils/ExchangeRateUtils.sol';

contract ExchangeRatePrecompileMockTest is ExchangeRateUtils {

    // setUp is executed before each and every test function
    function setUp() public {
        _setUpExchangeRatePrecompileMock();
        _setUpAccounts();
    }

    function test_CanCorrectlyConvertTinycentsToTinybars() public {
        uint256 tinycents = 1e8;
        uint256 tinybars = _doConvertTinycentsToTinybars(tinycents);
        assertEq(tinybars, 1e7, "expected 1 cent to equal 1e7 tinybar(0.1 HBAR) at $0.1/HBAR");
    }

    function test_CanCorrectlyConvertTinybarsToTinyCents() public {
        uint256 tinybars = 1e8;
        uint256 tinycents = _doConvertTinybarsToTinycents(tinybars);
        assertEq(tinycents, 1e9, "expected 1 HBAR to equal 10 cents(1e9 tinycents) at $0.1/HBAR");
    }

}

// forge test --match-contract ExchangeRatePrecompileMockTest -vv
