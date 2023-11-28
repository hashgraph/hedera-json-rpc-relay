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
import chai from 'chai';
import path from 'path';
import dotenv from 'dotenv';
import MockAdapter from 'axios-mock-adapter';
import { assert, expect } from 'chai';
import { Registry } from 'prom-client';
import sinon, { createSandbox } from 'sinon';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import { RelayImpl } from '../../src/lib/relay';
import { predefined } from '../../src/lib/errors/JsonRpcError';
import { EthImpl } from '../../src/lib/eth';
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';
import {
  defaultCallData,
  defaultEvmAddress,
  defaultFromLongZeroAddress,
  expectUnsupportedMethod,
  defaultErrorMessageHex,
  buildCryptoTransferTransaction,
  mockData,
  signTransaction,
  ethCallFailing,
  ethGetLogsFailing,
  defaultDetailedContractResults,
  defaultLogs1,
  defaultLogs2,
  defaultLogs3,
  defaultContractResults,
  defaultEthereumTransactions,
  defaultErrorMessageText,
  expectLogData,
  expectLogData1,
  expectLogData2,
  expectLogData3,
  expectLogData4,
  getRequestId,
} from '../helpers';

import pino from 'pino';
import { Log, Transaction, Transaction1559, Transaction2930 } from '../../src/lib/model';
import constants from '../../src/lib/constants';
import { SDKClient } from '../../src/lib/clients';
import { SDKClientError } from '../../src/lib/errors/SDKClientError';
import HAPIService from '../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../src/lib/hbarlimiter';
import { Hbar, HbarUnit, TransactionId } from '@hashgraph/sdk';
import chaiAsPromised from 'chai-as-promised';
import RelayAssertions from '../assertions';
import { v4 as uuid } from 'uuid';
import { JsonRpcError } from '../../dist';
import { hashNumber, numberTo0x, nullableNumberTo0x, toHash32 } from '../../dist/formatters';
import * as _ from 'lodash';
import { CacheService } from '../../src/lib/services/cacheService/cacheService';

chai.use(chaiAsPromised);

const logger = pino();
const registry = new Registry();
const Relay = new RelayImpl(logger, registry);

const noTransactions = '?transactions=false';

let restMock: MockAdapter, web3Mock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let hapiServiceInstance: HAPIService;
let sdkClientStub;
let getSdkClientStub;
let cacheService: CacheService;
let defaultLogs, defaultDetailedContractResults2, defaultDetailedContractResults3;

