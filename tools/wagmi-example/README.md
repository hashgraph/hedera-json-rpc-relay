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
if you want compile contract at your own there is a known issue with the two latest version of the solc compiler. You need to use version `solc <= 0.8.24` because the recent version of the Hedera doesn't support all opcodes from the latest release.

Using solc from [NPM](https://www.npmjs.com/package/solc)

1. `solcjs contract/Greeter.sol --optimize --abi --bin -o contract/`
2. Change file extension in one of generated files from `.abi` to `.json`