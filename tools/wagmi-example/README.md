# Wagmi Hedera Example

Wagmi is a library for building Web3 apps, offering hooks (React version) for wallet connections, blockchain data, and transactions.

Learn more [here](https://wagmi.sh).

## How to run example?
1. Install dependencies `npm install`
2. Run project `npm dev`

## Example
Example of using Wagmi with Hedera covers
1. Sign in with wallet
2. Check account balance
3. Deploy contract from bytecode
4. Read from contract
5. Write to contract

## Generate contract abi, bin
Using solc from [NPM](https://www.npmjs.com/package/solc)

1. `solcjs contract/Greeter.sol --optimize --abi --bin -o contract/` or `npm run compile`
2. Change file extension in one of generated files from `.abi` to `.json`