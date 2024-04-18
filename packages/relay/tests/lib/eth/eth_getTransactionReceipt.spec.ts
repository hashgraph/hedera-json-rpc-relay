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
import sinon, { createSandbox } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { EthImpl } from '../../../src/lib/eth';
import { Log } from '../../../src/lib/model';
import constants from '../../../src/lib/constants';
import RelayAssertions from '../../assertions';
import { nullableNumberTo0x, numberTo0x, toHash32 } from '../../../src/formatters';
import { BLOCK_BY_HASH_FROM_RELAY, DEFAULT_BLOCK } from './eth-config';
import { defaultErrorMessageHex, defaultLogs1 } from '../../helpers';
import { generateEthTestEnv } from './eth-helpers';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

describe('@ethGetTransactionReceipt eth_getTransactionReceipt tests', async function () {
  this.timeout(10000);
  let { restMock, ethImpl, cacheService } = generateEthTestEnv();
  let sandbox: sinon.SinonSandbox;

  this.beforeAll(() => {
    // @ts-ignore
    sandbox = createSandbox();
  });

  const contractEvmAddress = '0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9';
  const defaultTxHash = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';

  const defaultDetailedContractResultByHash = {
    address: '0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9',
    amount: 2000000000,
    bloom:
      '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    call_result: '0x0606',
    contract_id: '0.0.5001',
    created_contract_ids: ['0.0.7001'],
    error_message: null,
    from: '0x0000000000000000000000000000000000001f41',
    function_parameters: '0x0707',
    gas_limit: 1000000,
    gas_used: 123,
    timestamp: '167654.000123456',
    to: '0x0000000000000000000000000000000000001389',
    block_hash: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042000102030405060708090a0b0c0d0e0f',
    block_number: 17,
    logs: [
      {
        address: '0x0000000000000000000000000000000000001389',
        bloom:
          '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        contract_id: '0.0.5001',
        data: '0x0123',
        index: 0,
        topics: ['0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750'],
      },
    ],
    result: 'SUCCESS',
    transaction_index: 1,
    hash: '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392',
    state_changes: [
      {
        address: '0x0000000000000000000000000000000000001389',
        contract_id: '0.0.5001',
        slot: '0x0000000000000000000000000000000000000000000000000000000000000101',
        value_read: '0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750',
        value_written: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
      },
    ],
    status: '0x1',
    access_list: '0x',
    block_gas_used: 50000000,
    chain_id: '0x12a',
    gas_price: '0x4a817c80',
    max_fee_per_gas: '0x',
    max_priority_fee_per_gas: '0x',
    r: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
    s: '0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354',
    type: 2,
    v: 1,
    nonce: 1,
  };

  const defaultReceipt = {
    blockHash: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
    blockNumber: '0x11',
    cumulativeGasUsed: '0x2faf080',
    effectiveGasPrice: '0xad78ebc5ac620000',
    from: '0x0000000000000000000000000000000000001f41',
    to: '0x0000000000000000000000000000000000001389',
    gasUsed: '0x7b',
    logs: [
      {
        address: '0x0000000000000000000000000000000000001389',
        blockHash: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
        blockNumber: '0x11',
        data: '0x0123',
        logIndex: '0x0',
        removed: false,
        topics: ['0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750'],
        transactionHash: '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392',
        transactionIndex: '0x1',
      },
    ],
    logsBloom:
      '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    status: '0x1',
    transactionHash: '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392',
    transactionIndex: '0x1',
    contractAddress: '0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9',
    root: undefined,
  };

  const stubBlockAndFeesFunc = (sandbox: sinon.SinonSandbox) => {
    const gasPrice = 12500000000000000000;
    sandbox.stub(ethImpl, <any>'getCurrentGasPriceForBlock').resolves('0xad78ebc5ac620000');
    sandbox.stub(ethImpl, <any>'getBlockByHash').resolves(DEFAULT_BLOCK);
    sandbox.stub(ethImpl, <any>'getFeeWeibars').resolves(gasPrice);
  };

  this.afterEach(() => {
    restMock.resetHandlers();
    sandbox.restore();
    cacheService.clear();
  });

  it('returns `null` for non-existent hash', async function () {
    const txHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
    restMock.onGet(`contracts/results/${txHash}`).reply(404, {
      _status: {
        messages: [
          {
            message: 'No correlating transaction',
          },
        ],
      },
    });
    const receipt = await ethImpl.getTransactionReceipt(txHash);
    expect(receipt).to.be.null;
  });

  it('valid receipt on match', async function () {
    restMock.onGet(`accounts/${defaultDetailedContractResultByHash.from}?transactions=false`).reply(200);
    restMock.onGet(`accounts/${defaultDetailedContractResultByHash.from}?transactions=false`).reply(200);
    restMock.onGet(`accounts/${defaultDetailedContractResultByHash.to}?transactions=false`).reply(200);
    restMock.onGet(`accounts/${defaultDetailedContractResultByHash.to}?transactions=false`).reply(200);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.to}`).reply(200);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.to}`).reply(200);
    restMock.onGet(`tokens/${defaultDetailedContractResultByHash.contract_id}`).reply(200);
    restMock.onGet(`tokens/${defaultDetailedContractResultByHash.contract_id}`).reply(200);
    // mirror node request mocks
    restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
    stubBlockAndFeesFunc(sandbox);
    const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

    const currentGasPrice = await ethImpl.gasPrice('valid receipt on match TEST');

    // Assert the data format
    RelayAssertions.assertTransactionReceipt(receipt, defaultReceipt, {
      effectiveGasPrice: currentGasPrice,
    });
  });

  it('valid receipt on match should hit cache', async function () {
    restMock.onGet(`contracts/results/${defaultTxHash}`).replyOnce(200, defaultDetailedContractResultByHash);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).replyOnce(404);
    stubBlockAndFeesFunc(sandbox);
    for (let i = 0; i < 3; i++) {
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);
      expect(receipt).to.exist;
      if (receipt == null) return;
      expect(RelayAssertions.validateHash(receipt.transactionHash, 64)).to.eq(true);
      expect(receipt.transactionHash).to.exist;
      expect(receipt.to).to.eq(defaultReceipt.to);
      expect(receipt.contractAddress).to.eq(defaultReceipt.contractAddress);
      expect(receipt.logs).to.deep.eq(defaultReceipt.logs);
    }
  });

  it('valid receipt with evm address on match', async function () {
    // mirror node request mocks
    restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(200, {
      evm_address: contractEvmAddress,
    });
    stubBlockAndFeesFunc(sandbox);
    const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

    expect(receipt).to.exist;
    if (receipt == null) return;

    expect(RelayAssertions.validateHash(receipt.from, 40)).to.eq(true);
    if (receipt.contractAddress) {
      expect(RelayAssertions.validateHash(receipt.contractAddress, 40)).to.eq(true);
    }
    expect(receipt.contractAddress).to.eq(contractEvmAddress);
  });

  it('Handles null type', async function () {
    const contractResult = {
      ...defaultDetailedContractResultByHash,
      type: null,
    };

    const uniqueTxHash = '0x07cdd7b820375d10d73af57a6a3e84353645fdb1305ea58ff52daa53ec640533';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, contractResult);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
    stubBlockAndFeesFunc(sandbox);
    const receipt = await ethImpl.getTransactionReceipt(uniqueTxHash);

    expect(receipt).to.exist;
    if (receipt == null) return;

    expect(receipt.type).to.be.null;
  });

  it('handles empty bloom', async function () {
    const receiptWith0xBloom = {
      ...defaultDetailedContractResultByHash,
      bloom: '0x',
    };

    restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, receiptWith0xBloom);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
    stubBlockAndFeesFunc(sandbox);
    const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

    expect(receipt).to.exist;
    if (receipt == null) return;

    expect(receipt.logsBloom).to.eq(EthImpl.emptyBloom);
  });

  it('Adds a revertReason field for receipts with errorMessage', async function () {
    const receiptWithErrorMessage = {
      ...defaultDetailedContractResultByHash,
      error_message: defaultErrorMessageHex,
    };

    // fake unique hash so request dont re-use the cached value but the mock defined
    const uniqueTxHash = '0x04cad7b827375d10d73af57b6a3e843536457d31305ea58ff52dda53ec640533';

    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, receiptWithErrorMessage);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
    stubBlockAndFeesFunc(sandbox);
    const receipt = await ethImpl.getTransactionReceipt(uniqueTxHash);

    expect(receipt).to.exist;
    expect(receipt.revertReason).to.eq(defaultErrorMessageHex);
  });

  it('handles empty gas_used', async function () {
    const receiptWithNullGasUsed = {
      ...defaultDetailedContractResultByHash,
      gas_used: null,
    };

    // fake unique hash so request dont re-use the cached value but the mock defined
    const uniqueTxHash = '0x08cad7b827375d12d73af57b6a3e84353645fd31305ea59ff52dda53ec640533';
    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, receiptWithNullGasUsed);
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
    stubBlockAndFeesFunc(sandbox);
    const receipt = await ethImpl.getTransactionReceipt(uniqueTxHash);

    expect(receipt).to.exist;
    if (receipt == null) return;
    expect(receipt.gasUsed).to.eq('0x0');
  });

  it('handles missing transaction index', async function () {
    // fake unique hash so request dont re-use the cached value but the mock defined
    const uniqueTxHash = '0x17cad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533';

    // mirror node request mocks
    restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, {
      ...defaultDetailedContractResultByHash,
      ...{
        transaction_index: undefined,
      },
    });
    restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(200, {
      evm_address: contractEvmAddress,
    });
    stubBlockAndFeesFunc(sandbox);
    const receipt = await ethImpl.getTransactionReceipt(uniqueTxHash);

    expect(receipt).to.exist;

    expect(receipt.logs[0].transactionIndex).to.eq(null);
    expect(receipt.transactionIndex).to.eq(null);
  });

  it('valid receipt on cache match', async function () {
    let getBlockByHash = sandbox.stub(ethImpl, <any>'getBlockByHash').resolves(BLOCK_BY_HASH_FROM_RELAY);
    let getFeeWeibars = sandbox.stub(ethImpl, <any>'getFeeWeibars').resolves(`ad78ebc5ac620000`); // 0xad78ebc5ac620000 in decimal

    // set cache with synthetic log
    const cacheKeySyntheticLog1 = `${constants.CACHE_KEY.SYNTHETIC_LOG_TRANSACTION_HASH}${defaultDetailedContractResultByHash.hash}`;
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

    cacheService.set(cacheKeySyntheticLog1, cachedLog, EthImpl.ethGetTransactionReceipt);

    // w no mirror node requests
    const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

    // Assert the matching reciept
    expect(receipt.blockHash).to.eq(cachedLog.blockHash);
    expect(receipt.blockNumber).to.eq(cachedLog.blockNumber);
    expect(receipt.contractAddress).to.eq(cachedLog.address);
    expect(receipt.cumulativeGasUsed).to.eq(EthImpl.zeroHex);
    expect(receipt.effectiveGasPrice).to.eq(defaultReceipt.effectiveGasPrice);
    expect(receipt.from).to.eq(EthImpl.zeroAddressHex);
    expect(receipt.gasUsed).to.eq(EthImpl.zeroHex);
    expect(receipt.logs).to.deep.eq([cachedLog]);
    expect(receipt.logsBloom).to.be.eq(EthImpl.emptyBloom);
    expect(receipt.status).to.eq(EthImpl.oneHex);
    expect(receipt.to).to.eq(cachedLog.address);
    expect(receipt.transactionHash).to.eq(cachedLog.transactionHash);
    expect(receipt.transactionIndex).to.eq(cachedLog.transactionIndex);
    expect(receipt.root).to.eq(EthImpl.zeroHex32Byte);

    expect(getBlockByHash.calledOnce).to.be.true;
    // verify thet getFeeWeibars stub was called
    expect(getFeeWeibars.calledOnce).to.be.true;
    // verify getFeeWeibars was called with the correct format
    const expectedFormat = parseInt(BLOCK_BY_HASH_FROM_RELAY.timestamp, 16).toString();
    expect(getFeeWeibars.calledWith(`eth_GetTransactionReceipt`, undefined, expectedFormat)).to.be.true;
  });
});
