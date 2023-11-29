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
import path from 'path';
import dotenv from 'dotenv';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { EthImpl } from '../../../src/lib/eth';
import { Log, Transaction, Transaction2930, Transaction1559 } from '../../../src/lib/model';
import constants from '../../../src/lib/constants';
import RelayAssertions from '../../assertions';
import { nullableNumberTo0x, numberTo0x, toHash32 } from '../../../src/formatters';
import {
  DEFAULT_DETAILED_CONTRACT_RESULT_BY_HASH_REVERTED,
  DEFAULT_TRANSACTION,
  DEFAULT_TX_HASH,
  NO_TRANSACTIONS,
} from './eth-config';
import { defaultDetailedContractResultByHash, defaultFromLongZeroAddress, defaultLogs1 } from '../../helpers';
import { predefined } from '../../../src';
import { generateEthTestEnv } from './eth-helpers';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

describe('@ethGetTransactionByHash eth_getTransactionByHash tests', async function () {
  let { restMock, ethImpl, cacheService } = generateEthTestEnv();
  const from = '0x00000000000000000000000000000000000003f7';
  const evm_address = '0xc37f417fa09933335240fca72dd257bfbde9c275';
  const contractResultMock = {
    address: '0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69',
    amount: 20,
    bloom:
      '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    call_result: '0x',
    contract_id: '0.0.1012',
    created_contract_ids: [],
    error_message: null,
    from: '0x00000000000000000000000000000000000003f7',
    function_parameters: '0x',
    gas_limit: 250000,
    gas_used: 200000,
    timestamp: '1692959189.214316721',
    to: '0x00000000000000000000000000000000000003f4',
    hash: '0x7e8a09541c80ccda1f5f40a1975e031ed46de5ad7f24cd4c37be9bac65149b9e',
    block_hash: '0xa414a76539f84ae1c797fa10d00e49d5e7a1adae556dcd43084551e671623d2eba825bcb7bbfd5b7e3fe59d63d8a167f',
    block_number: 61033,
    logs: [],
    result: 'SUCCESS',
    transaction_index: 2,
    state_changes: [],
    status: '0x1',
    failed_initcode: null,
    block_gas_used: 200000,
    chain_id: '0x12a',
    gas_price: '0x',
    r: '0x85b423416d0164d0b2464d880bccb0679587c00673af8e016c8f0ce573be69b2',
    s: '0x3897a5ce2ace1f242d9c989cd9c163d79760af4266f3bf2e69ee288bcffb211a',
    v: 1,
    nonce: 9,
  };

  this.beforeEach(function () {
    restMock.reset();
    restMock.onGet(`accounts/${defaultFromLongZeroAddress}${NO_TRANSACTIONS}`).reply(200, {
      evm_address: `${DEFAULT_TRANSACTION.from}`,
    });
    restMock.onGet(`accounts/${from}?transactions=false`).reply(200, {
      evm_address: evm_address,
    });
  });

  it('returns 155 transaction for type 0', async function () {
    const uniqueTxHash = '0x27cad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533';
    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, {
      ...contractResultMock,
      type: 0,
    });

    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.be.an.instanceOf(Transaction);
  });

  it('returns 2930 transaction for type 1', async function () {
    const uniqueTxHash = '0x28cad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533';
    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, {
      ...contractResultMock,
      type: 1,
      access_list: [],
    });

    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.be.an.instanceOf(Transaction2930);
  });

  it('returns 1559 transaction for type 2', async function () {
    const uniqueTxHash = '0x27cad7b827375d12d73af57b7a3e84353645fd31305ea58ff52dda53ec640533';
    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, {
      ...contractResultMock,
      type: 2,
      access_list: [],
      max_fee_per_gas: '0x47',
      max_priority_fee_per_gas: '0x47',
    });

    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.be.an.instanceOf(Transaction1559);
  });

  it('returns `null` for non-existing hash', async function () {
    const uniqueTxHash = '0x27cAd7b838375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533';
    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(404, {
      _status: {
        messages: [
          {
            message: 'No correlating transaction',
          },
        ],
      },
    });

    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.equal(null);
  });

  it('account should be cached', async function () {
    restMock.onGet(`contracts/results/${DEFAULT_TX_HASH}`).reply(200, defaultDetailedContractResultByHash);
    const resBeforeCache = await ethImpl.getTransactionByHash(DEFAULT_TX_HASH);
    restMock.onGet(`accounts/${defaultFromLongZeroAddress}${NO_TRANSACTIONS}`).reply(404);
    const resAfterCache = await ethImpl.getTransactionByHash(DEFAULT_TX_HASH);
    expect(resBeforeCache).to.deep.equal(resAfterCache);
  });

  it('returns correct transaction for existing hash', async function () {
    restMock.onGet(`contracts/results/${DEFAULT_TX_HASH}`).reply(200, defaultDetailedContractResultByHash);
    const result = await ethImpl.getTransactionByHash(DEFAULT_TX_HASH);
    RelayAssertions.assertTransaction(result, {
      ...DEFAULT_TRANSACTION,
      maxFeePerGas: '0x55',
      maxPriorityFeePerGas: '0x43',
    });
  });

  it('returns correct transaction for existing hash w no sigs', async function () {
    const detailedResultsWithNullNullableValues = {
      ...defaultDetailedContractResultByHash,
      r: null,
      s: null,
    };

    const uniqueTxHash = '0x97cad7b827375d12d73af57b6a3f84353645fd31305ea58ff52dda53ec640533';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    RelayAssertions.assertTransaction(result, {
      ...DEFAULT_TRANSACTION,
      maxFeePerGas: '0x55',
      maxPriorityFeePerGas: '0x43',
      r: null,
      s: null,
    });
  });

  it('handles transactions with null gas_used', async function () {
    const detailedResultsWithNullNullableValues = {
      ...defaultDetailedContractResultByHash,
      gas_used: null,
    };
    const uniqueTxHash = '0x14aad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.not.be.null;

    expect(result).to.exist;
    if (result) expect(result.gas).to.eq('0x0');
  });

  it('handles transactions with null amount', async function () {
    const detailedResultsWithNullNullableValues = {
      ...defaultDetailedContractResultByHash,
      amount: null,
    };
    const uniqueTxHash = '0x0aaad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.not.be.null;

    expect(result).to.exist;
    if (result) expect(result.value).to.eq('0x0');
  });

  it('handles transactions with v as null', async function () {
    const detailedResultsWithNullNullableValues = {
      ...defaultDetailedContractResultByHash,
      v: null,
      type: 0,
    };
    const uniqueTxHash = '0xb4cad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.not.be.null;

    expect(result).to.exist;
    if (result) expect(result.v).to.eq('0x0');
  });

  it('handles transactions with undefined transaction_index', async function () {
    const detailedResultsWithNullNullableValues = {
      ...defaultDetailedContractResultByHash,
      transaction_index: undefined,
    };
    const uniqueTxHash = '0x14aad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640534';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.not.be.null;

    expect(result).to.exist;
    if (result) expect(result.transactionIndex).to.be.null;
  });

  it('handles transactions with undefined block_number', async function () {
    const detailedResultsWithNullNullableValues = {
      ...defaultDetailedContractResultByHash,
      block_number: undefined,
    };
    const uniqueTxHash = '0x14aad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640511';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.not.be.null;

    expect(result).to.exist;
    if (result) expect(result.blockNumber).to.be.null;
  });

  it('handles transactions with undefined transaction_index and block_number', async function () {
    const detailedResultsWithNullNullableValues = {
      ...defaultDetailedContractResultByHash,
      block_number: undefined,
      transaction_index: undefined,
    };

    const uniqueTxHash = '0x14aad7b827375d12d73af57b6a3e84353645fd31305ea58ff52d1a53ec640511';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
    const result = await ethImpl.getTransactionByHash(uniqueTxHash);
    expect(result).to.not.be.null;

    expect(result).to.exist;
    if (result) {
      expect(result.blockNumber).to.be.null;
      expect(result.transactionIndex).to.be.null;
    }
  });

  it('returns reverted transactions', async function () {
    restMock
      .onGet(`contracts/results/${DEFAULT_TX_HASH}`)
      .reply(200, DEFAULT_DETAILED_CONTRACT_RESULT_BY_HASH_REVERTED);

    const result = await ethImpl.getTransactionByHash(DEFAULT_TX_HASH);
    RelayAssertions.assertTransaction(result, {
      ...DEFAULT_TRANSACTION,
      maxFeePerGas: '0x55',
      maxPriorityFeePerGas: '0x43',
    });
  });

  it('throws error for reverted transactions when DEV_MODE=true', async function () {
    const initialDevModeValue = process.env.DEV_MODE;
    process.env.DEV_MODE = 'true';

    const uniqueTxHash = '0xa8cad7b827375d12d73af57b6a3f84353645fd31305ea58ff52dda53ec640533';
    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, DEFAULT_DETAILED_CONTRACT_RESULT_BY_HASH_REVERTED);
    const args = [uniqueTxHash];
    const errMessage = DEFAULT_DETAILED_CONTRACT_RESULT_BY_HASH_REVERTED.error_message;
    const data = DEFAULT_DETAILED_CONTRACT_RESULT_BY_HASH_REVERTED.error_message;
    await RelayAssertions.assertRejection(
      predefined.CONTRACT_REVERT(errMessage, data),
      ethImpl.getTransactionByHash,
      true,
      ethImpl,
      args,
    );
    process.env.DEV_MODE = initialDevModeValue;
  });

  it('returns synthetic transaction when it matches cache', async function () {
    // prepare cache with synthetic log
    const cacheKeySyntheticLog = `${constants.CACHE_KEY.SYNTHETIC_LOG_TRANSACTION_HASH}${defaultDetailedContractResultByHash.hash}`;
    const cachedLog = new Log({
      address: defaultLogs1[0].address,
      blockHash: toHash32(defaultLogs1[0].block_hash),
      blockNumber: numberTo0x(defaultLogs1[0].block_number),
      data: defaultLogs1[0].data,
      logIndex: numberTo0x(defaultLogs1[0].index),
      removed: false,
      topics: defaultLogs1[0].topics,
      transactionHash: toHash32(defaultLogs1[0].transaction_hash),
      transactionIndex: nullableNumberTo0x(defaultLogs1[0].transaction_index),
    });

    cacheService.set(cacheKeySyntheticLog, cachedLog, EthImpl.ethGetTransactionReceipt);

    const transaction = await ethImpl.getTransactionByHash(DEFAULT_TX_HASH);

    if (transaction) {
      // Assert the respnse tx
      expect(transaction.blockHash).to.eq(cachedLog.blockHash);
      expect(transaction.blockNumber).to.eq(cachedLog.blockNumber);
      expect(transaction.from).to.eq(cachedLog.address);
      expect(transaction.gas).to.eq(EthImpl.defaultTxGas);
      expect(transaction.gasPrice).to.eq(EthImpl.invalidEVMInstruction);
      expect(transaction.value).to.eq(EthImpl.oneTwoThreeFourHex);
      expect(transaction.to).to.eq(cachedLog.address);
      expect(transaction.hash).to.eq(cachedLog.transactionHash);
      expect(transaction.transactionIndex).to.eq(cachedLog.transactionIndex);
    }
  });
});
