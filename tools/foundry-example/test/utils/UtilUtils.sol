// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'forge-std/Test.sol';

import '../mocks/util-precompile/UtilPrecompileMock.sol';
import './CommonUtils.sol';
import '../libraries/Constants.sol';

/// for testing actions of the util precompiled/system contract
abstract contract UtilUtils is Test, CommonUtils, Constants {

    UtilPrecompileMock utilPrecompile = UtilPrecompileMock(UTIL_PRECOMPILE);

    function _setUpUtilPrecompileMock() internal {
        UtilPrecompileMock utilPrecompileMock = new UtilPrecompileMock();
        bytes memory code = address(utilPrecompileMock).code;
        vm.etch(UTIL_PRECOMPILE, code);
    }

    function _doCallPseudorandomSeed(address sender) internal setPranker(sender) returns (bytes32 seed) {
        seed = utilPrecompile.getPseudorandomSeed();
    }
}
