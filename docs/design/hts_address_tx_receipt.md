# HTS Token Creation via SystemContract Receipt Enhancement

## Purpose
The purpose of this enhancement is to improve the interoperability between Hedera Token Service (HTS) and Ethereum-compatible tools, like ethers, by ensuring access to the necessary information about newly created tokens, in this case token address. This change specifically addresses the gap in Web3 tooling support when creating tokens through HTS precompile contracts, making user experience smoother.


## Problem Statement
When users create tokens (fungible and non-fungible) by directly calling the 0x167 contract there is no way for them to get the evm address of the newly created token via standard EVM tooling e.g ethers. This is because the transaction receipt's contractAddress field is not being populated with the HTS token address, since essentially the operations is just a contract call, but not a contract create (deploy).

## Current Behaviour

Currently, when creating a token via HTS the address of the system contract is returned as a contractAddress in the transaction receipt.

## Proposed Solution

### Technical Details

### 1. Function Signature Detection

Detect in the transactionResponse from the mirror node, if the transaction was calling any of the HTS methods - createFungibleToken/createNonFungibleToken/createFungibleTokenWithCustomFees/createNonFungibleTokenWithCustomFees

N.B Currently, HTS supports both v1 and v2 security model function selectors

```javascript
const HTS_CREATE_FUNCTIONS_SIGNATURE = [
  "createFungibleToken(...)",
  "createNonFungibleToken(...)",
  "createFungibleTokenWithCustomFees(...)",
  "createNonFungibleTokenWithCustomFees(...)"
];
const functionSelector = receiptResponse.function_parameters.substring(0, FUNCTION_SELECTOR_CHAR_LENGTH);
const isTokenCreation = HTS_CREATE_FUNCTIONS_SIGNATURE.some(signature => 
  Utils.calculateFunctionSelector(signature) === functionSelector
);
```

### 2. Extract the token address from the call_result field in the transaction response. The extractions can happen with brute force since we know what the function response is beforehand and we know the last 40 characters of the response are the token address.

Example call_result. First 64 characters excluding 0x prefix are the response code, second 64 characters are the token address:
```json
"call_result": "0x0000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000040a"
```

```javascript
const tokenAddress = receiptResponse.call_result.substring(receiptResponse.call_result.length - 40);
```
After extraction, the expected output is:
```
"0x000000000000000000000000000000000000000000000000000000000000040a"
```

### 3. Add the token address to the receipt


## Testing Requirements

1. Acceptance tests
   1. Test creation of fungible token via ethers and correct receipt response
   2. Test creation of non fungible token via ethers and correct receipt response
   3. Test creation of fungible token with custom fees via ethers and correct receipt response
   4. Test creation of non fungible token with custom fees via ethers and correct receipt response
