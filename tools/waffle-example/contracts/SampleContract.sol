// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract SampleContract {
    event Notification(string message);

    function emitEvent() public {
        emit Notification("Hello world!");
    }

    function revertableFunction() pure public {
        assert(false);
    }
}
