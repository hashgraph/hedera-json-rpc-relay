# MAIAN

[MAIAN](https://github.com/ivicanikolicsg/MAIAN) is a tool specifically designed to find security vulnerabilities
in Smart Contracts that operate on Ethereum and other blockchain platforms. MAIAN main aim is to detect three
types of problematic contracts:
- **suicidal contract**: one that can be forced to self-destruct by any external user, not just their owner.
- **prodigal contract**: one that can inadvertently leak funds to arbitrary addresses due to improper handling of
  Ether transfers.
- **greedy contract**: one that locks funds indefinitely, making them irretrievable.
  Its key features are:
- Capability of analyzing both Solidity source code and bytecode.
- Automated analysis with detailed reporting of vulnerabilities.
- Graphical representations of control flow to aid in the understanding of contract behavior.
- Integrated support for deployment analysis.
- Easily integrates with continuous integration pipelines for ongoing security assessment.
  The tool is especially effective at finding specific types of security flaws that involve the misuse of funds within contracts

## Installation:
Due to changes in web3.py library introduced in version 3.5.5V (including), an attempt to start MAIAN, using instructions from
[github repo](https://github.com/ivicanikolicsg/MAIAN), ends with an error prompt that may be found [here](example_build_execution_error.md)
Further discussion regarding this error may be found [here](https://github.com/ethereum/web3.py/issues/879)
Alternative ways to run MAIAN are:
1) Running with manual downgrade od Python to v2 and web3.py to 3.5.4V
2) Running inside the Docker container:
```Shell
docker pull cryptomental/maian-augur-ci
docker run -it cryptomental/maian-augur-ci
cd MAIAN/tool && python2 maian.py -s example_contracts/example_suicidal.sol KAI -c 0
```
> **NOTE**: There is no `solc-select preinstalled` in the docker image. In order to change the version run:
> ```shell
> wget https://github.com/ethereum/solidity/releases/download/{your_version}/solc-static-linux && mv solc-static-linux /usr/bin/solc
> ```
> where `{your_version}` is desired solidity compiler version, ie. v0.8.24.
## Examples of executions:
* [Suicidal contract detection](execution_examples/suicidal_detection.md)
* [Leak detection](execution_examples/leak_detection.md)
* [AtomicHTS.sol check](execution_examples/AtomicHTS.md)
* [HederaTokenService.sol check](execution_examples/HederaTokenService.md)

## Tool analysis:
### Attempt of replacing Ethereum's JSON RPC to Hedera's JSON RPC relay:
As of April 2024, MAIAN across the last six years was not in active development. This state leads the tool to be
out of date and lacks support for newer features. This leads to multiple challenges, most impactful ones
are the following:
- **Differences in RPC Methods Ethereum's JSON RPC API**: Hedera does not support `eth_sendTransaction`.
  The available alternative is: `eth_sendRawTransaction` which requires transactions to be signed before being submitted,
  this additional step would have to be implemented in the MAIAN code.
- **Lack of Transaction Signing functionality**: In Ethereum, the unlocked account can automatically sign transactions,
  whereas, in Hedera, the transaction needs to be pre-signed. MAIAN lack of support for modern cryptographic libraries such as:
  `eth_account`, a newer version of `web3.py`, `pycryptodome`, will substantially impede alignment for the network in this
  field.
- **Library and language limitations**: due to out-of-date dependencies and environment, MAIAN lacks built-in support
  for SHA-3 (KECCAK-256), which is essential for Ethereum-style transactions and required for compatibility with
  Hedera's API, support for integrated account management, and transaction signing functionalities are also missing
- **Security and Maintenance Concerns**: using outdated software causes both Security risks and increases maintenance
  efforts

### Recommendations and possible investments in the tool:
- **Upgrade Python and web3.py**: Moving to at least Python 3.6+ and the latest version of web3.py would provide
  support for modern cryptographic functions, easier management of dependencies, and improve security.
- **Client-side Transaction Signing**: Implement client-side transaction signing to adapt to Hedera’s
  `eth_sendRawTransaction`.
- **Review and Adapt to Hedera’s API**: Thoroughly review Hedera’s API capabilities to understand the adjustments
  needed in the application to accommodate Hedera's specific methods and operational paradigms.

> **Support**:
> Even though MAIAN is not officially marked as abandoned, the last changes were introduced to the code base 6 years ago.
> Further work with this tool should be preceded by migrating it to a supported Python version and dropping
> archival dependencies from its codebase.
