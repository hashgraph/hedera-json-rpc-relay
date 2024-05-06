// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.4.9 <0.9.0;

interface IHRC {
    function associate() external returns (uint256 responseCode);
    function dissociate() external returns (uint256 responseCode);
}