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
import { AliasAccount } from '../clients/servicesClient';
import { ContractFunctionParameters } from '@hashgraph/sdk';
import RelayAssertions from '../../../relay/tests/assertions';
import EstimatePrecompileContractJson from '../contracts/EstimatePrecompileContract.json';
import Constants from '../helpers/constants';
import EquivalenceContractJson from '../contracts/EquivalenceContract.json';
import { ethers } from 'ethers';
import { Precheck } from '../../../relay/src/lib/precheck';
import pino from 'pino';
import { MirrorNodeClient } from '../../../relay/src/lib/clients';
import { CacheService } from '../../../relay/src/lib/services/cacheService/cacheService';
import EquivalenceDestructContractJson from '../contracts/EquivalenceDestruct.json';
const logger = pino();

describe.only('Equivalence tests', function () {
  const signers: AliasAccount[] = [];
  const { servicesNode, mirrorNode, relay }: any = global;

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
  const MAKE_CALL_WITHOUT_AMOUNT = 'makeCallWithoutAmount';
  const MAKE_CALL_WITHOUT_AMOUNT_TO_IDENTITY_PRECOMPILE = 'makeCallWithoutAmountToIdentityPrecompile';
  let estimatePrecompileContractReceipt;
  let estimatePrecompileContractAddress;
  let HederaAddress;
  let equivalenceContractReceipt;
  let equivalenceContractId;
  let equivalenceContract;
  let equivalenceContractSolidityAddress;
  let equivalenceDestructContractId;
  let equivalenceDestructContractReceipt;

  before(async function () {
    signers[0] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());

    //Deploying Estimate Precompile contract
    estimatePrecompileContractReceipt = await servicesNode.deployContract(
      EstimatePrecompileContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    estimatePrecompileContractAddress = estimatePrecompileContractReceipt.contractId.toString();
    console.log(estimatePrecompileContractAddress);

    //Deploying Equivalence Destrcut contract
    equivalenceDestructContractReceipt = await servicesNode.deployContract(
      EquivalenceDestructContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    equivalenceDestructContractId = equivalenceDestructContractReceipt.contractId.toString();
    console.log(equivalenceDestructContractId);

    //Deploying Equivalence contract
    equivalenceContractReceipt = await servicesNode.deployContract(
      EquivalenceContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    equivalenceContractId = equivalenceContractReceipt.contractId.toString();
    console.log(equivalenceContractId);
    equivalenceContractSolidityAddress = equivalenceContractReceipt.contractId.toSolidityAddress();

    equivalenceContract = new ethers.Contract(
      prefix + equivalenceContractSolidityAddress,
      EquivalenceContractJson.abi,
      signers[0].wallet,
    );
    console.log(equivalenceContract);
  });

  async function getResultByEntityIdAndTxTimestamp(entityId, txTimestamp) {
    return await mirrorNode.get(`/contracts/${entityId}/results/${txTimestamp}`);
  }

  it('should execute direct call to ethereum precompile 0x1', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
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

  //EQV-003 - Should fail with INVALID_SOLIDIY_ADDRESS
  // async function testRejection(errorMessage, method, checkMessage, thisObj, args?)
  it('should execute direct call to address 361 to 750 without amount', async function () {
    const args = [ETH_PRECOMPILE_0x361, NON_EXISTING_FUNCTION, EMPTY_FUNCTION_PARAMS, 500_000];
    await testRejection(CONTRACT_EXECUTION_EXCEPTION, servicesNode.executeContractCall, true, servicesNode, args);
  });

  //EQV-004 - Should fail with INVALID_FEE_SUBMITTED
  it('should execute direct call to ethereum precompile 361 to 750 with amount', async function () {
    const args = [ETH_PRECOMPILE_0x361, NON_EXISTING_FUNCTION, EMPTY_FUNCTION_PARAMS, 500_000, 100];
    await testRejection(INVALID_FEE_SUBMITTED, servicesNode.executeContractCallWithAmount, true, servicesNode, args);
  });

  //EQV-005 - OK - ??? Should it be like that? - Should it be successfull
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

  //EQV-005 - OK - ??? Should it be like that? - Should it be successfull
  it('should execute direct call to address 751 with amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCallWithAmount(
      ADDRESS_0x800,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      500_000,
      100, //add the amount
    );

    const record = await getResultByEntityIdAndTxTimestamp(ADDRESS_0x800, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ADDRESS_0x800);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  //EQV-006 - should be successfull - OK
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

  //EQV-006 - should be successfull - OK
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

  //EQV-007 - Should fail with INVALID_SOLIDIY_ADDRESS but it is SUCCESSFULL and creates Inactive EVM Address  - ????????
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

  //EQV-008 - should be successfull - OK
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

  //EQV-009 - OK -  should be unsuccessfull
  it('should execute direct call to address over 1000 with amount - case non-payable contract ', async function () {
    const args = [estimatePrecompileContractAddress, NON_EXISTING_FUNCTION, EMPTY_FUNCTION_PARAMS, 500_000, 100];
    await testRejection(CONTRACT_REVERT_EXECUTED, servicesNode.executeContractCallWithAmount, true, servicesNode, args);
  });

  it('should execute direct call to address over 1000 with amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCallWithAmount(
      'ETH_PRECOMPILE_0x1001',
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      100, //add the amount
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1001, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1001);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION);
  });

  //EQV-13 This should be successful due to hollow account creation
  it('should execute direct call to address over 1000 with amount - case hollow acconut', async function () {
    const hollowAccount = ethers.Wallet.createRandom();
    const hollowAcAddress = hollowAccount.address.toString();

    const { contractExecuteTimestamp } = await servicesNode.executeContractCallWithAmount(
      hollowAcAddress,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      1_000_000,
      100, //add the amount
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1001, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1001);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION);
  });

  //----------Internal calls----------------
  //EQUIVALENCE-040 - The same as mirror node but it fails with PRECOMPILE_ERROR it should be something else
  it('internal CALL to 0.0.0 without amount - should be successfull', async function () {
    const emptyByteArray = new Uint8Array(0);
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_0);
    const params = new ContractFunctionParameters().addAddress(evmAddress);
    params.addBytes(emptyByteArray);
    console.log('PARAMS ARE ');
    console.log(params);

    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  //EQUIVALENCE-041 - ОК
  it('internal CALL to 0.0.1 without amount - should be successfull', async function () {
    const emptyByteArray = new Uint8Array(0);
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_1);
    const params = new ContractFunctionParameters().addAddress(evmAddress);
    params.addBytes(emptyByteArray);
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  //EQUIVALENCE-042 -
  it.only('internal CALL to 0.0.2 without amount - should be successfull', async function () {
    const emptyByteArray = new Uint8Array(0);
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_2);
    const params = new ContractFunctionParameters().addAddress(evmAddress);
    params.addBytes(emptyByteArray);
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  //EQUIVALENCE-043 - PRECOMPILE ERROR
  it('internal CALL to 0.0.2 without amount - should be successfull', async function () {
    const emptyByteArray = new Uint8Array(0);
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_2);
    const params = new ContractFunctionParameters().addAddress(evmAddress);
    params.addBytes(emptyByteArray);
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  //EQUIVALENCE-044 - ОК
  it('internal CALL to 0.0.4 without amount - should be successfull', async function () {
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_4);
    const params = new ContractFunctionParameters().addAddress(evmAddress);
    console.log('PARAMS ARE ');
    console.log(params);

    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT_TO_IDENTITY_PRECOMPILE,
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  //EQUIVALENCE-045 - The same as mirror node but it fails with PRECOMPILE_ERROR it should be INVALID_SOLIDITY_ADDRESS
  it('internal CALL to 0.0.100 without amount - should be successfull', async function () {
    const emptyByteArray = new Uint8Array(0);
    const evmAddress = Utils.idToEvmAddress(ADDRESS_0_0_100);
    const params = new ContractFunctionParameters().addAddress(evmAddress);
    params.addBytes(emptyByteArray);

    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      equivalenceContractId,
      MAKE_CALL_WITHOUT_AMOUNT,
      params,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(equivalenceContractId, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(equivalenceContractId);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  async function testRejection(errorMessage, method, checkMessage, thisObj, args?) {
    await expect(method.apply(thisObj, args), `${errorMessage}`).to.eventually.be.rejected.and.satisfy((err) => {
      return err.message.includes(errorMessage);
    });
  }
});
