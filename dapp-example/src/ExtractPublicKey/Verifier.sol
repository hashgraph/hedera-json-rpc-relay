pragma solidity >=0.8.11;

contract Verifier {
    event Question(bytes32 indexed hash, bytes32 indexed r, bytes32 indexed s);
    event Answer(uint8 indexed v, address indexed answer);

    function recoverAddr(bytes32 hash, bytes32 r, bytes32 s, uint8 v) external returns (address) {
        address addr = ecrecover(hash, v, r, s);
        emit Question(hash, r, s);
        emit Answer(v, addr);
        return addr;
    }

    function ecrecovery(bytes32 hash, bytes memory sig) pure public returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        if (sig.length != 65) {
            return address(0);
        }

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := and(mload(add(sig, 65)), 255)
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            return address(0);
        }

        return ecrecover(hash, v, r, s);
    }

    function ecverify(bytes32 hash, bytes memory sig) view public returns (bool) {
        return msg.sender == ecrecovery(hash, sig);
    }
}