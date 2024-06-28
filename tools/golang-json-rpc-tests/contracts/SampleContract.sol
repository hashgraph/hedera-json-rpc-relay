// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract SampleContract {
    event ValueStored(uint256 value);
    uint256 public storedValue;
    constructor(uint256 initialValue) {
        storedValue = initialValue;
        emit ValueStored(initialValue);
    }
}
