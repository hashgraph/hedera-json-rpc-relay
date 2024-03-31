# Waffle Example

This project demonstrates a basic setup using Hardhat, with a focus on improving the testing process through the integration of the Waffle.js framework, with a particular emphasis on the `fixture` feature.

`fixture` is a feature that optimizes test execution for smart contracts. It enables the snapshotting of blockchain states, saving time by avoiding the recreation of the entire state for each test. Instead, tests can revert to a pre-defined snapshot, streamlining the testing process.

## Prerequisite

If you want to test it against localnet, please have the `Hedera Localnode` running.

## Configuration

1. Create a `.env` file based on the `.env.example` file provided.
2. Populate the prompted environment variables in the `.env` file with appropriate values.

## Setup and run test

1. Run `npm install`
2. Run `npx hardhat test`
