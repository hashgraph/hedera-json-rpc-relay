// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

contract Reverter {
    function revertPayable() public payable {
        revert("RevertReasonPayable");
    }

    function revertView() public view {
        revert("RevertReasonView");
    }

    function revertPure() public pure {
        revert("RevertReasonPure");
    }
}
