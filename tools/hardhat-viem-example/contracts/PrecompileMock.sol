// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

contract HtsSystemProxy {
    fallback() external payable {
        if (_isCalledByToken()) {
            _delegate(msg.sender);
        } else {
            _delegate(_getTarget());
        }
    }

    receive() external payable {
        _delegate(msg.sender);
    }

    function _isCalledByToken() internal view returns (bool) {
        uint32 size;
        address caller = msg.sender;
        assembly {
            size := extcodesize(caller)
        }
        return size > 0;
    }

    function _getTarget() internal pure returns (address target) {
        assembly {
            target := shr(96, calldataload(4))
        }
    }

    function _delegate(address target) internal {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(result) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }

    function delegateWithMultipleTokens(bytes calldata data) external {
        address[] memory tokens = _extractTokens(data);
        for (uint256 i = 0; i < tokens.length; i++) {
            _delegateToTarget(tokens[i], data);
        }
    }

    function _extractTokens(bytes calldata data) internal pure returns (address[] memory tokens) {
        uint256 tokensOffset;
        assembly {
            tokensOffset := calldataload(sub(calldatasize(), 32))
        }
        tokens = abi.decode(data[tokensOffset:], (address[]));
    }

    function _delegateToTarget(address target, bytes calldata data) internal {
        bytes memory modifiedData = _replaceToken(data, target);
        assembly {
            let dataLength := mload(modifiedData)
            calldatacopy(0, add(modifiedData, 32), dataLength)
            let result := delegatecall(gas(), target, 0, dataLength, 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(result) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }

    function _replaceToken(bytes calldata data, address target) internal pure returns (bytes memory) {
        bytes memory modifiedData = data;
        assembly {
            mstore(add(modifiedData, 36), shl(96, target))
        }
        return modifiedData;
    }
}
