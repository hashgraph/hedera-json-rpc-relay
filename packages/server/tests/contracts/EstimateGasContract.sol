// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract Caller {
    function pureMultiply() public pure returns (int) {
        return 2 * 2;
    }

    function msgSender() public view returns (address) {
        return msg.sender;
    }

    function txOrigin() public view returns (address) {
        return tx.origin;
    }

    function msgSig() public pure returns (bytes4) {
        return msg.sig;
    }

    function msgValue() public payable returns (uint) {
        return msg.value;
    }

    function addressBalance(address addr) public view returns (uint256) {
        return addr.balance;
    }
}

contract MockContract {
    function getAddress() public view returns (address) {
        return address(this);
    }
}

contract EstimateGasContract is Caller {
    uint256 public counter = 1;

    MockContract mockContract;

    constructor() {
        mockContract = new MockContract();
    }

    function updateCounter(uint256 _counter) public {
        counter = _counter;
    }

    function deployViaCreate() public returns (address) {
        MockContract newContract = new MockContract();

        return address(newContract);
    }

    function deployViaCreate2() public returns (address) {
        MockContract newContract = new MockContract{salt : bytes32(counter)}();

        return address(newContract);
    }

    function staticCallToContract() public view returns (address) {
        bytes memory result;
        bool success;

        address addr = address(mockContract);
        bytes4 sig = bytes4(keccak256("getAddress()"));
        assembly {
            let x := mload(0x40)
            mstore(x, sig)

            success := staticcall(50000, addr, x, 0x4, x, 0x20)

            mstore(0x40, add(x, 0x20))
            mstore(result, x)
        }

        return abi.decode(result, (address));
    }

    function delegateCallToContract() public returns (address) {
        bytes memory result;
        bool success;

        address addr = address(mockContract);
        bytes4 sig = bytes4(keccak256("getAddress()"));
        assembly {
            let x := mload(0x40)
            mstore(x, sig)

            success := delegatecall(50000, addr, x, 0x4, x, 0x20)

            mstore(0x40, add(x, 0x20))
            mstore(result, x)
        }

        return abi.decode(result, (address));
    }

    function callCodeToContract() public returns (address) {
        bytes memory result;
        bool success;

        address addr = address(mockContract);
        bytes4 sig = bytes4(keccak256("getAddress()"));
        assembly {
            let x := mload(0x40)
            mstore(x, sig)

            success := callcode(50000, addr, 0, x, 0x4, x, 0x20)

            mstore(0x40, add(x, 0x20))
            mstore(result, x)
        }

        return abi.decode(result, (address));
    }

    function logs() public {
        assembly {
            mstore(0x80, 0x160c)
            log0(0x80, 0x20)
            log1(0x80, 0x20, 0xac3e966f295f2d5312f973dc6d42f30a6dc1c1f76ab8ee91cc8ca5dad1fa60fd)
            log2(0x80, 0x20, 0xac3e966f295f2d5312f973dc6d42f30a6dc1c1f76ab8ee91cc8ca5dad1fa60fd, 0xae85c7887d510d629d8eb59ca412c0bf604c72c550fb0eec2734b12c76f2760b)

            mstore(add(0x80, 0x20), 0x551)
            log3(0x80, 0x40, 0xac3e966f295f2d5312f973dc6d42f30a6dc1c1f76ab8ee91cc8ca5dad1fa60fd, 0xae85c7887d510d629d8eb59ca412c0bf604c72c550fb0eec2734b12c76f2760b, 0xf4cd3854cb47c6b2f68a3a796635d026b9b412a93dfb80dd411c544cbc3c1817)
            log4(0x80, 0x40, 0xac3e966f295f2d5312f973dc6d42f30a6dc1c1f76ab8ee91cc8ca5dad1fa60fd, 0xae85c7887d510d629d8eb59ca412c0bf604c72c550fb0eec2734b12c76f2760b, 0xf4cd3854cb47c6b2f68a3a796635d026b9b412a93dfb80dd411c544cbc3c1817, 0xe32ef46652011110f84325a4871007ee80018c1b6728ee04ffae74eb557e3fbf)
        }
    }

    function destroy() public {
        assembly {
            selfdestruct(caller())
        }
    }

    function callToInvalidContract(address invalidContract) public {
        invalidContract.call(abi.encodeWithSignature("invalidFunction()"));
    }

    function delegateCallToInvalidContract(address invalidContract) public {
        invalidContract.delegatecall(abi.encodeWithSignature("invalidFunction()"));
    }

    function staticCallToInvalidContract(address invalidContract) public view {
        invalidContract.staticcall(abi.encodeWithSignature("invalidFunction()"));
    }

    function callCodeToInvalidContract(address invalidContract) public {
        bytes memory result;
        bool success;

        bytes4 sig = bytes4(keccak256("invalidFunction()"));
        assembly {
            let x := mload(0x40)
            mstore(x, sig)

            success := callcode(50000, invalidContract, 0, x, 0x4, x, 0x20)

            mstore(0x40, add(x, 0x20))
            mstore(result, x)
        }
    }

    receive() external payable {}
}
