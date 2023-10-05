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
import { expect } from 'chai';
import { Registry } from 'prom-client';
import { MirrorNodeClient } from '../../../../src/lib/clients/mirrorNodeClient';
import pino from 'pino';
import { TracerType } from '../../../../src/lib/constants';
import { DebugService } from '../../../../src/lib/services/debugService';
import { defaultEvmAddress, getRequestId, toHex, defaultBlock, defaultLogTopics, defaultLogs1 } from '../../../helpers';
import RelayAssertions from '../../../assertions';
import { JsonRpcError, predefined } from '../../../../src';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import { CommonService } from '../../../../src/lib/services/ethService';
import chaiAsPromised from 'chai-as-promised';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
chai.use(chaiAsPromised);

const logger = pino();
const registry = new Registry();

let restMock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let debugService: DebugService;
let cacheService: CacheService;

describe('Debug API Test Suite', async function () {
  this.timeout(10000);

  const transactionHash = '0xb7a433b014684558d4154c73de3ed360bd5867725239938c2143acb7a76bca82';
  const nonExistentTransactionHash = '0xb8a433b014684558d4154c73de3ed360bd5867725239938c2143acb7a76bca82';
  const contractAddress = '0x0000000000000000000000000000000000000409';
  const senderAddress = '0x00000000000000000000000000000000000003f8';
  const contractAddress2 = '0x000000000000000000000000000000000000040a';
  const tracerConfigTrue = { onlyTopCall: true };
  const tracerConfigFalse = { onlyTopCall: false };
  const callTracer: TracerType = TracerType.CallTracer;
  const opcodeLogger: TracerType = TracerType.OpcodeLogger;
  const CONTARCTS_RESULTS_ACTIONS = `contracts/results/${transactionHash}/actions`;
  const CONTRACTS_RESULTS_BY_HASH = `contracts/results/${transactionHash}`;
  const CONTRACT_BY_ADDRESS = `contracts/${contractAddress}`;
  const SENDER_BY_ADDRESS = `accounts/${senderAddress}?transactions=false`;
  const CONTRACT_BY_ADDRESS2 = `contracts/${contractAddress2}`;
  const CONTRACTS_RESULTS_BY_NON_EXISTENT_HASH = `contracts/results/${nonExistentTransactionHash}`;
  const CONTRACT_RESULTS_BY_ACTIONS_NON_EXISTENT_HASH = `contracts/results/${nonExistentTransactionHash}/actions`;

  const contractsResultsByHashResult = {
    address: '0x637a6a8e5a69c087c24983b05261f63f64ed7e9b',
    amount: 0,
    call_result: '0x2',
    error_message: null,
    from: '0x00000000000000000000000000000000000003f8',
    function_parameters: '0x1',
    gas_limit: 300000,
    gas_used: 240000,
    timestamp: '1696438011.462526383',
    to: '0x0000000000000000000000000000000000000409',
    hash: '0xe815a3403c81f277902000d7916606e9571c3a8c0854ef6871595466a43b5b1f',
    block_hash: '0xa4c97b684587a2f1fc42e14ae743c336b97c58f752790482d12e44919f2ccb062807df5c9c0fa9a373b4d9726707f8b5',
    block_number: 668,
    logs: [],
    result: 'SUCCESS',
    transaction_index: 5,
    status: '0x1',
    failed_initcode: null,
    access_list: '0x',
    block_gas_used: 240000,
    chain_id: '0x12a',
    gas_price: '0x',
    max_fee_per_gas: '0x47',
    max_priority_fee_per_gas: '0x47',
    type: 2,
    nonce: 0,
  };
  const contractsResultsActionsResult = {
    actions: [
      {
        call_depth: 0,
        call_operation_type: 'CREATE',
        call_type: 'CREATE',
        caller: '0.0.1016',
        caller_type: 'ACCOUNT',
        from: '0x00000000000000000000000000000000000003f8',
        gas: 247000,
        gas_used: 77324,
        index: 0,
        input: '0x',
        recipient: '0.0.1033',
        recipient_type: 'CONTRACT',
        result_data: '0x',
        result_data_type: 'OUTPUT',
        timestamp: '1696438011.462526383',
        to: '0x0000000000000000000000000000000000000409',
        value: 0,
      },
      {
        call_depth: 1,
        call_operation_type: 'CREATE',
        call_type: 'CREATE',
        caller: '0.0.1033',
        caller_type: 'CONTRACT',
        from: '0x0000000000000000000000000000000000000409',
        gas: 189733,
        gas_used: 75,
        index: 1,
        input: '0x',
        recipient: '0.0.1034',
        recipient_type: 'CONTRACT',
        result_data: '0x',
        result_data_type: 'OUTPUT',
        timestamp: '1696438011.462526383',
        to: '0x000000000000000000000000000000000000040a',
        value: 0,
      },
    ],
  };

  const accountsResult = {
    account: '0.0.1016',
    alias: 'HIQQGUYDVWQLUWBHCSHSKS655OZEV2SZ6DADL7HN33PPLND7JUXPLU2O',
    auto_renew_period: 7776000,
    balance: {
      balance: 999948880000,
      timestamp: '1696451386.125213473',
      tokens: [],
    },
    created_timestamp: '1696437345.028770670',
    decline_reward: false,
    deleted: false,
    ethereum_nonce: 3,
    evm_address: '0xc37f417fa09933335240fca72dd257bfbde9c275',
    expiry_timestamp: '1704213345.028770670',
    key: {
      _type: 'ECDSA_SECP256K1',
      key: '035303ada0ba5827148f254bddebb24aea59f0c035fceddedef5b47f4d2ef5d34e',
    },
    max_automatic_token_associations: 0,
    memo: 'auto-created account',
    pending_reward: 0,
    receiver_sig_required: false,
    staked_account_id: null,
    staked_node_id: null,
    stake_period_start: null,
    transactions: [],
  };
  const contractResult = {
    admin_key: null,
    auto_renew_account: null,
    auto_renew_period: 7776000,
    contract_id: '0.0.1033',
    created_timestamp: '1696438011.462526385',
    deleted: false,
    evm_address: '0x637a6a8e5a69c087c24983b05261f63f64ed7e9b',
    expiration_timestamp: '1704214011.462526385',
    file_id: null,
    max_automatic_token_associations: 0,
    memo: 'auto-created account',
    nonce: 2,
    obtainer_id: null,
    permanent_removal: null,
    proxy_account_id: null,
    timestamp: {
      from: '1696438011.462526385',
      to: null,
    },
    bytecode: '0x',
    runtime_bytecode: '0x',
  };

  const contractResultSecond = {
    admin_key: null,
    auto_renew_account: null,
    auto_renew_period: 7776000,
    contract_id: '0.0.1034',
    created_timestamp: '1696438011.462526384',
    deleted: false,
    evm_address: '0x91b1c451777122afc9b83f9b96160d7e59847ad7',
    expiration_timestamp: '1704214011.462526384',
    file_id: null,
    max_automatic_token_associations: 0,
    memo: 'auto-created account',
    nonce: 1,
    obtainer_id: null,
    permanent_removal: null,
    proxy_account_id: null,
    timestamp: {
      from: '1696438011.462526384',
      to: null,
    },
    bytecode: '0x',
    runtime_bytecode: '0x',
  };

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
    const common = new CommonService(mirrorNodeInstance, logger, cacheService);
    debugService = new DebugService(mirrorNodeInstance, logger, common);
  });

  describe('debug_traceTransaction', async function () {
    beforeEach(() => {
      restMock.onGet(CONTARCTS_RESULTS_ACTIONS).reply(200, contractsResultsActionsResult);
      restMock.onGet(CONTRACTS_RESULTS_BY_HASH).reply(200, contractsResultsByHashResult);
      restMock.onGet(CONTRACT_BY_ADDRESS).reply(200, contractResult);
      restMock.onGet(SENDER_BY_ADDRESS).reply(200, accountsResult);
      restMock.onGet(CONTRACT_BY_ADDRESS2).reply(200, contractResultSecond);
      restMock.onGet(`contracts/${senderAddress}`).reply(404, {
        _status: {
          messages: [
            {
              message: 'Not found',
            },
          ],
        },
      });
    });

    afterEach(() => {
      restMock.reset();
    });

    describe('all methods require a debug flag', async function () {
      let ffAtStart;

      before(function () {
        ffAtStart = process.env.DEBUG_API_ENABLED;
      });

      after(function () {
        process.env.DEBUG_API_ENABLED = ffAtStart;
      });

      it('DEBUG_API_ENABLED is not specified', async function () {
        delete process.env.DEBUG_API_ENABLED;
        await RelayAssertions.assertRejection(
          predefined.UNSUPPORTED_METHOD,
          debugService.debug_traceTransaction,
          true,
          debugService,
          [transactionHash, callTracer, tracerConfigFalse, getRequestId()],
        );
      });

      it('DEBUG_API_ENABLED=true', async function () {
        process.env.DEBUG_API_ENABLED = 'true';

        const traceTransaction = await debugService.debug_traceTransaction(
          transactionHash,
          callTracer,
          tracerConfigFalse,
          getRequestId(),
        );
        expect(traceTransaction).to.exist;
      });

      it('DEBUG_API_ENABLED=false', async function () {
        process.env.DEBUG_API_ENABLED = 'false';
        await RelayAssertions.assertRejection(
          predefined.UNSUPPORTED_METHOD,
          debugService.debug_traceTransaction,
          true,
          debugService,
          [transactionHash, callTracer, tracerConfigFalse, getRequestId()],
        );
      });
    });

    describe('callTracer', async function () {
      it('Test call tracer with onlyTopCall false', async function () {
        const expectedResult = {
          type: 'CREATE',
          from: '0xc37f417fa09933335240fca72dd257bfbde9c275',
          to: '0x637a6a8e5a69c087c24983b05261f63f64ed7e9b',
          value: '0x0',
          gas: '0x493e0',
          gasUsed: '0x3a980',
          input: '0x1',
          output: '0x2',
          calls: [
            {
              type: 'CREATE',
              from: '0x637a6a8e5a69c087c24983b05261f63f64ed7e9b',
              to: '0x91b1c451777122afc9b83f9b96160d7e59847ad7',
              gas: '0x2e525',
              gasUsed: '0x4b',
              input: '0x',
              output: '0x',
              value: '0x0',
            },
          ],
        };
        const result = await debugService.debug_traceTransaction(
          transactionHash,
          callTracer,
          tracerConfigFalse,
          getRequestId(),
        );

        expect(result).to.deep.equal(expectedResult);
      });

      it('Test call tracer with onlyTopCall true', async function () {
        const expectedResult = {
          type: 'CREATE',
          from: '0xc37f417fa09933335240fca72dd257bfbde9c275',
          to: '0x637a6a8e5a69c087c24983b05261f63f64ed7e9b',
          value: '0x0',
          gas: '0x493e0',
          gasUsed: '0x3a980',
          input: '0x1',
          output: '0x2',
          calls: undefined,
        };
        const result = await debugService.debug_traceTransaction(
          transactionHash,
          callTracer,
          tracerConfigTrue,
          getRequestId(),
        );

        expect(result).to.deep.equal(expectedResult);
      });
    });

    describe('opcodeLogger', async function () {
      beforeEach(() => {
        restMock.onGet(CONTARCTS_RESULTS_ACTIONS).reply(200, contractsResultsActionsResult);
        restMock.onGet(CONTRACTS_RESULTS_BY_HASH).reply(200, contractsResultsByHashResult);
      });

      afterEach(() => {
        restMock.reset();
      });

      it('Test opcodeLogger', async function () {
        const expectedError = predefined.INTERNAL_ERROR('opcodeLogger is currently not supported');
        await RelayAssertions.assertRejection(expectedError, debugService.debug_traceTransaction, true, debugService, [
          transactionHash,
          opcodeLogger,
          tracerConfigTrue,
          getRequestId(),
        ]);
      });
    });

    describe('Invalid scenarios', async function () {
      beforeEach(() => {
        const notFound = {
          _status: {
            messages: [
              {
                message: 'Not found',
              },
            ],
          },
        };
        restMock.onGet(CONTRACTS_RESULTS_BY_NON_EXISTENT_HASH).reply(404, notFound);
        restMock.onGet(CONTRACT_RESULTS_BY_ACTIONS_NON_EXISTENT_HASH).reply(404, notFound);
      });

      afterEach(() => {
        restMock.reset();
      });

      it('test case for non-existing transaction hash', async function () {
        const expectedError = predefined.INTERNAL_ERROR('Not found');

        await RelayAssertions.assertRejection(expectedError, debugService.debug_traceTransaction, true, debugService, [
          nonExistentTransactionHash,
          callTracer,
          tracerConfigTrue,
          getRequestId(),
        ]);
      });
    });
  });
});