const blockTransactionCount = 77;
const gasUsed1 = 200000;
const gasUsed2 = 800000;
const blockNumber = 3;
const blockTimestamp = '1651560386';
const blockHashTrimmed = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b';
const blockHash = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6b`;

const blockByHashFromRelay = {
  timestamp: '0x652dbbb7',
  difficulty: '0x0',
  extraData: '0x',
  gasLimit: '0xe4e1c0',
  baseFeePerGas: '0x1a3185c5000',
  gasUsed: '0x0',
  logsBloom:
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  miner: '0x0000000000000000000000000000000000000000',
  mixHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  nonce: '0x0000000000000000',
  receiptsRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
  sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
  size: '0x340',
  stateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
  totalDifficulty: '0x0',
  transactions: [],
  transactionsRoot: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
  uncles: [],
  withdrawals: [],
  withdrawalsRoot: '0x0',
  number: '0x341890',
  hash: '0x360cda6a0760c9adb0e41268edbeb6a0cb3bdaff8f1e68f6ffbd22c9c050d8af',
  parentHash: '0xf44fd739068dde2db83c114998f8218b6c9d49200642c40046b16e8f83dfdcd6',
};

const defaultBlock = {
  count: blockTransactionCount,
  hapi_version: '0.28.1',
  hash: blockHash,
  name: '2022-05-03T06_46_26.060890949Z.rcd',
  number: blockNumber,
  previous_hash: '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
  size: null,
  timestamp: {
    from: `${blockTimestamp}.060890949`,
    to: '1651560389.060890949',
  },
  gas_used: gasUsed1 + gasUsed2,
  logs_bloom: '0x',
};

const defaultNetworkFees = {
  fees: [
    {
      gas: 77,
      transaction_type: 'ContractCall',
    },
    {
      gas: 771,
      transaction_type: 'ContractCreate',
    },
    {
      gas: 57,
      transaction_type: 'EthereumTransaction',
    },
  ],
  timestamp: '1653644164.591111113',
};

describe('Eth calls using MirrorNode', async function () {
  this.timeout(10000);

  let ethImpl: EthImpl;
  let ethImplLowTransactionCount: EthImpl;
  const ethFeeHistoryValue = process.env.ETH_FEE_HISTORY_FIXED || 'true';

  this.beforeAll(() => {
    cacheService = new CacheService(logger.child({ name: `cache` }), registry);
    // @ts-ignore
    mirrorNodeInstance = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL,
      logger.child({ name: `mirror-node` }),
      registry,
      cacheService,
    );

    // @ts-ignore
    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: 'throwException' });

    // @ts-ignore
    web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: 'throwException' });

    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TINYBAR;
    const hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);

    hapiServiceInstance = new HAPIService(logger, registry, hbarLimiter, cacheService);

    process.env.ETH_FEE_HISTORY_FIXED = 'false';

    // @ts-ignore
    ethImpl = new EthImpl(hapiServiceInstance, mirrorNodeInstance, logger, '0x12a', registry, cacheService);
  });

  this.afterAll(() => {
    process.env.ETH_FEE_HISTORY_FIXED = ethFeeHistoryValue;
  });

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
  });

  const blockHash2 = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6c`;
  const blockHash3 = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6d`;
  const blockHashPreviousTrimmed = '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298';
  const blockNumber2 = 4;
  const blockNumber3 = 5;
  const blockNumberHex = `0x${blockNumber.toString(16)}`;
  const maxGasLimit = 250000;
  const maxGasLimitHex = numberTo0x(maxGasLimit);
  const contractCallData = '0xef641f44';
  const blockTimestampHex = numberTo0x(Number(blockTimestamp));
  const firstTransactionTimestampSeconds = '1653077541';
  const contractAddress1 = '0x000000000000000000000000000000000000055f';
  const htsTokenAddress = '0x0000000000000000000000000000000002dca431';
  const contractTimestamp1 = `${firstTransactionTimestampSeconds}.983983199`;
  const contractTimestamp4 = `${firstTransactionTimestampSeconds}.983983198`;
  const contractHash1 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
  const contractHash2 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393';
  const contractHash3 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394';
  const contractAddress2 = '0x000000000000000000000000000000000000055e';
  const contractAddress3 = '0x000000000000000000000000000000000000255c';
  const wrongContractAddress = '0x00000000000000000000000000000000055e';
  const contractTimestamp2 = '1653077542.701408897';
  const contractTimestamp3 = '1653088542.123456789';
  const contractId1 = '0.0.1375';
  const contractId2 = '0.0.1374';
  const gasUsedRatio = 0.5;
  const deployedBytecode =
    '0x608060405234801561001057600080fd5b5060405161078938038061078983398181016040528101906100329190';
  const mirrorNodeDeployedBytecode =
    '0x608060405234801561001057600080fd5b5060405161078938038061078983398181016040528101906100321234';
  const accountAddress1 = '0x13212A14deaf2775a5b3bEcC857806D5c719d3f2';
  const receiverAddress = '0x5b98Ce3a4D1e1AC55F15Da174D5CeFcc5b8FB994';

  const olderBlock = {
    count: blockTransactionCount,
    hapi_version: '0.28.1',
    hash: blockHash,
    name: '2022-05-03T06_46_26.060890949Z.rcd',
    number: blockNumber,
    previous_hash: '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
    size: null,
    timestamp: {
      from: `${contractTimestamp4}`,
      to: '1651560389.060890949',
    },
    gas_used: gasUsed1 + gasUsed2,
    logs_bloom: '0x',
  };

  const blockZero = {
    count: 5,
    hapi_version: '0.28.1',
    hash: '0x4a7eed88145253eca01a6b5995865b68b041923772d0e504d2ae5fbbf559b68b397adfce5c52f4fa8acec860e6fbc395',
    name: '2020-08-27T23_40_52.347251002Z.rcd',
    number: 0,
    previous_hash: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    size: null,
    timestamp: {
      from: '1598571652.347251002',
      to: '1598571654.548395000',
    },
    gas_used: 0,
    logs_bloom: '0x',
  };

  const mostRecentBlock = {
    blocks: [
      {
        count: 8,
        gas_used: 0,
        hapi_version: '0.35.0',
        hash: '0xd9f84ed7415f33ae171a34c5daa4030a3a3028536d737bacf28b08c68309c629d6b2d9e01cb4ad7eb5e4fc21749b8c33',
        logs_bloom: '0x',
        name: '2023-03-22T19_21_10.216373003Z.rcd.gz',
        number: 6,
        previous_hash:
          '0xe5ec054c17063d3912eb13760f9f62779f12c60f4d13f882d3fe0aba15db617b9f2b62d9f51d2aac05f7499147c6aa28',
        size: 3085,
        timestamp: {
          from: '1679512870.216373003',
          to: '1679512871.851262003',
        },
      },
    ],
  };

  const defaultContractResultsWithNullableFrom = _.cloneDeep(defaultContractResults);
  defaultContractResultsWithNullableFrom.results[0].from = null;

  const defaultContractResultsRevert = {
    results: [
      {
        amount: 0,
        bloom:
          '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        call_result: '0x',
        contract_id: null,
        created_contract_ids: [],
        error_message:
          '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002645524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000',
        from: '0x0000000000000000000000000000000000000557',
        function_parameters: '0x',
        gas_limit: maxGasLimit,
        gas_used: gasUsed1,
        hash: contractHash1,
        timestamp: `${contractTimestamp1}`,
        to: null,
        block_gas_used: 400000,
        block_hash: blockHash,
        block_number: blockNumber,
        chain_id: '0x12a',
        failed_initcode: null,
        gas_price: '0x4a817c80',
        max_fee_per_gas: '0x59',
        max_priority_fee_per_gas: '0x33',
        nonce: 5,
        r: '0xb5c21ab4dfd336e30ac2106cad4aa8888b1873a99bce35d50f64d2ec2cc5f6d9',
        result: 'SUCCESS',
        s: '0x1092806a99727a20c31836959133301b65a2bfa980f9795522d21a254e629110',
        status: '0x1',
        transaction_index: 1,
        type: 2,
        v: 1,
      },
    ],
    links: {
      next: null,
    },
  };

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
    type: 2,
    v: 1,
    nonce: 9,
  };

  const defaultLogTopics = [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000000000000000000000000208fa13',
    '0x0000000000000000000000000000000000000000000000000000000000000005',
  ];

  const defaultLogTopics1 = [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x000000000000000000000000000000000000000000000000000000000208fa13',
  ];

  const defaultNullLogTopics = [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x000000000000000000000000000000000000000000000000000000000208fa13',
    null,
    null,
  ];

  const logBloom4 = '0x4444';
  const defaultLogs4 = [
    {
      address: '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69',
      bloom: logBloom4,
      contract_id: contractId2,
      data: '0x',
      index: 0,
      topics: defaultLogTopics1,
      root_contract_id: '0.0.34806097',
      timestamp: contractTimestamp3,
      block_hash: blockHash3,
      block_number: blockNumber3,
      transaction_hash: contractHash3,
      transaction_index: 1,
    },
  ];

  const defaultLogsList = defaultLogs1.concat(defaultLogs2).concat(defaultLogs3);
  defaultLogs = {
    logs: defaultLogsList,
  };

  const defaultCurrentContractState = {
    state: [
      {
        address: contractAddress1,
        contract_id: contractId1,
        timestamp: contractTimestamp1,
        slot: '0x0000000000000000000000000000000000000000000000000000000000000101',
        value: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
      },
    ],
  };

  const defaultOlderContractState = {
    state: [
      {
        address: contractAddress1,
        contract_id: contractId1,
        timestamp: contractTimestamp4,
        slot: '0x0000000000000000000000000000000000000000000000000000000000000101',
        value: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
      },
    ],
  };

  defaultDetailedContractResults2 = {
    ...defaultDetailedContractResults,
    ...{
      timestamp: contractTimestamp2,
      block_hash: blockHash2,
      block_number: blockNumber2,
      hash: contractHash2,
      logs: defaultLogs2,
    },
  };

  defaultDetailedContractResults3 = {
    ...defaultDetailedContractResults,
    ...{
      timestamp: contractTimestamp3,
      block_hash: blockHash3,
      block_number: blockNumber3,
      hash: contractHash3,
      contract_id: contractId2,
      logs: defaultLogs3,
    },
  };

  const defaultContractStateEmptyArray = {
    state: [],
    links: {
      next: null,
    },
  };

  const detailedContractResultNotFound = { _status: { messages: [{ message: 'No correlating transaction' }] } };

  const results = defaultContractResults.results;
  const totalGasUsed = numberTo0x(results[0].gas_used + results[1].gas_used);

  const baseFeePerGasHex = numberTo0x(BigInt(defaultNetworkFees.fees[2].gas) * TINYBAR_TO_WEIBAR_COEF_BIGINT); // '0x84b6a5c400' -> 570_000_000_000 tb

  const defaultContract = {
    admin_key: null,
    auto_renew_account: null,
    auto_renew_period: 7776000,
    contract_id: '0.0.1052',
    created_timestamp: '1659622477.294172233',
    deleted: false,
    evm_address: null,
    expiration_timestamp: null,
    file_id: '0.0.1051',
    max_automatic_token_associations: 0,
    memo: '',
    obtainer_id: null,
    permanent_removal: null,
    proxy_account_id: null,
    timestamp: {
      from: '1659622477.294172233',
      to: null,
    },
    bytecode: '0x123456',
    runtime_bytecode: mirrorNodeDeployedBytecode,
  };

  const defaultContract2 = {
    ...defaultContract,
    address: contractAddress2,
    contract_id: contractId2,
  };

  const defaultContract3EmptyBytecode = {
    address: contractAddress2,
    contract_id: contractId2,
    admin_key: null,
    auto_renew_account: null,
    auto_renew_period: 7776000,
    created_timestamp: '1659622477.294172233',
    deleted: false,
    evm_address: null,
    expiration_timestamp: null,
    file_id: '0.0.1051',
    max_automatic_token_associations: 0,
    memo: '',
    obtainer_id: null,
    permanent_removal: null,
    proxy_account_id: null,
    timestamp: {
      from: '1659622477.294172233',
      to: null,
    },
    bytecode: '0x123456',
    runtime_bytecode: '0x',
  };

  const defaultEthGetBlockByLogs = {
    logs: [defaultLogs.logs[0], defaultLogs.logs[1]],
  };

  const defaultHTSToken = mockData.token;

  this.afterEach(() => {
    restMock.resetHandlers();
  });

  this.beforeEach(() => {
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);
  });

  describe('eth_getStorageAt', async function () {
    it('eth_getStorageAt with match with block and slot less than 32 bytes and without leading zeroes', async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet('blocks?limit=1&order=desc').reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${defaultBlock.timestamp.to}&slot=0x101&limit=100&order=desc`,
        )
        .reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, '0x101', numberTo0x(blockNumber));
      expect(result).to.exist;
      expect(result).to.not.be.null;

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    it('eth_getStorageAt with match with block and slot less than 32 bytes and leading zeroes', async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet('blocks?limit=1&order=desc').reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${defaultBlock.timestamp.to}&slot=0x0000101&limit=100&order=desc`,
        )
        .reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, '0x0000101', numberTo0x(blockNumber));
      expect(result).to.exist;
      expect(result).to.not.be.null;

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    it('eth_getStorageAt with match with block', async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet('blocks?limit=1&order=desc').reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${defaultBlock.timestamp.to}&slot=0x0000000000000000000000000000000000000000000000000000000000000101&limit=100&order=desc`,
        )
        .reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(
        contractAddress1,
        defaultDetailedContractResults.state_changes[0].slot,
        numberTo0x(blockNumber),
      );
      expect(result).to.exist;
      expect(result).to.not.be.null;

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    it('eth_getStorageAt with match with latest block', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?slot=${defaultCurrentContractState.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, defaultCurrentContractState.state[0].slot, 'latest');
      expect(result).to.exist;
      expect(result).to.not.be.null;

      // verify slot value
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    // Block number is a required param, this should not work and should be removed when/if validations are added.
    // Instead the relay should return `missing value for required argument <argumentIndex> error`.
    it('eth_getStorageAt with match null block', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?slot=${defaultCurrentContractState.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, defaultDetailedContractResults.state_changes[0].slot);
      expect(result).to.exist;
      expect(result).to.not.be.null;

      // verify slot value
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    it('eth_getStorageAt should throw a predefined RESOURCE_NOT_FOUND when block not found', async function () {
      restMock.onGet(`blocks/${blockNumber}`).reply(200, null);
      restMock.onGet('blocks?limit=1&order=desc').reply(200, mostRecentBlock);

      const args = [contractAddress1, defaultDetailedContractResults.state_changes[0].slot, numberTo0x(blockNumber)];

      await RelayAssertions.assertRejection(
        predefined.RESOURCE_NOT_FOUND(),
        ethImpl.getStorageAt,
        false,
        ethImpl,
        args,
      );
    });

    it('eth_getStorageAt should return EthImpl.zeroHex32Byte when slot wrong', async function () {
      const wrongSlot = '0x0000000000000000000000000000000000000000000000000000000000001101';
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet('blocks?limit=1&order=desc').reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${defaultBlock.timestamp.to}&slot=${wrongSlot}&limit=100&order=desc`,
        )
        .reply(200, defaultContractStateEmptyArray);

      const result = await ethImpl.getStorageAt(contractAddress1, wrongSlot, numberTo0x(blockNumber));
      expect(result).to.equal(EthImpl.zeroHex32Byte);
    });

    it('eth_getStorageAt should return old state when passing older block number', async function () {
      restMock.onGet(`blocks/${blockNumber}`).reply(200, olderBlock);
      restMock.onGet('blocks?limit=1&order=desc').reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${olderBlock.timestamp.to}&slot=${defaultOlderContractState.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, defaultOlderContractState);

      const result = await ethImpl.getStorageAt(
        contractAddress1,
        defaultOlderContractState.state[0].slot,
        numberTo0x(olderBlock.number),
      );
      expect(result).to.equal(defaultOlderContractState.state[0].value);
    });

    it('eth_getStorageAt should throw error when contract not found', async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet('blocks?limit=1&order=desc').reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${defaultBlock.timestamp.to}&slot=${defaultOlderContractState.state[0].slot}&limit=100&order=desc`,
        )
        .reply(404, detailedContractResultNotFound);

      const args = [contractAddress1, defaultDetailedContractResults.state_changes[0].slot, numberTo0x(blockNumber)];

      await RelayAssertions.assertRejection(
        predefined.RESOURCE_NOT_FOUND(),
        ethImpl.getStorageAt,
        false,
        ethImpl,
        args,
      );
    });
  });

  describe('eth_getTransactionCount', async () => {
    const blockNumber = mockData.blocks.blocks[2].number;
    const blockNumberHex = numberTo0x(blockNumber);
    const transactionId = '0.0.1078@1686183420.196506746';

    const accountPath = `accounts/${mockData.account.evm_address}${noTransactions}`;
    const accountTimestampFilteredPath = `accounts/${mockData.account.evm_address}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=2&order=desc`;
    const contractPath = `contracts/${mockData.account.evm_address}`;
    const contractResultsPath = `contracts/results/${transactionId}`;
    const earliestBlockPath = `blocks?limit=1&order=asc`;
    const blockPath = `blocks/${blockNumber}`;
    const latestBlockPath = `blocks?limit=1&order=desc`;

    this.beforeEach(() => {
      restMock.onGet(latestBlockPath).reply(202, {
        blocks: [
          {
            ...mockData.blocks.blocks[2],
            number: blockNumber + constants.MAX_BLOCK_RANGE + 1,
          },
        ],
      });
    });

    it('should return 0x0 nonce for no block consideration with not found acoount', async () => {
      restMock.onGet(contractPath).reply(404, mockData.notFound);
      restMock.onGet(accountPath).reply(404, mockData.notFound);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, null);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it('should return latest nonce for no block consideration but valid account', async () => {
      restMock.onGet(contractPath).reply(404, mockData.notFound);
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, null);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it('should return 0x0 nonce for block 0 consideration', async () => {
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, '0');
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it('should return 0x0 nonce for block 1 consideration', async () => {
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, '1');
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it('should return latest nonce for latest block', async () => {
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, EthImpl.blockLatest);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it('should return latest nonce for pending block', async () => {
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, EthImpl.blockPending);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it('should return 0x0 nonce for earliest block with valid block', async () => {
      restMock.onGet(earliestBlockPath).reply(200, { blocks: [mockData.blocks.blocks[0]] });
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, EthImpl.blockEarliest);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it('should throw error for earliest block with invalid block', async () => {
      restMock.onGet(earliestBlockPath).reply(200, { blocks: [] });
      const args = [mockData.account.evm_address, EthImpl.blockEarliest];

      await RelayAssertions.assertRejection(
        predefined.INTERNAL_ERROR('No network blocks found'),
        ethImpl.getTransactionCount,
        true,
        ethImpl,
        args,
      );
    });

    it('should throw error for earliest block with non 0 or 1 block', async () => {
      restMock.onGet(earliestBlockPath).reply(200, { blocks: [mockData.blocks.blocks[2]] });

      const args = [mockData.account.evm_address, EthImpl.blockEarliest];

      const errMessage = `Partial mirror node encountered, earliest block number is ${mockData.blocks.blocks[2].number}`;

      await RelayAssertions.assertRejection(
        predefined.INTERNAL_ERROR(errMessage),
        ethImpl.getTransactionCount,
        true,
        ethImpl,
        args,
      );
    });

    it('should return nonce for request on historical numerical block', async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);
      restMock.onGet(accountPath).reply(200, { ...mockData.account, transactions: [defaultEthereumTransactions[0]] });
      restMock
        .onGet(accountTimestampFilteredPath)
        .reply(200, { ...mockData.account, transactions: defaultEthereumTransactions });
      restMock.onGet(`${contractResultsPath}`).reply(200, defaultDetailedContractResults);

      const accountPathContractResultsAddress = `accounts/${defaultDetailedContractResults.from}${noTransactions}`;
      restMock
        .onGet(accountPathContractResultsAddress)
        .reply(200, { ...mockData.account, transactions: [defaultEthereumTransactions[0]] });

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(`0x${defaultDetailedContractResults.nonce + 1}`);
    });

    it('should throw error for account historical numerical block tag with missing block', async () => {
      restMock.onGet(blockPath).reply(404, mockData.notFound);

      const args = [mockData.account.evm_address, blockNumberHex];

      await RelayAssertions.assertRejection(predefined.UNKNOWN_BLOCK, ethImpl.getTransactionCount, true, ethImpl, args);
    });

    it('should throw error for account historical numerical block tag with error on latest block', async () => {
      restMock.onGet(blockPath).reply(404, mockData.notFound);
      restMock.onGet(latestBlockPath).reply(404, mockData.notFound);

      const args = [mockData.account.evm_address, blockNumberHex];

      await RelayAssertions.assertRejection(predefined.UNKNOWN_BLOCK, ethImpl.getTransactionCount, true, ethImpl, args);
    });

    it('should return valid nonce for historical numerical block close to latest', async () => {
      restMock.onGet(latestBlockPath).reply(202, {
        blocks: [
          {
            ...mockData.blocks.blocks[2],
            number: blockNumber + 1,
          },
        ],
      });
      restMock.onGet(accountPath).reply(200, mockData.account);

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it('should return 0x0 nonce for historical numerical block with no ethereum transactions found', async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock.onGet(transactionPath(mockData.account.evm_address, 2)).reply(200, { transactions: [] });

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it('should return 0x1 nonce for historical numerical block with a single ethereum transactions found', async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock.onGet(transactionPath(mockData.account.evm_address, 2)).reply(200, { transactions: [{}] });

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.oneHex);
    });

    it('should throw for historical numerical block with a missing contracts results', async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock
        .onGet(transactionPath(mockData.account.evm_address, 2))
        .reply(200, { transactions: [{ transaction_id: transactionId }, {}] });
      restMock.onGet(contractResultsPath).reply(404, mockData.notFound);

      const args = [mockData.account.evm_address, blockNumberHex];
      const errMessage = `Failed to retrieve contract results for transaction ${transactionId}`;

      await RelayAssertions.assertRejection(
        predefined.RESOURCE_NOT_FOUND(errMessage),
        ethImpl.getTransactionCount,
        true,
        ethImpl,
        args,
      );
    });

    it('should return valid nonce for historical numerical block when contract result sender is not address', async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock
        .onGet(transactionPath(mockData.account.evm_address, 2))
        .reply(200, { transactions: [{ transaction_id: transactionId }, {}] });
      restMock.onGet(contractResultsPath).reply(200, { from: mockData.contract.evm_address, nonce: 2 });
      restMock.onGet(accountPath).reply(200, mockData.account);

      const accountPathContractResultsAddress = `accounts/${mockData.contract.evm_address}${noTransactions}`;
      restMock
        .onGet(accountPathContractResultsAddress)
        .reply(200, { ...mockData.account, transactions: [defaultEthereumTransactions[0]] });

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(3));
    });

    it('should return valid nonce for historical numerical block', async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock
        .onGet(transactionPath(mockData.account.evm_address, 2))
        .reply(200, { transactions: [{ transaction_id: transactionId }, {}] });
      restMock
        .onGet(contractResultsPath)
        .reply(200, { from: mockData.account.evm_address, nonce: mockData.account.ethereum_nonce - 1 });
      const accountPathContractResultsAddress = `accounts/${mockData.account.evm_address}${noTransactions}`;
      restMock
        .onGet(accountPathContractResultsAddress)
        .reply(200, { ...mockData.account, transactions: [defaultEthereumTransactions[0]] });
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it('should throw for -1 invalid block tag', async () => {
      const args = [mockData.account.evm_address, '-1'];

      await RelayAssertions.assertRejection(predefined.UNKNOWN_BLOCK, ethImpl.getTransactionCount, true, ethImpl, args);
    });

    it('should throw for invalid block tag', async () => {
      const args = [mockData.account.evm_address, 'notablock'];

      await RelayAssertions.assertRejection(predefined.UNKNOWN_BLOCK, ethImpl.getTransactionCount, true, ethImpl, args);
    });

    it('should return 0x1 for pre-hip-729 contracts with nonce=null', async () => {
      restMock.onGet(accountPath).reply(200, { ...mockData.account, ethereum_nonce: null });
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, EthImpl.blockLatest);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.oneHex);
    });
  });
});

