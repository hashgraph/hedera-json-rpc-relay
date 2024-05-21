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

import { expect } from 'chai';
import { Utils } from '../helpers/utils';
import ServicesClient, { AliasAccount } from '../clients/servicesClient';
import { ContractFunctionParameters, ContractFunctionSelector } from '@hashgraph/sdk';
import RelayAssertions from '../../../relay/tests/assertions';
import EstimatePrecompileContractJson from '../contracts/EstimatePrecompileContract.json';
import Constants from '../helpers/constants';
import EquivalenceContractJson from '../contracts/EquivalenceContract.json';
import { ethers, toUtf8Bytes } from 'ethers';
import { Precheck } from '../../../relay/src/lib/precheck';
import pino from 'pino';
import { MirrorNodeClient } from '../../../relay/src/lib/clients';
import { CacheService } from '../../../relay/src/lib/services/cacheService/cacheService';
import EquivalenceDestructContractJson from '../contracts/EquivalenceDestruct.json';
import ERC20MockJson from '../contracts/ERC20Mock.json';
import { AccountId, Hbar, ContractId } from '@hashgraph/sdk';
import TokenManagementContractJson from '../contracts/TokenManagementContract.json';
import RelayClient from '../clients/relayClient';
import {
  decodeErrorMessage,
  hexToASCII,
  prepend0x,
  toHexString,
  trimPrecedingZeros,
} from '../../../relay/src/formatters';
import MirrorClient from '../clients/mirrorClient';
const logger = pino();

