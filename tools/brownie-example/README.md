# Brownie

[Brownie](https://github.com/eth-brownie/brownie) is an open-source Python-based framework for testing, deploying, and interacting with Ethereum smart contracts. Built on top of the `web3.py` library, Brownie is designed to streamline the development workflow for decentralized applications by providing an easy-to-use interface for tasks such as contract deployment, testing, and debugging. It supports both Solidity and Vyper.

Brownie's main capabilities are:

- **Automated Contract Testing**: Facilitates both unit and integration testing using Python, with the ability to create fixtures, mocks, and use `pytest` for comprehensive test coverage.
- **Local Blockchain Environment**: Integrates with Ganache, allowing for the quick setup of a local Ethereum environment for development, testing, and debugging.
- **Contract Interaction**: Provides an intuitive API for interacting with smart contracts, including sending transactions, calling functions, and retrieving events.
- **Built-in Debugging Tools**: Offers detailed transaction tracing and error reporting to aid in identifying bugs and optimizing gas usage.
- **Seamless Integration with Development Pipelines**: Brownie can be easily integrated into continuous integration/continuous deployment (CI/CD) workflows to ensure contract reliability.

## Installation:

To install Brownie, the recommended approach is using `pip`:

```Shell
pip install eth-brownie
```

You may also want to start the Hedera Local Node to run a local blockchain for testing:
https://github.com/hashgraph/hedera-local-node

Once installed, you can initialize a new project:

```Shell
brownie init
```

Brownie supports both Solidity and Vyper contract languages.

Brownie will automatically download the required Solidity compiler and dependencies when you first compile a contract.

You may also install additional dependencies running:

```Shell
brownie pm install OpenZeppelin/openzeppelin-contracts@4.4.0
```

## Tool Analysis:

### Key Features and Advantages:

1. **Cross-Platform Compatibility**: Brownie supports Ethereum-compatible blockchains, it can be used for Hedera Smart Contracts development.

2. **Contract Testing and Debugging**:
    - Brownie uses `pytest` for its testing framework, providing access to Python’s testing ecosystem. You can write both unit tests and functional tests for contracts.
    - Transaction debugging is powerful with detailed stack traces, revert reasons, and gas reports.

3. **Ease of Use**: By leveraging Python, a well-known and widely used programming language, Brownie makes it easier for developers to interact with the blockchain and smart contracts without needing deep knowledge of Solidity or EVM bytecode.

5. **Event Monitoring and Logging**: Contracts deployed via Brownie are easy to monitor through event subscriptions, and the logs can be analyzed to detect specific contract behaviors in real-time.

### Limitations and Considerations:

1. **Dependency on `web3.py`**: As Brownie is built on `web3.py`, it inherits some of the limitations and idiosyncrasies of this library. Regular updates to `web3.py` are necessary to maintain compatibility with the latest Ethereum features.

2. **Complex Projects**: For highly complex or large-scale projects, the simplified Python-based testing environment might require additional customization or integration with other more advanced development tools.

> **Community and Support**:
> Brownie is no longer actively maintained, although developers can engage with the community on the [official GitHub](https://github.com/eth-brownie/brownie) page or the [Python Ethereum Developers Discord](https://discord.gg/YGzGZEfSBc).

## Tests performed

# Using Brownie (https://github.com/eth-brownie/brownie) with Hedera Hashgraph

- Activate Python virtual environment
```
python3 -m venv venv
source venv/bin/activate
```
- Install Brownie
```
pip3 install eth-brownie
```
- Create a Brownie project
```
mkdir brownie-test-project
cd brownie-test-project
brownie init
```
- Add an account and start Brownie console
```
brownie networks list
brownie accounts new myaccount
brownie console --network hedera-test
```
- Check that Brownie can fetch balance of the account
```
>>> accounts.load('myaccount')
>>> accounts[0].balance()
```
- Exit Brownie console and create "Token" subproject
```
brownie bake token
cd token
brownie compile
```
- Start the console
```
brownie console --network hedera-test
```
- Check that "Token" is available
```
>>> accounts.load('myaccount')
>>> Token
```
- Deploy a token contract
```
>>> t = Token.deploy("Test Token", "TST", 18, 1e23, {'from': accounts[0]})
```

## Using fixtures and forking

Brownie can connect to any network or its fork and is designed to work seamlessly with a ganache-cli script. However, if an alternative script is used in the configuration process to start the fork, Brownie may fail with the following error:
```shell
INTERNALERROR> ValueError: could not read ganache version: b'2.31.0\n'
```

To run your tests on forked networks, which allows the use of true fixtures (with snapshots created before each test and reverted after each test), you simply need to register an additional network in the Brownie configuration.

### Debugging Transactions and Working with Events in Brownie

Brownie provides tools for debugging transactions and working with events during development and testing:

1. **Transaction Debugging**:
   - Brownie allows you to inspect transactions in detail. After sending a transaction, you can call `tx.info()` on the transaction object to see its gas usage, logs, and status.

   Example:
   ```python
   tx = contract.someFunction({'from': accounts[0]})
   tx.info()  # View transaction details
   ```

2. **Accessing Events**:
   - Events emitted by contracts during a transaction can be easily accessed through the transaction object. You can retrieve all events or filter for specific ones.

   Example:
   ```python
   tx = contract.someFunction({'from': accounts[0]})
   print(tx.events)  # Print all emitted events
   ```

   To access a specific event, you can reference it by name:
   ```python
   transfer_event = tx.events['Transfer']
   print(transfer_event)
   ```

3. **Real-Time Event Monitoring**:
   - You can set up filters to watch for specific events in real time. This is useful when you want to monitor certain actions as they happen on the network.

   Example:
   ```python
   event_filter = contract.events.Transfer.createFilter(fromBlock='latest')
   events = event_filter.get_all_entries()
   print(events)
   ```

4. **Reverting and Snapshotting**:
   - When testing on forked networks, you can create a snapshot of the current blockchain state, perform tests, and then revert back to the snapshot for repeated testing.

   Example:
   ```python
   network.snapshot()
   tx = contract.someFunction({'from': accounts[0]})
   network.revert()  # Revert to the snapshot
   ```

   You can configure Brownie to automatically isolate each test by adding the following code to your conftest.py file:
   ```python
   @pytest.fixture(scope="function", autouse=True)
   def isolate(fn_isolation):
     pass
   ```
   This ensures that each test runs in an isolated environment, preventing any side effects from one test affecting another.

5. **Revert Reasons**:
   - If a transaction fails or reverts, Brownie provides detailed error messages and stack traces, including revert reasons, making it easier to identify and fix issues in your contract logic.

# Brownie usage example

Simple scripts for basic operations like hbars transfer, balance fetching, and contract interactions (deployment and calls).

## Setup & Install

Follow this instruction from the installation section above:

```Shell
pip install eth-brownie
```

## Running tests

After installing brownie you can go to your project directory and run following script:

1. Run a fork of the network of your choose (snapshot method is required for tests).

   In order to run the tests on the non-forked (no snapshot method available) network 
   you need to have 2 accounts configured in brownie
   
   Bob's account can not be empty:
   
   ```shell
   brownie accounts new bob
   brownie accounts new alice
   ```
   Since the transfer of hbars is performed during the tests it is advised to connect to the forked network instead of
   the actual remote network.
   
   In order to run the tests on the forked network add the fork config to the brownie networks list:
   ```bash
   brownie networks add development hedera-test-fork cmd=ganache-cli host=http://127.0.0.1 chain_id=296 fork='https://testnet.hashio.io/api' accounts=10 mnemonic=brownie port=8545
   ```
2.  Run `brownie test --network hedera-test-fork`

## Deploying your Smart Contract

1. Run brownie run deploy --network hedera-test
