## Storage Layout Analysis

The Solidity compiler (`solc`) provides an option to generate detailed storage layout information as part of the build output. This feature can be enabled by selecting the `storageLayout` option, which provides insights into how variables are stored in contract storage.

### Enabling Storage Layout in Hardhat

To generate the storage layout using Hardhat, you need to modify the Hardhat configuration file (`hardhat.config.js`) as follows:

```javascript
module.exports = {
  solidity: {
    settings: {
      outputSelection: {
        "*": {
          "*": ["storageLayout"]
        }
      }
    }
  }
};
```

With this configuration, the storage layout information will be included in the build artifacts. You can find this information in the following path within the build output:

```
output -> contracts -> ContractName.sol -> ContractName -> storageLayout
```

### Understanding the Storage Layout Format

The storage layout is represented in JSON format with the following fields:

- **`ast_id`**: The identifier in the Abstract Syntax Tree (AST).
- **`contract`**: The name of the contract.
- **`label`**: The name of the variable.
- **`offset`**: The starting location of the variable in memory. For smaller values, multiple variables may be packed into a single memory slot. In such cases, the `offset` value for the second and subsequent variables will differ from 0.
- **`slot`**: An integer representing the slot number in storage.
- **`type`**: The type of the value stored in the slot.

### Application to Token Smart Contract Emulation

For the purpose of our implementation, understanding which variable names are stored in specific slots is sufficient to develop a functional emulator for the token smart contract.

### Issues with Storage for Mappings, Arrays, and Strings Longer than 31 Bytes

When dealing with mappings, arrays, and strings longer than 31 bytes in Solidity, these data types do not fit entirely within a single storage slot. This creates challenges when trying to access or compute their storage locations.

### Accessing Mappings

For mappings, the value is not stored directly in the storage slot. Instead, to access a specific value in a mapping, you must first calculate the storage slot by computing the Keccak-256 hash of the concatenation of the "key" (the mapped value) and the "slot" number where the mapping is declared.

```solidity
bytes32 storageSlot = keccak256(abi.encodePacked(key, uint256(slotNumber)));
```

To reverse-engineer or retrieve the original key (e.g., an address or token ID) from a storage slot, you'd need to maintain a mapping of keys to their corresponding storage hashes, which can be cumbersome.

### Calculating Storage for User Addresses and Token IDs

For our current use case, where we need to calculate these values for user addresses and token IDs (which are integers), this is manageable:
- **User Addresses**: Since the number of user accounts is limited, their mapping can be stored and referenced as needed.
- **Token IDs**: These are sequentially incremented integers, making it possible to precompute and store their corresponding storage slots on the Hedera JSON-RPC side.

### Handling Long Strings

Handling strings longer than 31 bytes is more complex:
1. **Calculate the Slot Hash**: Start by calculating the Keccak-256 hash of the slot number where the string is stored.

   ```solidity
   bytes32 hashSlot = keccak256(abi.encodePacked(uint256(slotNumber)));
   ```

2. **Retrieve the Value**: Access the value stored at this hash slot. If the string exceeds 32 bytes, retrieve the additional segments from consecutive slots (e.g., `hashSlot + 1`, `hashSlot + 2`, etc.), until the entire string is reconstructed.

This process requires careful calculation and multiple reads from storage to handle longer strings properly.
