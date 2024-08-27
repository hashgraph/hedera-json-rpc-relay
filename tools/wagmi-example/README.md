# Wagmi Hedera Example

## How to run example?
1. Install dependencies `pnpm install`
2. Run project `pnpm dev`

## Example
Example of using Wagmi with Hedera covers
1. Sign in with wallet
2. Check account balance
3. Deploy contract from bytecode
4. Read from contract
5. Write to contract

## Generate contract abi, bin
If you want to compile the contract on your own, be aware of a known issue with the two latest versions of the Solc compiler. You should use version solc <= 0.8.24 because the most recent versions of Hedera do not support all the opcodes introduced in the latest releases.

Using solc from [NPM](https://www.npmjs.com/package/solc)

1. `solcjs contract/Greeter.sol --optimize --abi --bin -o contract/`
2. Change file extension in one of generated files from `.abi` to `.json`