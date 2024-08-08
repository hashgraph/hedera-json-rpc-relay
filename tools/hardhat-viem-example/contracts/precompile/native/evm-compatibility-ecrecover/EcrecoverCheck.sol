// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;

/**
 * @dev Converts an unsigned integer to its string representation.
 * @param value The unsigned integer to convert.
 * @return The string representation of the unsigned integer.
 */
function uintToString(uint value) pure returns (string memory) {
  uint length = 1;
  uint v = value;
  while ((v /= 10) != 0) { length++; }
  bytes memory result = new bytes(length);
  while (true) {
    length--;
    result[length] = bytes1(uint8(0x30 + (value % 10)));
    value /= 10;
    if (length == 0) {
        break;
    }
  }
  return string(result);
}

contract EcrecoverCheck {
    function verifySignature(
        string memory message,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public pure returns (address) {
        bytes memory prefixedMessage = abi.encodePacked(
            "\x19Ethereum Signed Message:\n",
            uintToString(bytes(message).length),
            message
        );
        bytes32 digest = keccak256(prefixedMessage);
        return ecrecover(digest, v, r, s);
    }

    function getSender() public view returns (address) {
        return msg.sender;
    }
}
