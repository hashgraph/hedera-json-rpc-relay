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

const getTransactionIdFromException = (error) => {
  const idFromEx = error.transactionId.toString().split('@');
  return `${idFromEx[0]}-${idFromEx[1].replace('.', '-')}`;
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
  const CONTRACT_REVERT_EXECUTED = 'CONTRACT_REVERT_EXECUTED';
  const prefix = '0x';
  const ETH_PRECOMPILE_0x1 = '0.0.1';
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

  const validateContractCall = (
    record,
    expectedContractId = equivalenceContractId,
    expectedResult = SUCCESS,
    expectedStatus = STATUS_SUCCESS,
  ) => {
    expect(record.contract_id).to.equal(expectedContractId, "Record 'contract_id' was not as expected.");
    expect(record.result).to.equal(expectedResult, "Record 'result' was not as expected.");
    expect(record.status).to.equal(expectedStatus, "Record 'status' was not as expected.");
  };

  const validateContractActions = (contractAction, callType: CallTypes, outcome: Outcomes, message?: string) => {
    const txLookup = `\nCheck transaction record by timestamp:'${contractAction.timestamp}'`;
    expect(contractAction.call_operation_type).to.equal(
      callType.toUpperCase(),
      `Internal call type was not as expected`,
    );
    if (outcome === Outcomes.Error) {
      expect(contractAction.result_data_type).to.equal(
        Outcomes.Error,
        `Expected "Error" but contract ${callType.toUpperCase()} was executed successfully.${txLookup}`,
      );
      if (message) {
        expect(decodeResultData(contractAction.result_data)).to.equal(
          message,
          `Error received was not as expected.${txLookup}`,
        );
      }
    } else if (outcome === Outcomes.Output) {
      expect(contractAction.result_data_type).to.equal(
        Outcomes.Output,
        `Expected "${message === '0x' ? 'noop' : 'Output'}" but received error: "${decodeResultData(
          contractAction.result_data,
        )}".${txLookup}`,
      );
      if (message) {
        expect(contractAction.result_data).to.equal(message, `Output "result_data" was not as expected.${txLookup}`);
      }
    } else {
      assert.fail(`Test outcome "${outcome}" is not handled in test code`);
    }
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

  enum CallTypes {
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

  const getTestSummaryOutcome = (outcome: Outcomes, hederaAddress: string, message?: string): string => {
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
        let result = 'should fail';
        if (addressName) {
          result = result + ` executing ${addressName}`;
        }
        if (message) {
          result = result + ` with ${message}`;
        }
        return result;
      }
      case Outcomes.Output: {
        let result = addressName ? `should execute the ${addressName}` : 'should succeed';
        if (message) {
          result = result + (message === '0x' ? ' with noop' : `with output "${message}"`);
        }
        return result;
      }
      default: {
        assert.fail(`Unsupported outcome: ${outcome} type provided in test data`);
      }
    }
  };

  const getFunctionName = (callType: CallTypes, amount: number, hederaAddress: string): string => {
    let functionName = '';
    const isWithAmount = amount > 0;
    switch (hederaAddress) {
      case ADDRESS_0_0_359: {
        switch (callType) {
          case CallTypes.Call: {
            functionName = isWithAmount ? MAKE_HTS_CALL_WITH_AMOUNT : MAKE_HTS_CALL_WITHOUT_AMOUNT;
            break;
          }
          case CallTypes.StaticCall:
          case CallTypes.DelegateCall: {
            functionName = `hts${callType}`;
            break;
          }
        }
        break;
      }
      case ADDRESS_0_0_360: {
        switch (callType) {
          case CallTypes.Call: {
            functionName = isWithAmount ? 'exchangeRateWithAmount' : 'exchangeRateWithoutAmount';
            break;
          }
          case CallTypes.StaticCall:
          case CallTypes.DelegateCall: {
            functionName = `exchangeRate${callType}`;
            break;
          }
        }
        break;
      }
      case ADDRESS_0_0_361: {
        switch (callType) {
          case CallTypes.Call: {
            functionName = isWithAmount ? 'getPseudorandomSeedWithAmount' : 'getPseudorandomSeed';
            break;
          }
          case CallTypes.StaticCall:
          case CallTypes.DelegateCall: {
            functionName = `getPseudorandomSeed${callType}`;
            break;
          }
        }
        break;
      }
      default: {
        switch (callType) {
          case CallTypes.Call: {
            functionName = isWithAmount ? MAKE_CALL_WITH_AMOUNT : MAKE_CALL_WITHOUT_AMOUNT;
            break;
          }
          case CallTypes.StaticCall:
          case CallTypes.DelegateCall: {
            functionName = `make${callType}`;
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
      value: BigInt('50000000000000000000'),
      gasLimit: 10_000_000,
    });

    const tokenAddress = (await tx.wait()).logs.filter(
      (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken,
    )[0].args[0];
    return tokenAddress;
  }

  it('direct CALL to ethereum precompile 0x1 should succeed', async function () {
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      ETH_PRECOMPILE_0x1,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1, contractExecuteTimestamp);
    validateContractCall(record, ETH_PRECOMPILE_0x1, SUCCESS, STATUS_SUCCESS);

    const contractActions = await getContractActions(record.hash);
    validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Output);
  });

  // Equivalence-003; Address 0.0.362 currently skipped because of ongoing issue being investigated
  [/*'0.0.362',*/ '0.0.556', '0.0.750'].forEach((address) => {
    it(`direct CALL to ethereum precompile ${address} without amount should succeed with noop`, async function () {
      let contractCallResult;
      try {
        contractCallResult = await servicesClient.executeContractCall(
          address,
          NON_EXISTING_FUNCTION,
          EMPTY_FUNCTION_PARAMS,
          500_000,
        );
      } catch (e) {
        const contractActions = await getContractActions(getTransactionIdFromException(e));
        validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Output, '0x');
        return;
      }
      const record = await getResultByEntityIdAndTxTimestamp(address, contractCallResult.contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Output, '0x');
    });
  });

  // Equivalence-004; Address 0.0.362 currently skipped because of ongoing issue being investigated
  [, /*'0.0.362'*/ '0.0.556', '0.0.750'].forEach((address) => {
    it(`direct CALL to ethereum precompile ${address} with amount should fail with INVALID_FEE_SUBMITTED`, async function () {
      let contractCallResult;
      try {
        contractCallResult = await servicesClient.executeContractCallWithAmount(
          address,
          NON_EXISTING_FUNCTION,
          EMPTY_FUNCTION_PARAMS,
          500_000,
          100,
        );
      } catch (e) {
        const contractActions = await getContractActions(getTransactionIdFromException(e));
        validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Error, INVALID_FEE_SUBMITTED);
        return;
      }
      const record = await getResultByEntityIdAndTxTimestamp(address, contractCallResult.contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Error, INVALID_FEE_SUBMITTED);
    });
  });

  // Equivalence-005
  ['0.0.751', '0.0.799', '0.0.800', '0.0.1000'].forEach((address) => {
    it(`direct CALL to address ${address} without amount should succeed with noop`, async function () {
      let contractCallResult;
      try {
        contractCallResult = await servicesClient.executeContractCall(
          address,
          NON_EXISTING_FUNCTION,
          EMPTY_FUNCTION_PARAMS,
          500_000,
        );
      } catch (e) {
        const contractActions = await getContractActions(getTransactionIdFromException(e));
        validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Output, '0x');
        return;
      }
      const record = await getResultByEntityIdAndTxTimestamp(address, contractCallResult.contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Output, '0x');
    });
  });

  // Equivalence-005; Address range [0.0.751-0.0.799] currently skipped because of ongoing issue being investigated
  [/*'0.0.751', '0.0.799',*/ '0.0.800', '0.0.1000'].forEach((address) => {
    it(`direct CALL to address ${address} with amount should succeed`, async function () {
      let contractCallResult;
      try {
        contractCallResult = await servicesClient.executeContractCallWithAmount(
          address,
          NON_EXISTING_FUNCTION,
          EMPTY_FUNCTION_PARAMS,
          500_000,
          100,
        );
      } catch (e) {
        const contractActions = await getContractActions(getTransactionIdFromException(e));
        validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Output);
        return;
      }
      const record = await getResultByEntityIdAndTxTimestamp(address, contractCallResult.contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Output);
    });
  });

  // EQV-006 - should be successfull - OK
  it('direct CALL to address over 1000 without amount should succeed with noop', async function () {
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      ETH_PRECOMPILE_0x1001,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1001, contractExecuteTimestamp);
    validateContractCall(record, ETH_PRECOMPILE_0x1001, SUCCESS, STATUS_SUCCESS);

    const contractActions = await getContractActions(record.hash);
    validateContractActions(contractActions.actions[0], CallTypes.Call, Outcomes.Output, '0x');
  });

  // EQV-006 - should be successfull - OK
  // Skipped as test is not ready
  it.skip('should execute direct call to address over 1000 without amount - case contract', async function () {
    let contractCallResult;
    try {
      contractCallResult = await servicesClient.executeContractCall(
        estimatePrecompileContractAddress,
        NON_EXISTING_FUNCTION,
        EMPTY_FUNCTION_PARAMS,
        1_000_000,
      );
    } catch (e) {
      const contractActions = await getContractActions(getTransactionIdFromException(e));
      assert.fail(`${e.message}\ncontact actions:\n${JSON.stringify(contractActions, null, 2)}`);
    }

    const record = await getResultByEntityIdAndTxTimestamp(
      equivalenceDestructContractId,
      contractCallResult.contractExecuteTimestamp,
    );
    validateContractCall(record, equivalenceDestructContractId, SUCCESS, STATUS_SUCCESS);
  });

  // EQV-007 - Should fail with INVALID_SOLIDIY_ADDRESS but it is SUCCESSFULL and creates Inactive EVM Address  - ????????
  // Skipped as test is not ready
  it.skip('should execute direct call to non-existing contract', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      NON_EXISTING_CONTRACT_ID,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(NON_EXISTING_CONTRACT_ID, contractExecuteTimestamp);
    validateContractCall(record, NON_EXISTING_CONTRACT_ID, SUCCESS, STATUS_SUCCESS);
  });

  // EQV-008 - should be successfull - OK
  // Skipped as test is not ready
  it.skip('direct CALL to address over 1000 without amount (payable contract)', async function () {
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceDestructContractId,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceDestructContractId, contractExecuteTimestamp);
    validateContractCall(record, equivalenceDestructContractId, SUCCESS, STATUS_SUCCESS);
  });

  // EQV-009 - OK -  should be unsuccessfull
  it('should execute direct call to address over 1000 with amount - case non-payable contract ', async function () {
    const args = [estimatePrecompileContractAddress, NON_EXISTING_FUNCTION, EMPTY_FUNCTION_PARAMS, 500_000, 100];
    await testRejection(CONTRACT_REVERT_EXECUTED, servicesNode.executeContractCallWithAmount, true, servicesNode, args);
  });

  // Skipped as test is not ready
  it.skip('should execute direct call to address over 1000 with amount', async function () {
    let contractCallResult;
    try {
      contractCallResult = await servicesClient.executeContractCallWithAmount(
        ETH_PRECOMPILE_0x1001,
        NON_EXISTING_FUNCTION,
        EMPTY_FUNCTION_PARAMS,
        1_000_000,
        100,
      );
    } catch (e) {
      const contractActions = await getContractActions(getTransactionIdFromException(e));
      assert.fail(`${e.message}\ncontact actions:\n${JSON.stringify(contractActions, null, 2)}`);
    }

    const record = await getResultByEntityIdAndTxTimestamp(
      ETH_PRECOMPILE_0x1001,
      contractCallResult.contractExecuteTimestamp,
    );
    validateContractCall(record, ETH_PRECOMPILE_0x1001, SUCCESS, CONTRACT_EXECUTION_EXCEPTION);
  });

  // EQV-13 This should be successful due to hollow account creation
  // Skipped as test is not ready
  it.skip('should execute direct call to address over 1000 with amount - case hollow acconut', async function () {
    const hollowAccount = ethers.Wallet.createRandom();
    // convert evm address to hedera address
    const hollowAcAddress = hollowAccount.address.toString();
    let contractCallResult;

    try {
      contractCallResult = await servicesClient.executeContractCallWithAmount(
        hollowAcAddress,
        NON_EXISTING_FUNCTION,
        EMPTY_FUNCTION_PARAMS,
        1_000_000,
        100,
      );
    } catch (e) {
      const contractActions = await getContractActions(getTransactionIdFromException(e));
      assert.fail(`${e.message}\ncontact actions:\n${JSON.stringify(contractActions, null, 2)}`);
    }

    const record = await getResultByEntityIdAndTxTimestamp(
      ETH_PRECOMPILE_0x1001,
      contractCallResult.contractExecuteTimestamp,
    );
    validateContractCall(record, ETH_PRECOMPILE_0x1001, SUCCESS, CONTRACT_EXECUTION_EXCEPTION);
  });

  [
    {
      // Equivalence 014, 040, 052
      callTypes: [CallTypes.Call, CallTypes.StaticCall, CallTypes.DelegateCall],
      addresses: [ADDRESS_0_0_0],
      amount: 0,
      outcome: Outcomes.Output,
      message: '0x',
    },
    {
      // Equivalence-015
      callTypes: [CallTypes.Call],
      addresses: [ADDRESS_0_0_0],
      amount: 100,
      outcome: Outcomes.Error,
      message: INVALID_FEE_SUBMITTED,
    },
    {
      // Equivalence-020
      callTypes: [CallTypes.Call],
      addresses: ['0.0.1', '0.0.2', '0.0.3', '0.0.4', '0.0.5', '0.0.6', '0.0.7', '0.0.8', '0.0.9'],
      amount: 100,
      outcome: Outcomes.Error,
      message: INVALID_FEE_SUBMITTED,
    },
    {
      // Equivalence-022
      callTypes: [CallTypes.Call],
      addresses: ['0.0.10', '0.0.100', '0.0.358'],
      amount: 100,
      outcome: Outcomes.Error,
      message: INVALID_FEE_SUBMITTED,
    },
    {
      // Equivalence-021, 045, 057; Address 0.0.10 currently skipped because of ongoing issue being investigated
      callTypes: [CallTypes.Call, CallTypes.StaticCall, CallTypes.DelegateCall],
      addresses: [/*'0.0.10',*/ '0.0.100', '0.0.358'],
      amount: 0,
      outcome: Outcomes.Output,
      message: '0x',
    },
    {
      // Equivalence-030; Address 0.0.362 currently skipped because of ongoing issue being investigated
      callTypes: [CallTypes.Call],
      addresses: [/*'0.0.362',*/ '0.0.556', '0.0.750'],
      amount: 100,
      outcome: Outcomes.Error,
      message: INVALID_FEE_SUBMITTED,
    },
    {
      // Equivalence 031; Address range [0.0.751-0.0.799] currently skipped because of ongoing issue being investigated
      callTypes: [CallTypes.Call],
      addresses: [/*'0.0.751', '0.0.799',*/ '0.0.800', '0.0.1000'],
      amount: 100,
      outcome: Outcomes.Output,
      message: '',
    },
    {
      // Equivalence-029, 049, 061; Address 0.0.362 currently skipped because of ongoing issue being investigated
      callTypes: [CallTypes.Call, CallTypes.StaticCall, CallTypes.DelegateCall],
      addresses: [/*'0.0.362',*/ '0.0.750', '0.0.751', '0.0.1000'],
      amount: 0,
      outcome: Outcomes.Output,
      message: '0x',
    },
  ].forEach((test) => {
    test.callTypes.forEach((callType) => {
      test.addresses.forEach((address) => {
        it(`internal ${callType.toUpperCase()} to address ${address} ${getTestSummaryAmount(
          test.amount,
        )} amount ${getTestSummaryOutcome(
          test.outcome,
          address,
          test.message,
        )} when called through an intermediary contract`, async function () {
          let contractCallResult;
          try {
            contractCallResult = await servicesClient.executeContractCallWithAmount(
              equivalenceContractId,
              getFunctionName(callType, test.amount, address),
              getContractFunctionParams(address),
              500_000,
              test.amount,
            );
          } catch (e) {
            const contractActions = await getContractActions(getTransactionIdFromException(e));
            validateContractActions(contractActions.actions[1], callType, test.outcome, test.message);
            return;
          }

          const record = await getResultByEntityIdAndTxTimestamp(
            equivalenceContractId,
            contractCallResult.contractExecuteTimestamp,
          );
          validateContractCall(record);

          const contractActions = await getContractActions(record.hash);
          validateContractActions(contractActions.actions[1], callType, test.outcome, test.message);
        });
      });
    });
  });

  // Equivalence 016, 041, 053
  [CallTypes.Call, CallTypes.StaticCall, CallTypes.DelegateCall].forEach((callType) => {
    it(`internal ${callType.toUpperCase()} to address 0.0.1 without amount with knowh hash and signature should execute the ecrecover precompile through the intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_1);
      const messageSignerAddress = '05fba803be258049a27b820088bab1cad2058871';
      const hashedMessage =
        '0xf950ac8b7f08b2f5ffa0f893d0f85398135301759b768dc20c1e16d9cdba5b53000000000000000000000000000000000000000000000000000000000000001b45e5f9dc145b79479820a9dfa925bb698333e7f17b7d570391e8487c96a39e07675b682b2519f6232152a9f6f4f5923d171dfb7636daceee2c776edecc6c8b64';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        getFunctionName(callType, 0, ADDRESS_0_0_1),
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(precheck.hexToBytes(hashedMessage)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      validateContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      validateContractActions(childRecord, callType, Outcomes.Output);
      expect(childRecord.result_data).to.include(messageSignerAddress);
    });
  });

  // Equivalence 017, 042, 054
  [CallTypes.Call, CallTypes.StaticCall, CallTypes.DelegateCall].forEach((callType) => {
    it(`internal ${callType.toUpperCase()} to address 0.0.2 without amount with knowh hash and signature should execute the SHA-256 precompile through the intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_2);
      const message = 'Encode me!';
      const hashedMessage = '0x68907fbd785a694c3617d35a6ce49477ac5704d75f0e727e353da7bc664aacc2';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        getFunctionName(callType, 0, ADDRESS_0_0_2),
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(toUtf8Bytes(message)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      validateContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      validateContractActions(childRecord, callType, Outcomes.Output);
      expect(childRecord.result_data).to.equal(hashedMessage);
    });
  });

  // Equivalence 018, 043, 055
  [CallTypes.Call, CallTypes.StaticCall, CallTypes.DelegateCall].forEach((callType) => {
    it(`internal ${callType.toUpperCase()} to address 0.0.3 without amount with knowh hash and signature should execute the RIPEMD-160 precompile through the intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_3);
      const message = 'Encode me!';
      const hashedMessage = '4f0c39893f4c1c805aea87a95b5d359a218920d6';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        getFunctionName(callType, 0, ADDRESS_0_0_3),
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(toUtf8Bytes(message)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      validateContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      validateContractActions(childRecord, callType, Outcomes.Output);
      expect(removeLeadingZeros(removeLeading0x(childRecord.result_data))).to.equal(hashedMessage);
    });
  });

  // Equivalence 019, 044, 056
  [CallTypes.Call, CallTypes.StaticCall, CallTypes.DelegateCall].forEach((callType) => {
    it(`internal ${callType.toUpperCase()} to address 0.0.4 without amount with knowh hash and signature should execute the identity precompile through the intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_4);
      const message = 'Encode me!';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        getFunctionName(callType, 0, ADDRESS_0_0_4),
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(toUtf8Bytes(message)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      validateContractCall(record);

      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      validateContractActions(childRecord, callType, Outcomes.Output);
      expect(decodeResultData(childRecord.result_data)).to.equal(
        message,
        `Decoded 'result_data' from child record is not encoded message:'${message}'`,
      );
    });
  });

  // Equivalence-024, 027, 028; Addresses 0.0.359 and 0.0.361 currently skipped because of ongoing issue being investigated
  [/*ADDRESS_0_0_359,*/ ADDRESS_0_0_360 /*ADDRESS_0_0_361*/].forEach((address) => {
    it(`internal CALL to address ${address} with amount ${getTestSummaryOutcome(
      Outcomes.Error,
      address,
      INVALID_FEE_SUBMITTED,
    )} through the intermediary contract`, async function () {
      let contractCallResult;
      try {
        contractCallResult = await servicesClient.executeContractCallWithAmount(
          equivalenceContractId,
          getFunctionName(CallTypes.Call, 100, address),
          getContractFunctionParams(address),
          500_000,
          100,
        );
      } catch (e) {
        const contractActions = await getContractActions(getTransactionIdFromException(e));
        validateContractActions(contractActions.actions[1], CallTypes.Call, Outcomes.Error, INVALID_FEE_SUBMITTED);
        return;
      }

      const record = await getResultByEntityIdAndTxTimestamp(
        equivalenceContractId,
        contractCallResult.contractExecuteTimestamp,
      );
      validateContractCall(record);
      const contractActions = await getContractActions(record.hash);
      validateContractActions(contractActions.actions[1], CallTypes.Call, Outcomes.Error, INVALID_FEE_SUBMITTED);
    });
  });

  // Equivalence-023, 025, 026, 046, 047, 048, 058, 059, 060; Address 0.0.359 currently skipped because of ongoing issue being investigated
  [CallTypes.Call, CallTypes.StaticCall, CallTypes.DelegateCall].forEach((callType) => {
    [/*ADDRESS_0_0_359,*/ ADDRESS_0_0_360, ADDRESS_0_0_361].forEach((address) => {
      it(`internal ${callType.toUpperCase()} to address ${address} without amount ${getTestSummaryOutcome(
        Outcomes.Output,
        address,
      )} through the intermediary contract`, async function () {
        const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
          equivalenceContractId,
          getFunctionName(callType, 0, address),
          getContractFunctionParams(address),
          500_000,
          0,
        );

        const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
        validateContractCall(record);

        const contractActions = await getContractActions(record.hash);
        validateContractActions(contractActions.actions[1], callType, Outcomes.Output);
      });
    });
  });
});
