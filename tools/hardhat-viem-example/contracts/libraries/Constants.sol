// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

abstract contract Constants {
  address internal constant HTS_PRECOMPILE = address(0x167);
  address internal constant EXCHANGE_RATE_PRECOMPILE = address(0x168);
  address internal constant UTIL_PRECOMPILE = address(0x168);

  address internal constant ADDRESS_ZERO = address(0);
}
