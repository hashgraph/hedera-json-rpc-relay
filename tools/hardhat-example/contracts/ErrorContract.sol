//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract ErrorContract {

    error SomeCustomError();

    function revertWithNothing() public {
        revert();
    }

    function revertWithString() public {
        require(false, "Some revert message");
    }

    function revertWithCustomError() public {
        revert SomeCustomError();
    }

    function revertWithPanic() public {
        uint z = 100;
        uint y = 0;
        uint x = z / y;
    }
}
