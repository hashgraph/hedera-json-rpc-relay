/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2025 Hedera Hashgraph, LLC
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

import { RelayCall } from '../../../src';
import { predefined } from '../../../src/lib/errors/JsonRpcError';
import { EthImpl } from '../../../src/lib/eth';
import { Assertions } from '../../helpers/assertions';
import { Relay } from '../../helpers/relay';

describe('eth_getCode acceptance tests', function () {
  this.timeout(10000);
  const relay = new Relay();
  const requestId = 'test-request-id';

  it('should return contract bytecode for valid contract address', async function () {
    const contractAddress = '0x0000000000000000000000000000000000000001';
    const expectedBytecode = '0x6080604052348015600f57600080fd5b506000610167905077618dc65e';

    const result = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_GET_CODE, [contractAddress, 'latest'], requestId);
    expect(result).to.equal(expectedBytecode);
  });

  it('should return empty bytecode for non-contract address', async function () {
    const nonContractAddress = '0x0000000000000000000000000000000000000002';

    const result = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_GET_CODE, [nonContractAddress, 'latest'], requestId);
    expect(result).to.equal(EthImpl.emptyHex);
  });

  it('should return redirect bytecode for HTS token address', async function () {
    const tokenAddress = '0x0000000000000000000000000000000000000003';
    const expectedRedirectBytecode = `6080604052348015600f57600080fd5b506000610167905077618dc65e${tokenAddress.slice(
      2,
    )}600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033`;

    const result = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_GET_CODE, [tokenAddress, 'latest'], requestId);
    expect(result).to.equal(expectedRedirectBytecode);
  });

  it('should throw error for invalid block number', async function () {
    const contractAddress = '0x0000000000000000000000000000000000000001';
    const invalidBlockNumber = '0xinvalid';
    const expectedError = predefined.UNKNOWN_BLOCK(
      `The value passed is not a valid blockHash/blockNumber/blockTag value: ${invalidBlockNumber}`,
    );

    await Assertions.assertPredefinedRpcError(expectedError, relay.call, false, relay, [
      RelayCall.ETH_ENDPOINTS.ETH_GET_CODE,
      [contractAddress, invalidBlockNumber],
      requestId,
    ]);
  });
});
