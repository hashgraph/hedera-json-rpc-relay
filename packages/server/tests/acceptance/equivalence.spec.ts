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

describe.only('Equivalence tests', function () {
  const signers: AliasAccount[] = [];
  const { servicesNode, mirrorNode, relay }: any = global;

  const SUCCESS = 'SUCCESS';
  const STATUS_SUCCESS = '0x1';
  const CONTRACT_EXECUTION_EXCEPTION = 'CONTRACT_EXECUTION_EXCEPTION';
  const INVALID_FEE_SUBMITTED = 'INVALID_FEE_SUBMITTED';

  const ETH_PRECOMPILE_0x1 = '0.0.1';
  const ETH_PRECOMPILE_0x361 = '0.0.361';
  const ETH_PRECOMPILE_0x751 = '0.0.751';
  const ETH_PRECOMPILE_0x1001 = '0.0.1001';
  const NON_EXISTING_CONTRACT_ID = '0.0.564400';
  const NON_EXISTING_FUNCTION = 'nxxixxkxxi';
  const EMPTY_FUNCTION_PARAMS = new ContractFunctionParameters();

  before(async function () {
    signers[0] = await servicesNode.createAliasAccount(15, relay.provider, Utils.generateRequestId());
  });

  async function getResultByEntityIdAndTxTimestamp(entityId, txTimestamp) {
    return await mirrorNode.get(`/contracts/${entityId}/results/${txTimestamp}`);
  }

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

  it('should execute direct call to ethereum precompile 361 without amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      ETH_PRECOMPILE_0x361,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      500_000,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x361, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x361);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION); //Check if it should be CONTRACT_EXECUTION_EXCEPTION
  });

  it.only('should execute direct call to ethereum precompile 361 with amount', async function () {
    const args = [ETH_PRECOMPILE_0x361, NON_EXISTING_FUNCTION, EMPTY_FUNCTION_PARAMS, 500_000, 100];

    const responseCode = await extractResponseCode(
      INVALID_FEE_SUBMITTED,
      servicesNode.executeContractCallWithAmount,
      true,
      servicesNode,
      args,
    );

    console.log(responseCode);

    //const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x361, contractExecuteTimestamp);

    //expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x361);
    //  expect(record.result).to.equal(SUCCESS);
    //expect(record.status).to.equal(INVALID_FEE_SUBMITTED);
  });

  it('should execute direct call to ethereum precompile 751 without amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      ETH_PRECOMPILE_0x751,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x751, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x751);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION); //Check if it should be CONTRACT_EXECUTION_EXCEPTION
  });

  it('should execute direct call to ethereum precompile 751 with amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      ETH_PRECOMPILE_0x751,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      100, //add the amount
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x751, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x751);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION);
  });

  it('should execute direct call to ethereum precompile over 1000 without amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      ETH_PRECOMPILE_0x1001,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1001, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1001);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION);
  });

  it('should execute direct call to ethereum precompile over 1000 with amount', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      ETH_PRECOMPILE_0x1001,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
      100, //add the amount
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1001, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1001);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(CONTRACT_EXECUTION_EXCEPTION);
  });

  async function extractResponseCode(error, method, checkMessage, thisObj, args?) {
    await expect(method.apply(thisObj, args), `${error.message}`).to.eventually.be.rejected.and.satisfy((err) => {
      if (!checkMessage) {
        return err.code === error.code && err.name === error.name;
      }
      return err.code === error.code && err.name === error.name && err.message === error.message;
    });
  }
});
