// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.0;

import "../test/libraries/Constants.sol";

/// @title Prevents delegatecall to a contract
/// @notice Base contract that provides a modifier for preventing delegatecall to methods in a child contract
abstract contract NoDelegateCall is Constants {
    /// @dev The original address of this contract
    address private immutable original;

    /// @dev slightly modified as in context of constructor address(this) is the address of the deployed contract and not the etched contract address
    ///      hence _original allows passing the address to which a contract is etched to; for normal uses pass ADDRESS_ZERO
    constructor(address _original) {
        // Immutables are computed in the init code of the contract, and then inlined into the deployed bytecode.
        // In other words, this variable won't change when it's checked at runtime.
        original = _original == ADDRESS_ZERO ? address(this) : _original;
    }

    /// @dev Private method is used instead of inlining into modifier because modifiers are copied into each method,
    ///     and the use of immutable means the address bytes are copied in every place the modifier is used.
    function checkNotDelegateCall() private view {
        require(address(this) == original, "NO_DELEGATECALL");
    }

    /// @notice Prevents delegatecall into the modified method
    modifier noDelegateCall() {
        checkNotDelegateCall();
        _;
    }
}
