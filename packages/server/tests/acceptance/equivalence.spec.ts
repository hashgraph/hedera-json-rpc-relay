/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { assert, expect } from 'chai';
import { Utils } from '../helpers/utils';
import ServicesClient, { AliasAccount } from '../clients/servicesClient';
import { ContractFunctionParameters } from '@hashgraph/sdk';
import EstimatePrecompileContractJson from '../contracts/EstimatePrecompileContract.json';
import Constants from '../helpers/constants';
import EquivalenceContractJson from '../contracts/EquivalenceContract.json';
import { ethers, toUtf8Bytes } from 'ethers';
import { Precheck } from '../../../relay/src/lib/precheck';
import pino from 'pino';
import { MirrorNodeClient } from '../../../relay/src/lib/clients';
import EquivalenceDestructContractJson from '../contracts/EquivalenceDestruct.json';
import RelayClient from '../clients/relayClient';
import { hexToASCII } from '../../../relay/src/formatters';
const logger = pino();

const removeLeading0x = (input: string) => {
  return input.startsWith('0x') ? input.replace('0x', '') : input;
};

const removeLeadingZeros = (input) => {
  let result = input;
  while (result[0] === '0') {
    result = result.substring(1);
  }
  return result;
};

const decodeResultData = (input: string) => {
  return hexToASCII(removeLeading0x(input));
};

async function testRejection(errorMessage, method, checkMessage, thisObj, args?) {
  await expect(method.apply(thisObj, args), `${errorMessage}`).to.eventually.be.rejected.and.satisfy((err) => {
    return err.message.includes(errorMessage);
  });
}

