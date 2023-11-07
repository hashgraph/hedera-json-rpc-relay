// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";

contract CounterScript is Script {
    function setUp() public {}

    function run() public {
        vm.broadcast();
    }
}
