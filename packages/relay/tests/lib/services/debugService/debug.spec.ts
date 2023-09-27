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
  const tracerConfigTrue = { onlyTopCall: true };
  const tracerConfigFalse = { onlyTopCall: false };
  const callTracer: TracerType = TracerType.CallTracer;
  const opcodeLogger: TracerType = TracerType.OpcodeLogger;
  const CONTARCTS_RESULTS_ACTIONS = `contracts/results/${transactionHash}/actions`;
  const CONTRACTS_RESULTS_BY_HASH = `contracts/results/${transactionHash}`;
  const CONTRACTS_RESULTS_BY_NON_EXISTENT_HASH = `contracts/results/${nonExistentTransactionHash}`;
  const CONTRACT_RESULTS_BY_ACTIONS_NON_EXISTENT_HASH = `contracts/results/${nonExistentTransactionHash}/actions`;

  const contractsResultsByHashResult = {
    address: '0x637a6a8e5a69c087c24983b05261f63f64ed7e9b',
    amount: 0,
    bloom:
      '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    call_result: '0x000000000000000000000000637a6a8e5a69c087c24983b05261f63f64ed7e9b',
    contract_id: '0.0.1032',
    created_contract_ids: [],
    error_message: null,
    from: '0x00000000000000000000000000000000000003f7',
    function_parameters: '0x5c929889',
    gas_limit: 300000,
    gas_used: 240000,
    timestamp: '1695626842.324789307',
    to: '0x0000000000000000000000000000000000000408',
    hash: '0xf634a6a58aeeb723b1221a3a18a86fa1bd83e9e2f95dd021cf325e60352e3df6',
    block_hash: '0xfce40b1e7236a8ef62e98078ff551efc8038185dd8f0c5cbd527f93b62d8be19f70c7217790538b9c2723d5bb86b28ff',
    block_number: 381,
    logs: [],
    result: 'SUCCESS',
    transaction_index: 4,
    state_changes: [
      {
        address: '0x637a6a8e5a69c087c24983b05261f63f64ed7e9b',
        contract_id: '0.0.1032',
        slot: '0x0000000000000000000000000000000000000000000000000000000000000001',
        value_read: '0x00000000000000000000000091b1c451777122afc9b83f9b96160d7e59847ad7',
        value_written: null,
      },
    ],
    status: '0x1',
    failed_initcode: null,
    access_list: '0x',
    block_gas_used: 240000,
    chain_id: '0x12a',
    gas_price: '0x1312d0',
    max_fee_per_gas: '0x',
    max_priority_fee_per_gas: '0x',
    r: '0x33effe0b5958ab86ce01590d46dbb1328097c4c3ada5b0d5e407c05147bcd94a',
    s: '0x05f6aa6e805e64f1fb71ff8d3433378ccd2050faf4471b461ca0b1cc9800f4b4',
    type: 0,
    v: 0,
    nonce: 1,
  };
  const contractsResultsActionsResult = {
    actions: [
      {
        call_depth: 0,
        call_operation_type: 'CALL',
        call_type: 'CALL',
        caller: '0.0.1015',
        caller_type: 'ACCOUNT',
        from: '0x00000000000000000000000000000000000003f7',
        gas: 279000,
        gas_used: 5439,
        index: 0,
        input: '0x5c929889',
        recipient: '0.0.1032',
        recipient_type: 'CONTRACT',
        result_data: '0x000000000000000000000000637a6a8e5a69c087c24983b05261f63f64ed7e9b',
        result_data_type: 'OUTPUT',
        timestamp: '1695626842.324789307',
        to: '0x0000000000000000000000000000000000000408',
        value: 0,
      },
      {
        call_depth: 1,
        call_operation_type: 'DELEGATECALL',
        call_type: 'CALL',
        caller: '0.0.1032',
        caller_type: 'CONTRACT',
        from: '0x0000000000000000000000000000000000000408',
        gas: 50000,
        gas_used: 148,
        index: 1,
        input: '0x38cc4831',
        recipient: '0.0.1033',
        recipient_type: 'CONTRACT',
        result_data: '0x000000000000000000000000637a6a8e5a69c087c24983b05261f63f64ed7e9b',
        result_data_type: 'OUTPUT',
        timestamp: '1695626842.324789307',
        to: '0x0000000000000000000000000000000000000409',
        value: 0,
      },
    ],
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
    web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: 'throwException' });

    // @ts-ignore
    const common = new CommonService(mirrorNodeInstance, logger, cacheService);
    debugService = new DebugService(mirrorNodeInstance, logger, cacheService, common);
  });

  describe('debug_traceTransaction', async function () {
    beforeEach(() => {
      restMock.onGet(CONTARCTS_RESULTS_ACTIONS).reply(200, contractsResultsActionsResult);
      restMock.onGet(CONTRACTS_RESULTS_BY_HASH).reply(200, contractsResultsByHashResult);
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
          from: '0x00000000000000000000000000000000000003f7',
          to: '0x0000000000000000000000000000000000000408',
          value: '0x0',
          gas: '0x493e0',
          gasUsed: '0x3a980',
          input: '0x5c929889',
          output: '0x000000000000000000000000637a6a8e5a69c087c24983b05261f63f64ed7e9b',
          error: null,
          revertReason: null,
          calls: [
            {
              type: 'CALL',
              from: '0x00000000000000000000000000000000000003f7',
              to: '0x0000000000000000000000000000000000000408',
              gas: 279000,
              gasUsed: 5439,
              input: '0x5c929889',
              output: '0x000000000000000000000000637a6a8e5a69c087c24983b05261f63f64ed7e9b',
            },
            {
              type: 'DELEGATECALL',
              from: '0x0000000000000000000000000000000000000408',
              to: '0x0000000000000000000000000000000000000409',
              gas: 50000,
              gasUsed: 148,
              input: '0x38cc4831',
              output: '0x000000000000000000000000637a6a8e5a69c087c24983b05261f63f64ed7e9b',
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
          from: '0x00000000000000000000000000000000000003f7',
          to: '0x0000000000000000000000000000000000000408',
          value: '0x0',
          gas: '0x493e0',
          gasUsed: '0x3a980',
          input: '0x5c929889',
          output: '0x000000000000000000000000637a6a8e5a69c087c24983b05261f63f64ed7e9b',
          error: null,
          revertReason: null,
          calls: [
            {
              type: 'CALL',
              from: '0x00000000000000000000000000000000000003f7',
              to: '0x0000000000000000000000000000000000000408',
              gas: 279000,
              gasUsed: 5439,
              input: '0x5c929889',
              output: '0x000000000000000000000000637a6a8e5a69c087c24983b05261f63f64ed7e9b',
            },
          ],
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
