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

describe.only('EstimateGasContract tests', function () {
  const signers: AliasAccount[] = [];
  const { servicesNode, mirrorNode, relay }: any = global;

  const SUCCESS = 'SUCCESS';
  const STATUS_SUCCESS = '0x1';

  const ETH_PRECOMPILE_0x1 = '0.0.1';
  const NON_EXISTING_CONTRACT_ID = '0.0.564400';
  const NON_EXISTING_FUNCTION = 'nxxixxkxxi';
  const EMPTY_FUNCTION_PARAMS = new ContractFunctionParameters();

  before(async function () {
    signers[0] = await servicesNode.createAliasAccount(15, relay.provider, Utils.generateRequestId());
  });

  async function getResultByEntityIdAndTxTimestamp(entityId, txTimestamp) {
    return await mirrorNode.get(`/contracts/${entityId}/results/${txTimestamp}`);
  }

  it('direct call to non-existing contract', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      NON_EXISTING_CONTRACT_ID,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(NON_EXISTING_CONTRACT_ID, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(NON_EXISTING_CONTRACT_ID);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });

  it('direct call to ethereum precompile 0x1', async function () {
    const { contractExecuteTimestamp } = await servicesNode.executeContractCall(
      ETH_PRECOMPILE_0x1,
      NON_EXISTING_FUNCTION,
      EMPTY_FUNCTION_PARAMS,
    );

    const record = await getResultByEntityIdAndTxTimestamp(ETH_PRECOMPILE_0x1, contractExecuteTimestamp);

    expect(record.contract_id).to.equal(ETH_PRECOMPILE_0x1);
    expect(record.result).to.equal(SUCCESS);
    expect(record.status).to.equal(STATUS_SUCCESS);
  });
});