describe('Eth', async function () {
  this.timeout(10000);

  let ethImpl: EthImpl;
  let sandbox: sinon.SinonSandbox;
  let getCurrentGasPriceForBlockStub: sinon.SinonStub;

  this.beforeAll(() => {
    // @ts-ignore
    sandbox = createSandbox();
    cacheService = new CacheService(logger.child({ name: `cache` }), registry);
    mirrorNodeInstance = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL as string,
      logger.child({ name: `mirror-node` }),
      registry,
      cacheService,
    );
    ethImpl = new EthImpl(hapiServiceInstance, mirrorNodeInstance, logger, '0x12a', registry, cacheService);
    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: 'throwException' });
  });

  const contractEvmAddress = '0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9';
  const defaultTxHash = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
  const defaultTransaction = {
    accessList: [],
    blockHash: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
    blockNumber: '0x11',
    chainId: '0x12a',
    from: `${defaultEvmAddress}`,
    gas: '0x7b',
    gasPrice: '0x4a817c80',
    hash: defaultTxHash,
    input: '0x0707',
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
    nonce: 1,
    r: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
    s: '0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354',
    to: '0x0000000000000000000000000000000000001389',
    transactionIndex: '0x1',
    type: 2,
    v: 1,
    value: '0x77359400',
  };

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

  const defaultDetailedContractResultByHashReverted = {
    ...defaultDetailedContractResultByHash,
    ...{
      result: 'CONTRACT_REVERT_EXECUTED',
      status: '0x0',
      error_message:
        '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d6520726576657274206d65737361676500000000000000000000000000',
    },
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
    sandbox.stub(ethImpl, <any>'getBlockByHash').resolves(defaultBlock);
    sandbox.stub(ethImpl, <any>'getFeeWeibars').resolves(gasPrice);
  };

  this.afterEach(() => {
    restMock.resetHandlers();
    sandbox.restore();
    cacheService.clear();
  });

  it('should execute "eth_chainId"', async function () {
    const chainId = Relay.eth().chainId();

    expect(chainId).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
  });

  it('should execute "eth_accounts"', async function () {
    const accounts = Relay.eth().accounts();

    expect(accounts).to.be.an('Array');
    expect(accounts.length).to.be.equal(0);
  });

  it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
    const result = await Relay.eth().getUncleByBlockHashAndIndex();
    expect(result).to.be.null;
  });

  it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
    const result = await Relay.eth().getUncleByBlockNumberAndIndex();
    expect(result).to.be.null;
  });

  it('should execute "eth_getUncleCountByBlockHash"', async function () {
    const result = await Relay.eth().getUncleCountByBlockHash();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_getUncleCountByBlockNumber"', async function () {
    const result = await Relay.eth().getUncleCountByBlockNumber();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_hashrate"', async function () {
    const result = await Relay.eth().hashrate();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_mining"', async function () {
    const result = await Relay.eth().mining();
    expect(result).to.eq(false);
  });

  it('should execute "eth_submitWork"', async function () {
    const result = await Relay.eth().submitWork();
    expect(result).to.eq(false);
  });

  it('should execute "eth_syncing"', async function () {
    const result = await Relay.eth().syncing();
    expect(result).to.eq(false);
  });

  it('should execute "eth_getWork"', async function () {
    const result = Relay.eth().getWork();
    expect(result).to.have.property('code');
    expect(result.code).to.be.equal(-32601);
    expect(result).to.have.property('name');
    expect(result.name).to.be.equal('Method not found');
    expect(result).to.have.property('message');
    expect(result.message).to.be.equal('Unsupported JSON-RPC method');
  });

  it('should execute "eth_maxPriorityFeePerGas"', async function () {
    const result = await Relay.eth().maxPriorityFeePerGas();
    expect(result).to.eq('0x0');
  });

  const unsupportedMethods = [
    'submitHashrate',
    'signTransaction',
    'sign',
    'sendTransaction',
    'protocolVersion',
    'coinbase',
  ];

  unsupportedMethods.forEach((method) => {
    it(`should execute "eth_${method}" and return unsupported message`, async function () {
      const result = await Relay.eth()[method]();
      expectUnsupportedMethod(result);
    });
  });

  describe('eth_getTransactionReceipt', async function () {
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
      let getBlockByHash = sandbox.stub(ethImpl, <any>'getBlockByHash').resolves(blockByHashFromRelay);
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
      const expectedFormat = parseInt(blockByHashFromRelay.timestamp, 16).toString();
      expect(getFeeWeibars.calledWith(`eth_GetTransactionReceipt`, undefined, expectedFormat)).to.be.true;
    });
  });

  describe('eth_getTransactionByHash', async function () {
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
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}${noTransactions}`).reply(200, {
        evm_address: `${defaultTransaction.from}`,
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
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      const resBeforeCache = await ethImpl.getTransactionByHash(defaultTxHash);
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}${noTransactions}`).reply(404);
      const resAfterCache = await ethImpl.getTransactionByHash(defaultTxHash);
      expect(resBeforeCache).to.deep.equal(resAfterCache);
    });

    it('returns correct transaction for existing hash', async function () {
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      RelayAssertions.assertTransaction(result, defaultTransaction);
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
        ...defaultTransaction,
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
      expect(result.gas).to.eq('0x0');
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
      expect(result.value).to.eq('0x0');
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
      expect(result.v).to.eq('0x0');
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
      expect(result.transactionIndex).to.be.null;
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
      expect(result.blockNumber).to.be.null;
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
      expect(result.blockNumber).to.be.null;
      expect(result.transactionIndex).to.be.null;
    });

    it('returns reverted transactions', async function () {
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHashReverted);

      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      RelayAssertions.assertTransaction(result, defaultTransaction);
    });

    it('throws error for reverted transactions when DEV_MODE=true', async function () {
      const initialDevModeValue = process.env.DEV_MODE;
      process.env.DEV_MODE = 'true';

      const uniqueTxHash = '0xa8cad7b827375d12d73af57b6a3f84353645fd31305ea58ff52dda53ec640533';
      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, defaultDetailedContractResultByHashReverted);
      const args = [uniqueTxHash];
      const errMessage = defaultDetailedContractResultByHashReverted.error_message;
      const data = defaultDetailedContractResultByHashReverted.error_message;
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

      const transaction = await ethImpl.getTransactionByHash(defaultTxHash);

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
    });
  });
});
