// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'hedera-smart-contracts/exchange-rate-precompile/IExchangeRate.sol';

contract ExchangeRatePrecompileMock is IExchangeRate {

    // 1e8 tinybars = 1 HBAR
    // 1e8 tinycents = 1 cent = 0.01 USD

    // HBAR/USD rate in tinybars/tinycents
    uint256 private rate; // 1e8 / 10; // Initial rate of 1e8 tinybars/10 tinycents, equivalent to $0.10/1 HBAR
    /// @dev it appears that contracts that are etched do NOT have any starting state i.e. all state is initialised to the default
    ///      hence "rate" is not initialised to 1e7 here, but updateRate is called after the ExchangeRatePrecompileMock is etched(using vm.etch) onto the EXCHANGE_RATE_PRECOMPILE address

    function tinycentsToTinybars(uint256 tinycents) external override returns (uint256) {
        require(rate > 0, "Rate must be greater than 0");
        return (tinycents * rate) / 1e8;
    }

    function tinybarsToTinycents(uint256 tinybars) external override returns (uint256) {
        require(rate > 0, "Rate must be greater than 0");
        return (tinybars * 1e8) / rate;
        // (1e8 * 1e8) / (1e8 / 12) = (12*1e8) tinycents
    }

    function updateRate(uint256 newRate) external {
        require(newRate > 0, "New rate must be greater than 0");
        rate = newRate;
    }

    function getCurrentRate() external view returns (uint256) {
        return rate;
    }
}