const removeLeading0x = (input: string) => {
  return input.startsWith('0x') ? input.replace('0x', '') : input;
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
  // const { servicesNode, mirrorNode, relay }: {servicesNode: ServicesClient; mirrorNode: MirrorNodeClient; relay: RelayClient;} = global;
  const { servicesNode, mirrorNode, relay }: any = global;
  const servicesClient = servicesNode as ServicesClient;
  const mirrorClient = mirrorNode as MirrorClient;
  const relayClient = relay as RelayClient;

  const SUCCESS = 'SUCCESS';
  const STATUS_SUCCESS = '0x1';
  const CONTRACT_EXECUTION_EXCEPTION = 'CONTRACT_EXECUTION_EXCEPTION';
  const INVALID_FEE_SUBMITTED = 'INVALID_FEE_SUBMITTED';
  const INVALID_SOLIDITY_ADDRESS = 'INVALID_SOLIDITY_ADDRESS';
  const CONTRACT_REVERT_EXECUTED = 'CONTRACT_REVERT_EXECUTED';
  const prefix = '0x';
  const ETH_PRECOMPILE_0x1 = '0.0.1';
  const ETH_PRECOMPILE_0x361 = '0.0.361';
  const ETH_PRECOMPILE_0x751 = '0.0.751';
  const ADDRESS_0x800 = '0.0.800';
  const ETH_PRECOMPILE_0x1001 = '0.0.1001';
  const NON_EXISTING_CONTRACT_ID = '0.0.564400';
  const NON_EXISTING_FUNCTION = 'nxxixxkxxi';
  const EMPTY_FUNCTION_PARAMS = new ContractFunctionParameters();
  const ADDRESS_0_0_0 = '0.0.0';
  const ADDRESS_0_0_1 = '0.0.1';
  const ADDRESS_0_0_2 = '0.0.2';
  const ADDRESS_0_0_3 = '0.0.3';
  const ADDRESS_0_0_4 = '0.0.4';
  const ADDRESS_0_0_100 = '0.0.100';
  const ADDRESS_0_0_358 = '0.0.358';
  const ADDRESS_0_0_359 = '0.0.359';
  const ADDRESS_0_0_360 = '0.0.360';
  const MAKE_CALL_WITHOUT_AMOUNT = 'makeCallWithoutAmount';
  const MAKE_CALL_WITH_AMOUNT = 'makeCallWithAmount';
  const MAKE_CALL_WITHOUT_AMOUNT_TO_IDENTITY_PRECOMPILE = 'makeCallWithoutAmountToIdentityPrecompile';
  const MAKE_CALL_WITH_AMOUNT_TO_IDENTITY_PRECOMPILE = 'makeCallWithAmountToIdentityPrecompile';
  const MAKE_HTS_CALL_WITHOUT_AMOUNT = 'htsCallWithoutAmount';
  const MAKE_HTS_CALL_WITH_AMOUNT = 'htsCallWithAmount';
  const MAKE_STATICCALL = 'makeStaticCall';
  const MAKE_HTS_STATICCALL = 'htsStaticCall';
  const MAKE_DELEGATECALL = 'makeDelegateCall';
  const accounts: AliasAccount[] = [];
  let tokenAddress;
  let estimatePrecompileContractReceipt;
  let estimatePrecompileContractAddress;
  let estimatePrecompileSolidityAddress;
  let HederaAddress;
  let equivalenceContractReceipt;
  let equivalenceContractId;
  let equivalenceContract;
  let equivalenceContractSolidityAddress;
  let equivalenceDestructContractId;
  let equivalenceDestructContractReceipt;
  let estimateContract;
  let TokenManager;
  let requestId;

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
    const contractMirror = await mirrorClient.get(`/contracts/${estimatePrecompileSolidityAddress}`, requestId);

    accounts[0] = await servicesClient.createAccountWithContractIdKey(
      contractMirror.contract_id,
      200,
      relay.provider,
      requestId,
    );

    tokenAddress = await createFungibleToken();
    console.log(`tokenAddress: ${tokenAddress}`);
  });

  async function getResultByEntityIdAndTxTimestamp(entityId, txTimestamp) {
    return await mirrorNode.get(`/contracts/${entityId}/results/${txTimestamp}`);
  }

  /**
   * Returns a list of ContractActions for a contract's function executions for a given transactionId or ethereum transaction hash.
   * @param transactionIdOrHash Transaction Id or a 32 byte hash with optional 0x prefix
   * @returns list of ContractActions
   */
  async function getContractActions(transactionIdOrHash: string) {
    return await mirrorClient.get(`/contracts/results/${transactionIdOrHash}/actions`);
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

  //----------Internal calls----------------
  // EQUIVALENCE-014 - Same as mirror node - fails with PRECOMPILE_ERROR it should be something else
  it('internal CALL to 0.0.0 without amount - should be successfull', async function () {
    const emptyByteArray = new Uint8Array(0);
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_0);
    const params = new ContractFunctionParameters().addAddress(evmAddress);
    params.addBytes(emptyByteArray);

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];
    /**
     * '{"call_depth":1
          "call_operation_type":"CALL"
          "call_type":"CALL"
          "caller":"0.0.1045"
          "caller_type":"CONTRACT"
          "from":"0x0000000000000000000000000000000000000415"
          "gas":466906
          "gas_used":466906
          "index":1
          "input":"0x"
          "recipient":null
          "recipient_type":null
          "result_data":"0x505245434f4d50494c455f4552524f52"
          "result_data_type":"ERROR"
          "timestamp":"1715842544.840853219"
          "to":"0x0000000000000000000000000000000000000000"
          "value":0}'
     */

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  // EQUIVALENCE-015 - Same as mirror node - fails with PRECOMPILE_ERROR it should be INVALID_FEE_SUBMITTED
  it('internal CALL to 0.0.0 with amount should fail with INVALID_FEE_SUBMITTED, as the intermediary contract should not transfer funds to 0x0.', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_0);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
      equivalenceContractId,
      MAKE_CALL_WITH_AMOUNT,
      new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
      1_000_000,
      100,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('ERROR');
    expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_FEE_SUBMITTED);
  });

  // EQUIVALENCE-016
  it('internal CALL to 0.0.1 without amount - should be successfull (Expected to execute the ecrecover precompile through the intermediary contract.)', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_1);

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('OUTPUT');
    /*   '{"call_depth":1
          "call_operation_type":"CALL"
          "call_type":"PRECOMPILE"
          "caller":"0.0.1122"
          "caller_type":"CONTRACT"
          "from":"0x0000000000000000000000000000000000000462"
          "gas":469355
          "gas_used":3000
          "index":1
          "input":"0x"
          "recipient":"0.0.1"
          "recipient_type":"CONTRACT"
          "result_data":"0x"
          "result_data_type":"OUTPUT"
          "timestamp":"1715845647.860197419"
          "to":"0x0000000000000000000000000000000000000001"
          "value":0}'
   */
  });

  // EQUIVALENCE-017
  it('internal CALL to 0.0.2 without amount should execute the SHA-256 precompile through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_2);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('OUTPUT');
    /*
      '{"call_depth":1
      "call_operation_type":"CALL"
      "call_type":"PRECOMPILE"
      "caller":"0.0.1131"
      "caller_type":"CONTRACT"
      "from":"0x000000000000000000000000000000000000046b"
      "gas":469355
      "gas_used":60
      "index":1
      "input":"0x"
      "recipient":"0.0.2"
      "recipient_type":"CONTRACT"
      "result_data":"0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      "result_data_type":"OUTPUT"
      "timestamp":"1715846596.410665470"
      "to":"0x0000000000000000000000000000000000000002"
      "value":0}'
    */
  });

  // EQUIVALENCE-018
  it('internal CALL to 0.0.3 without amount should execute the RIPEMD-160 precompile through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_3);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('OUTPUT');
    /*
        '{"call_depth":1
        "call_operation_type":"CALL"
        "call_type":"PRECOMPILE"
        "caller":"0.0.1149"
        "caller_type":"CONTRACT"
        "from":"0x000000000000000000000000000000000000047d"
        "gas":469355
        "gas_used":600
        "index":1
        "input":"0x"
        "recipient":"0.0.3"
        "recipient_type":"CONTRACT"
        "result_data":"0x0000000000000000000000009c1185a5c5e9fc54612808977ee8f548b2258d31"
        "result_data_type":"OUTPUT"
        "timestamp":"1715847501.800742931"
        "to":"0x0000000000000000000000000000000000000003"
        "value":0}'
    */
  });

  // EQUIVALENCE-019
  it('internal CALL to 0.0.4 without amount should execute the identity precompile through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_4);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT_TO_IDENTITY_PRECOMPILE,
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('OUTPUT');
    /*
      '{"call_depth":1
      "call_operation_type":"CALL"
      "call_type":"PRECOMPILE"
      "caller":"0.0.1158"
      "caller_type":"CONTRACT"
      "from":"0x0000000000000000000000000000000000000486"
      "gas":469422
      "gas_used":30
      "index":1
      "input":"0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000c48656c6c6f2c20576f726c640000000000000000000000000000000000000000"
      "recipient":"0.0.4"
      "recipient_type":"CONTRACT"
      "result_data":"0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000c48656c6c6f2c20576f726c640000000000000000000000000000000000000000"
      "result_data_type":"OUTPUT"
      "timestamp":"1715847778.640519586"
      "to":"0x0000000000000000000000000000000000000004"
      "value":0}'
    */
  });

  // EQUIVALENCE-020
  // FROM https://www.notion.so/limechain/In-Equivalance-Test-plan-json-rpc-relay-10a7cd268daa44e9b414f3f5410bc08d says 'These should all fail with INVALID_FEE_SUBMITTED when called through an intermediary contract.'
  ['0.0.1', '0.0.2', '0.0.3', '0.0.4', '0.0.5', '0.0.6', '0.0.7', '0.0.8', '0.0.9'].forEach((address) => {
    it(`internal CALL to precompile address ${address} with amount should fail with INVALID_FEE_SUBMITTED when called through an intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(address);
      const message = 'Encode me!';
      const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
        equivalenceContractId,
        MAKE_CALL_WITH_AMOUNT,
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(toUtf8Bytes(message)),
        2_000_000,
        100,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(record.contract_id).to.equal(equivalenceContractId);
      expect(record.result).to.equal(SUCCESS);
      expect(record.status).to.equal(STATUS_SUCCESS);
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.result_data_type).to.equal('ERROR');
      expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_FEE_SUBMITTED);
    });
  });

  // EQUIVALENCE-021 - Same as mirror node - fails with PRECOMPILE_ERROR it should be INVALID_SOLIDITY_ADDRESS
  // BUG: [Executing an internal call without amount against system accounts results in PRECOMPILE_ERROR] https://github.com/hashgraph/hedera-services/issues/11158
  ['0.0.10', '0.0.100', '0.0.357'].forEach((address) => {
    it(`internal CALL to ${address} without amount should fail with INVALID_SOLIDITY_ADDRESS when called through an intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(address);
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        MAKE_CALL_WITHOUT_AMOUNT,
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(record.contract_id).to.equal(equivalenceContractId);
      expect(record.result).to.equal(SUCCESS);
      expect(record.status).to.equal(STATUS_SUCCESS);
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.call_operation_type).to.equal('CALL');
      expect(childRecord.call_type).to.equal('CALL');
      expect(childRecord.result_data_type).to.equal('ERROR');
      expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_SOLIDITY_ADDRESS);
      /*
          '{"call_depth":1
          "call_operation_type":"CALL"
          "call_type":"CALL"
          "caller":"0.0.1224"
          "caller_type":"CONTRACT"
          "from":"0x00000000000000000000000000000000000004c8"
          "gas":466894
          "gas_used":466894
          "index":1
          "input":"0x"
          "recipient":"0.0.100"
          "recipient_type":"ACCOUNT"
          "result_data":"0x505245434f4d50494c455f4552524f52"
          "result_data_type":"ERROR"
          "timestamp":"1715855739.520497716"
          "to":"0x0000000000000000000000000000000000000064"
          "value":0}'
        */
    });
  });

  // EQUIVALENCE-022 - Same as mirror node - fails with PRECOMPILE_ERROR it should be INVALID_FEE_SUBMITTED
  // BUG: [Executing an internal call without amount against system accounts results in PRECOMPILE_ERROR] https://github.com/hashgraph/hedera-services/issues/11158
  ['0.0.10', '0.0.100', '0.0.357'].forEach((address) => {
    it(`internal CALL to adress '${address}' with amount should fail with 'INVALID_FEE_SUBMITTED' when attempted through an intermediary contract.`, async function () {
      const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_100);
      const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
        equivalenceContractId,
        MAKE_CALL_WITH_AMOUNT,
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
        1_000_000,
        100,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(record.contract_id).to.equal(equivalenceContractId);
      expect(record.result).to.equal(SUCCESS);
      expect(record.status).to.equal(STATUS_SUCCESS);
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.call_operation_type).to.equal('CALL');
      expect(childRecord.call_type).to.equal('CALL');
      expect(childRecord.result_data_type).to.equal('ERROR');
      expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_FEE_SUBMITTED);
      /*
        '{
          "call_depth": 1,
          "call_operation_type": "CALL",
          "call_type": "CALL",
          "caller": "0.0.1038",
          "caller_type": "CONTRACT",
          "from": "0x000000000000000000000000000000000000040e",
          "gas": 927957,
          "gas_used": 927957,
          "index": 1,
          "input": "0x",
          "recipient": "0.0.100",
          "recipient_type": "ACCOUNT",
          "result_data": "0x505245434f4d50494c455f4552524f52",
          "result_data_type": "ERROR",
          "timestamp": "1715935668.132923212",
          "to": "0x0000000000000000000000000000000000000064",
          "value": 100
        }'
        */
    });
  });

  // EQUIVALENCE-023 - Same as mirror node - PRECOMPILE ERROR
  it('internal CALL to 0.0.358 without amount should execute the HTS precompiles through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_358);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
    /*
      '{"call_depth":1
      "call_operation_type":"CALL"
      "call_type":"CALL"
      "caller":"0.0.1256"
      "caller_type":"CONTRACT"
      "from":"0x00000000000000000000000000000000000004e8"
      "gas":466883
      "gas_used":466883
      "index":1
      "input":"0x"
      "recipient":null
      "recipient_type":null
      "result_data":"0x505245434f4d50494c455f4552524f52"
      "result_data_type":"ERROR"
      "timestamp":"1715860160.719665055"
      "to":"0x0000000000000000000000000000000000000166"
      "value":0}'
 */
  });

  // EQUIVALENCE-024 - Same as mirror node - PRECOMPILE ERROR
  it('internal CALL to address 0.0.358 with amount for other functions than TokenCreate i.e. Approve/Associate should result in INVALID_FEE_SUBMITTED through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_358);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
      equivalenceContractId,
      MAKE_CALL_WITH_AMOUNT,
      new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
      1_000_000,
      100,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('ERROR');
    expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_FEE_SUBMITTED);
    /*
      '{"call_depth":1
      "call_operation_type":"CALL"
      "call_type":"CALL"
      "caller":"0.0.1265"
      "caller_type":"CONTRACT"
      "from":"0x00000000000000000000000000000000000004f1"
      "gas":959113
      "gas_used":959113
      "index":1
      "input":"0x"
      "recipient":null
      "recipient_type":null
      "result_data":"0x505245434f4d50494c455f4552524f52"
      "result_data_type":"ERROR"
      "timestamp":"1715860279.970723513"
      "to":"0x0000000000000000000000000000000000000166"
      "value":0}'
    */
  });

  // EQUIVALENCE-025 - Same as mirror node
  it.only('internal CALL to 0.0.360 without amount should execute the ExchangeRate precompile through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_360);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_HTS_CALL_WITHOUT_AMOUNT,
      new ContractFunctionParameters().addAddress(tokenAddress),
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('CALL');
    expect(childRecord.call_type).to.equal('SYSTEM');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('OUTPUT');
    /*
    '{
      "call_depth": 1,
      "call_operation_type": "CALL",
      "call_type": "SYSTEM",
      "caller": "0.0.1297",
      "caller_type": "CONTRACT",
      "from": "0x0000000000000000000000000000000000000511",
      "gas": 49094,
      "gas_used": 100,
      "index": 1,
      "input": "0x19f373610000000000000000000000000000000000000000000000000000000000000513",
      "recipient": "0.0.359",
      "recipient_type": "CONTRACT",
      "result_data": "0x00000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000001",
      "result_data_type": "OUTPUT",
      "timestamp": "1715867826.679620882",
      "to": "0x0000000000000000000000000000000000000167",
      "value": 0
    }'
    */
  });

  // EQUIVALENCE-026 - Same as mirror node
  it.only('internal CALL to addresses 0.0.361 without amount(PRNG precompile) should execute it through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ETH_PRECOMPILE_0x361);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      'getPseudorandomSeed',
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('CALL');
    expect(childRecord.call_type).to.equal('SYSTEM');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
    /*
     * '{
        "call_depth": 1,
        "call_operation_type": "CALL",
        "call_type": "SYSTEM",
        "caller": "0.0.1306",
        "caller_type": "CONTRACT",
        "from": "0x000000000000000000000000000000000000051a",
        "gas": 49808,
        "gas_used": 0,
        "index": 1,
        "input": "0xd83bf9a1",
        "recipient": "0.0.361",
        "recipient_type": "CONTRACT",
        "result_data": "0x62f0bc0bb45c2750c1afebdefb68e6d0a8ea70351a43ce98820d30571fdd4ad5",
        "result_data_type": "OUTPUT",
        "timestamp": "1715869135.530404307",
        "to": "0x0000000000000000000000000000000000000169",
        "value": 0
      }'
     */
  });

  // EQUIVALENCE-027 - Same as mirror node - succeeds but should result in INVALID_FEE_SUBMITTED
  it('internal CALL to addresses 0.0.359 with amount(ExchangeRate precompile) should result in INVALID_FEE_SUBMITTED through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_359);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
      equivalenceContractId,
      MAKE_HTS_CALL_WITH_AMOUNT,
      new ContractFunctionParameters().addAddress(tokenAddress),
      1_000_000,
      100,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('CALL');
    expect(childRecord.call_type).to.equal('SYSTEM');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('ERROR');
    expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_FEE_SUBMITTED);
    /*
    '{
      "call_depth": 1,
      "call_operation_type": "CALL",
      "call_type": "SYSTEM",
      "caller": "0.0.1065",
      "caller_type": "CONTRACT",
      "from": "0x0000000000000000000000000000000000000429",
      "gas": 959554,
      "gas_used": 100,
      "index": 1,
      "input": "0x19f37361000000000000000000000000000000000000000000000000000000000000042b",
      "recipient": "0.0.359",
      "recipient_type": "CONTRACT",
      "result_data": "0x00000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000001",
      "result_data_type": "OUTPUT",
      "timestamp": "1716205365.582565806",
      "to": "0x0000000000000000000000000000000000000167",
      "value": 0
    }'
    */
  });

  // EQUIVALENCE-028 - Same as mirror node - succeeds but should result in INVALID_FEE_SUBMITTED
  it('internal CALL to addresses 0.0.361 with amount (PRNG precompile) should result in INVALID_FEE_SUBMITTED through the intermediary contract.', async function () {
    const evmAddress = Utils.idToEvmAddress(ETH_PRECOMPILE_0x361);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCallWithAmount(
      equivalenceContractId,
      'getPseudorandomSeedWithAmount',
      EMPTY_FUNCTION_PARAMS,
      1_000_000,
      100,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal('ERROR');
    expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_FEE_SUBMITTED);
    /*
    '{
      "call_depth": 1,
      "call_operation_type": "CALL",
      "call_type": "SYSTEM",
      "caller": "0.0.1315",
      "caller_type": "CONTRACT",
      "from": "0x0000000000000000000000000000000000000523",
      "gas": 960397,
      "gas_used": 0,
      "index": 1,
      "input": "0xd83bf9a1",
      "recipient": "0.0.361",
      "recipient_type": "CONTRACT",
      "result_data": "0x29cd8faf6c267af3e6a2aa76d0609dafdcc5fe766141df230ab892398a4db347",
      "result_data_type": "OUTPUT",
      "timestamp": "1715869282.420056139",
      "to": "0x0000000000000000000000000000000000000169",
      "value": 0
    }'
    */
  });

  // EQUIVALENCE-029 range 0.0.361..0.0.750 !!PRNG is 361!!
  [
    // '0.0.362',
    // '0.0.450',
    // '0.0.599',
    // '0.0.700',
    // '0.0.751',
    // '0.0.785',
    // '0.0.1000',
  ].forEach((address) => {
    it(`internal CALL to address ${address} without amount should fail with INVALID_SOLIDITY_ADDRESS when called through an intermediary contract`, async function () {
      const evmAddress = Utils.idToEvmAddress(address);
      const { contractExecuteTimestamp, contractExecutedTransactionId } = await servicesClient.executeContractCall(
        equivalenceContractId,
        MAKE_CALL_WITHOUT_AMOUNT,
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      const actions = await getContractActions(record.hash);
      const childRecordError = decodeResultData(actions[1].result_data);

      expect(record.contract_id).to.equal(equivalenceContractId);
      expect(record.result).to.equal(SUCCESS);
      expect(record.status).to.equal(STATUS_SUCCESS);
      expect(childRecordError).to.equal(INVALID_SOLIDITY_ADDRESS);
    });
  });

  // EQUIVALENCE-030 range 0.0.361..0.0.750 !!PRNG is 361!!
  [
    // '0.0.362',
    // '0.0.450',
    // '0.0.599',
    // '0.0.750',
  ].forEach((address) => {
    it(`internal CALL to address ${address} with amount should fail with INVALID_FEE_SUBMITTED when called through an intermediary contract.`, async function () {});
  });

  /* EQUIVALENCE-031 range 0.0.751..0.0.1000
   * This should be verified what is the behaviour
   * Per other notes sheet:
   * This should work for address 0.0.800
   * And if account exists and has receiverSigRequired = false
   * And if (account exists) and (account has receiverSigRequired = true) and (account is sender)
   */

  [
    // '0.0.751',
    // '0.0.800',
    // '0.0.1000',
  ].forEach((address) => {
    it(`internal CALL to address ${address} with amount`, async function () {});
  });

  // EQUIVALENCE-032
  // EQUIVALENCE-033
  // EQUIVALENCE-034
  // EQUIVALENCE-035
  // EQUIVALENCE-036
  // EQUIVALENCE-037
  // EQUIVALENCE-038
  // EQUIVALENCE-039

  // EQUIVALENCE-040 - PRECOMPILE ERROR - Same as mirror node but it fails with PRECOMPILE_ERROR it should be INVALID_FEE_SUBMITTED
  it('internal STATICCALL to address(0.0.0) without amount should succeed with noop through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_0);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_STATICCALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('STATICCALL');
    expect(childRecord.call_type).to.equal('CALL');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-041;
  it('internal STATICCALL to address 0.0.1 with known hash and signature should execute the ecrecover precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_1);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_STATICCALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('STATICCALL');
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-042;
  it('internal STATICCALL to address 0.0.2 should execute the SHA-256 precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_2);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_STATICCALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('STATICCALL');
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-043;
  it('internal STATICCALL to address 0.0.3 should execute the RIPEMD-160 precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_3);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_STATICCALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('STATICCALL');
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-044;
  it('internal STATICCALL to address 0.0.4 should execute the identity precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_4);
    const message = 'Encode me!';
    const messageBytes = toUtf8Bytes(message);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(messageBytes);

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_STATICCALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('STATICCALL');
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
    expect(message).to.equal(
      decodeResultData(childRecord.result_data),
      `Decoded 'result_data' from child record is not '${message}'`,
    );
  });

  // EQUIVALENCE-045 - Same as mirror node - fails with PRECOMPILE_ERROR it should be INVALID_SOLIDITY_ADDRESS
  // BUG: [Executing an internal call without amount against system accounts results in PRECOMPILE_ERROR] https://github.com/hashgraph/hedera-services/issues/11158
  ['0.0.10', '0.0.100', '0.0.357'].forEach((address) => {
    it(`STATICCALL to address ${address} without amount should fail with INVALID_SOLIDITY_ADDRESS when called through an intermediary contract`, async function () {
      const evmAddress = Utils.idToEvmAddress(address);
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        MAKE_STATICCALL,
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(record.contract_id).to.equal(equivalenceContractId);
      expect(record.result).to.equal(SUCCESS);
      expect(record.status).to.equal(STATUS_SUCCESS);
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.call_operation_type).to.equal('STATICCALL');
      expect(childRecord.call_type).to.equal('CALL');
      expect(childRecord.result_data_type).to.equal('ERROR');
      expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_SOLIDITY_ADDRESS);
      /*
        '{
          "call_depth": 1,
          "call_operation_type": "STATICCALL",
          "call_type": "CALL",
          "caller": "0.0.1038",
          "caller_type": "CONTRACT",
          "from": "0x000000000000000000000000000000000000040e",
          "gas": 466983,
          "gas_used": 466983,
          "index": 1,
          "input": "0x",
          "recipient": "0.0.10",
          "recipient_type": "ACCOUNT",
          "result_data": "0x505245434f4d50494c455f4552524f52",
          "result_data_type": "ERROR",
          "timestamp": "1715935738.322606675",
          "to": "0x000000000000000000000000000000000000000a",
          "value": 0
        }'
        */
    });
  });

  // EQUIVALENCE-046;
  // BUG: [Direct call w/o value to system accounts [0.0.361-0.0.750] result in precompile error] https://github.com/hashgraph/hedera-services/issues/11033
  it('internal STATICCALL to address 0.0.358 without amount should execute the HTS precompiles through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_358);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_STATICCALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-047;
  it('internal STATICCALL to addresses 0.0.359 (ExchangeRate precompile) without amount should execute the ExchangeRate precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_359);
    const params = new ContractFunctionParameters().addAddress(tokenAddress);

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_HTS_STATICCALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('STATICCALL');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
    /*
    '{
      "call_depth": 1,
      "call_operation_type": "STATICCALL",
      "call_type": "SYSTEM",
      "caller": "0.0.1049",
      "caller_type": "CONTRACT",
      "from": "0x0000000000000000000000000000000000000419",
      "gas": 467412,
      "gas_used": 100,
      "index": 1,
      "input": "0x19f37361000000000000000000000000000000000000000000000000000000000000041b",
      "recipient": "0.0.359",
      "recipient_type": "CONTRACT",
      "result_data": "0x00000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000001",
      "result_data_type": "OUTPUT",
      "timestamp": "1716203726.922385630",
      "to": "0x0000000000000000000000000000000000000167",
      "value": 0
    }'
    */
  });

  // EQUIVALENCE-048;
  it('internal STATICCALL to addresses 0.0.361 (PRNG precompile) without amount should execute the PRNG precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ETH_PRECOMPILE_0x361);
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      'getPseudorandomSeedStaticCall',
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);

    expect(childRecord.call_operation_type).to.equal('STATICCALL');
    expect(childRecord.call_type).to.equal('SYSTEM');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-049 range 0.0.361..0.0.750 !!PRNG is 361!!
  [
    // '0.0.362',
    // '0.0.450',
    // '0.0.599',
    // '0.0.700',
    // '0.0.751',
    // '0.0.785',
    // '0.0.1000',
  ].forEach((address) => {
    it(`internal STATICCALL to address ${address} without amount should fail with INVALID_SOLIDITY_ADDRESS when called through an intermediary contract`, async function () {
      const params = new ContractFunctionParameters()
        .addAddress(Utils.idToEvmAddress(address))
        .addBytes(new Uint8Array(0));

      const { contractExecuteTimestamp, contractExecutedTransactionId } = await servicesClient.executeContractCall(
        equivalenceContractId,
        MAKE_STATICCALL,
        params,
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      const actions = await getContractActions(record.hash);
      const childRecordError = decodeResultData(actions[1].result_data);

      expect(record.contract_id).to.equal(equivalenceContractId);
      expect(record.result).to.equal(SUCCESS);
      expect(record.status).to.equal(STATUS_SUCCESS);
      expect(childRecordError).to.equal(INVALID_SOLIDITY_ADDRESS);
    });
  });

  // EQUIVALENCE-050;
  // STATICCALL to address(over 0.0.1000) wi/o amount (case contract). Create a contract within the test. Grab the contractID and execute InternalCall
  // Expected to succeed if the contract exists and is called through an intermediary contract.
  // it('internal STATICCALL to address(over 0.0.1000) wi/o amount (case contract)', async function () {
  //   const accounts = await mirrorClient.get('/accounts?account.id=gt:0.0.1000');
  //   console.log(JSON.stringify(accounts))
  // });

  // EQUIVALENCE-051;
  // STATICCALL to address(over 0.0.1000) wi/o amount (case invalid contractID): In here we should either hit an invalid contractID(this is challenging due to the different environments)
  // Or we should create an account and use accountID instead (needs to be verified)
  // Should fail with INVALID_SOLIDITY_ADDRESS through the intermediary contract.
  // it('internal STATICCALL to address(over 0.0.1000) wi/o amount (case invalid contractID)', async function () {
  // });

  // EQUIVALENCE-052 - PRECOMPILE ERROR - Same as mirror node but it fails with PRECOMPILE_ERROR it should be INVALID_FEE_SUBMITTED
  it('internal DELEGATECALL to address(0.0.0) without amount should succeed with noop through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_0);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_DELEGATECALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.call_type).to.equal('CALL');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-053
  it('internal DELEGATECALL to address 0.0.1 with known hash and signature should execute the ecrecover precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_1);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_DELEGATECALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-054
  it('internal DELEGATECALL to address 0.0.2 should execute the SHA-256 precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_2);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_DELEGATECALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-055
  it('internal DELEGATECALL to address 0.0.3 should execute the RIPEMD-160 precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_3);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_DELEGATECALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-056
  it('internal DELEGATECALL to address 0.0.4 should execute the identity precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_4);
    const message = 'Encode me!';
    const messageBytes = toUtf8Bytes(message);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(messageBytes);

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_DELEGATECALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.call_type).to.equal('PRECOMPILE');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
    expect(message).to.equal(
      decodeResultData(childRecord.result_data),
      `Decoded 'result_data' from child record is not '${message}'`,
    );
  });

  // EQUIVALENCE-057 - Same as mirror node - fails with PRECOMPILE_ERROR it should be INVALID_SOLIDITY_ADDRESS
  // BUG: [Executing an internal call without amount against system accounts results in PRECOMPILE_ERROR] https://github.com/hashgraph/hedera-services/issues/11158
  ['0.0.10', '0.0.100', '0.0.357'].forEach((address) => {
    it(`internal DELEGATECALL to address ${address} without amount should fail with INVALID_SOLIDITY_ADDRESS when called through an intermediary contract`, async function () {
      const evmAddress = Utils.idToEvmAddress(address);
      const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
        equivalenceContractId,
        MAKE_DELEGATECALL,
        new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0)),
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];

      expect(record.contract_id).to.equal(equivalenceContractId);
      expect(record.result).to.equal(SUCCESS);
      expect(record.status).to.equal(STATUS_SUCCESS);
      expect(childRecord.to).to.equal(evmAddress);
      expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
      expect(childRecord.call_type).to.equal('CALL');
      expect(childRecord.result_data_type).to.equal('ERROR');
      expect(decodeResultData(childRecord.result_data)).to.equal(INVALID_SOLIDITY_ADDRESS);
      /*
        '{
          "call_depth": 1,
          "call_operation_type": "DELEGATECALL",
          "call_type": "CALL",
          "caller": "0.0.1038",
          "caller_type": "CONTRACT",
          "from": "0x000000000000000000000000000000000000040e",
          "gas": 466962,
          "gas_used": 466962,
          "index": 1,
          "input": "0x",
          "recipient": "0.0.10",
          "recipient_type": "ACCOUNT",
          "result_data": "0x505245434f4d50494c455f4552524f52",
          "result_data_type": "ERROR",
          "timestamp": "1715935792.722483506",
          "to": "0x000000000000000000000000000000000000000a",
          "value": 0
        }'
        */
    });
  });

  // EQUIVALENCE-058
  // BUG: [Direct call w/o value to system accounts [0.0.361-0.0.750] result in precompile error] https://github.com/hashgraph/hedera-services/issues/11033
  it('internal DELEGATECALL to address 0.0.358 without amount should execute the HTS precompiles through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_358);
    const params = new ContractFunctionParameters().addAddress(evmAddress).addBytes(new Uint8Array(0));

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      MAKE_DELEGATECALL,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-059
  // Investigate
  it.only('internal DELEGATECALL to addresses 0.0.359 (ExchangeRate precompile) without amount should execute the ExchangeRate precompile through the intermediary contract', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_359);
    const params = new ContractFunctionParameters().addAddress(tokenAddress);

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      'htsDelegateCall',
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
    /*
  '{
      "call_depth": 1,
      "call_operation_type": "DELEGATECALL",
      "call_type": "SYSTEM",
      "caller": "0.0.1049",
      "caller_type": "CONTRACT",
      "from": "0x0000000000000000000000000000000000000419",
      "gas": 467413,
      "gas_used": 467413,
      "index": 1,
      "input": "0x19f37361000000000000000000000000000000000000000000000000000000000000041b",
      "recipient": "0.0.359",
      "recipient_type": "CONTRACT",
      "result_data": "0x505245434f4d50494c455f4552524f52",
      "result_data_type": "ERROR",
      "timestamp": "1716203893.732399055",
      "to": "0x0000000000000000000000000000000000000167",
      "value": 0
    }'
  */
  });

  it.only('DELEGATECALL to addresses 0.0.359 (ExchangeRate precompile)...', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_360); // address 360 is 0000000000000000000000000000000000000168, mirror node calls that address
    const evmAddress1 = Utils.idToEvmAddress(ADDRESS_0_0_359); // 359 is 0000000000000000000000000000000000000167

    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      'makeDelegateCall',
      new ContractFunctionParameters()
        .addAddress(evmAddress)
        .addFunction(tokenAddress, new ContractFunctionSelector('isToken(address)')),
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.to).to.equal(evmAddress);
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-060
  it('internal DELEGATECALL to addresses 0.0.361 (PRNG precompile) without amount should execute the PRNG precompile through the intermediary contract', async function () {
    const { contractExecuteTimestamp } = await servicesClient.executeContractCall(
      equivalenceContractId,
      'getPseudorandomSeedDelegateCall',
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
    const contractActions = await getContractActions(record.hash);
    const childRecord = contractActions.actions[1];

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);

    expect(childRecord.call_operation_type).to.equal('DELEGATECALL');
    expect(childRecord.call_type).to.equal('SYSTEM');
    expect(childRecord.to).to.equal(Utils.idToEvmAddress(ETH_PRECOMPILE_0x361));
    expect(childRecord.result_data_type).to.equal(
      'OUTPUT',
      `Error in child record: "${decodeResultData(childRecord.result_data)}"`,
    );
  });

  // EQUIVALENCE-061 range 0.0.361..0.0.750 !!PRNG is 361!!
  // BUG: 3 different outcomes for address range
  [
    // '0.0.362',
    // '0.0.450',
    // '0.0.751',
    // '0.0.741',
    // '0.0.800',
    // '0.0.1000',
  ].forEach((address) => {
    it(`internal DELEGATECALL to address ${address} without amount should fail with INVALID_SOLIDITY_ADDRESS when called through an intermediary contract`, async function () {
      const params = new ContractFunctionParameters()
        .addAddress(Utils.idToEvmAddress(address))
        .addBytes(new Uint8Array(0));

      const { contractExecuteTimestamp, contractExecutedTransactionId } = await servicesClient.executeContractCall(
        equivalenceContractId,
        MAKE_DELEGATECALL,
        params,
        500_000,
      );

      const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);
      const contractActions = await getContractActions(record.hash);
      const childRecord = contractActions.actions[1];
      const childRecordError = hexToASCII(childRecord.result_data);

      expect(record.contract_id).to.equal(equivalenceContractId);
      expect(record.result).to.equal(SUCCESS);
      expect(record.status).to.equal(STATUS_SUCCESS);
      expect(childRecordError).to.equal(INVALID_SOLIDITY_ADDRESS);
    });
  });
});