describe.only('Equivalence tests', async function () {
  const signers: AliasAccount[] = [];
  const { servicesNode, mirrorNode, relay }: any = global;
  const servicesClient = servicesNode as ServicesClient;
  const mirrorNodeClient = mirrorNode as MirrorNodeClient;
  let precheck: Precheck;

  const SUCCESS = 'SUCCESS';
  const STATUS_SUCCESS = '0x1';
  const CONTRACT_EXECUTION_EXCEPTION = 'CONTRACT_EXECUTION_EXCEPTION';
  const INVALID_FEE_SUBMITTED = 'INVALID_FEE_SUBMITTED';
  const INVALID_SOLIDITY_ADDRESS = 'INVALID_SOLIDITY_ADDRESS';
  const CONTRACT_REVERT_EXECUTED = 'CONTRACT_REVERT_EXECUTED';
  const prefix = '0x';
  const ETH_PRECOMPILE_0x1 = '0.0.1';
  const ETH_PRECOMPILE_0x361 = '0.0.361';
  const ADDRESS_0x800 = '0.0.800';
  const ETH_PRECOMPILE_0x1001 = '0.0.1001';
  const NON_EXISTING_CONTRACT_ID = '0.0.564400';
  const NON_EXISTING_FUNCTION = 'nxxixxkxxi';
  const EMPTY_FUNCTION_PARAMS = new ContractFunctionParameters();
  const EMPTY_UINT8_ARRAY = new Uint8Array(0);
  const ADDRESS_0_0_0 = '0.0.0';
  const ADDRESS_0_0_1 = '0.0.1';
  const ADDRESS_0_0_2 = '0.0.2';
  const ADDRESS_0_0_3 = '0.0.3';
  const ADDRESS_0_0_4 = '0.0.4';
  const ADDRESS_0_0_359 = '0.0.359';
  const ADDRESS_0_0_360 = '0.0.360';
  const ADDRESS_0_0_361 = '0.0.361';
  const MAKE_CALL_WITHOUT_AMOUNT = 'makeCallWithoutAmount';
  const MAKE_CALL_WITH_AMOUNT = 'makeCallWithAmount';
  const MAKE_HTS_CALL_WITHOUT_AMOUNT = 'htsCallWithoutAmount';
  const MAKE_HTS_CALL_WITH_AMOUNT = 'htsCallWithAmount';
  const accounts: AliasAccount[] = [];
  let tokenAddress;
  let estimatePrecompileContractReceipt;
  let estimatePrecompileContractAddress;
  let estimatePrecompileSolidityAddress;
  let equivalenceContractReceipt;
  let equivalenceContractId;
  let equivalenceContract;
  let equivalenceContractSolidityAddress;
  let equivalenceDestructContractId;
  let equivalenceDestructContractReceipt;
  let estimateContract;
  let requestId;

  const expectSuccessfulContractCall = (record) => {
    expect(record.contract_id).to.equal(
      equivalenceContractId,
      'Contract Id from record did not match with equivalence contract Id.',
    );
    expect(record.result).to.equal(SUCCESS, 'Result from record was not as expected.');
    expect(record.status).to.equal(STATUS_SUCCESS, 'Status from record was not as expected');
  };

  before(async function () {
    signers[0] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());

    //Deploying Estimate Precompile contract
    estimatePrecompileContractReceipt = await servicesClient.deployContract(
      EstimatePrecompileContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    estimatePrecompileContractAddress = estimatePrecompileContractReceipt.contractId.toString();
    estimatePrecompileSolidityAddress = estimatePrecompileContractReceipt.contractId.toSolidityAddress();
    console.log(`estimatePrecompileContractAddress: ${estimatePrecompileContractAddress}`);

    //Deploying Equivalence Destrcut contract
    equivalenceDestructContractReceipt = await servicesClient.deployContract(
      EquivalenceDestructContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    equivalenceDestructContractId = equivalenceDestructContractReceipt.contractId.toString();
    console.log(`equivalenceDestructContractId: ${equivalenceDestructContractId}`);

    //Deploying Equivalence contract
    equivalenceContractReceipt = await servicesClient.deployContract(
      EquivalenceContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    equivalenceContractId = equivalenceContractReceipt.contractId.toString();
    console.log(`equivalenceContractId: ${equivalenceContractId}`);
    equivalenceContractSolidityAddress = equivalenceContractReceipt.contractId.toSolidityAddress();

    equivalenceContract = new ethers.Contract(
      prefix + equivalenceContractSolidityAddress,
      EquivalenceContractJson.abi,
      signers[0].wallet,
    );
    console.log(`equivalenceContract:\n${JSON.stringify(equivalenceContract, null, 2)}`);

    requestId = Utils.generateRequestId();
    const contractMirror = await mirrorNodeClient.get(`/contracts/${estimatePrecompileSolidityAddress}`, requestId);

    accounts[0] = await servicesClient.createAccountWithContractIdKey(
      contractMirror.contract_id,
      200,
      relay.provider,
      requestId,
    );

    tokenAddress = await createFungibleToken();
    console.log(`tokenAddress: ${tokenAddress}`);
    precheck = new Precheck(mirrorNodeClient, logger, '0x12a');
  });

  enum Opcodes {
    Call = 'Call',
    StaticCall = 'StaticCall',
    DelegateCall = 'DelegateCall',
    CallCode = 'CallCode',
  }

  enum Outcomes {
    Output = 'OUTPUT',
    Error = 'ERROR',
  }

  const getTestSummaryAmount = (amount: number): string => {
    return amount === 0 ? 'without' : 'with';
  };

  const getTestSummaryOutcome = (outcome: Outcomes, hederaAddress: string, errorMessage?: string): string => {
    let addressName: string;
    switch (hederaAddress) {
      case ADDRESS_0_0_1: {
        addressName = `ecrecover precompile`;
        break;
      }
      case ADDRESS_0_0_2: {
        addressName = `SHA-256 precompile`;
        break;
      }
      case ADDRESS_0_0_3: {
        addressName = `RIPEMD-160 precompile`;
        break;
      }
      case ADDRESS_0_0_4: {
        addressName = `identity precompile`;
        break;
      }
      case ADDRESS_0_0_359: {
        addressName = `HTS precompile`;
        break;
      }
      case ADDRESS_0_0_360: {
        addressName = `ExchangeRate precompile`;
        break;
      }
      case ADDRESS_0_0_361: {
        addressName = `PRNG precompile`;
        break;
      }
      // no need to identify unnamed addresses
      default: {
        addressName = '';
      }
    }

    switch (outcome) {
      case Outcomes.Error: {
        return `should fail ${addressName ? `executing ${addressName}` : ''}${
          errorMessage ? `with ${errorMessage}` : ''
        }`;
      }
      case Outcomes.Output: {
        return addressName ? `should execute the ${addressName}` : 'should succeed';
      }
      default: {
        assert.fail(`Unsupported outcome: ${outcome} type provided in test data`);
      }
    }
  };

  const getFunctionName = (opcode: Opcodes, amount: number, hederaAddress: string): string => {
    let functionName = '';
    const isWithAmount = amount > 0;
    switch (hederaAddress) {
      case ADDRESS_0_0_359: {
        switch (opcode) {
          case Opcodes.Call: {
            functionName = isWithAmount ? MAKE_HTS_CALL_WITH_AMOUNT : MAKE_HTS_CALL_WITHOUT_AMOUNT;
            break;
          }
          case Opcodes.StaticCall:
          case Opcodes.DelegateCall: {
            functionName = `hts${opcode}`;
            break;
          }
        }
        break;
      }
      case ADDRESS_0_0_360: {
        switch (opcode) {
          case Opcodes.Call: {
            functionName = isWithAmount ? 'exchangeRateWithAmount' : 'exchangeRateWithoutAmount';
            break;
          }
          case Opcodes.StaticCall:
          case Opcodes.DelegateCall: {
            functionName = `exchangeRate${opcode}`;
            break;
          }
        }
        break;
      }
      case ADDRESS_0_0_361: {
        switch (opcode) {
          case Opcodes.Call: {
            functionName = isWithAmount ? 'getPseudorandomSeedWithAmount' : 'getPseudorandomSeed';
            break;
          }
          case Opcodes.StaticCall:
          case Opcodes.DelegateCall: {
            functionName = `getPseudorandomSeed${opcode}`;
            break;
          }
        }
        break;
      }
      default: {
        switch (opcode) {
          case Opcodes.Call: {
            functionName = isWithAmount ? MAKE_CALL_WITH_AMOUNT : MAKE_CALL_WITHOUT_AMOUNT;
            break;
          }
          case Opcodes.StaticCall:
          case Opcodes.DelegateCall: {
            functionName = `make${opcode}`;
            break;
          }
        }
      }
    }
    if (!functionName) {
      assert.fail('function name not found');
    }

    return functionName;
  };

  const getContractFunctionParams = (hederaAddress: string): ContractFunctionParameters => {
    let params: ContractFunctionParameters;
    switch (hederaAddress) {
      case ADDRESS_0_0_359: {
        params = new ContractFunctionParameters().addAddress(tokenAddress);
        break;
      }
      case ADDRESS_0_0_360: {
        params = new ContractFunctionParameters().addUint256(100);
        break;
      }
      case ADDRESS_0_0_361: {
        params = EMPTY_FUNCTION_PARAMS;
        break;
      }
      default: {
        params = new ContractFunctionParameters()
          .addAddress(Utils.idToEvmAddress(hederaAddress))
          .addBytes(EMPTY_UINT8_ARRAY);
      }
    }
    return params;
  };

  async function getResultByEntityIdAndTxTimestamp(entityId, txTimestamp) {
    return await mirrorNode.get(`/contracts/${entityId}/results/${txTimestamp}`);
  }

  /**
   * Returns a list of ContractActions for a contract's function executions for a given transactionId or ethereum transaction hash.
   * @param transactionIdOrHash Transaction Id or a 32 byte hash with optional 0x prefix
   * @returns list of ContractActions
   */
  async function getContractActions(transactionIdOrHash: string) {
    return await mirrorNodeClient.get(`/contracts/results/${transactionIdOrHash}/actions`, Utils.generateRequestId());
  }

  async function createFungibleToken() {
    estimateContract = new ethers.Contract(
      prefix + estimatePrecompileSolidityAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );
    const tx = await estimateContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 10_000_000,
    });

    const tokenAddress = (await tx.wait()).logs.filter(
      (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken,
    )[0].args[0];
    return tokenAddress;
  }

  it('should execute direct call to ethereum precompile 0x1', async function () {
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      ETH_PRECOMPILE_0x1,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  // EQV-003 - Should fail with INVALID_SOLIDIY_ADDRESS
  // async function testRejection(errorMessage, method, checkMessage, thisObj, args?)
  it('should execute direct call to address 361 to 750 without amount', async function () {
    const args = [ETH_PRECOMPILE_0x361, NON_EXISTING_FUNCTION, EMPTY_FUNCTION_PARAMS, 500_000];
    await testRejection(CONTRACT_EXECUTION_EXCEPTION, servicesNode.executeContractCall, true, servicesNode, args);
  });

  // EQV-004 - Should fail with INVALID_FEE_SUBMITTED
  it('should execute direct call to ethereum precompile 361 to 750 with amount', async function () {
    const args = [ETH_PRECOMPILE_0x361, NON_EXISTING_FUNCTION, EMPTY_FUNCTION_PARAMS, 500_000, 100];
    await testRejection(INVALID_FEE_SUBMITTED, servicesNode.executeContractCallWithAmount, true, servicesNode, args);
  });

  // EQV-005 - OK - ??? Should it be like that? - Should it be successfull
  it('should execute direct call to address 751 without amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      ADDRESS_0x800,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ADDRESS_0x800, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ADDRESS_0x800);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS); //Check if it should be CONTRACT_EXECUTION_EXCEPTION
  });

  // EQV-005 - OK - ??? Should it be like that? - Should it be successfull
  it('should execute direct call to address 751 with amount', async function () {
    const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
      ADDRESS_0x800,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      500_000,
      100,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ADDRESS_0x800, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ADDRESS_0x800);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  // EQV-006 - should be successfull - OK
  it('should execute direct call to address over 1000 without amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      ETH_PRECOMPILE_0x1001,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1001, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1001);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  // EQV-006 - should be successfull - OK
  it('should execute direct call to address over 1000 without amount - case contract ', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      estimatePrecompileContractAddress,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceDestructContractId, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(equivalenceDestructContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  // EQV-007 - Should fail with INVALID_SOLIDIY_ADDRESS but it is SUCCESSFULL and creates Inactive EVM Address  - ????????
  it('should execute direct call to non-existing contract', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      NON_EXISTING_CONTRACT_ID,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(NON_EXISTING_CONTRACT_ID, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(NON_EXISTING_CONTRACT_ID);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  // EQV-008 - should be successfull - OK
  it('should execute direct call to address over 1000 without amount - case payable contract ', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      equivalenceDestructContractId,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceDestructContractId, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(equivalenceDestructContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  // EQV-009 - OK -  should be unsuccessfull
  it('should execute direct call to address over 1000 with amount - case non-payable contract ', async function () {
    const args = [estimatePrecompileContractAddress, NON_EXISTING_FUNCTION, EMPTY_FUNCTION_PARAMS, 500_000, 100];
    await testRejection(CONTRACT_REVERT_EXECUTED, servicesNode.executeContractCallWithAmount, true, servicesNode, args);
  });

  it('should execute direct call to address over 1000 with amount', async function () {
    const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
      'ETH_PRECOMPILE_0x1001',
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      1_000_000,
      100,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1001, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1001);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION);
  });

  // EQV-13 This should be successful due to hollow account creation
  it('should execute direct call to address over 1000 with amount - case hollow acconut', async function () {
    const hollowAccount = ethers.Wallet.createRandom();
    const hollowAcAddress = hollowAccount.address.toString();

    const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
      hollowAcAddress,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      1_000_000,
      100,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1001, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1001);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION);
  });

  [
    {
      // Equivalence 014, 040, 052
      opcodes: [Opcodes.Call, Opcodes.StaticCall, Opcodes.DelegateCall],
      addresses: [ADDRESS_0_0_0],
      amount: 0,
      outcome: Outcomes.Output,
      errorMessage: '',
    },
    {
      // Equivalence 015
      opcodes: [Opcodes.Call],
      addresses: [ADDRESS_0_0_0],
      amount: 100,
      outcome: Outcomes.Error,
      errorMessage: INVALID_FEE_SUBMITTED,
    },
    {
      // Equivalence 020
      opcodes: [Opcodes.Call],
      addresses: ['0.0.1', '0.0.2', '0.0.3', '0.0.4', '0.0.5', '0.0.6', '0.0.7', '0.0.8', '0.0.9'],
      amount: 100,
      outcome: Outcomes.Error,
      errorMessage: INVALID_FEE_SUBMITTED,
    },
    {
      // Equivalence 022
      opcodes: [Opcodes.Call],
      addresses: ['0.0.10', '0.0.100', '0.0.357'],
      amount: 100,
      outcome: Outcomes.Error,
      errorMessage: INVALID_FEE_SUBMITTED,
    },
    {
      // Equivalence 021, 045, 057
      opcodes: [Opcodes.Call, Opcodes.StaticCall, Opcodes.DelegateCall],
      addresses: ['0.0.10', '0.0.100', '0.0.357'],
      amount: 0,
      outcome: Outcomes.Error,
      errorMessage: INVALID_SOLIDITY_ADDRESS,
    },
    {
      // Equivalence 030
      opcodes: [Opcodes.Call],
      addresses: ['0.0.362', '0.0.556', '0.0.750'],
      amount: 100,
      outcome: Outcomes.Error,
      errorMessage: INVALID_FEE_SUBMITTED,
    },
    {
      // Equivalence 031 - Updated, same as mirror node, call to 751..799 fails with INVALID_ALIAS_KEY
      // This should be verified, what is the behaviour?
      opcodes: [Opcodes.Call],
      addresses: ['0.0.751', '0.0.799', '0.0.800', '0.0.1000'],
      amount: 100,
      outcome: Outcomes.Output,
      errorMessage: '',
    },
    {
      // Equivalence 029, 049, 061
      opcodes: [Opcodes.Call, Opcodes.StaticCall, Opcodes.DelegateCall],
      addresses: ['0.0.362', '0.0.750', '0.0.751', '0.0.1000'],
      amount: 0,
      outcome: Outcomes.Error,
      errorMessage: INVALID_SOLIDITY_ADDRESS,
    },
  ].forEach((test) => {
    test.opcodes.forEach((opcode) => {
      test.addresses.forEach((address) => {
        it(`internal ${opcode.toUpperCase()} to address ${address} ${getTestSummaryAmount(
          test.amount,
        )} amount ${getTestSummaryOutcome(
          test.outcome,
          address,
          test.errorMessage,
        )} when called through an intermediary contract`, async function () {
          const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
            equivalenceContractId,
            getFunctionName(opcode, test.amount, address),
            getContractFunctionParams(address),
            500_000,
            test.amount,
          );

          const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
          expectSuccessfulContractCall(record);

          const contractActions = await getContractActions(record.hash);
          const childRecord = contractActions.actions[1];

          expect(childRecord.to).to.equal(Utils.idToEvmAddress(address));
          expect(childRecord.call_operation_type).to.equal(opcode.toUpperCase());

          if (test.outcome === Outcomes.Error) {
            expect(childRecord.result_data_type).to.equal(
              Outcomes.Error,
              'Expected "Error" but contract call was executed successfully.',
            );
            if (test.errorMessage) {
              expect(decodeResultData(childRecord.result_data)).to.equal(
                test.errorMessage,
                'Error received was not as expected.',
              );
            }
          } else if (test.outcome === Outcomes.Output) {
            expect(childRecord.result_data_type).to.equal(
              Outcomes.Output,
              `Expected "Output" but received error in child record: "${decodeResultData(childRecord.result_data)}".`,
            );
          } else {
            assert.fail(`Test outcome "${test.outcome}" is not handled in test code`);
          }
        });
      });
    });
  });

  // Equivalence 016, 041, 053
  [Opcodes.Call, Opcodes.StaticCall, Opcodes.DelegateCall].forEach((opcode) => {
    it(`internal ${opcode.toUpperCase()} to address 0.0.1 without amount with knowh hash and signature should execute the ecrecover precompile through the intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_1);
      const messageSignerAddress = '05fba803be258049a27b820088bab1cad2058871';
      const hashedMessage =
        '0xf950ac8b7f08b2f5ffa0f893d0f85398135301759b768dc20c1e16d9cdba5b53000000000000000000000000000000000000000000000000000000000000001b45e5f9dc145b79479820a9dfa925bb698333e7f17b7d570391e8487c96a39e07675b682b2519f6232152a9f6f4f5923d171dfb7636daceee2c776edecc6c8b64';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        getFunctionName(opcode, 0, ADDRESS_0_0_1),
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(precheck.hexToBytes(hashedMessage)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      expectSuccessfulContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(childRecord.call_type).to.equal('PRECOMPILE');
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.result_data_type).to.equal(
        Outcomes.Output,
        `Expected "Output" but received error in child record: "${decodeResultData(childRecord.result_data)}".`,
      );
      expect(childRecord.result_data).to.include(messageSignerAddress);
    });
  });

  // Equivalence 017, 042, 054
  [Opcodes.Call, Opcodes.StaticCall, Opcodes.DelegateCall].forEach((opcode) => {
    it(`internal ${opcode.toUpperCase()} to address 0.0.2 without amount with knowh hash and signature should execute the SHA-256 precompile through the intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_2);
      const message = 'Encode me!';
      const hashedMessage = '0x68907fbd785a694c3617d35a6ce49477ac5704d75f0e727e353da7bc664aacc2';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        getFunctionName(opcode, 0, ADDRESS_0_0_2),
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(toUtf8Bytes(message)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      expectSuccessfulContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(childRecord.call_type).to.equal('PRECOMPILE');
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.result_data_type).to.equal(
        Outcomes.Output,
        `Expected "Output" but received error in child record: "${decodeResultData(childRecord.result_data)}".`,
      );
      expect(childRecord.result_data).to.equal(hashedMessage);
    });
  });

  // Equivalence 018, 043, 055
  [Opcodes.Call, Opcodes.StaticCall, Opcodes.DelegateCall].forEach((opcode) => {
    it(`internal ${opcode.toUpperCase()} to address 0.0.3 without amount with knowh hash and signature should execute the RIPEMD-160 precompile through the intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_3);
      const message = 'Encode me!';
      const hashedMessage = '4f0c39893f4c1c805aea87a95b5d359a218920d6';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        getFunctionName(opcode, 0, ADDRESS_0_0_3),
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(toUtf8Bytes(message)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      expectSuccessfulContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(childRecord.call_type).to.equal('PRECOMPILE');
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.result_data_type).to.equal(
        Outcomes.Output,
        `Expected "Output" but received error in child record: "${decodeResultData(childRecord.result_data)}".`,
      );
      expect(removeLeadingZeros(removeLeading0x(childRecord.result_data))).to.equal(hashedMessage);
    });
  });

  // Equivalence 019, 044, 056
  [Opcodes.Call, Opcodes.StaticCall, Opcodes.DelegateCall].forEach((opcode) => {
    it(`internal ${opcode.toUpperCase()} to address 0.0.4 without amount with knowh hash and signature should execute the identity precompile through the intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_4);
      const message = 'Encode me!';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        getFunctionName(opcode, 0, ADDRESS_0_0_4),
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(toUtf8Bytes(message)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      expectSuccessfulContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(childRecord.call_type).to.equal('PRECOMPILE');
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.result_data_type).to.equal(
        Outcomes.Output,
        `Expected "Output" but received error in child record: "${decodeResultData(childRecord.result_data)}".`,
      );
      expect(decodeResultData(childRecord.result_data)).to.equal(
        message,
        `Decoded 'result_data' from child record is not '${message}'`,
      );
    });
  });

  // Equivalence 024, 027, 028
  [ADDRESS_0_0_359, ADDRESS_0_0_360, ADDRESS_0_0_361].forEach((address) => {
    it(`internal CALL to address ${address} with amount ${getTestSummaryOutcome(
      Outcomes.Error,
      address,
      INVALID_FEE_SUBMITTED,
    )} through the intermediary contract`, async function () {
      const evmAddress = Utils.idToEvmAddress(address);
      const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
        equivalenceContractId,
        getFunctionName(Opcodes.Call, 100, address),
        getContractFunctionParams(address),
        500_000,
        100,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      expectSuccessfulContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(childRecord.call_operation_type).to.equal(Opcodes.Call.toUpperCase());
      expect(childRecord.call_type).to.equal('SYSTEM');
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.result_data_type).to.equal(
        Outcomes.Error,
        'Expected "Error" but contract call was executed successfully.',
      );
      expect(decodeResultData(childRecord.result_data)).to.equal(
        INVALID_FEE_SUBMITTED,
        'Error received was not as expected.',
      );
    });
  });

  // Equivalence 023, 025, 026, 046, 047, 048, 058, 059, 060
  [Opcodes.Call, Opcodes.StaticCall, Opcodes.DelegateCall].forEach((opcode) => {
    [ADDRESS_0_0_359, ADDRESS_0_0_360, ADDRESS_0_0_361].forEach((address) => {
      it(`internal ${opcode.toUpperCase()} to address ${address} without amount ${getTestSummaryOutcome(
        Outcomes.Output,
        address,
      )} through the intermediary contract`, async function () {
        const evmAddress = Utils.idToEvmAddress(address);
        const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
          equivalenceContractId,
          getFunctionName(opcode, 0, address),
          getContractFunctionParams(address),
          500_000,
          0,
        );

        const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
        expectSuccessfulContractCall(record);

        const contractActions = await getContractActions(record.hash);
        const childRecord = contractActions.actions[1];

        expect(childRecord.call_operation_type).to.equal(opcode.toUpperCase());
        expect(childRecord.call_type).to.equal('SYSTEM');
        expect(childRecord.to).to.equal(evmAddress);
        expect(childRecord.result_data_type).to.equal(
          Outcomes.Output,
          `Expected "Output" but received error in child record: "${decodeResultData(childRecord.result_data)}".`,
        );
      });
    });
  });
});
