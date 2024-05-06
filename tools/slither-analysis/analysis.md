# Slither
[Slither](https://github.com/crytic/slither) is a framework for static analysis of Solidity and Vyper, written in Python3,
offering several features for stability and security checks:
- Detection of vulnerable Solidity code with low false positives
- Identification of error conditions in source code
- Integration into CI and Hardhat/Foundry builds
- Built-in 'printers' for swift reporting of crucial contract information
- Provided detector API; a tool for integrating custom and tailored analyses
- Ability to analyze contracts written with Solidity >= 0.4
- Intermediate representation [SlithIR](https://github.com/trailofbits/slither/wiki/SlithIR) enables simple,
  high-precision analyses
- Integrates with Github's code scanning in CI
- Supports Vyper Smart Contracts

## Installation:
#### Prerequisite - set up solidity:
- Python 3.8+.
- [Supported compilation framework]() or Solidity compiler, it is recommended to use
  [solc-select](https://github.com/crytic/solc-select?tab=readme-ov-file) (note: for ARM processor architecture
  [Rosetta](https://github.com/crytic/solc-select?tab=readme-ov-file#oserror-errno-86-bad-cpu-type-in-executable)
  dependency will be needed)
- Installation of Slither via pip package manager is done via:  `python3 -m pip install slither-analyzer`, for
  other methods and detailed process explanation follow [how to install](https://github.com/crytic/slither?tab=readme-ov-file#how-to-install)
  section

#### Example of use `solc-select`
```shell
solc-select install 0.8.25
solc-select use 0.8.25
```
#### Follow up with the desired setup.
## Working Principle:
Slither's main working principle is based on converting solidity Smart Contracts code into the
intermediate representation called SlithIR which is used under the hood
[SSA](https://en.wikipedia.org/wiki/Static_single-assignment_form) and reduced instruction set to
perform program analysis like [dataflow analysis](https://clang.llvm.org/docs/DataFlowAnalysisIntro.html)
or [taint checking](https://en.wikipedia.org/wiki/Taint_checking).
General Slither architecture is shown below on the fig. 1.

![fig1_img.png](static/img.png)

According to the paper ["Slither: A Static Analysis Framework For Smart Contracts"](https://agroce.github.io/wetseb19.pdf),
we can distinguish 4 main angles, in which the tool might be used:
* **Automated vulnerability detection**: a large variety of
  Smart Contract vulnerabilities can be detected without user intervention.
* **Automated optimization detection**: Slither detects code
  optimizations that the compiler misses
* **Code understanding**: printers summarize and display
  contracts’ information to aid in the study of the codebase.
* **Assisted code review**: through its API, a user can interact
  with Slither.
## Tool analysis:
Slither takes [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree) structure that is generated
during the compilation process using `solc` compiler and recovering metadata from it, including analyzing inheritance graph,
[control flow graph](https://en.wikipedia.org/wiki/Control-flow_graph) and the list of all expressions.
The entire bytecode is transformed into Slither's own IR (Intermediate Representation) which allows to capture of more details,
useful in the next stages of static analysis.
> **NOTE:**
> Slither is not executing any code provided by the user, the entire analysis provided by the tool is performed on the bytecode,
> therefore deployment context and environment are not taken into account, and analysis is strictly static.
## Research directions and conclusions:
### Contract may be provided to Slither in two different methods:
1) as an address of the already deployed contract: `NETWORK:0x...`, *as of April 2024, Headera is not listed within the
   available provider list*.
> Supported networks: mainet, optim, ropsten, kovan, goerli, sepolia, tobalaba, bsc, testnet.bsc, arbi, testnet.arbi,
> poly, mumbai, avax, testnet.avax, ftm, goerli.base
2) By providing Smart Contract implementation in Solidity.
### Adding Headera RPC support for Slither:
Some tools do not have any option to set custom RPC nor use Hedera block explorers, those are:
- `slither-mutate`
- `slither-interface`
- `slither-check-erc`
#### Attempt to run Slither's RPC call using hashio.io with the use of `slither-read-storage`:
The baseline test on Ethereum main net was compleated successfully following result:
`slither-read-storage 0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8 --json storage_layout.json`
```json
{
  "slot0": {
    "name": "slot0",
    "type_string": "UniswapV3Pool.Slot0",
    "slot": 0,
    "size": 256,
    "offset": 0,
    "value": null,
    "elems": {
      "sqrtPriceX96": {
        "name": "slot0.sqrtPriceX96",
        "type_string": "uint160",
        "slot": 0,
        "size": 160,
        "offset": 0,
        "value": null,
        "elems": {}
      },
    ...
```
Full json output is available [here](Slither/slither-read-storage-mainnet.json)
For Hashscan test, verified mainnet contract was choosen:
```dtd
Address: `0x00000000000000000000000000000000002e7a5d` \
HashscanLink: https://hashscan.io/mainnet/contract/0.0.3045981?type=contractcall&p=1&k=1714033671.497715003 \
Name: `UniswapV2Router02`
```
Execution of command:    
`slither-read-storage 0x00000000000000000000000000000000002e7a5d --json storage_layout.json --rpc-url https://mainnet.hashio.io/api`
yields `ERROR:SlitherSolcParsing` with details available [here](slither_reports/slither-read-storage-hashscan-error.md).
The tested Hedera contract is verified and the code is available. Therefore, the tool should be able to fetch it and parse it properly.
Unfortunately performing this procedure on the current version of Slither is not enough to run tests for contracts deployed
on the Hashscan.

There are also additional options to configure integration with various block explorers APIs.
```
Etherscan options:
  --etherscan-only-source-code
                        Only compile if the source code is available.
  --etherscan-only-bytecode
                        Only looks for bytecode.
  --etherscan-apikey ETHERSCAN_API_KEY
                        Etherscan API key.
  --arbiscan-apikey ARBISCAN_API_KEY
                        Etherscan API key.
  --polygonscan-apikey POLYGONSCAN_API_KEY
                        Etherscan API key.
  --test-polygonscan-apikey TEST_POLYGONSCAN_API_KEY
                        Etherscan API key.
  --avax-apikey AVAX_API_KEY
                        Etherscan API key.
  --ftmscan-apikey FTMSCAN_API_KEY
                        Etherscan API key.
  --bscan-apikey BSCAN_API_KEY
                        Etherscan API key.
  --optim-apikey OPTIM_API_KEY
                        Optimistic API key.
  --etherscan-export-directory ETHERSCAN_EXPORT_DIR
                        Directory in which to save the analyzed contracts.
```

But there is no way to integrate in any way with e.g. [hashscan](https://hashscan.io)


### Slither test results for different contracts:
> #### ENVIRONMENT:
> * Slither version: 0.9.6
> * Python version: 3.11.7
> * OS: GNU/Linux x86_64 6.5.0-28 Kubuntu distro
#### Reports of the tests:
| Smart contract                                                                   | Result                                           |
|----------------------------------------------------------------------------------|--------------------------------------------------|
| [AtomicHTS.sol](test_contracts/hts-precompile/AtomicHTS.sol)                     | [Report](slither_reports/AtomicHTS.md)           |
| [ExpiryHelper.sol](test_contracts/hts-precompile/ExpiryHelper.sol)               | [Report](slither_reports/ExpiryHelper.md)        |
| [FeeHelper.sol](test_contracts/hts-precompile/FeeHelper.sol)                     | [Report](slither_reports/FeeHelper.md)           |
| [HederaResponseCodes.sol](test_contracts/hts-precompile/HederaResponseCodes.sol) | [Report](slither_reports/HederaResponseCodes.md) |
| [HederaTokenService.sol](test_contracts/hts-precompile/HederaTokenService.sol)   | [Report](slither_reports/HederaTokenService.md)  |
| [IHederaTokenService.sol](test_contracts/hts-precompile/IHederaTokenService.sol) | [Report](slither_reports/IHederaTokenService.md) |
| [IHRC.sol](test_contracts/hts-precompile/IHRC.sol)                               | [Report](slither_reports/IHRC.md)                |
| [KeyHelper.sol](test_contracts/hts-precompile/KeyHelper.sol)                     | [Report](slither_reports/KeyHelper.md)           |

### Overview of Slither Detectors and Their Blockchain Specificity
Solidity code is not tied to a particular blockchain; it is crafted for platforms that uphold the Ethereum Virtual Machine (EVM). 
Hence, Slither doesn't necessitate modifications or improvements for distinct chains. It hasn't integrated any rules or 
supplementary details specific to a chain, and presently, there are no chain-specific detectors in the official project repository

| Name                           | Description                                                             | 
|--------------------------------|-------------------------------------------------------------------------|
| Reentrancy vulnerabilities     | Identifies potential reentrancy issues in Smart Contracts               | 
| Arithmetic issues              | Detects overflows, underflows, and other arithmetic operations          | 
| Unexpected ether flows         | Checks for unexpected behavior in ether transfer                        | 
| Unchecked low-level calls      | Identifies low-level calls that are not checked                         | 
| Exception handling             | Checks for incorrect handling of exceptions                             | 
| Suicidal patterns              | Vulnerabilities that can lead to self-destruction of contracts          | 
| Unprotected selfdestruct       | `selfdestruct` function callable by anyone                              | 
| ERC standards compliance       | Ensures compliance with ERC standards                                   | 
| Naming conventions             | Ensures that naming follows best practices                              | 
| Function order                 | Verifies that functions are ordered properly                            | 
| Variable ordering              | Focuses on gas-efficient storage of state variables                     | 
| State variable packing         | Checks for optimal packing of state variables to reduce gas costs       | 
| Unused state variables         | Detects state variables that are declared but not used                  | 
| Redundant expressions          | Points out unnecessary code segments that can be removed                | 
| Code complexity                | Identifies overly complex code that could be simplified                 | 
| Redundant code                 | Highlights unnecessary code segments                                    | 
| Shadowing state variables      | Warns about local variables shadowing state variables                   | 
| Shadowing built-in             | Alerts on local variables shadowing Solidity's built-in globals         | 
| Visibility specifiers          | Ensures that visibility is explicitly stated and follows best practices | 
| External calls best practices  | Checks for issues with how external calls are made                      | 
| Assembly usage                 | Cautions against the use of inline assembly                             | 
| Solc select pragma             | Suggests specific Solidity compiler versions                            | 
| License identification         | Checks for the presence of licensing information in code                | 

### Test summary:
* Test contracts were performed on different Solidity versions: {0.4.11, 0.4.19, 0.8.9}.
  Running Slither on an incorrect language version can yield unexpected Python exceptions -
  some error cases are not properly handled within the Slither implementation
* Calling Internal Hedera System functions are reported by Slither as `low-level-calls` which is categorized as
  `Informational` impact type. This means that no additional actions need to be made for Slither to Hedera compatibility -
  from the tool perspective, those are just normal address calls, as the potential solution it may be beneficial to
  ensure that Slither will recognize address 0x167 as assigned to Hedera's internal system functions.
* Slither's Detectors provide API that may be used to provide custom internal Hedera checks such as:
    * ecrecover is not supported for ED25519 accounts
    * precompiles that are missing in the Hedera EVM
      example of detector implementation POC may be found [here](detectors/hedera/ecrecover_usage_local.py)
* It might be beneficial to introduce eth tools -> Hashscan compatibility layer proxy API that would enable
  transparent communication between Hashscan and Slither.
* Tests didn't generate any kind of high-impact vulnerability. The Table below depicts a detailed histogram
  of the reported issues by the Slither (for hts-precompile contracts):

  ![slither_report_histogram.png](static/slither_report_histogram.png)\
