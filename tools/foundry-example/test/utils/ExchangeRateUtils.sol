// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'forge-std/Test.sol';

import '../mocks/exchange-rate-precompile/ExchangeRatePrecompileMock.sol';
import './CommonUtils.sol';
import '../libraries/Constants.sol';

/// for testing actions of the exchange rate precompiled/system contract
abstract contract ExchangeRateUtils is Test, CommonUtils, Constants {

    ExchangeRatePrecompileMock exchangeRatePrecompile = ExchangeRatePrecompileMock(EXCHANGE_RATE_PRECOMPILE);

    function _setUpExchangeRatePrecompileMock() internal {
        ExchangeRatePrecompileMock exchangeRatePrecompileMock = new ExchangeRatePrecompileMock();
        bytes memory code = address(exchangeRatePrecompileMock).code;
        vm.etch(EXCHANGE_RATE_PRECOMPILE, code);
        _doUpdateRate(1e7);
    }

    function _doConvertTinycentsToTinybars(uint256 tinycents) internal returns (uint256 tinybars) {

        tinybars = exchangeRatePrecompile.tinycentsToTinybars(tinycents);

    }

    function _doConvertTinybarsToTinycents(uint256 tinybars) internal returns (uint256 tinycents) {

        tinycents = exchangeRatePrecompile.tinybarsToTinycents(tinybars);

    }

    function _doUpdateRate(uint256 newRate) internal {

        exchangeRatePrecompile.updateRate(newRate);

    }

}
