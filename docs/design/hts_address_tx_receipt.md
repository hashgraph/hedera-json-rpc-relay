# HTS Token Creation via SystemContract Receipt Enhancement

## Purpose
The purpose of this enhancement is to improve the interoperability between Hedera Token Service (HTS) and Ethereum-compatible tools, like ethers, by ensuring access to the necessary information about newly created tokens, in this case token address. This change specifically addresses the gap in Web3 tooling support when creating tokens through HTS precompile contracts, making user experience more smooth.


## Problem Statement
When users create tokens (fungible and non-fungible) by directly calling the 0x167 contract there is no way for to get the contract address of the newly created token via ethers. This is because the transaction receipt's contractAddress field is not being populated correctly for HTS token creation operations, since essentially they are just a contract call, but not a contract create (deploy).

## Current Behaviour

Currently, when creating a token via HTS the address of the system contract ic returned as a contractAddress in the transaction receipt.

## Proposed Solution

### Technical Details

1. Function Signature Detection

Detect in the transactionResponse from the mirror node, if the transaction was calling any of the HTS method e.g createFungibleToken/createNonFungibleToken etc.

N.B Currently, HTS supports both v1 and v2 security model function selectors

1. Extract the token address from the call_result field in the transaction response.

2. Add the token address to the receipt


## Testing Requirements

1. Unit tests
   1. Test token creation function signature detection

2. Acceptance tests
   1. Test fungible token creation flow via ethers and correct receipt response
   2. Test non fungible token creation flow via ethers and correct receipt response
