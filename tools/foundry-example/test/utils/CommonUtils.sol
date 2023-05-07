// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'forge-std/Test.sol';

/// generic test utils
abstract contract CommonUtils is Test {

    address internal alice = vm.addr(1);
    address internal bob = vm.addr(2);
    address internal carol = vm.addr(3);
    address internal dave = vm.addr(4);

    uint256 public constant NUM_OF_ACCOUNTS = 4;

    modifier setPranker(address pranker) {
        vm.startPrank(pranker);
        _;
        vm.stopPrank();
    }

    function _setUpAccounts() internal {
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(dave, 100 ether);
    }

    function _getAccount(uint index) internal returns (address) {
        if (index == 0) {
            return alice;
        }
        if (index == 1) {
            return bob;
        }
        if (index == 2) {
            return carol;
        }

        return dave; // return dave by default
    }

}
