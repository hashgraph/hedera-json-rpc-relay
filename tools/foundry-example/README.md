# Foundry example

Simple scripts for basic operations like hbars transfer, balance fetching, and contract interactions (deployment and calls).

## Prerequisite

You must have the Foundry CLI(forge) installed.

## Configuration

## Setup & Install

In the project directory:

1. Run `forge install`
2. Run `forge build`
3. Run `forge test`

To view lib dependency mappings:
`forge remappings`

To filter and run a specific test:
`forge test --match-contract {ContractName} --match-test {testFunctionName}`

For example:
`forge test --match-contract CounterTest --match-test testIncrement`

Or to run all tests in a file:
`forge test --match-path test/{FileName}.t.sol`

For varying degrees of verbosity in trace logs use the flags: `-v`, `-vv`, `-vvv` and `-vvvv`

## Deploy to Network

To deploy the `src/Counter.sol:Counter` contract to the Hedera testnet(alias is configured in `foundry.toml` as `h_testnet`)
`forge create --rpc-url h_testnet --private-key 0x744963be31f2a9252bd58bfe59d3aba886395ad063a3abd1cf8b52b00185d4fd src/Counter.sol:Counter`
