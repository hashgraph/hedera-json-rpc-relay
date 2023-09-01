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
import chai from "chai";
import path from "path";
import dotenv from "dotenv";
import MockAdapter from "axios-mock-adapter";
import { assert, expect } from "chai";
import { Registry } from "prom-client";
import sinon from "sinon";
dotenv.config({ path: path.resolve(__dirname, "../test.env") });
import { RelayImpl } from "../../src/lib/relay";
import { predefined } from "../../src/lib/errors/JsonRpcError";
import { EthImpl } from "../../src/lib/eth";
import { MirrorNodeClient } from "../../src/lib/clients/mirrorNodeClient";
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
} from "../helpers";

import pino from "pino";
import { Log, Transaction, Transaction1559, Transaction2930 } from "../../src/lib/model";
import constants from "../../src/lib/constants";
import { SDKClient } from "../../src/lib/clients";
import { SDKClientError } from "../../src/lib/errors/SDKClientError";
import HAPIService from "../../src/lib/services/hapiService/hapiService";
import HbarLimit from "../../src/lib/hbarlimiter";
import { Hbar, HbarUnit, TransactionId } from "@hashgraph/sdk";
import chaiAsPromised from "chai-as-promised";
import RelayAssertions from "../assertions";
import { v4 as uuid } from "uuid";
import { JsonRpcError } from "../../dist";
import { hashNumber, numberTo0x, nullableNumberTo0x, toHash32 } from "../../dist/formatters";
import * as _ from "lodash";
import { CacheService } from "../../src/lib/services/cacheService/cacheService";

chai.use(chaiAsPromised);

const logger = pino();
const registry = new Registry();
const Relay = new RelayImpl(logger, registry);

const noTransactions = "?transactions=false";

let restMock: MockAdapter, web3Mock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let hapiServiceInstance: HAPIService;
let sdkClientStub;
let getSdkClientStub;
let cacheService: CacheService;
let defaultLogs, defaultDetailedContractResults2, defaultDetailedContractResults3;

describe("Eth calls using MirrorNode", async function () {
  this.timeout(10000);

  let ethImpl: EthImpl;
  let ethImplLowTransactionCount: EthImpl;
  const ethFeeHistoryValue = process.env.ETH_FEE_HISTORY_FIXED || "true";

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
    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: "throwException" });

    // @ts-ignore
    web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: "throwException" });

    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TINYBAR;
    const hbarLimiter = new HbarLimit(logger.child({ name: "hbar-rate-limit" }), Date.now(), total, duration, registry);

    hapiServiceInstance = new HAPIService(logger, registry, hbarLimiter, cacheService);

    process.env.ETH_FEE_HISTORY_FIXED = "false";

    // @ts-ignore
    ethImpl = new EthImpl(hapiServiceInstance, mirrorNodeInstance, logger, "0x12a", registry, cacheService);
  });

  this.afterAll(() => {
    process.env.ETH_FEE_HISTORY_FIXED = ethFeeHistoryValue;
  });

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, "getSDKClient").returns(sdkClientStub);
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
  });

  const TINYBAR_TO_WEIBAR_COEF_BIGINT = BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
  const blockHashTrimmed = "0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b";
  const blockHash = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6b`;
  const blockHash2 = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6c`;
  const blockHash3 = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6d`;
  const blockHashPreviousTrimmed = "0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298";
  const blockNumber = 3;
  const blockNumber2 = 4;
  const blockNumber3 = 5;
  const blockNumberHex = `0x${blockNumber.toString(16)}`;
  const blockTransactionCount = 77;
  const gasUsed1 = 200000;
  const gasUsed2 = 800000;
  const maxGasLimit = 250000;
  const maxGasLimitHex = numberTo0x(maxGasLimit);
  const contractCallData = "0xef641f44";
  const blockTimestamp = "1651560386";
  const blockTimestampHex = numberTo0x(Number(blockTimestamp));
  const firstTransactionTimestampSeconds = "1653077541";
  const contractAddress1 = "0x000000000000000000000000000000000000055f";
  const htsTokenAddress = "0x0000000000000000000000000000000002dca431";
  const contractTimestamp1 = `${firstTransactionTimestampSeconds}.983983199`;
  const contractTimestamp4 = `${firstTransactionTimestampSeconds}.983983198`;
  const contractHash1 = "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392";
  const contractHash2 = "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393";
  const contractHash3 = "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394";
  const contractAddress2 = "0x000000000000000000000000000000000000055e";
  const contractAddress3 = "0x000000000000000000000000000000000000255c";
  const wrongContractAddress = "0x00000000000000000000000000000000055e";
  const contractTimestamp2 = "1653077542.701408897";
  const contractTimestamp3 = "1653088542.123456789";
  const contractId1 = "0.0.1375";
  const contractId2 = "0.0.1374";
  const gasUsedRatio = 0.5;
  const deployedBytecode =
    "0x608060405234801561001057600080fd5b5060405161078938038061078983398181016040528101906100329190";
  const mirrorNodeDeployedBytecode =
    "0x608060405234801561001057600080fd5b5060405161078938038061078983398181016040528101906100321234";
  const accountAddress1 = "0x13212A14deaf2775a5b3bEcC857806D5c719d3f2";
  const receiverAddress = "0x5b98Ce3a4D1e1AC55F15Da174D5CeFcc5b8FB994";

  const defaultBlock = {
    count: blockTransactionCount,
    hapi_version: "0.28.1",
    hash: blockHash,
    name: "2022-05-03T06_46_26.060890949Z.rcd",
    number: blockNumber,
    previous_hash: "0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b",
    size: null,
    timestamp: {
      from: `${blockTimestamp}.060890949`,
      to: "1651560389.060890949",
    },
    gas_used: gasUsed1 + gasUsed2,
    logs_bloom: "0x",
  };

  const olderBlock = {
    count: blockTransactionCount,
    hapi_version: "0.28.1",
    hash: blockHash,
    name: "2022-05-03T06_46_26.060890949Z.rcd",
    number: blockNumber,
    previous_hash: "0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b",
    size: null,
    timestamp: {
      from: `${contractTimestamp4}`,
      to: "1651560389.060890949",
    },
    gas_used: gasUsed1 + gasUsed2,
    logs_bloom: "0x",
  };

  const blockZero = {
    count: 5,
    hapi_version: "0.28.1",
    hash: "0x4a7eed88145253eca01a6b5995865b68b041923772d0e504d2ae5fbbf559b68b397adfce5c52f4fa8acec860e6fbc395",
    name: "2020-08-27T23_40_52.347251002Z.rcd",
    number: 0,
    previous_hash: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    size: null,
    timestamp: {
      from: "1598571652.347251002",
      to: "1598571654.548395000",
    },
    gas_used: 0,
    logs_bloom: "0x",
  };

  const mostRecentBlock = {
    blocks: [
      {
        count: 8,
        gas_used: 0,
        hapi_version: "0.35.0",
        hash: "0xd9f84ed7415f33ae171a34c5daa4030a3a3028536d737bacf28b08c68309c629d6b2d9e01cb4ad7eb5e4fc21749b8c33",
        logs_bloom: "0x",
        name: "2023-03-22T19_21_10.216373003Z.rcd.gz",
        number: 6,
        previous_hash:
          "0xe5ec054c17063d3912eb13760f9f62779f12c60f4d13f882d3fe0aba15db617b9f2b62d9f51d2aac05f7499147c6aa28",
        size: 3085,
        timestamp: {
          from: "1679512870.216373003",
          to: "1679512871.851262003",
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
          "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        call_result: "0x",
        contract_id: null,
        created_contract_ids: [],
        error_message:
          "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002645524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000",
        from: "0x0000000000000000000000000000000000000557",
        function_parameters: "0x",
        gas_limit: maxGasLimit,
        gas_used: gasUsed1,
        hash: contractHash1,
        timestamp: `${contractTimestamp1}`,
        to: null,
        block_gas_used: 400000,
        block_hash: blockHash,
        block_number: blockNumber,
        chain_id: "0x12a",
        failed_initcode: null,
        gas_price: "0x4a817c80",
        max_fee_per_gas: "0x59",
        max_priority_fee_per_gas: "0x33",
        nonce: 5,
        r: "0xb5c21ab4dfd336e30ac2106cad4aa8888b1873a99bce35d50f64d2ec2cc5f6d9",
        result: "SUCCESS",
        s: "0x1092806a99727a20c31836959133301b65a2bfa980f9795522d21a254e629110",
        status: "0x1",
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
    address: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
    amount: 20,
    bloom:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    call_result: "0x",
    contract_id: "0.0.1012",
    created_contract_ids: [],
    error_message: null,
    from: "0x00000000000000000000000000000000000003f7",
    function_parameters: "0x",
    gas_limit: 250000,
    gas_used: 200000,
    timestamp: "1692959189.214316721",
    to: "0x00000000000000000000000000000000000003f4",
    hash: "0x7e8a09541c80ccda1f5f40a1975e031ed46de5ad7f24cd4c37be9bac65149b9e",
    block_hash: "0xa414a76539f84ae1c797fa10d00e49d5e7a1adae556dcd43084551e671623d2eba825bcb7bbfd5b7e3fe59d63d8a167f",
    block_number: 61033,
    logs: [],
    result: "SUCCESS",
    transaction_index: 2,
    state_changes: [],
    status: "0x1",
    failed_initcode: null,
    block_gas_used: 200000,
    chain_id: "0x12a",
    gas_price: "0x",
    r: "0x85b423416d0164d0b2464d880bccb0679587c00673af8e016c8f0ce573be69b2",
    s: "0x3897a5ce2ace1f242d9c989cd9c163d79760af4266f3bf2e69ee288bcffb211a",
    type: 2,
    v: 1,
    nonce: 9,
  };

  const defaultLogTopics = [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000000000000000000000000208fa13",
    "0x0000000000000000000000000000000000000000000000000000000000000005",
  ];

  const defaultLogTopics1 = [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x000000000000000000000000000000000000000000000000000000000208fa13",
  ];

  const defaultNullLogTopics = [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x000000000000000000000000000000000000000000000000000000000208fa13",
    null,
    null,
  ];

  const logBloom4 = "0x4444";
  const defaultLogs4 = [
    {
      address: "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69",
      bloom: logBloom4,
      contract_id: contractId2,
      data: "0x",
      index: 0,
      topics: defaultLogTopics1,
      root_contract_id: "0.0.34806097",
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
        slot: "0x0000000000000000000000000000000000000000000000000000000000000101",
        value: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
      },
    ],
  };

  const defaultOlderContractState = {
    state: [
      {
        address: contractAddress1,
        contract_id: contractId1,
        timestamp: contractTimestamp4,
        slot: "0x0000000000000000000000000000000000000000000000000000000000000101",
        value: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
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

  const detailedContractResultNotFound = { _status: { messages: [{ message: "No correlating transaction" }] } };

  const results = defaultContractResults.results;
  const totalGasUsed = numberTo0x(results[0].gas_used + results[1].gas_used);

  const defaultNetworkFees = {
    fees: [
      {
        gas: 77,
        transaction_type: "ContractCall",
      },
      {
        gas: 771,
        transaction_type: "ContractCreate",
      },
      {
        gas: 57,
        transaction_type: "EthereumTransaction",
      },
    ],
    timestamp: "1653644164.591111113",
  };
  const baseFeePerGasHex = numberTo0x(BigInt(defaultNetworkFees.fees[2].gas) * TINYBAR_TO_WEIBAR_COEF_BIGINT); // '0x84b6a5c400' -> 570_000_000_000 tb

  const defaultContract = {
    admin_key: null,
    auto_renew_account: null,
    auto_renew_period: 7776000,
    contract_id: "0.0.1052",
    created_timestamp: "1659622477.294172233",
    deleted: false,
    evm_address: null,
    expiration_timestamp: null,
    file_id: "0.0.1051",
    max_automatic_token_associations: 0,
    memo: "",
    obtainer_id: null,
    permanent_removal: null,
    proxy_account_id: null,
    timestamp: {
      from: "1659622477.294172233",
      to: null,
    },
    bytecode: "0x123456",
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
    created_timestamp: "1659622477.294172233",
    deleted: false,
    evm_address: null,
    expiration_timestamp: null,
    file_id: "0.0.1051",
    max_automatic_token_associations: 0,
    memo: "",
    obtainer_id: null,
    permanent_removal: null,
    proxy_account_id: null,
    timestamp: {
      from: "1659622477.294172233",
      to: null,
    },
    bytecode: "0x123456",
    runtime_bytecode: "0x",
  };

  const defaultEthGetBlockByLogs = {
    logs: [defaultLogs.logs[0], defaultLogs.logs[1]],
  };

  const defaultHTSToken = mockData.token;

  this.afterEach(() => {
    restMock.resetHandlers();
  });

  this.beforeEach(() => {
    restMock.onGet("network/fees").reply(200, defaultNetworkFees);
  });

  it('"eth_blockNumber" should return the latest block number', async function () {
    restMock.onGet("blocks?limit=1&order=desc").reply(200, {
      blocks: [defaultBlock],
    });
    const blockNumber = await ethImpl.blockNumber();
    expect(blockNumber).to.be.eq(blockNumber);
  });

  it('"eth_blockNumber" should return the latest block number using cache', async function () {
    restMock.onGet("blocks?limit=1&order=desc").reply(200, {
      blocks: [defaultBlock],
    });
    const blockNumber = await ethImpl.blockNumber();
    expect(numberTo0x(defaultBlock.number)).to.be.eq(blockNumber);

    // Second call should return the same block number using cache
    restMock.onGet("blocks?limit=1&order=desc").reply(400, {
      blocks: [defaultBlock],
    });

    const blockNumber2 = await ethImpl.blockNumber();
    expect(blockNumber2).to.be.eq(blockNumber);

    // expire cache, instead of waiting for ttl we clear it to simulate expiry faster.
    cacheService.clear();
    // Third call should return new number using mirror node
    const newBlockNumber = 7;
    restMock.onGet("blocks?limit=1&order=desc").reply(200, {
      blocks: [{ ...defaultBlock, number: newBlockNumber }],
    });
    const blockNumber3 = await ethImpl.blockNumber();
    expect(numberTo0x(newBlockNumber)).to.be.eq(blockNumber3);
  });

  it('"eth_blockNumber" should throw an error if no blocks are found', async function () {
    restMock.onGet("blocks?limit=1&order=desc").reply(404, {
      _status: {
        messages: [
          {
            message: "Block not found",
          },
        ],
      },
    });

    const error = predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK;

    await RelayAssertions.assertRejection(error, ethImpl.blockNumber, true, ethImpl);
  });

  it('"eth_blockNumber" return the latest block number on second try', async function () {
    restMock
      .onGet("blocks?limit=1&order=desc")
      .replyOnce(404, {
        _status: {
          messages: [
            {
              message: "Block not found",
            },
          ],
        },
      })
      .onGet("blocks?limit=1&order=desc")
      .replyOnce(200, {
        blocks: [defaultBlock],
      });

    const blockNumber = await ethImpl.blockNumber();
    expect(blockNumber).to.be.eq(blockNumber);
  });

  it('"eth_blockNumber" should throw an error if no blocks are found after third try', async function () {
    restMock
      .onGet("blocks?limit=1&order=desc")
      .reply(404, {
        _status: {
          messages: [
            {
              message: "Block not found",
            },
          ],
        },
      })
      .onGet("blocks?limit=1&order=desc")
      .reply(404, {
        _status: {
          messages: [
            {
              message: "Block not found",
            },
          ],
        },
      })
      .onGet("blocks?limit=1&order=desc")
      .reply(404, {
        _status: {
          messages: [
            {
              message: "Block not found",
            },
          ],
        },
      })
      .onGet("blocks?limit=1&order=desc")
      .reply(404, {
        _status: {
          messages: [
            {
              message: "Block not found",
            },
          ],
        },
      });

    await RelayAssertions.assertRejection(
      predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK,
      ethImpl.blockNumber,
      true,
      ethImpl,
    );
  });

  describe("with match", async function () {
    beforeEach(function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, defaultEthGetBlockByLogs);
    });

    it("eth_getBlockByNumber with match", async function () {
      restMock
        .onGet(
          `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, defaultContractResults);

      const result = await ethImpl.getBlockByNumber(numberTo0x(blockNumber), false);

      RelayAssertions.assertBlock(result, {
        hash: blockHashTrimmed,
        gasUsed: totalGasUsed,
        number: blockNumberHex,
        parentHash: blockHashPreviousTrimmed,
        timestamp: blockTimestampHex,
        transactions: [contractHash1, contractHash2],
      });
    });

    it("eth_getBlockByNumber with match paginated", async function () {
      const next = `contracts/results?timestamp=lte:${defaultBlock.timestamp.to}&timestamp=gte:${defaultBlock.timestamp.from}&limit=100&order=asc`; // just flip the timestamp parameters for simplicity
      restMock
        .onGet(
          `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, { results: [], links: { next: next } });
      restMock.onGet(next).reply(200, defaultContractResults);
      const result = await ethImpl.getBlockByNumber(numberTo0x(blockNumber), false);

      RelayAssertions.assertBlock(result, {
        hash: blockHashTrimmed,
        gasUsed: totalGasUsed,
        number: blockNumberHex,
        parentHash: blockHashPreviousTrimmed,
        timestamp: blockTimestampHex,
        transactions: [contractHash1, contractHash2],
      });
    });

    it("eth_getBlockByNumber should return cached result", async function () {
      restMock
        .onGet(
          `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, defaultContractResults);
      const resBeforeCache = await ethImpl.getBlockByNumber(numberTo0x(blockNumber), false);

      restMock.onGet(`blocks/${blockNumber}`).reply(404);
      const resAfterCache = await ethImpl.getBlockByNumber(numberTo0x(blockNumber), false);

      expect(resBeforeCache).to.eq(resAfterCache);
    });

    it("eth_getBlockByHash with match", async function () {
      restMock
        .onGet(
          `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, defaultContractResults);

      const result = await ethImpl.getBlockByHash(blockHash, false);
      RelayAssertions.assertBlock(result, {
        hash: blockHashTrimmed,
        gasUsed: totalGasUsed,
        number: blockNumberHex,
        parentHash: blockHashPreviousTrimmed,
        timestamp: blockTimestampHex,
        transactions: [contractHash1, contractHash2],
      });
    });

    it("eth_getBlockByHash with match paginated", async function () {
      const next = `contracts/results?timestamp=lte:${defaultBlock.timestamp.to}&timestamp=gte:${defaultBlock.timestamp.from}&limit=100&order=asc`; // just flip the timestamp parameters for simplicity
      restMock
        .onGet(
          `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, { results: [], links: { next: next } });
      restMock.onGet(next).reply(200, defaultContractResults);

      const result = await ethImpl.getBlockByHash(blockHash, false);
      RelayAssertions.assertBlock(result, {
        hash: blockHashTrimmed,
        gasUsed: totalGasUsed,
        number: blockNumberHex,
        parentHash: blockHashPreviousTrimmed,
        timestamp: blockTimestampHex,
        transactions: [contractHash1, contractHash2],
      });
    });
  });

  it("eth_getBlockByNumber with zero transactions", async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, { ...defaultBlock, gas_used: 0 });
    restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { results: [] });
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { logs: [] });
    const result = await ethImpl.getBlockByNumber(numberTo0x(blockNumber), false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal("0x0");
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(0);
    expect(result.transactionsRoot).equal(EthImpl.ethEmptyTrie);

    // verify expected constants
    RelayAssertions.verifyBlockConstants(result);
  });

  it("eth_getBlockByNumber with match and details", async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);
    const result = await ethImpl.getBlockByNumber(numberTo0x(blockNumber), true);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as Transaction).hash).equal(contractHash1);
    expect((result.transactions[1] as Transaction).hash).equal(contractHash2);
    expect((result.transactions[1] as Transaction).gas).equal(hashNumber(gasUsed2));

    // verify expected constants
    RelayAssertions.verifyBlockConstants(result);
  });

  it("eth_getBlockByNumber with match and details paginated", async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
    const next = `contracts/results?timestamp=lte:${defaultBlock.timestamp.to}&timestamp=gte:${defaultBlock.timestamp.from}&limit=100&order=asc`; // just flip the timestamp parameters for simplicity
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { results: [], links: { next: next } });
    restMock.onGet(next).reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);
    const result = await ethImpl.getBlockByNumber(numberTo0x(blockNumber), true);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as Transaction).hash).equal(contractHash1);
    expect((result.transactions[1] as Transaction).hash).equal(contractHash2);
    expect((result.transactions[1] as Transaction).gas).equal(hashNumber(gasUsed2));

    // verify expected constants
    RelayAssertions.verifyBlockConstants(result);
  });

  it("eth_getBlockByNumber with block match and contract revert", async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, { ...defaultBlock, gas_used: gasUsed1 });
    restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResultsRevert);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { logs: [] });

    const result = await ethImpl.getBlockByNumber(numberTo0x(blockNumber), true);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(numberTo0x(gasUsed1));
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(1);

    // verify expected constants
    RelayAssertions.verifyBlockConstants(result);
  });

  it("eth_getBlockByNumber with no match", async function () {
    cacheService.clear();
    restMock.onGet(`blocks/${blockNumber}`).reply(400, {
      _status: {
        messages: [
          {
            message: "No such block exists",
          },
        ],
      },
    });
    restMock.onGet(`blocks?limit=1&order=desc`).reply(200, mostRecentBlock);

    const result = await ethImpl.getBlockByNumber(blockNumber.toString(), false);
    expect(result).to.equal(null);
  });

  it("eth_getBlockByNumber with latest tag", async function () {
    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);
    for (const result of defaultContractResults.results) {
      restMock
        .onGet(`contracts/${result.to}/results/${result.timestamp}`)
        .reply(404, { _status: { messages: [{ message: "Not found" }] } });
    }

    const result = await ethImpl.getBlockByNumber("latest", false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // check that we only made the expected number of requests with the expected urls
    expect(restMock.history.get.length).equal(4);
    expect(restMock.history.get[0].url).equal("blocks?limit=1&order=desc");
    expect(restMock.history.get[1].url).equal(
      "contracts/results?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc",
    );
    expect(restMock.history.get[2].url).equal(
      "contracts/results/logs?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc",
    );
    expect(restMock.history.get[3].url).equal("network/fees");

    expect(result.number).equal(blockNumberHex);
  });

  it("eth_getBlockByNumber with latest tag paginated", async function () {
    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
    const next = `contracts/results?timestamp=lte:${defaultBlock.timestamp.to}&timestamp=gte:${defaultBlock.timestamp.from}&limit=100&order=asc`; // just flip the timestamp parameters for simplicity
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { results: [], links: { next: next } });
    restMock.onGet(next).reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);
    for (const result of defaultContractResults.results) {
      restMock
        .onGet(`contracts/${result.to}/results/${result.timestamp}`)
        .reply(404, { _status: { messages: [{ message: "Not found" }] } });
    }

    const result = await ethImpl.getBlockByNumber("latest", false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    expect(result.number).equal(blockNumberHex);
  });

  it("eth_getBlockByNumber with pending tag", async function () {
    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);
    for (const result of defaultContractResults.results) {
      restMock
        .onGet(`contracts/${result.to}/results/${result.timestamp}`)
        .reply(404, { _status: { messages: [{ message: "Not found" }] } });
    }

    const result = await ethImpl.getBlockByNumber("pending", false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    expect(result.number).equal(blockNumberHex);
  });

  it("eth_getBlockByNumber with earliest tag", async function () {
    restMock.onGet(`blocks/0`).reply(200, defaultBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);
    for (const result of defaultContractResults.results) {
      restMock
        .onGet(`contracts/${result.to}/results/${result.timestamp}`)
        .reply(404, { _status: { messages: [{ message: "Not found" }] } });
    }

    const result = await ethImpl.getBlockByNumber("earliest", false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    expect(result.number).equal(blockNumberHex);
  });

  it("eth_getBlockByNumber with hex number", async function () {
    restMock.onGet(`blocks/3735929054`).reply(200, defaultBlock);
    restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
      blocks: [
        {
          number: 3735929055,
        },
      ],
    });
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);
    for (const result of defaultContractResults.results) {
      restMock
        .onGet(`contracts/${result.to}/results/${result.timestamp}`)
        .reply(404, { _status: { messages: [{ message: "Not found" }] } });
    }

    const result = await ethImpl.getBlockByNumber("0xdeadc0de", false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    expect(result.number).equal(blockNumberHex);
  });

  it("eth_getBlockByHash with match", async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock.onGet("network/fees").reply(200, defaultNetworkFees);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);

    const result = await ethImpl.getBlockByHash(blockHash, false);
    RelayAssertions.assertBlock(result, {
      hash: blockHashTrimmed,
      gasUsed: totalGasUsed,
      number: blockNumberHex,
      parentHash: blockHashPreviousTrimmed,
      timestamp: blockTimestampHex,
      transactions: [contractHash1, contractHash2],
    });
  });

  it("eth_getBlockByHash with match paginated", async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    const next = `contracts/results?timestamp=lte:${defaultBlock.timestamp.to}&timestamp=gte:${defaultBlock.timestamp.from}&limit=100&order=asc`; // just flip the timestamp parameters for simplicity
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { results: [], links: { next: next } });
    restMock.onGet(next).reply(200, defaultContractResults);
    restMock.onGet("network/fees").reply(200, defaultNetworkFees);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);

    const result = await ethImpl.getBlockByHash(blockHash, false);
    RelayAssertions.assertBlock(result, {
      hash: blockHashTrimmed,
      gasUsed: totalGasUsed,
      number: blockNumberHex,
      parentHash: blockHashPreviousTrimmed,
      timestamp: blockTimestampHex,
      transactions: [contractHash1, contractHash2],
    });
  });

  it("eth_getBlockByHash should hit cache", async function () {
    restMock.onGet(`blocks/${blockHash}`).replyOnce(200, defaultBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .replyOnce(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);

    for (let i = 0; i < 3; i++) {
      const result = await ethImpl.getBlockByHash(blockHash, false);
      expect(result).to.exist;
      expect(result).to.not.be.null;
      expect(result.hash).equal(blockHashTrimmed);
      expect(result.number).equal(blockNumberHex);
      RelayAssertions.verifyBlockConstants(result);
    }
  });

  it("eth_getBlockByHash with match and details", async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);

    const result = await ethImpl.getBlockByHash(blockHash, true);

    RelayAssertions.assertBlock(
      result,
      {
        hash: blockHashTrimmed,
        gasUsed: totalGasUsed,
        number: blockNumberHex,
        timestamp: blockTimestampHex,
        parentHash: blockHashPreviousTrimmed,
        transactions: [contractHash1, contractHash2],
      },
      true,
    );
  });

  it("eth_getBlockByHash with match and details paginated", async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    const next = `contracts/results?timestamp=lte:${defaultBlock.timestamp.to}&timestamp=gte:${defaultBlock.timestamp.from}&limit=100&order=asc`; // just flip the timestamp parameters for simplicity
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { results: [], links: { next: next } });
    restMock.onGet(next).reply(200, defaultContractResults);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, defaultEthGetBlockByLogs);

    const result = await ethImpl.getBlockByHash(blockHash, true);
    RelayAssertions.assertBlock(
      result,
      {
        hash: blockHashTrimmed,
        gasUsed: totalGasUsed,
        number: blockNumberHex,
        parentHash: blockHashPreviousTrimmed,
        timestamp: blockTimestampHex,
        transactions: [contractHash1, contractHash2],
      },
      true,
    );
  });

  it("eth_getBlockByHash with block match and contract revert", async function () {
    cacheService.clear();
    const randomBlock = {
      ...defaultBlock,
      gas_used: 400000,
    };
    restMock.onGet(`blocks/${blockHash}`).reply(200, randomBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${randomBlock.timestamp.from}&timestamp=lte:${randomBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, []);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${randomBlock.timestamp.from}&timestamp=lte:${randomBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { logs: [] });

    const result = await ethImpl.getBlockByHash(blockHash, true);
    RelayAssertions.assertBlock(result, {
      hash: blockHashTrimmed,
      gasUsed: numberTo0x(randomBlock.gas_used),
      number: blockNumberHex,
      parentHash: blockHashPreviousTrimmed,
      timestamp: blockTimestampHex,
      transactions: [],
    });
  });

  it("eth_getBlockByHash with no match", async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(400, {
      _status: {
        messages: [
          {
            message: "No such block exists",
          },
        ],
      },
    });

    const result = await ethImpl.getBlockByHash(blockHash, false);
    expect(result).to.equal(null);
  });

  it("eth_getBlockByHash should throw if unexpected error", async function () {
    // mirror node request mocks
    const randomBlock = {
      timestamp: {
        from: `1651560386.060890949`,
        to: "1651560389.060890919",
      },
    };
    restMock.onGet(`blocks/${blockHash}`).reply(200, randomBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${randomBlock.timestamp.from}&timestamp=lte:${randomBlock.timestamp.to}&limit=100&order=asc`,
      )
      .abortRequestOnce();
    await RelayAssertions.assertRejection(predefined.INTERNAL_ERROR(), ethImpl.getBlockByHash, false, ethImpl, [
      blockHash,
      false,
    ]);
  });

  it("eth_getBlockTransactionCountByNumber with match", async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber(blockNumber.toString());
    expect(result).equal(numberTo0x(blockTransactionCount));
  });

  it("eth_getBlockTransactionCountByNumber with match should hit cache", async function () {
    restMock.onGet(`blocks/${blockNumber}`).replyOnce(200, defaultBlock);

    for (let i = 0; i < 3; i++) {
      const result = await ethImpl.getBlockTransactionCountByNumber(blockNumber.toString());
      expect(result).equal(numberTo0x(blockTransactionCount));
    }
  });

  it("eth_getBlockTransactionCountByNumber with no match", async function () {
    cacheService.clear();
    restMock.onGet(`blocks/${blockNumber}`).reply(400, {
      _status: {
        messages: [
          {
            message: "No such block exists",
          },
        ],
      },
    });

    const result = await ethImpl.getBlockTransactionCountByNumber(blockNumber.toString());
    expect(result).to.equal(null);
  });

  it("eth_getBlockTransactionCountByNumber with latest tag", async function () {
    // mirror node request mocks
    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber("latest");
    expect(result).equal(numberTo0x(blockTransactionCount));
  });

  it("eth_getBlockTransactionCountByNumber with pending tag", async function () {
    // mirror node request mocks
    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber("pending");
    expect(result).equal(numberTo0x(blockTransactionCount));
  });

  it("eth_getBlockTransactionCountByNumber with earliest tag", async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/0`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber("earliest");
    expect(result).equal(numberTo0x(blockTransactionCount));
  });

  it("eth_getBlockTransactionCountByNumber with hex number", async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/3735929054`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber("0xdeadc0de");
    expect(result).equal(numberTo0x(blockTransactionCount));
  });

  it("eth_getBlockTransactionCountByHash with match", async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByHash(blockHash);
    expect(result).equal(numberTo0x(blockTransactionCount));
  });

  it("eth_getBlockTransactionCountByHash with match should hit cache", async function () {
    restMock.onGet(`blocks/${blockHash}`).replyOnce(200, defaultBlock);

    for (let i = 0; i < 3; i++) {
      const result = await ethImpl.getBlockTransactionCountByHash(blockHash);
      expect(result).equal(numberTo0x(blockTransactionCount));
    }
  });

  it("eth_getBlockTransactionCountByHash with no match", async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(400, {
      _status: {
        messages: [
          {
            message: "No such block exists",
          },
        ],
      },
    });

    const result = await ethImpl.getBlockTransactionCountByHash(blockHash);
    expect(result).to.equal(null);
  });

  it("eth_getTransactionByBlockNumberAndIndex with match", async function () {
    // mirror node request mocks
    restMock
      .onGet(
        `contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock
      .onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`)
      .reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(defaultBlock.number),
      numberTo0x(defaultBlock.count),
    );
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it("eth_getTransactionByBlockNumberAndIndex with null amount", async function () {
    const randomBlock = {
      number: 1009,
      count: 37,
    };
    const nullableDefaultContractResults = _.cloneDeep(defaultContractResults);
    // @ts-ignore
    nullableDefaultContractResults.results[0].amount = null;
    restMock
      .onGet(
        `contracts/results?block.number=${randomBlock.number}&transaction.index=${randomBlock.count}&limit=100&order=asc`,
      )
      .reply(200, nullableDefaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(randomBlock.number),
      numberTo0x(randomBlock.count),
    );
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.value).equal("0x0");
  });

  it("eth_getTransactionByBlockNumberAndIndex with no contract result match", async function () {
    restMock
      .onGet(
        `contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(400, {
        _status: {
          messages: [
            {
              message: "No such contract result exists",
            },
          ],
        },
      });

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(defaultBlock.number),
      numberTo0x(defaultBlock.count),
    );
    expect(result).to.equal(null);
  });

  it("eth_getTransactionByBlockNumberAndIndex should throw for internal error", async function () {
    const randomBlock = {
      number: 5644,
      count: 33,
    };
    restMock
      .onGet(
        `contracts/results?block.number=${randomBlock.number}&transaction.index=${randomBlock.count}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResultsWithNullableFrom);

    const args = [numberTo0x(randomBlock.number), numberTo0x(randomBlock.count)];
    const errMessage = "Cannot read properties of null (reading 'substring')";

    await RelayAssertions.assertRejection(
      predefined.INTERNAL_ERROR(errMessage),
      ethImpl.getTransactionByBlockNumberAndIndex,
      true,
      ethImpl,
      args,
    );
  });

  it("eth_getTransactionByBlockNumberAndIndex with no contract results", async function () {
    restMock
      .onGet(
        `contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, {
        results: [],
      });

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(defaultBlock.number),
      numberTo0x(defaultBlock.count),
    );
    expect(result).to.equal(null);
  });

  it("eth_getTransactionByBlockNumberAndIndex with latest tag", async function () {
    // mirror node request mocks
    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
    restMock
      .onGet(
        `contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex("latest", numberTo0x(defaultBlock.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it("eth_getTransactionByBlockNumberAndIndex with match pending tag", async function () {
    // mirror node request mocks
    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
    restMock
      .onGet(
        `contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex("pending", numberTo0x(defaultBlock.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it("eth_getTransactionByBlockNumberAndIndex with earliest tag", async function () {
    // mirror node request mocks
    restMock
      .onGet(`contracts/results?block.number=0&transaction.index=${defaultBlock.count}&limit=100&order=asc`)
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex("earliest", numberTo0x(defaultBlock.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it("eth_getTransactionByBlockNumberAndIndex with hex number", async function () {
    restMock
      .onGet(`contracts/results?block.number=3735929054&transaction.index=${defaultBlock.count}&limit=100&order=asc`)
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex("0xdeadc0de" + "", numberTo0x(defaultBlock.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it("eth_getTransactionByBlockHashAndIndex with match", async function () {
    // mirror node request mocks
    restMock
      .onGet(
        `contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResults);
    restMock
      .onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`)
      .reply(200, defaultDetailedContractResults);
    const result = await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash, numberTo0x(defaultBlock.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it("eth_getTransactionByBlockHashAndIndex should throw for internal error", async function () {
    const randomBlock = {
      hash: "0x5f827a801c579c84eca738827b65612b28ed425b7578bfdd10177e24fc3db8d4b1a7f3d56d83c39b950cc5e4d175dd64",
      count: 9,
    };
    restMock
      .onGet(
        `contracts/results?block.hash=${randomBlock.hash}&transaction.index=${randomBlock.count}&limit=100&order=asc`,
      )
      .reply(200, defaultContractResultsWithNullableFrom);

    const args = [randomBlock.hash, numberTo0x(randomBlock.count)];
    const errMessage = "Cannot read properties of null (reading 'substring')";

    await RelayAssertions.assertRejection(
      predefined.INTERNAL_ERROR(errMessage),
      ethImpl.getTransactionByBlockHashAndIndex,
      true,
      ethImpl,
      args,
    );
  });

  it("eth_getTransactionByBlockHashAndIndex with no contract result match", async function () {
    // mirror node request mocks
    restMock
      .onGet(
        `contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(404, {
        _status: {
          messages: [
            {
              message: "Not found",
            },
          ],
        },
      });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      defaultBlock.hash.toString(),
      numberTo0x(defaultBlock.count),
    );
    expect(result).to.equal(null);
  });

  it("eth_getTransactionByBlockHashAndIndex with no contract results", async function () {
    restMock
      .onGet(
        `contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, {
        results: [],
      });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      defaultBlock.hash.toString(),
      numberTo0x(defaultBlock.count),
    );
    expect(result).to.equal(null);
  });

  it("eth_getTransactionByBlockHashAndIndex returns 155 transaction for type 0", async function () {
    restMock
      .onGet(
        `contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, {
        results: [
          {
            ...contractResultMock,
            type: 0,
          },
        ],
      });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      defaultBlock.hash.toString(),
      numberTo0x(defaultBlock.count),
    );
    expect(result).to.be.an.instanceOf(Transaction);
  });

  it("eth_getTransactionByBlockHashAndIndex returns 2930 transaction for type 1", async function () {
    restMock
      .onGet(
        `contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, {
        results: [
          {
            ...contractResultMock,
            type: 1,
            access_list: [],
          },
        ],
      });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      defaultBlock.hash.toString(),
      numberTo0x(defaultBlock.count),
    );
    expect(result).to.be.an.instanceOf(Transaction2930);
  });

  it("eth_getTransactionByBlockHashAndIndex returns 1559 transaction for type 2", async function () {
    restMock
      .onGet(
        `contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`,
      )
      .reply(200, {
        results: [
          {
            ...contractResultMock,
            type: 2,
            access_list: [],
            max_fee_per_gas: "0x47",
            max_priority_fee_per_gas: "0x47",
          },
        ],
      });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      defaultBlock.hash.toString(),
      numberTo0x(defaultBlock.count),
    );
    expect(result).to.be.an.instanceOf(Transaction1559);
  });

  describe("Block transaction count", async function () {
    let currentMaxBlockRange: number;

    this.afterEach(() => {
      process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = currentMaxBlockRange.toString();
    });

    this.beforeEach(() => {
      currentMaxBlockRange = Number(process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE);
      process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = "1";
      ethImplLowTransactionCount = new EthImpl(
        hapiServiceInstance,
        mirrorNodeInstance,
        logger,
        "0x12a",
        registry,
        cacheService,
      );
    });

    it("eth_getBlockByHash with greater number of transactions than the ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE", async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
      restMock
        .onGet(
          `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, defaultContractResults);
      restMock
        .onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`)
        .reply(200, defaultDetailedContractResults);
      restMock
        .onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`)
        .reply(200, defaultDetailedContractResults);
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, defaultEthGetBlockByLogs);

      const args = [blockHash, true];

      await RelayAssertions.assertRejection(
        predefined.MAX_BLOCK_SIZE(77),
        ethImplLowTransactionCount.getBlockByHash,
        true,
        ethImplLowTransactionCount,
        args,
      );
    });

    it("eth_getBlockByNumber with greater number of transactions than the ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE", async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, defaultContractResults);
      restMock
        .onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`)
        .reply(200, defaultDetailedContractResults);
      restMock
        .onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`)
        .reply(200, defaultDetailedContractResults);
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, defaultEthGetBlockByLogs);

      const args = [numberTo0x(blockNumber), true];

      await RelayAssertions.assertRejection(
        predefined.MAX_BLOCK_SIZE(77),
        ethImplLowTransactionCount.getBlockByNumber,
        true,
        ethImplLowTransactionCount,
        args,
      );
    });
  });

  describe("eth_getBalance", async function () {
    const defBalance = 99960581137;
    const defHexBalance = numberTo0x(BigInt(defBalance) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
    it("should return balance from mirror node", async () => {
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 10000,
          },
        ],
      });
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance,
        },
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, null, getRequestId());
      expect(resBalance).to.equal(defHexBalance);
    });

    it("should return balance for latest block from cache", async () => {
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 10000,
          },
        ],
      });
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance,
        },
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, null, getRequestId());
      expect(resBalance).to.equal(defHexBalance);

      // next call should use cache
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(404, {});

      const resBalanceCached = await ethImpl.getBalance(contractAddress1, null);
      expect(resBalanceCached).to.equal(resBalance);

      // Third call should return new number using mirror node
      const newBalance = 55555;
      const newBalanceHex = numberTo0x(BigInt(newBalance) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: newBalance,
        },
      });
      // expire cache, instead of waiting for ttl we clear it to simulate expiry faster.
      cacheService.clear();

      const resBalanceNew = await ethImpl.getBalance(contractAddress1, null, getRequestId());
      expect(newBalanceHex).to.equal(resBalanceNew);
    });

    it("should return balance from mirror node with block number passed as param the same as latest", async () => {
      const blockNumber = "0x2710";
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 10000,
            timestamp: {
              from: `${blockTimestamp}.060890919`,
              to: "1651560389.060890949",
            },
          },
        ],
      });
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance,
        },
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, blockNumber, getRequestId());
      expect(resBalance).to.equal(defHexBalance);
    });

    it("should return balance from mirror node with block hash passed as param the same as latest", async () => {
      const blockHash = "0x43da6a71f66d6d46d2b487c8231c04f01b3ba3bd91d165266d8eb39de3c0152b";
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 10000,
            timestamp: {
              from: `${blockTimestamp}.060890919`,
              to: "1651560389.060890949",
            },
          },
        ],
      });
      restMock.onGet(`blocks/${blockHash}`).reply(200, {
        number: 10000,
      });
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance,
        },
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, blockHash, getRequestId());
      expect(resBalance).to.equal(defHexBalance);
    });

    it("should return balance from mirror node with block number passed as param, one behind latest", async () => {
      const blockNumber = "0x270F";
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 10000,
            timestamp: {
              from: `${blockTimestamp}.060890919`,
              to: "1651560389.060890949",
            },
          },
        ],
      });
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance,
        },
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, blockNumber, getRequestId());
      expect(resBalance).to.equal(defHexBalance);
    });

    it("should return balance from mirror node with block hash passed as param, one behind latest", async () => {
      const blockHash = "0x43da6a71f66d6d46d2b487c8231c04f01b3ba3bd91d165266d8eb39de3c0152b";
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 10000,
            timestamp: {
              from: `${blockTimestamp}.060890919`,
              to: "1651560389.060890949",
            },
          },
        ],
      });
      restMock.onGet(`blocks/${blockHash}`).reply(200, {
        number: 9998,
        timestamp: {
          from: "1651550386",
        },
      });

      restMock.onGet(`balances?account.id=${contractAddress1}&timestamp=1651550386`).reply(200, {
        account: contractAddress1,
        balances: [
          {
            balance: defBalance,
          },
        ],
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, blockHash, getRequestId());
      expect(resBalance).to.equal(defHexBalance);
    });

    it("should return balance from consensus node", async () => {
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 10000,
          },
        ],
      });
      restMock.onGet(`contracts/${contractAddress1}`).reply(200, null);
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(404, {
        _status: {
          messages: [{ message: "Not found" }],
        },
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, null, getRequestId());
      expect(resBalance).to.equal(EthImpl.zeroHex);
    });

    it("should return cached value for mirror nodes", async () => {
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 10000,
          },
        ],
      });
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance,
        },
      });

      const resNoCache = await ethImpl.getBalance(contractAddress1, null, getRequestId());

      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(404, {
        _status: {
          messages: [{ message: "Not found" }],
        },
      });

      const resCached = await ethImpl.getBalance(contractAddress1, null, getRequestId());
      expect(resNoCache).to.equal(defHexBalance);
      expect(resCached).to.equal(defHexBalance);
    });

    it("should return cached value for mirror nodes that is not latest so will need to query mirror node", async () => {
      const blockNumber = "0x1";
      restMock.onGet("blocks/1").reply(200, defaultBlock);

      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [
          {
            number: 3,
            timestamp: {
              from: `${blockTimestamp}.060890919`,
              to: "1651560389.060890949",
            },
          },
        ],
      });

      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance,
        },
        transactions: [
          buildCryptoTransferTransaction("0.0.98", contractId1, 100, { timestamp: `${blockTimestamp}.002391010` }),
          buildCryptoTransferTransaction("0.0.98", contractId1, 50, { timestamp: `${blockTimestamp}.002392003` }),
          buildCryptoTransferTransaction("0.0.98", contractId1, 25, { timestamp: `${blockTimestamp}.980350003` }),
        ],
        links: {
          next: null,
        },
      });

      const resNoCache = await ethImpl.getBalance(contractAddress1, blockNumber, getRequestId());

      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(404, {
        _status: {
          messages: [{ message: "Not found" }],
        },
      });

      const resCached = await ethImpl.getBalance(contractAddress1, blockNumber, getRequestId());
      expect(resNoCache).to.equal(defHexBalance);
      expect(resCached).to.equal(defHexBalance);
    });

    describe("with blockNumberOrTag filter", async function () {
      const balance1 = 99960581131;
      const balance2 = 99960581132;
      const balance3 = 99960581133;
      const timestamp1 = 1651550386;
      const timestamp2 = 1651560286;
      const timestamp3 = 1651560386;
      const timestamp4 = 1651561386;

      const hexBalance1 = numberTo0x(BigInt(balance1) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
      const hexBalance3 = numberTo0x(BigInt(balance3) * TINYBAR_TO_WEIBAR_COEF_BIGINT);

      const latestBlock = {
        ...defaultBlock,
        number: 4,
        timestamp: {
          from: `${timestamp3}.060890949`,
          to: `${timestamp4}.060890949`,
        },
      };

      const recentBlock = {
        ...defaultBlock,
        number: 2,
        timestamp: {
          from: `${timestamp2}.060890949`,
          to: `${timestamp3}.060890949`,
        },
      };

      const earlierBlock = {
        ...defaultBlock,
        number: 1,
        timestamp: {
          from: `${timestamp1}.060890949`,
          to: `${timestamp2}.060890949`,
        },
      };

      beforeEach(async () => {
        restMock.onGet(`blocks?limit=1&order=desc`).reply(200, { blocks: [latestBlock] });
        restMock.onGet(`blocks/3`).reply(200, defaultBlock);
        restMock.onGet(`blocks/0`).reply(200, blockZero);
        restMock.onGet(`blocks/2`).reply(200, recentBlock);
        restMock.onGet(`blocks/1`).reply(200, earlierBlock);

        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: `${timestamp4}.060890949`,
          },
          transactions: [],
        });

        restMock.onGet(`balances?account.id=${contractId1}&timestamp=${earlierBlock.timestamp.from}`).reply(200, {
          timestamp: `${timestamp1}.060890949`,
          balances: [
            {
              account: contractId1,
              balance: balance1,
              tokens: [],
            },
          ],
          links: {
            next: null,
          },
        });

        restMock.onGet(`balances?account.id=${contractId1}&timestamp=${recentBlock.timestamp.from}`).reply(200, {
          timestamp: `${timestamp2}.060890949`,
          balances: [
            {
              account: contractId1,
              balance: balance2,
              tokens: [],
            },
          ],
          links: {
            next: null,
          },
        });

        restMock.onGet(`balances?account.id=${contractId1}`).reply(200, {
          timestamp: `${timestamp4}.060890949`,
          balances: [
            {
              account: contractId1,
              balance: balance3,
              tokens: [],
            },
          ],
          links: {
            next: null,
          },
        });

        restMock.onGet(`balances?account.id=${contractId1}&timestamp=${blockZero.timestamp.from}`).reply(200, {
          timestamp: null,
          balances: [],
          links: {
            next: null,
          },
        });
      });

      it("latest", async () => {
        const resBalance = await ethImpl.getBalance(contractId1, "latest", getRequestId());
        expect(resBalance).to.equal(hexBalance3);
      });

      it("earliest", async () => {
        const resBalance = await ethImpl.getBalance(contractId1, "earliest", getRequestId());
        expect(resBalance).to.equal("0x0");
      });

      it("pending", async () => {
        const resBalance = await ethImpl.getBalance(contractId1, "pending", getRequestId());
        expect(resBalance).to.equal(hexBalance3);
      });

      it("blockNumber is in the latest 15 minutes and the block.timstamp.to is later than the consensus transactions timestamps", async () => {
        const fromTimestamp = "1651560934";
        const toTimestamp = "1651560935";
        const recentBlockWithinLastfifteen = {
          ...defaultBlock,
          number: 2,
          timestamp: {
            from: `${fromTimestamp}.002391003`,
            to: `${toTimestamp}.980351003`,
          },
        };

        restMock.onGet(`blocks/2`).reply(200, recentBlockWithinLastfifteen);

        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: `${blockTimestamp}.060890960`,
          },
          transactions: [
            buildCryptoTransferTransaction("0.0.98", contractId1, 100, { timestamp: `${fromTimestamp}.002391010` }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50, { timestamp: `${fromTimestamp}.002392003` }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 25, { timestamp: `${fromTimestamp}.980350003` }),
          ],
          links: {
            next: null,
          },
        });

        const resBalance = await ethImpl.getBalance(contractId1, "2", getRequestId());
        const historicalBalance = numberTo0x(BigInt(balance3) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
        expect(resBalance).to.equal(historicalBalance);
      });

      it("blockNumber is not in the latest 15 minutes", async () => {
        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: `${timestamp4}.060890949`,
          },
          transactions: [],
        });

        const resBalance = await ethImpl.getBalance(contractId1, "1", getRequestId());
        expect(resBalance).to.equal(hexBalance1);
      });

      it("blockNumber is in the latest 15 minutes and there have been several debit transactions with consensus.timestamps greater the block.timestamp.to", async () => {
        const blockTimestamp = "1651560900";
        const recentBlockWithinLastfifteen = {
          ...defaultBlock,
          number: 2,
          timestamp: {
            from: "1651560899.060890921",
            to: `${blockTimestamp}.060890941`,
          },
        };
        restMock.onGet(`blocks/2`).reply(200, recentBlockWithinLastfifteen);
        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: `${blockTimestamp}.060890960`,
          },
          transactions: [
            buildCryptoTransferTransaction("0.0.98", contractId1, 100, { timestamp: `${blockTimestamp}.060890954` }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50, { timestamp: `${blockTimestamp}.060890953` }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 25, { timestamp: `${blockTimestamp}.060890952` }),
          ],
          links: {
            next: null,
          },
        });

        const resBalance = await ethImpl.getBalance(contractId1, "2", getRequestId());
        const historicalBalance = numberTo0x(BigInt(balance3 - 175) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
        expect(resBalance).to.equal(historicalBalance);
      });

      it("blockNumber is in the latest 15 minutes and there have been several credit transactions with consensus.timestamps greater the block.timestamp.to", async () => {
        const recentBlockWithinLastfifteen = {
          ...defaultBlock,
          number: 2,
          timestamp: {
            from: "1651560899.060890921",
            to: "1651560900.060890941",
          },
        };

        restMock.onGet(`blocks/2`).reply(200, recentBlockWithinLastfifteen);
        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: `${timestamp4}.060890960`,
          },
          transactions: [
            buildCryptoTransferTransaction(contractId1, "0.0.98", 100, { timestamp: "1651561386.060890954" }),
            buildCryptoTransferTransaction(contractId1, "0.0.98", 50, { timestamp: "1651561386.060890953" }),
            buildCryptoTransferTransaction(contractId1, "0.0.98", 25, { timestamp: "1651561386.060890952" }),
          ],
          links: {
            next: null,
          },
        });

        const resBalance = await ethImpl.getBalance(contractId1, "2", getRequestId());
        const historicalBalance = numberTo0x(BigInt(balance3 + 175) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
        expect(resBalance).to.equal(historicalBalance);
      });

      it("blockNumber is in the latest 15 minutes and there have been mixed credit and debit transactions with consensus.timestamps greater the block.timestamp.to", async () => {
        const recentBlockWithinLastfifteen = {
          ...defaultBlock,
          number: 2,
          timestamp: {
            from: "1651560899.060890921",
            to: "1651560900.060890941",
          },
        };

        restMock.onGet(`blocks/2`).reply(200, recentBlockWithinLastfifteen);
        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: `${timestamp4}.060890960`,
          },
          transactions: [
            buildCryptoTransferTransaction(contractId1, "0.0.98", 100, { timestamp: "1651561386.060890954" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50, { timestamp: "1651561386.060890953" }),
            buildCryptoTransferTransaction(contractId1, "0.0.98", 25, { timestamp: "1651561386.060890952" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 10, { timestamp: "1651561386.060890951" }),
          ],
          links: {
            next: null,
          },
        });

        const resBalance = await ethImpl.getBalance(contractId1, "2", getRequestId());
        const historicalBalance = numberTo0x(BigInt(balance3 + 65) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
        expect(resBalance).to.equal(historicalBalance);
      });

      it("blockNumber is in the latest 15 minutes and there have been mixed credit and debit transactions and a next pagination with a timestamp less than the block.timestamp.to", async () => {
        const recentBlockWithinLastfifteen = {
          ...defaultBlock,
          number: 1,
          timestamp: {
            from: "1651550584.060890921",
            to: "1651550585.060890941",
          },
        };
        restMock.onGet(`blocks/1`).reply(200, recentBlockWithinLastfifteen);
        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: "1651550587.060890941",
          },
          transactions: [
            buildCryptoTransferTransaction("0.0.98", contractId1, 100, { timestamp: "1651550587.060890964" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 55, { timestamp: "1651550587.060890958" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50, { timestamp: "1651550587.060890953" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 25, { timestamp: "1651550587.060890952" }),
          ],
          links: {
            next: `/api/v1/accounts/${contractId1}?limit=100&timestamp=lt:1651550575.060890941`,
          },
        });
        const latestBlock = {
          ...defaultBlock,
          number: 4,
          timestamp: {
            from: "1651550595.060890941",
            to: "1651550597.060890941",
          },
        };

        restMock.onGet("blocks?limit=1&order=desc").reply(200, {
          blocks: [latestBlock],
        });

        const resBalance = await ethImpl.getBalance(contractId1, "1", getRequestId());
        const historicalBalance = numberTo0x(BigInt(balance3 - 230) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
        expect(resBalance).to.equal(historicalBalance);
      });

      it("blockNumber is in the latest 15 minutes with debit transactions and a next pagination with a timestamp greater than the block.timestamp.to", async () => {
        const recentBlockWithinLastfifteen = {
          ...defaultBlock,
          number: 1,
          timestamp: {
            from: "1651550564.060890921",
            to: "1651550565.060890941",
          },
        };

        restMock.onGet(`blocks/1`).reply(200, recentBlockWithinLastfifteen);
        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: "1651550587.060890941",
          },
          transactions: [
            buildCryptoTransferTransaction("0.0.98", contractId1, 100, { timestamp: "1651550587.060890964" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 55, { timestamp: "1651550587.060890958" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50, { timestamp: "1651550587.060890953" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 25, { timestamp: "1651550587.060890952" }),
          ],
          links: {
            next: `/api/v1/accounts/${contractId1}?limit=100&timestamp=lt:1651550575.060890941`,
          },
        });

        restMock.onGet(`accounts/${contractId1}?limit=100&timestamp=lt:1651550575.060890941`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: "1651550587.060890941",
          },
          transactions: [
            buildCryptoTransferTransaction("0.0.98", contractId1, 200, { timestamp: "1651550574.060890964" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50, { timestamp: "1651550573.060890958" }),
          ],
          links: {
            next: null,
          },
        });

        const latestBlock = {
          ...defaultBlock,
          number: 4,
          timestamp: {
            from: "1651550595.060890941",
            to: "1651550597.060890941",
          },
        };

        restMock.onGet("blocks?limit=1&order=desc").reply(200, {
          blocks: [latestBlock],
        });

        const resBalance = await ethImpl.getBalance(contractId1, "1", getRequestId());
        const historicalBalance = numberTo0x(BigInt(balance3 - 480) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
        expect(resBalance).to.equal(historicalBalance);
      });

      it("blockNumber is in the latest 15 minutes with credit and debit transactions and a next pagination with a timestamp greater than the block.timestamp.to", async () => {
        const recentBlockWithinLastfifteen = {
          ...defaultBlock,
          number: 1,
          timestamp: {
            from: "1651550564.060890921",
            to: "1651550565.060890941",
          },
        };
        restMock.onGet(`blocks/1`).reply(200, recentBlockWithinLastfifteen);
        restMock.onGet(`accounts/${contractId1}?limit=100`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: "1651550587.060890941",
          },
          transactions: [
            buildCryptoTransferTransaction(contractId1, "0.0.98", 100, { timestamp: "1651550587.060890964" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 55, { timestamp: "1651550587.060890958" }),
            buildCryptoTransferTransaction(contractId1, "0.0.98", 50, { timestamp: "1651550587.060890953" }),
            buildCryptoTransferTransaction("0.0.98", contractId1, 25, { timestamp: "1651550587.060890952" }),
          ],
          links: {
            next: `/api/v1/accounts/${contractId1}?limit=100&timestamp=lt:1651550575.060890941`,
          },
        });

        restMock.onGet(`accounts/${contractId1}?limit=100&timestamp=lt:1651550575.060890941`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: "1651550587.060890941",
          },
          transactions: [
            buildCryptoTransferTransaction("0.0.98", contractId1, 200, { timestamp: "1651550574.060890964" }),
            buildCryptoTransferTransaction(contractId1, "0.0.98", 50, { timestamp: "1651550573.060890958" }),
          ],
          links: {
            next: null,
          },
        });

        const latestBlock = {
          ...defaultBlock,
          number: 4,
          timestamp: {
            from: "1651550595.060890941",
            to: "1651550597.060890941",
          },
        };

        restMock.onGet("blocks?limit=1&order=desc").reply(200, {
          blocks: [latestBlock],
        });

        const resBalance = await ethImpl.getBalance(contractId1, "1", getRequestId());
        const historicalBalance = numberTo0x(BigInt(balance3 - 80) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
        expect(resBalance).to.equal(historicalBalance);
      });

      it("blockNumber is the same as the latest block", async () => {
        const resBalance = await ethImpl.getBalance(contractId1, "3", getRequestId());
        expect(resBalance).to.equal(hexBalance3);
      });

      it("blockNumber is not in the latest 15 minutes, mirror node balance for address not found 404 status", async () => {
        // random eth address
        const notFoundEvmAddress = "0x1234567890123456789012345678901234567890";
        restMock.onGet(`balances?account.id=${notFoundEvmAddress}&timestamp=1651550386.060890949`).reply(404, {
          _status: {
            messages: [{ message: "Not found" }],
          },
        });

        const resBalance = await ethImpl.getBalance(notFoundEvmAddress, "1", getRequestId());
        expect(resBalance).to.equal(EthImpl.zeroHex);
      });

      it("blockNumber is in the latest 15 minutes, mirror node balance for address not found 404 status", async () => {
        // random eth address
        const notFoundEvmAddress = "0x1234567890123456789012345678901234567890";
        const blockTimestamp = "1651560900";
        const recentBlockWithinLastfifteen = {
          ...defaultBlock,
          number: 2,
          timestamp: {
            from: "1651560899.060890921",
            to: `${blockTimestamp}.060890941`,
          },
        };
        restMock.onGet(`blocks/2`).reply(200, recentBlockWithinLastfifteen);
        restMock.onGet(`accounts/${notFoundEvmAddress}?limit=100`).reply(404, {
          _status: {
            messages: [{ message: "Not found" }],
          },
        });

        const resBalance = await ethImpl.getBalance(notFoundEvmAddress, "2", getRequestId());
        expect(resBalance).to.equal(EthImpl.zeroHex);
      });
    });

    describe("Calculate balance at block timestamp", async function () {
      const timestamp1 = 1651550386;

      it("Given a blockNumber, return the account balance at that blocknumber, with transactions that debit the account balance", async () => {
        const transactionsInBlockTimestamp: any[] = [
          buildCryptoTransferTransaction("0.0.98", contractId1, 100, { timestamp: `${timestamp1}.060890955` }),
          buildCryptoTransferTransaction("0.0.98", contractId1, 50, { timestamp: `${timestamp1}.060890954` }),
        ];

        const resultingUpdate = ethImpl.getBalanceAtBlockTimestamp(
          contractId1,
          transactionsInBlockTimestamp,
          Number(`${timestamp1}.060890950`),
        );
        // Transactions up to the block timestamp.to timestamp will be subsctracted from the current balance to get the block's balance.
        expect(resultingUpdate).to.equal(+150);
      });

      it("Given a blockNumber, return the account balance at that blocknumber, with transactions that credit the account balance", async () => {
        const transactionsInBlockTimestamp: any[] = [
          buildCryptoTransferTransaction(contractId1, "0.0.98", 100, { timestamp: `${timestamp1}.060890955` }),
          buildCryptoTransferTransaction(contractId1, "0.0.98", 50, { timestamp: `${timestamp1}.060890954` }),
        ];

        const resultingUpdate = ethImpl.getBalanceAtBlockTimestamp(
          contractId1,
          transactionsInBlockTimestamp,
          Number(`${timestamp1}.060890950`),
        );
        // Transactions up to the block timestamp.to timestamp will be subsctracted from the current balance to get the block's balance.
        expect(resultingUpdate).to.equal(-150);
      });

      it("Given a blockNumber, return the account balance at that blocknumber, with transactions that debit and credit the account balance", async () => {
        const transactionsInBlockTimestamp: any[] = [
          buildCryptoTransferTransaction("0.0.98", contractId1, 100, { timestamp: `${timestamp1}.060890955` }),
          buildCryptoTransferTransaction(contractId1, "0.0.98", 50, { timestamp: `${timestamp1}.060890954` }),
        ];

        const resultingUpdate = ethImpl.getBalanceAtBlockTimestamp(
          contractId1,
          transactionsInBlockTimestamp,
          Number(`${timestamp1}.060890950`),
        );
        // Transactions up to the block timestamp.to timestamp will be subsctracted from the current balance to get the block's balance.
        expect(resultingUpdate).to.equal(+50);
      });

      it("Given a blockNumber, return the account balance at that blocknumber, with transactions that debit, credit, and debit the account balance", async () => {
        const transactionsInBlockTimestamp: any[] = [
          buildCryptoTransferTransaction("0.0.98", contractId1, 100, { timestamp: `${timestamp1}.060890955` }),
          buildCryptoTransferTransaction(contractId1, "0.0.98", 50, { timestamp: `${timestamp1}.060890954` }),
          buildCryptoTransferTransaction("0.0.98", contractId1, 20, { timestamp: `${timestamp1}.060890955` }),
        ];

        const resultingUpdate = ethImpl.getBalanceAtBlockTimestamp(
          contractId1,
          transactionsInBlockTimestamp,
          Number(`${timestamp1}.060890950`),
        );
        // Transactions up to the block timestamp.to timestamp will be subsctracted from the current balance to get the block's balance.
        expect(resultingUpdate).to.equal(+70);
      });
    });
  });

  describe("eth_getCode", async function () {
    it("should return non cached value for not found contract", async () => {
      restMock.onGet(`contracts/${contractAddress1}`).reply(404, defaultContract);
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(contractAddress1, 16)}`).reply(404, null);
      sdkClientStub.getContractByteCode.throws(
        new SDKClientError({
          status: {
            _code: 16,
          },
        }),
      );

      const resNoCache = await ethImpl.getCode(contractAddress1, null);
      const resCached = await ethImpl.getCode(contractAddress1, null);
      expect(resNoCache).to.equal(EthImpl.emptyHex);
      expect(resCached).to.equal(EthImpl.emptyHex);
    });

    it("should return the runtime_bytecode from the mirror node", async () => {
      restMock.onGet(`contracts/${contractAddress1}`).reply(200, defaultContract);
      restMock.onGet(`accounts/${contractAddress1}?limit=100`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(contractAddress1, 16)}`).reply(404, null);
      sdkClientStub.getContractByteCode.returns(Buffer.from(deployedBytecode.replace("0x", ""), "hex"));

      const res = await ethImpl.getCode(contractAddress1, null);
      expect(res).to.equal(mirrorNodeDeployedBytecode);
    });

    it("should return the bytecode from SDK if Mirror Node returns 404", async () => {
      restMock.onGet(`contracts/${contractAddress2}`).reply(404, defaultContract);
      restMock.onGet(`accounts/${contractAddress2}?limit=100`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(contractAddress2, 16)}`).reply(404, null);
      sdkClientStub.getContractByteCode.returns(Buffer.from(deployedBytecode.replace("0x", ""), "hex"));
      const res = await ethImpl.getCode(contractAddress2, null);
      expect(res).to.equal(deployedBytecode);
    });

    it("should return the bytecode from SDK if Mirror Node returns empty runtime_bytecode", async () => {
      restMock.onGet(`contracts/${contractAddress3}`).reply(404, {
        ...defaultContract,
        runtime_bytecode: EthImpl.emptyHex,
      });
      restMock.onGet(`accounts/${contractAddress3}?limit=100`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(contractAddress3, 16)}`).reply(404, null);
      sdkClientStub.getContractByteCode.returns(Buffer.from(deployedBytecode.replace("0x", ""), "hex"));
      const res = await ethImpl.getCode(contractAddress3, null);
      expect(res).to.equal(deployedBytecode);
    });

    it("should return redirect bytecode for HTS token", async () => {
      restMock.onGet(`contracts/${htsTokenAddress}`).reply(404, null);
      restMock.onGet(`accounts/${htsTokenAddress}?limit=100`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(htsTokenAddress, 16)}`).reply(200, defaultHTSToken);
      const redirectBytecode = `6080604052348015600f57600080fd5b506000610167905077618dc65e${htsTokenAddress.slice(
        2,
      )}600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033`;
      const res = await ethImpl.getCode(htsTokenAddress, null);
      expect(res).to.equal(redirectBytecode);
    });

    it("should return the static bytecode for address(0x167) call", async () => {
      restMock.onGet(`contracts/${EthImpl.iHTSAddress}`).reply(200, defaultContract);
      restMock.onGet(`accounts/${EthImpl.iHTSAddress}${noTransactions}`).reply(404, null);

      const res = await ethImpl.getCode(EthImpl.iHTSAddress, null);
      expect(res).to.equal(EthImpl.invalidEVMInstruction);
    });
  });

  describe("eth_getLogs", async function () {
    const latestBlock = {
      ...defaultBlock,
      number: 17,
      timestamp: {
        from: `1651560393.060890949`,
        to: "1651560395.060890949",
      },
    };

    it("blockHash filter timeouts and throws the expected error", async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]],
      };

      restMock.onGet(`blocks/${blockHash}`).timeout();
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);

      await ethGetLogsFailing(ethImpl, [blockHash, null, null, null, null], (error) => {
        expect(error.statusCode).to.equal(504);
        expect(error.message).to.eq("timeout of 10000ms exceeded");
      });
    });

    it("address filter timeouts and throws the expected error", async function () {
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/${contractAddress1}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .timeout();

      await ethGetLogsFailing(ethImpl, [null, null, null, contractAddress1, null], (error) => {
        expect(error.statusCode).to.equal(504);
        expect(error.message).to.eq("timeout of 10000ms exceeded");
      });
    });

    it("error when retrieving logs", async function () {
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(400, { _status: { messages: [{ message: "Mocked error" }] } });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;
      expect(result.length).to.eq(0);
    });

    it("no filters", async function () {
      const filteredLogs = {
        logs: [
          defaultLogs.logs[0],
          { ...defaultLogs.logs[1], address: "0x0000000000000000000000000000000002131952" },
          { ...defaultLogs.logs[2], address: "0x0000000000000000000000000000000002131953" },
          { ...defaultLogs.logs[3], address: "0x0000000000000000000000000000000002131954" },
        ],
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      filteredLogs.logs.forEach((log, index) => {
        restMock.onGet(`contracts/${log.address}`).reply(200, { ...defaultContract, contract_id: `0.0.105${index}` });
      });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData(result[0], filteredLogs.logs[0], defaultDetailedContractResults);
      expectLogData(result[1], filteredLogs.logs[1], defaultDetailedContractResults);
      expectLogData(result[2], filteredLogs.logs[2], defaultDetailedContractResults2);
      expectLogData(result[3], filteredLogs.logs[3], defaultDetailedContractResults3);
    });

    it("no filters but undefined transaction_index", async function () {
      const filteredLogs = {
        logs: [
          { ...defaultLogs.logs[0], transaction_index: undefined },
          { ...defaultLogs.logs[1], transaction_index: undefined },
          { ...defaultLogs.logs[2], transaction_index: undefined },
          { ...defaultLogs.logs[3], transaction_index: undefined },
        ],
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      filteredLogs.logs.forEach((log, index) => {
        restMock.onGet(`contracts/${log.address}`).reply(200, { ...defaultContract, contract_id: `0.0.105${index}` });
      });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(4);
      result.forEach((log, index) => {
        expect(log.transactionIndex).to.be.null;
      });
    });

    it("should be able to return more than two logs with limit of two per request", async function () {
      const unfilteredLogs = {
        logs: [
          { ...defaultLogs.logs[0], address: "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69" },
          { ...defaultLogs.logs[1], address: "0x0000000000000000000000000000000002131952" },
          { ...defaultLogs.logs[2], address: "0x0000000000000000000000000000000002131953" },
          { ...defaultLogs.logs[3], address: "0x0000000000000000000000000000000002131954" },
        ],
      };
      const filteredLogs = {
        logs: [
          { ...defaultLogs.logs[0], address: "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69" },
          { ...defaultLogs.logs[1], address: "0x0000000000000000000000000000000002131952" },
        ],
        links: { next: "contracts/results/logs?limit=2&order=desc&timestamp=lte:1668432962.375200975&index=lt:0" },
      };
      const filteredLogsNext = {
        logs: [
          { ...defaultLogs.logs[2], address: "0x0000000000000000000000000000000002131953" },
          { ...defaultLogs.logs[3], address: "0x0000000000000000000000000000000002131954" },
        ],
        links: { next: null },
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });

      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=2&order=asc`,
        )
        .replyOnce(200, filteredLogs)
        .onGet("contracts/results/logs?limit=2&order=desc&timestamp=lte:1668432962.375200975&index=lt:0")
        .replyOnce(200, filteredLogsNext);

      unfilteredLogs.logs.forEach((log, index) => {
        restMock.onGet(`contracts/${log.address}`).reply(200, { ...defaultContract, contract_id: `0.0.105${index}` });
      });
      //setting mirror node limit to 2 for this test only
      process.env["MIRROR_NODE_LIMIT_PARAM"] = "2";
      const result = await ethImpl.getLogs(null, null, null, null, null);
      //resetting mirror node limit to 100
      process.env["MIRROR_NODE_LIMIT_PARAM"] = "100";
      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData(result[0], filteredLogs.logs[0], defaultDetailedContractResults);
      expectLogData(result[1], filteredLogs.logs[1], defaultDetailedContractResults);
      expectLogData(result[2], filteredLogsNext.logs[0], defaultDetailedContractResults2);
      expectLogData(result[3], filteredLogsNext.logs[1], defaultDetailedContractResults3);
    });

    it("Should return evm address if contract has one", async function () {
      const filteredLogs = {
        logs: [
          {
            ...defaultLogs.logs[0],
            address: defaultEvmAddress,
          },
        ],
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      restMock
        .onGet(`contracts/${filteredLogs.logs[0].address}`)
        .reply(200, { ...defaultContract, evm_address: defaultEvmAddress });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(1);
      expect(result[0].address).to.eq(defaultEvmAddress);
    });

    it("address filter", async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1], defaultLogs.logs[2]],
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/${contractAddress1}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, null, null, contractAddress1, null);

      expect(result).to.exist;

      expect(result.length).to.eq(3);
      expectLogData1(result[0]);
      expectLogData2(result[1]);
      expectLogData3(result[2]);
    });

    it("multiple addresses filter", async function () {
      const filteredLogsAddress1 = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1], defaultLogs.logs[2]],
      };
      const filteredLogsAddress2 = {
        logs: defaultLogs3,
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/${contractAddress1}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogsAddress1);
      restMock
        .onGet(
          `contracts/${contractAddress2}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogsAddress2);
      for (const log of filteredLogsAddress1.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      const result = await ethImpl.getLogs(null, null, null, [contractAddress1, contractAddress2], null);

      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData1(result[0]);
      expectLogData2(result[1]);
      expectLogData3(result[2]);
      expectLogData4(result[3]);
    });

    it("blockHash filter", async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]],
      };

      restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(blockHash, null, null, null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it("with valid fromBlock && toBlock filter", async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]],
      };
      const toBlock = {
        ...defaultBlock,
        number: 16,
        timestamp: {
          from: `1651560391.060890949`,
          to: "1651560393.060890949",
        },
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet("blocks/5").reply(200, defaultBlock);
      restMock.onGet("blocks/16").reply(200, toBlock);
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${toBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, "0x5", "0x10", null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it("with non-existing fromBlock filter", async function () {
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });

      restMock.onGet("blocks/5").reply(200, defaultBlock);
      restMock.onGet("blocks/16").reply(404, { _status: { messages: [{ message: "Not found" }] } });

      const result = await ethImpl.getLogs(null, "0x10", "0x5", null, null);

      expect(result).to.exist;
      expect(result).to.be.empty;
    });

    it("with non-existing toBlock filter", async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0]],
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet("blocks/5").reply(200, defaultBlock);
      restMock.onGet("blocks/16").reply(404, { _status: { messages: [{ message: "Not found" }] } });
      restMock
        .onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&limit=100&order=asc`)
        .reply(200, filteredLogs);
      restMock.onGet(`contracts/${filteredLogs.logs[0].address}`).reply(200, defaultContract);

      const result = await ethImpl.getLogs(null, "0x5", "0x10", null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
    });

    it("when fromBlock > toBlock", async function () {
      const fromBlock = {
        ...defaultBlock,
        number: 16,
        timestamp: {
          from: `1651560391.060890949`,
          to: "1651560393.060890949",
        },
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet("blocks/16").reply(200, fromBlock);
      restMock.onGet("blocks/5").reply(200, defaultBlock);
      const result = await ethImpl.getLogs(null, "0x10", "0x5", null, null);

      expect(result).to.exist;
      expect(result).to.be.empty;
    });

    it("with only toBlock", async function () {
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet("blocks/5").reply(200, { blocks: [defaultBlock] });

      await ethGetLogsFailing(ethImpl, [null, null, "0x5", null, null], (error) => {
        expect(error.code).to.equal(-32011);
        expect(error.name).to.equal("Missing fromBlock parameter");
        expect(error.message).to.equal("Provided toBlock parameter without specifying fromBlock");
      });
    });

    it("with block tag", async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0]],
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, "latest", null, null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
    });

    it("when block range is too large", async function () {
      const fromBlock = {
        ...defaultBlock,
        number: 1,
      };
      const toBlock = {
        ...defaultBlock,
        number: 1003,
      };

      const blockBeyondMaximumRange = {
        ...defaultBlock,
        number: 1007,
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [blockBeyondMaximumRange] });
      restMock.onGet("blocks/1").reply(200, fromBlock);
      restMock.onGet("blocks/1003").reply(200, toBlock);

      await ethGetLogsFailing(ethImpl, [null, "0x1", "0x3eb", null, null], (error) => {
        expect(error.message).to.equal("Exceeded maximum block range: 1000");
      });
    });

    it("with topics filter", async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]],
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/results/logs` +
            `?timestamp=gte:${defaultBlock.timestamp.from}` +
            `&timestamp=lte:${defaultBlock.timestamp.to}` +
            `&topic0=${defaultLogTopics[0]}&topic1=${defaultLogTopics[1]}` +
            `&topic2=${defaultLogTopics[2]}&topic3=${defaultLogTopics[3]}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, null, null, null, defaultLogTopics);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it("with null topics filter", async function () {
      const filteredLogs = {
        logs: [defaultLogs4[0]],
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/results/logs` +
            `?timestamp=gte:${defaultBlock.timestamp.from}` +
            `&timestamp=lte:${defaultBlock.timestamp.to}` +
            `&topic0=${defaultLogTopics1[0]}` +
            `&topic1=${defaultLogTopics1[1]}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }
      const result = await ethImpl.getLogs(null, null, null, null, defaultNullLogTopics);

      expect(result).to.exist;
      expect(result[0].topics.length).to.eq(defaultLogs4[0].topics.length);
      for (let index = 0; index < result[0].topics.length; index++) {
        expect(result[0].topics[index]).to.eq(defaultLogs4[0].topics[index]);
      }
    });

    it("with topics and blocks filter", async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]],
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet("blocks/5").reply(200, defaultBlock);
      restMock.onGet("blocks/16").reply(200, defaultBlock);
      restMock
        .onGet(
          `contracts/results/logs` +
            `?timestamp=gte:${defaultBlock.timestamp.from}` +
            `&timestamp=lte:${defaultBlock.timestamp.to}` +
            `&topic0=${defaultLogTopics[0]}&topic1=${defaultLogTopics[1]}` +
            `&topic2=${defaultLogTopics[2]}&topic3=${defaultLogTopics[3]}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, "0x5", "0x10", null, defaultLogTopics);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });
  });

  it("eth_feeHistory", async function () {
    const previousBlock = {
      ...defaultBlock,
      number: blockNumber2,
      timestamp: {
        from: "1651560386.060890948",
        to: "1651560389.060890948",
      },
    };
    const latestBlock = { ...defaultBlock, number: blockNumber3 };
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    previousFees.fees[2].gas += 1;

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(2, "latest", [25, 75]);

    expect(feeHistory).to.exist;
    expect(feeHistory["baseFeePerGas"].length).to.equal(3);
    expect(feeHistory["gasUsedRatio"].length).to.equal(2);
    expect(feeHistory["baseFeePerGas"][0]).to.equal("0x870ab1a800");
    expect(feeHistory["baseFeePerGas"][1]).to.equal("0x84b6a5c400");
    expect(feeHistory["baseFeePerGas"][2]).to.equal("0x84b6a5c400");
    expect(feeHistory["gasUsedRatio"][0]).to.equal(gasUsedRatio);
    expect(feeHistory["oldestBlock"]).to.equal(`0x${previousBlock.number.toString(16)}`);
    const rewards = feeHistory["reward"][0];
    expect(rewards[0]).to.equal("0x0");
    expect(rewards[1]).to.equal("0x0");
  });

  it("eth_feeHistory with latest param", async function () {
    const previousBlock = {
      ...defaultBlock,
      number: blockNumber2,
      timestamp: {
        from: "1651560386.060890948",
        to: "1651560389.060890948",
      },
    };
    const latestBlock = { ...defaultBlock, number: blockNumber3 };
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, "latest", [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory["oldestBlock"]).to.eq("0x" + blockNumber3);
  });

  it("eth_feeHistory with pending param", async function () {
    const previousBlock = {
      ...defaultBlock,
      number: blockNumber2,
      timestamp: {
        from: "1651560386.060890948",
        to: "1651560389.060890948",
      },
    };
    const latestBlock = { ...defaultBlock, number: blockNumber3 };
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, "pending", [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory["oldestBlock"]).to.eq("0x" + blockNumber3);
  });

  it("eth_feeHistory with earliest param", async function () {
    const firstBlockIndex = 0;
    const secondBlockIndex = 1;
    const previousBlock = {
      ...defaultBlock,
      number: firstBlockIndex,
      timestamp: {
        from: "1651560386.060890948",
        to: "1651560389.060890948",
      },
    };
    const latestBlock = { ...defaultBlock, number: secondBlockIndex };
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, "earliest", [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory["oldestBlock"]).to.eq("0x" + firstBlockIndex);
  });

  it("eth_feeHistory with number param", async function () {
    const previousBlock = {
      ...defaultBlock,
      number: blockNumber2,
      timestamp: {
        from: "1651560386.060890948",
        to: "1651560389.060890948",
      },
    };
    const latestBlock = { ...defaultBlock, number: blockNumber3 };
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, "0x" + blockNumber3, [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory["oldestBlock"]).to.eq("0x" + blockNumber3);
  });

  it("eth_feeHistory with max results", async function () {
    const maxResultsCap = Number(constants.DEFAULT_FEE_HISTORY_MAX_RESULTS);

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [{ ...defaultBlock, number: 10 }] });
    restMock.onGet(`network/fees?timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultNetworkFees);
    Array.from(Array(11).keys()).map((blockNumber) =>
      restMock.onGet(`blocks/${blockNumber}`).reply(200, { ...defaultBlock, number: blockNumber }),
    );

    const feeHistory = await ethImpl.feeHistory(200, "0x9", [0]);

    expect(feeHistory).to.exist;
    expect(feeHistory["oldestBlock"]).to.equal(`0x0`);
    expect(feeHistory["reward"].length).to.equal(maxResultsCap);
    expect(feeHistory["baseFeePerGas"].length).to.equal(maxResultsCap + 1);
    expect(feeHistory["gasUsedRatio"].length).to.equal(maxResultsCap);
  });

  it("eth_feeHistory verify cached value", async function () {
    const latestBlock = { ...defaultBlock, number: blockNumber3 };
    const latestFees = defaultNetworkFees;
    const hexBlockNumber = `0x${latestBlock.number.toString(16)}`;

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const firstFeeHistory = await ethImpl.feeHistory(1, hexBlockNumber, null);
    const secondFeeHistory = await ethImpl.feeHistory(1, hexBlockNumber, null);

    expect(firstFeeHistory).to.exist;
    expect(firstFeeHistory["baseFeePerGas"][0]).to.equal(baseFeePerGasHex);
    expect(firstFeeHistory["gasUsedRatio"][0]).to.equal(gasUsedRatio);
    expect(firstFeeHistory["oldestBlock"]).to.equal(hexBlockNumber);

    expect(firstFeeHistory).to.equal(secondFeeHistory);
  });

  it("eth_feeHistory on mirror 404", async function () {
    const latestBlock = { ...defaultBlock, number: blockNumber3 };

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(404, {
      _status: {
        messages: [{ message: "Not found" }],
      },
    });
    const fauxGasTinyBars = 25_000;
    const fauxGasWeiBarHex = "0xe35fa931a000";
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const feeHistory = await ethImpl.feeHistory(1, "latest", [25, 75]);

    expect(feeHistory).to.exist;

    expect(feeHistory["baseFeePerGas"][0]).to.equal(fauxGasWeiBarHex);
    expect(feeHistory["gasUsedRatio"][0]).to.equal(gasUsedRatio);
    expect(feeHistory["oldestBlock"]).to.equal(`0x${latestBlock.number.toString(16)}`);
    const rewards = feeHistory["reward"][0];
    expect(rewards[0]).to.equal("0x0");
    expect(rewards[1]).to.equal("0x0");
  });

  it("eth_feeHistory on mirror 500", async function () {
    const latestBlock = { ...defaultBlock, number: blockNumber3 };

    restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(404, {
      _status: {
        messages: [{ message: "Not found" }],
      },
    });

    const fauxGasTinyBars = 35_000;
    const fauxGasWeiBarHex = "0x13e52b9abe000";
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const feeHistory = await ethImpl.feeHistory(1, "latest", null);

    expect(feeHistory["baseFeePerGas"][0]).to.equal(fauxGasWeiBarHex);
    expect(feeHistory["gasUsedRatio"][0]).to.equal(gasUsedRatio);
    expect(feeHistory["oldestBlock"]).to.equal(`0x${latestBlock.number.toString(16)}`);
  });

  describe("eth_feeHistory using fixed fees", function () {
    this.beforeAll(function () {
      process.env.ETH_FEE_HISTORY_FIXED = "true";
    });

    this.beforeEach(function () {
      cacheService.clear();
      restMock.reset();
      restMock.onGet(`network/fees`).reply(200, defaultNetworkFees);
    });

    this.afterAll(function () {
      process.env.ETH_FEE_HISTORY_FIXED = "false";
    });

    it("eth_feeHistory with fixed fees", async function () {
      const latestBlockNumber = 20;
      const latestBlock = { ...defaultBlock, number: latestBlockNumber };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 2;

      const feeHistory = await ethImpl.feeHistory(countBlocks, "latest", [25, 75]);

      expect(feeHistory).to.exist;
      expect(feeHistory["oldestBlock"]).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory["baseFeePerGas"].length).to.eq(countBlocks + 1);
      expect(feeHistory["baseFeePerGas"][0]).to.eq(baseFeePerGasHex);
      expect(feeHistory["baseFeePerGas"][1]).to.eq(baseFeePerGasHex);
      expect(feeHistory["baseFeePerGas"][2]).to.eq(baseFeePerGasHex);
    });

    it("eth_feeHistory 5 blocks with latest with fixed fees", async function () {
      const latestBlockNumber = 20;
      const latestBlock = { ...defaultBlock, number: latestBlockNumber };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 5;

      const feeHistory = await ethImpl.feeHistory(countBlocks, "latest", []);

      expect(feeHistory).to.exist;
      expect(feeHistory["oldestBlock"]).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory["baseFeePerGas"].length).to.eq(countBlocks + 1);
      expect(feeHistory["baseFeePerGas"][0]).to.eq(baseFeePerGasHex);
      expect(feeHistory["baseFeePerGas"][1]).to.eq(baseFeePerGasHex);
      expect(feeHistory["baseFeePerGas"][2]).to.eq(baseFeePerGasHex);
    });

    it("eth_feeHistory 5 blocks with custom newest with fixed fees", async function () {
      const latestBlockNumber = 10;
      const latestBlock = { ...defaultBlock, number: latestBlockNumber };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 5;

      const feeHistory = await ethImpl.feeHistory(countBlocks, "latest", []);

      expect(feeHistory).to.exist;
      expect(feeHistory["oldestBlock"]).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory["baseFeePerGas"].length).to.eq(countBlocks + 1);
      expect(feeHistory["baseFeePerGas"][0]).to.eq(baseFeePerGasHex);
      expect(feeHistory["baseFeePerGas"][1]).to.eq(baseFeePerGasHex);
      expect(feeHistory["baseFeePerGas"][2]).to.eq(baseFeePerGasHex);
    });

    it("eth_feeHistory with pending param", async function () {
      const latestBlockNumber = 20;
      const latestBlock = { ...defaultBlock, number: latestBlockNumber };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 5;

      const feeHistory = await ethImpl.feeHistory(countBlocks, "pending", []);

      expect(feeHistory).to.exist;
      expect(feeHistory["oldestBlock"]).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory["baseFeePerGas"].length).to.eq(countBlocks + 1);
      expect(feeHistory["baseFeePerGas"][0]).to.eq(baseFeePerGasHex);
    });

    it("eth_feeHistory with earliest param", async function () {
      const latestBlockNumber = 10;
      const latestBlock = { ...defaultBlock, number: latestBlockNumber };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/1`).reply(200, latestBlock);
      const countBlocks = 1;

      const feeHistory = await ethImpl.feeHistory(countBlocks, "earliest", []);

      expect(feeHistory).to.exist;
      expect(feeHistory["oldestBlock"]).to.eq(numberTo0x(1));
      expect(feeHistory["baseFeePerGas"].length).to.eq(2);
      expect(feeHistory["baseFeePerGas"][0]).to.eq(baseFeePerGasHex);
    });

    it("eth_feeHistory with fixed fees using cache", async function () {
      const latestBlockNumber = 20;
      const latestBlock = { ...defaultBlock, number: latestBlockNumber };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
      restMock.onGet(`network/fees`).reply(200, defaultNetworkFees);

      const countBlocks = 2;

      const feeHistory = await ethImpl.feeHistory(countBlocks, "latest", []);

      expect(feeHistory).to.exist;
      expect(feeHistory["oldestBlock"]).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory["baseFeePerGas"].length).to.eq(countBlocks + 1);
      expect(feeHistory["baseFeePerGas"][0]).to.eq(baseFeePerGasHex);
      expect(feeHistory["baseFeePerGas"][1]).to.eq(baseFeePerGasHex);
      expect(feeHistory["baseFeePerGas"][2]).to.eq(baseFeePerGasHex);

      restMock.onGet("blocks?limit=1&order=desc").reply(404, {});
      restMock.onGet(`blocks/${latestBlock.number}`).reply(404, {});

      const feeHistoryUsingCache = await ethImpl.feeHistory(countBlocks, "latest", []);
      expect(feeHistoryUsingCache).to.exist;
      expect(feeHistoryUsingCache["oldestBlock"]).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistoryUsingCache["baseFeePerGas"].length).to.eq(countBlocks + 1);
      expect(feeHistoryUsingCache["baseFeePerGas"][0]).to.eq(baseFeePerGasHex);
      expect(feeHistoryUsingCache["baseFeePerGas"][1]).to.eq(baseFeePerGasHex);
      expect(feeHistoryUsingCache["baseFeePerGas"][2]).to.eq(baseFeePerGasHex);
    });
  });

  it("eth_estimateGas with transaction.data null does not fail", async function () {
    const callData = {
      from: "0x05fba803be258049a27b820088bab1cad2058871",
      value: "0x0",
      gasPrice: "0x0",
      data: null,
    };
    web3Mock
      .onPost("contracts/call", { ...callData, estimate: true })
      .reply(501, { errorMessage: "", statusCode: 501 });

    const gas = await ethImpl.estimateGas(callData, null);
    expect(gas).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("eth_estimateGas to mirror node for contract call returns 501", async function () {
    const callData = {
      data: "0x608060405234801561001057600080fd5b506040516107893803806107898339818101604052810190610032919061015a565b806000908051906020019061004892919061004f565b50506102f6565b82805461005b90610224565b90600052602060002090601f01602090048101928261007d57600085556100c4565b82601f1061009657805160ff19168380011785556100c4565b828001600101855582156100c4579182015b828111156100c35782518255916020019190600101906100a8565b5b5090506100d191906100d5565b5090565b5b808211156100ee5760008160009055506001016100d6565b5090565b6000610105610100846101c0565b61019b565b90508281526020810184848401111561011d57600080fd5b6101288482856101f1565b509392505050565b600082601f83011261014157600080fd5b81516101518482602086016100f2565b91505092915050565b60006020828403121561016c57600080fd5b600082015167ffffffffffffffff81111561018657600080fd5b61019284828501610130565b91505092915050565b60006101a56101b6565b90506101b18282610256565b919050565b6000604051905090565b600067ffffffffffffffff8211156101db576101da6102b6565b5b6101e4826102e5565b9050602081019050919050565b60005b8381101561020f5780820151818401526020810190506101f4565b8381111561021e576000848401525b50505050565b6000600282049050600182168061023c57607f821691505b602082108114156102505761024f610287565b5b50919050565b61025f826102e5565b810181811067ffffffffffffffff8211171561027e5761027d6102b6565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b610484806103056000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063a41368621461003b578063cfae321714610057575b600080fd5b6100556004803603810190610050919061022c565b610075565b005b61005f61008f565b60405161006c91906102a6565b60405180910390f35b806000908051906020019061008b929190610121565b5050565b60606000805461009e9061037c565b80601f01602080910402602001604051908101604052809291908181526020018280546100ca9061037c565b80156101175780601f106100ec57610100808354040283529160200191610117565b820191906000526020600020905b8154815290600101906020018083116100fa57829003601f168201915b5050505050905090565b82805461012d9061037c565b90600052602060002090601f01602090048101928261014f5760008555610196565b82601f1061016857805160ff1916838001178555610196565b82800160010185558215610196579182015b8281111561019557825182559160200191906001019061017a565b5b5090506101a391906101a7565b5090565b5b808211156101c05760008160009055506001016101a8565b5090565b60006101d76101d2846102ed565b6102c8565b9050828152602081018484840111156101ef57600080fd5b6101fa84828561033a565b509392505050565b600082601f83011261021357600080fd5b81356102238482602086016101c4565b91505092915050565b60006020828403121561023e57600080fd5b600082013567ffffffffffffffff81111561025857600080fd5b61026484828501610202565b91505092915050565b60006102788261031e565b6102828185610329565b9350610292818560208601610349565b61029b8161043d565b840191505092915050565b600060208201905081810360008301526102c0818461026d565b905092915050565b60006102d26102e3565b90506102de82826103ae565b919050565b6000604051905090565b600067ffffffffffffffff8211156103085761030761040e565b5b6103118261043d565b9050602081019050919050565b600081519050919050565b600082825260208201905092915050565b82818337600083830152505050565b60005b8381101561036757808201518184015260208101905061034c565b83811115610376576000848401525b50505050565b6000600282049050600182168061039457607f821691505b602082108114156103a8576103a76103df565b5b50919050565b6103b78261043d565b810181811067ffffffffffffffff821117156103d6576103d561040e565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f830116905091905056fea264697066735822122070d157c4efbb3fba4a1bde43cbba5b92b69f2fc455a650c0dfb61e9ed3d4bd6364736f6c634300080400330000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b696e697469616c5f6d7367000000000000000000000000000000000000000000",
      from: "0x81cb089c285e5ee3a7353704fb114955037443af",
    };
    web3Mock
      .onPost("contracts/call", { ...callData, estimate: true })
      .reply(501, { errorMessage: "", statusCode: 501 });

    const gas = await ethImpl.estimateGas(callData, null);
    expect(gas).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("eth_estimateGas contract call returns workaround response from mirror-node", async function () {
    const callData = {
      data: "0x608060405234801561001057600080fd5b506040516107893803806107898339818101604052810190610032919061015a565b806000908051906020019061004892919061004f565b50506102f6565b82805461005b90610224565b90600052602060002090601f01602090048101928261007d57600085556100c4565b82601f1061009657805160ff19168380011785556100c4565b828001600101855582156100c4579182015b828111156100c35782518255916020019190600101906100a8565b5b5090506100d191906100d5565b5090565b5b808211156100ee5760008160009055506001016100d6565b5090565b6000610105610100846101c0565b61019b565b90508281526020810184848401111561011d57600080fd5b6101288482856101f1565b509392505050565b600082601f83011261014157600080fd5b81516101518482602086016100f2565b91505092915050565b60006020828403121561016c57600080fd5b600082015167ffffffffffffffff81111561018657600080fd5b61019284828501610130565b91505092915050565b60006101a56101b6565b90506101b18282610256565b919050565b6000604051905090565b600067ffffffffffffffff8211156101db576101da6102b6565b5b6101e4826102e5565b9050602081019050919050565b60005b8381101561020f5780820151818401526020810190506101f4565b8381111561021e576000848401525b50505050565b6000600282049050600182168061023c57607f821691505b602082108114156102505761024f610287565b5b50919050565b61025f826102e5565b810181811067ffffffffffffffff8211171561027e5761027d6102b6565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b610484806103056000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063a41368621461003b578063cfae321714610057575b600080fd5b6100556004803603810190610050919061022c565b610075565b005b61005f61008f565b60405161006c91906102a6565b60405180910390f35b806000908051906020019061008b929190610121565b5050565b60606000805461009e9061037c565b80601f01602080910402602001604051908101604052809291908181526020018280546100ca9061037c565b80156101175780601f106100ec57610100808354040283529160200191610117565b820191906000526020600020905b8154815290600101906020018083116100fa57829003601f168201915b5050505050905090565b82805461012d9061037c565b90600052602060002090601f01602090048101928261014f5760008555610196565b82601f1061016857805160ff1916838001178555610196565b82800160010185558215610196579182015b8281111561019557825182559160200191906001019061017a565b5b5090506101a391906101a7565b5090565b5b808211156101c05760008160009055506001016101a8565b5090565b60006101d76101d2846102ed565b6102c8565b9050828152602081018484840111156101ef57600080fd5b6101fa84828561033a565b509392505050565b600082601f83011261021357600080fd5b81356102238482602086016101c4565b91505092915050565b60006020828403121561023e57600080fd5b600082013567ffffffffffffffff81111561025857600080fd5b61026484828501610202565b91505092915050565b60006102788261031e565b6102828185610329565b9350610292818560208601610349565b61029b8161043d565b840191505092915050565b600060208201905081810360008301526102c0818461026d565b905092915050565b60006102d26102e3565b90506102de82826103ae565b919050565b6000604051905090565b600067ffffffffffffffff8211156103085761030761040e565b5b6103118261043d565b9050602081019050919050565b600081519050919050565b600082825260208201905092915050565b82818337600083830152505050565b60005b8381101561036757808201518184015260208101905061034c565b83811115610376576000848401525b50505050565b6000600282049050600182168061039457607f821691505b602082108114156103a8576103a76103df565b5b50919050565b6103b78261043d565b810181811067ffffffffffffffff821117156103d6576103d561040e565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f830116905091905056fea264697066735822122070d157c4efbb3fba4a1bde43cbba5b92b69f2fc455a650c0dfb61e9ed3d4bd6364736f6c634300080400330000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b696e697469616c5f6d7367000000000000000000000000000000000000000000",
      from: "0x81cb089c285e5ee3a7353704fb114955037443af",
    };
    web3Mock.onPost("contracts/call", { ...callData, estimate: true }).reply(200, { result: `0x61A80` });

    const gas = await ethImpl.estimateGas(callData, null);
    expect(gas).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("eth_estimateGas contract call returns default", async function () {
    const gas = await ethImpl.estimateGas({ data: "0x01" }, null);
    expect(gas).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("eth_estimateGas to mirror node for transfer returns 501", async function () {
    const callData = {
      data: "0x",
      from: "0x81cb089c285e5ee3a7353704fb114955037443af",
      to: receiverAddress,
      value: "0x2540BE400",
    };
    web3Mock
      .onPost("contracts/call", { ...callData, estimate: true })
      .reply(501, { errorMessage: "", statusCode: 501 });

    restMock.onGet(`accounts/${receiverAddress}${noTransactions}`).reply(200, { address: receiverAddress });

    const gas = await ethImpl.estimateGas(callData, null);
    expect(gas).to.equal(numberTo0x(constants.TX_BASE_COST));
  });

  it("eth_estimateGas to mirror node for transfer without value returns 501", async function () {
    const callData = {
      data: "0x",
      from: "0x81cb089c285e5ee3a7353704fb114955037443af",
      to: receiverAddress,
    };
    web3Mock
      .onPost("contracts/call", { ...callData, estimate: true })
      .reply(501, { errorMessage: "", statusCode: 501 });
    restMock.onGet(`accounts/${receiverAddress}${noTransactions}`).reply(200, { address: receiverAddress });

    const result = await ethImpl.estimateGas(callData, null);
    expect(result).to.not.be.null;
    expect(result.code).to.eq(-32602);
    expect(result.name).to.eq("Invalid parameter");
  });

  it("eth_estimateGas transfer to existing account", async function () {
    restMock.onGet(`accounts/${receiverAddress}${noTransactions}`).reply(200, { address: receiverAddress });

    const gas = await ethImpl.estimateGas(
      {
        to: receiverAddress,
        value: 100_000_000_000,
      },
      null,
    );
    expect(gas).to.equal(EthImpl.gasTxBaseCost);
  });

  it("eth_estimateGas transfer to existing cached account", async function () {
    restMock.onGet(`accounts/${receiverAddress}${noTransactions}`).reply(200, { address: receiverAddress });

    const gasBeforeCache = await ethImpl.estimateGas(
      {
        to: receiverAddress,
        value: 100_000_000_000,
      },
      null,
    );

    restMock.onGet(`accounts/${receiverAddress}${noTransactions}`).reply(404);
    const gasAfterCache = await ethImpl.estimateGas(
      {
        to: receiverAddress,
        value: 100_000_000_000,
      },
      null,
    );

    expect(gasBeforeCache).to.equal(EthImpl.gasTxBaseCost);
    expect(gasAfterCache).to.equal(EthImpl.gasTxBaseCost);
  });

  it("eth_estimateGas transfer to non existing account", async function () {
    restMock.onGet(`accounts/${receiverAddress}${noTransactions}`).reply(404);

    const hollowAccountGasCreation = await ethImpl.estimateGas(
      {
        to: receiverAddress,
        value: 100_000_000_000,
      },
      null,
    );

    expect(hollowAccountGasCreation).to.equal(EthImpl.gasTxHollowAccountCreation);
  });

  it("eth_estimateGas transfer with 0 value", async function () {
    const result = await ethImpl.estimateGas(
      {
        to: receiverAddress,
        value: 0,
      },
      null,
    );

    expect(result).to.exist;
    expect(result.code).to.equal(-32602);
    expect(result.name).to.equal("Invalid parameter");
    expect(result.message).to.equal(
      `Invalid parameter 0: Invalid 'value' field in transaction param. Value must be greater than 0`,
    );
  });

  it("eth_estimateGas transfer with invalid value", async function () {
    const result = await ethImpl.estimateGas(
      {
        to: receiverAddress,
        value: null,
      },
      null,
    );

    expect(result).to.exist;
    expect(result.code).to.equal(-32602);
    expect(result.name).to.equal("Invalid parameter");
    expect(result.message).to.equal(
      `Invalid parameter 0: Invalid 'value' field in transaction param. Value must be greater than 0`,
    );
  });

  it("eth_estimateGas empty call returns transfer cost", async function () {
    restMock.onGet(`accounts/undefined${noTransactions}`).reply(404);
    const gas = await ethImpl.estimateGas({}, null);
    expect(gas).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("eth_estimateGas empty call returns transfer cost with overridden default gas", async function () {
    const defaultGasOverride = constants.TX_DEFAULT_GAS_DEFAULT + 1;
    process.env.TX_DEFAULT_GAS = defaultGasOverride.toString();
    const ethImplOverridden = new EthImpl(sdkClientStub, mirrorNodeInstance, logger, "0x12a", registry, cacheService);
    restMock.onGet(`accounts/undefined${noTransactions}`).reply(404);
    const gas = await ethImplOverridden.estimateGas({}, null);
    expect(gas).to.equal(numberTo0x(defaultGasOverride));
  });

  it("eth_estimateGas empty input transfer cost", async function () {
    restMock.onGet(`accounts/undefined${noTransactions}`).reply(404);
    const gas = await ethImpl.estimateGas({ data: "" }, null);
    expect(gas).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("eth_estimateGas empty input transfer cost with overridden default gas", async function () {
    const defaultGasOverride = constants.TX_DEFAULT_GAS_DEFAULT + 1;
    process.env.TX_DEFAULT_GAS = defaultGasOverride.toString();
    const ethImplOverridden = new EthImpl(sdkClientStub, mirrorNodeInstance, logger, "0x12a", registry, cacheService);
    restMock.onGet(`accounts/undefined${noTransactions}`).reply(404);
    const gas = await ethImplOverridden.estimateGas({ data: "" }, null);
    expect(gas).to.equal(numberTo0x(defaultGasOverride));
  });

  it("eth_estimateGas zero input returns transfer cost", async function () {
    restMock.onGet(`accounts/undefined${noTransactions}`).reply(404);
    const gas = await ethImpl.estimateGas({ data: "0x" }, null);
    expect(gas).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("eth_estimateGas zero input returns transfer cost with overridden default gas", async function () {
    const defaultGasOverride = constants.TX_DEFAULT_GAS_DEFAULT + 1;
    process.env.TX_DEFAULT_GAS = defaultGasOverride.toString();
    const ethImplOverridden = new EthImpl(sdkClientStub, mirrorNodeInstance, logger, "0x12a", registry, cacheService);
    restMock.onGet(`accounts/undefined${noTransactions}`).reply(404);
    const gas = await ethImplOverridden.estimateGas({ data: "0x" }, null);
    expect(gas).to.equal(numberTo0x(defaultGasOverride));
  });

  it("eth_estimateGas with contract revert and message does not equal executionReverted", async function () {
    const transaction = {
      from: "0x05fba803be258049a27b820088bab1cad2058871",
      data: "0x60806040523480156200001157600080fd5b50604051620019f4380380620019f48339818101604052810190620000379190620001fa565b818181600390816200004a9190620004ca565b5080600490816200005c9190620004ca565b5050505050620005b1565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620000d08262000085565b810181811067ffffffffffffffff82111715620000f257620000f162000096565b5b80604052505",
    };
    const id = uuid();
    web3Mock.onPost("contracts/call", { ...transaction, estimate: true }).reply(400, {
      _status: {
        messages: [
          {
            message: "data field invalid hexadecimal string",
            detail: "",
            data: "",
          },
        ],
      },
    });

    const result: any = await ethImpl.estimateGas(transaction, id);

    expect(result).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("eth_estimateGas with contract revert and message does not equal executionReverted and ESTIMATE_GAS_THROWS is set to false", async function () {
    const estimateGasThrows = process.env.ESTIMATE_GAS_THROWS;
    process.env.ESTIMATE_GAS_THROWS = "false";
    const transaction = {
      from: "0x05fba803be258049a27b820088bab1cad2058871",
      data: "0x60806040523480156200001157600080fd5b50604051620019f4380380620019f48339818101604052810190620000379190620001fa565b818181600390816200004a9190620004ca565b5080600490816200005c9190620004ca565b5050505050620005b1565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620000d08262000085565b810181811067ffffffffffffffff82111715620000f257620000f162000096565b5b80604052505",
    };
    const id = uuid();
    web3Mock.onPost("contracts/call", { ...transaction, estimate: true }).reply(400, {
      _status: {
        messages: [
          {
            message: "data field invalid hexadecimal string",
            detail: "",
            data: "",
          },
        ],
      },
    });

    const result: any = await ethImpl.estimateGas(transaction, id);

    expect(result).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
    process.env.ESTIMATE_GAS_THROWS = estimateGasThrows;
  });

  it('eth_estimateGas with contract revert and message equals "execution reverted: Invalid number of recipients"', async function () {
    const transaction = {
      from: "0x05fba803be258049a27b820088bab1cad2058871",
      data: "0x60806040523480156200001157600080fd5b50604051620019f4380380620019f48339818101604052810190620000379190620001fa565b818181600390816200004a9190620004ca565b5080600490816200005c9190620004ca565b5050505050620005b1565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620000d08262000085565b810181811067ffffffffffffffff82111715620000f257620000f162000096565b5b80604052505",
    };
    const id = uuid();
    web3Mock.onPost("contracts/call", { ...transaction, estimate: true }).reply(400, {
      _status: {
        messages: [
          {
            data: "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001c496e76616c6964206e756d626572206f6620726563697069656e747300000000",
            detail: "Invalid number of recipients",
            message: "CONTRACT_REVERT_EXECUTED",
          },
        ],
      },
    });

    const result: any = await ethImpl.estimateGas(transaction, id);

    expect(result.data).to.equal(
      "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001c496e76616c6964206e756d626572206f6620726563697069656e747300000000",
    );
    expect(result.message).to.equal("execution reverted: Invalid number of recipients");
  });

  it("eth_estimateGas handles a 501 unimplemented response from the mirror node correctly by returning default gas", async function () {
    const transaction = {
      from: "0x05fba803be258049a27b820088bab1cad2058871",
      data: "0x60806040523480156200001157600080fd5b50604051620019f4380380620019f48339818101604052810190620000379190620001fa565b818181600390816200004a9190620004ca565b5080600490816200005c9190620004ca565b5050505050620005b1565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620000d08262000085565b810181811067ffffffffffffffff82111715620000f257620000f162000096565b5b80604052505",
    };
    const id = uuid();
    web3Mock.onPost("contracts/call", { ...transaction, estimate: true }).reply(501, {
      _status: {
        messages: [
          {
            message: "Auto account creation is not supported.",
            detail: "",
            data: "",
          },
        ],
      },
    });

    const result: any = await ethImpl.estimateGas(transaction, id);
    expect(result).to.equal(numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT));
  });

  it("should perform estimateGas precheck", async function () {
    const transaction = {
      from: "0x05fba803be258049a27b820088bab1cad2058871",
      data: "0x",
      value: "0xA186B8E9800",
      gasPrice: "0xF4240",
    };

    ethImpl.contractCallFormat(transaction);
    expect(transaction.value).to.eq(1110);
    expect(transaction.gasPrice).to.eq(1000000);
  });

  describe("eth_gasPrice", async function () {
    it("eth_gasPrice", async function () {
      restMock.onGet(`network/fees`).reply(200, defaultNetworkFees);

      const weiBars = await ethImpl.gasPrice();
      const expectedWeiBars = defaultNetworkFees.fees[2].gas * constants.TINYBAR_TO_WEIBAR_COEF;
      expect(weiBars).to.equal(numberTo0x(expectedWeiBars));
    });

    it("eth_gasPrice with cached value", async function () {
      restMock.onGet(`network/fees`).reply(200, defaultNetworkFees);

      const firstGasResult = await ethImpl.gasPrice();

      const modifiedNetworkFees = { ...defaultNetworkFees };
      modifiedNetworkFees.fees[2].gas = defaultNetworkFees.fees[2].gas * 100;

      restMock.onGet(`network/fees`).reply(200, modifiedNetworkFees);

      const secondGasResult = await ethImpl.gasPrice();

      expect(firstGasResult).to.equal(secondGasResult);
    });

    it("eth_gasPrice with no EthereumTransaction gas returned", async function () {
      // deep copy defaultNetworkFees to avoid mutating the original object
      const partialNetworkFees = JSON.parse(JSON.stringify(defaultNetworkFees));
      partialNetworkFees.fees.splice(2);

      restMock.onGet(`network/fees`).reply(200, partialNetworkFees);

      await RelayAssertions.assertRejection(predefined.COULD_NOT_ESTIMATE_GAS_PRICE, ethImpl.gasPrice, true, ethImpl);
    });

    it("eth_gasPrice with mirror node return network fees found", async function () {
      restMock.onGet(`network/fees`).reply(404, {
        _status: {
          messages: [
            {
              message: "Not found",
            },
          ],
        },
      });

      const fauxGasTinyBars = 35_000;
      const fauxGasWeiBarHex = "0x13e52b9abe000";
      sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

      const gas = await ethImpl.gasPrice();
      expect(gas).to.equal(fauxGasWeiBarHex);
    });

    it("eth_gasPrice with no network fees records found", async function () {
      restMock.onGet(`network/fees`).reply(404, {
        _status: {
          messages: [
            {
              message: "Not found",
            },
          ],
        },
      });

      await RelayAssertions.assertRejection(predefined.COULD_NOT_ESTIMATE_GAS_PRICE, ethImpl.gasPrice, true, ethImpl);
    });
  });

  describe("eth_call precheck failures", async function () {
    let callConsensusNodeSpy: sinon.SinonSpy;
    let callMirrorNodeSpy: sinon.SinonSpy;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      callConsensusNodeSpy = sandbox.spy(ethImpl, "callConsensusNode");
      callMirrorNodeSpy = sandbox.spy(ethImpl, "callMirrorNode");
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("eth_call with missing `to` field", async function () {
      await ethCallFailing(
        ethImpl,
        {
          from: contractAddress1,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        "latest",
        (error) => {
          expect(error.message).to.equal(`Invalid Contract Address: ${undefined}.`);
        },
      );
    });

    it("eth_call with incorrect `to` field length", async function () {
      await ethCallFailing(
        ethImpl,
        {
          from: contractAddress1,
          to: EthImpl.zeroHex,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        "latest",
        (error) => {
          expect(error.message).to.equal(
            `Invalid Contract Address: ${EthImpl.zeroHex}. Expected length of 42 chars but was 3.`,
          );
        },
      );
    });

    it('should execute "eth_call" against mirror node with a false ETH_CALL_DEFAULT_TO_CONSENSUS_NODE', async function () {
      const initialEthCallConesneusFF = process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE;

      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = "false";
      restMock.onGet(`contracts/${defaultCallData.from}`).reply(404);
      restMock.onGet(`accounts/${defaultCallData.from}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: defaultCallData.from,
      });
      restMock.onGet(`contracts/${defaultCallData.to}`).reply(200, defaultContract);
      await ethImpl.call({ ...defaultCallData, gas: `0x${defaultCallData.gas.toString(16)}` }, "latest");

      assert(callMirrorNodeSpy.calledOnce);
      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = initialEthCallConesneusFF;
    });

    it('should execute "eth_call" against mirror node with an undefined ETH_CALL_DEFAULT_TO_CONSENSUS_NODE', async function () {
      const initialEthCallConesneusFF = process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE;

      delete process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE;
      restMock.onGet(`contracts/${defaultCallData.from}`).reply(404);
      restMock.onGet(`accounts/${defaultCallData.from}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: defaultCallData.from,
      });
      restMock.onGet(`contracts/${defaultCallData.to}`).reply(200, defaultContract);
      await ethImpl.call({ ...defaultCallData, gas: `0x${defaultCallData.gas.toString(16)}` }, "latest");

      assert(callMirrorNodeSpy.calledOnce);
      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = initialEthCallConesneusFF;
    });

    it('should execute "eth_call" against mirror node with a ETH_CALL_DEFAULT_TO_CONSENSUS_NODE set to true', async function () {
      const initialEthCallConesneusFF = process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE;

      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = "true";
      restMock.onGet(`contracts/${defaultCallData.from}`).reply(404);
      restMock.onGet(`accounts/${defaultCallData.from}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: defaultCallData.from,
      });
      restMock.onGet(`contracts/${defaultCallData.to}`).reply(200, defaultContract);
      await ethImpl.call({ ...defaultCallData, gas: `0x${defaultCallData.gas.toString(16)}` }, "latest");

      assert(callConsensusNodeSpy.calledOnce);
      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = initialEthCallConesneusFF;
    });

    it("gas exceeds limit", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(404);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      const excessiveGasLimit = "15000001";
      await ethCallFailing(
        ethImpl,
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: excessiveGasLimit,
        },
        "latest",
        (error) => {
          expect(error).to.be.not.null;
          expect(error.code).to.equal(predefined.GAS_LIMIT_TOO_HIGH(excessiveGasLimit, constants.BLOCK_GAS_LIMIT).code);
        },
      );
    });

    it("block 0", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(404);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      const block = "0";
      await ethCallFailing(
        ethImpl,
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        block,
        (error) => {
          const predefineError = predefined.UNSUPPORTED_HISTORICAL_EXECUTION(block);
          expect(error.code).to.equal(predefineError.code);
          expect(error.name).to.equal(predefineError.name);
          expect(error.message).to.equal(predefineError.message);
        },
      );
    });

    it("block 1", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(404);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      const block = "1";
      await ethCallFailing(
        ethImpl,
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        block,
        (error) => {
          const predefineError = predefined.UNSUPPORTED_HISTORICAL_EXECUTION(block);
          expect(error.code).to.equal(predefineError.code);
          expect(error.name).to.equal(predefineError.name);
          expect(error.message).to.equal(predefineError.message);
        },
      );
    });

    it("block earliest", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(404);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      const block = "earliest";
      await ethCallFailing(
        ethImpl,
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        block,
        (error) => {
          const predefineError = predefined.UNSUPPORTED_HISTORICAL_EXECUTION(block);
          expect(error.code).to.equal(predefineError.code);
          expect(error.name).to.equal(predefineError.name);
          expect(error.message).to.equal(predefineError.message);
        },
      );
    });

    it("block hash not supported", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(404);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      restMock.onGet(`blocks?limit=1&order=desc`).reply(202);

      await ethCallFailing(
        ethImpl,
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        blockHashTrimmed,
        (error) => {
          const predefineError = predefined.UNSUPPORTED_OPERATION(
            `BlockParam: ${blockHashTrimmed} is not a supported eth_call block identifier`,
          );
          expect(error.code).to.equal(predefineError.code);
          expect(error.name).to.equal(predefineError.name);
          expect(error.message).to.equal(predefineError.message);
        },
      );
    });

    it("latest block but not found for comparison", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(404);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      restMock.onGet(`blocks?limit=1&order=desc`).reply(404);

      const block = "0x10";
      await ethCallFailing(
        ethImpl,
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        block,
        (error) => {
          const predefineError = predefined.RESOURCE_NOT_FOUND(`unable to retrieve latest block from mirror node`);
          expect(error.code).to.equal(predefineError.code);
          expect(error.name).to.equal(predefineError.name);
          expect(error.message).to.equal(predefineError.message);
        },
      );
    });

    it("to field is not a contract or token", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(404);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(404);
      restMock.onGet(`tokens/${contractId2}`).reply(404);
      web3Mock.onPost(`contracts/call`).reply(200, { result: "0x1" });

      await expect(
        ethImpl.call(
          {
            from: accountAddress1,
            to: contractAddress2,
            data: contractCallData,
            gas: maxGasLimitHex,
          },
          "latest",
        ),
      ).to.eventually.be.fulfilled.and.equal("0x1");
    });

    // support for web3js.
    it("the input is set with the encoded data for the data field", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(200);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200);
      restMock.onGet(`tokens/${contractId2}`).reply(200);
      web3Mock.onPost(`contracts/call`).reply(200, { result: "0x1" });

      await expect(
        ethImpl.call(
          {
            from: accountAddress1,
            to: contractAddress2,
            input: contractCallData,
            gas: maxGasLimitHex,
          },
          "latest",
        ),
      ).to.eventually.be.fulfilled.and.equal("0x1");
    });
  });

  describe("eth_call using consensus node", async function () {
    let initialEthCallConesneusFF;

    before(() => {
      initialEthCallConesneusFF = process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE;
      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = "true";
    });

    after(() => {
      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = initialEthCallConesneusFF;
    });

    it("eth_call with no gas", async function () {
      restMock.onGet(`contracts/${accountAddress1}`).reply(404);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      sdkClientStub.submitContractCallQueryWithRetry.returns({
        asBytes: function () {
          return Uint8Array.of(0);
        },
      });

      const result = await ethImpl.call(
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
        },
        "latest",
      );

      sinon.assert.calledWith(
        sdkClientStub.submitContractCallQueryWithRetry,
        contractAddress2,
        contractCallData,
        400_000,
        accountAddress1,
        "eth_call",
      );
      expect(result).to.equal("0x00");
    });

    it("eth_call with no data", async function () {
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      sdkClientStub.submitContractCallQueryWithRetry.returns({
        asBytes: function () {
          return Uint8Array.of(0);
        },
      });

      const result = await ethImpl.call(
        {
          from: accountAddress1,
          to: contractAddress2,
          gas: maxGasLimitHex,
        },
        "latest",
      );

      sinon.assert.calledWith(
        sdkClientStub.submitContractCallQueryWithRetry,
        contractAddress2,
        undefined,
        maxGasLimit,
        accountAddress1,
        "eth_call",
      );
      expect(result).to.equal("0x00");
    });

    it('eth_call with no "from" address', async function () {
      const callData = {
        ...defaultCallData,
        from: undefined,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };

      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      sdkClientStub.submitContractCallQueryWithRetry.returns({
        asBytes: function () {
          return Uint8Array.of(0);
        },
      });

      const result = await ethImpl.call(callData, "latest");
      expect(result).to.equal("0x00");
    });

    it('eth_call with wrong "from" address', async function () {
      const callData = {
        ...defaultCallData,
        from: "0x0000000000000000000000000000000000000000",
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };

      const result = await ethImpl.call(callData, "latest");

      expect(result.name).to.equal("Non Existing Account Address");
      expect(result.code).to.equal(-32014);
      expect(result.message).to.equal(`Non Existing Account Address: ${callData.from}. Expected an Account Address.`);
    });

    it("eth_call with all fields", async function () {
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      sdkClientStub.submitContractCallQueryWithRetry.returns({
        asBytes: function () {
          return Uint8Array.of(0);
        },
      });

      const result = await ethImpl.call(
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        "latest",
      );

      sinon.assert.calledWith(
        sdkClientStub.submitContractCallQueryWithRetry,
        contractAddress2,
        contractCallData,
        maxGasLimit,
        accountAddress1,
        "eth_call",
      );
      expect(result).to.equal("0x00");
    });

    //Return once the value, then it's being fetched from cache. After the loop we reset the sdkClientStub, so that it returns nothing, if we get an error in the next request that means that the cache was cleared.
    it("eth_call should cache the response for 200ms", async function () {
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      sdkClientStub.submitContractCallQueryWithRetry.returns({
        asBytes: function () {
          return Uint8Array.of(0);
        },
      });

      for (let index = 0; index < 3; index++) {
        const result = await ethImpl.call(
          {
            from: accountAddress1,
            to: contractAddress2,
            data: contractCallData,
            gas: maxGasLimitHex,
          },
          "latest",
        );
        expect(result).to.equal("0x00");
        await new Promise((r) => setTimeout(r, 50));
      }

      await new Promise((r) => setTimeout(r, 200));

      const expectedError = predefined.INVALID_CONTRACT_ADDRESS(contractAddress2);
      sdkClientStub.submitContractCallQueryWithRetry.throws(expectedError);
      const call: string | JsonRpcError = await ethImpl.call(
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        "latest",
      );

      expect(call.code).to.equal(expectedError.code);
      expect(call.name).to.equal(expectedError.name);
      expect(call.message).to.equal(expectedError.message);
    });

    describe("with gas > 15_000_000", async function () {
      it("eth_call throws gasLimit too high error when gas exceeds limit", async function () {
        restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

        sdkClientStub.submitContractCallQueryWithRetry.returns(undefined);

        const args = [
          {
            to: contractAddress2,
            data: contractCallData,
            gas: 50_000_000,
          },
          "latest",
        ];

        await RelayAssertions.assertRejection(
          predefined.GAS_LIMIT_TOO_HIGH(50000000, constants.BLOCK_GAS_LIMIT),
          ethImpl.call,
          false,
          ethImpl,
          args,
        );
      });
    });

    it("SDK returns a precheck error", async function () {
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      sdkClientStub.submitContractCallQueryWithRetry.throws(
        predefined.CONTRACT_REVERT(defaultErrorMessageText, defaultErrorMessageHex),
      );

      const result = await ethImpl.call(
        {
          from: accountAddress1,
          to: contractAddress2,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        "latest",
      );

      expect(result).to.exist;
      expect(result.code).to.equal(-32008);
      expect(result.name).to.equal("Contract revert executed");
      expect(result.message).to.equal(`execution reverted: ${defaultErrorMessageText}`);
      expect(result.data).to.equal(defaultErrorMessageHex);
    });

    it("eth_call with wrong `to` field", async function () {
      const args = [
        {
          from: contractAddress1,
          to: wrongContractAddress,
          data: contractCallData,
          gas: maxGasLimitHex,
        },
        "latest",
      ];

      await RelayAssertions.assertRejection(
        predefined.INVALID_CONTRACT_ADDRESS(wrongContractAddress),
        ethImpl.call,
        false,
        ethImpl,
        args,
      );
    });

    it("eth_call throws internal error when consensus node times out and submitContractCallQueryWithRetry returns undefined", async function () {
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      sdkClientStub.submitContractCallQueryWithRetry.returns(undefined);

      const result = await ethImpl.call(
        {
          to: contractAddress2,
          data: contractCallData,
          gas: 5_000_000,
        },
        "latest",
      );

      expect(result).to.exist;
      expect(result.code).to.equal(-32603);
      expect(result.name).to.equal("Internal error");
      expect(result.message).to.equal(
        "Error invoking RPC: Invalid contractCallResponse from consensus-node: undefined",
      );
    });
  });

  describe("eth_call using mirror node", async function () {
    const defaultCallData = {
      gas: 400000,
      value: null,
    };
    let initialEthCallConesneusFF;

    before(() => {
      initialEthCallConesneusFF = process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE;
      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = "false";
    });

    after(() => {
      process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = initialEthCallConesneusFF;
    });

    //temporary workaround until precompiles are implemented in Mirror node evm module
    beforeEach(() => {
      restMock.onGet(`tokens/${defaultContractResults.results[1].contract_id}`).reply(404, null);
      web3Mock.reset();
    });

    it("eth_call with all fields, but mirror-node returns empty response", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract3EmptyBytecode);
      web3Mock.onPost(`contracts/call`).replyOnce(200, {});

      const result = await ethImpl.call(callData, "latest");
      expect(result).to.equal("0x");
    });

    it("eth_call with no gas", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        data: contractCallData,
      };

      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(200, { result: `0x00` });
      const result = await ethImpl.call(callData, "latest");
      expect(result).to.equal("0x00");
    });

    it("eth_call with no data", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        gas: maxGasLimit,
      };
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(200, { result: `0x00` });

      const result = await ethImpl.call(callData, "latest");
      expect(result).to.equal("0x00");
    });

    it("eth_call with no from address", async function () {
      const callData = {
        ...defaultCallData,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(200, { result: `0x00` });
      const result = await ethImpl.call(callData, "latest");
      expect(result).to.equal("0x00");
    });

    it("eth_call with all fields", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(200, { result: `0x00` });
      const result = await ethImpl.call(callData, "latest");
      expect(result).to.equal("0x00");
    });

    it("eth_call with all fields but mirrorNode throws 429", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(429, mockData.tooManyRequests);
      const result = await ethImpl.call(callData, "latest");
      expect(result).to.be.not.null;
      expect(result.code).to.eq(-32605);
      expect(result.name).to.eq("IP Rate limit exceeded");
    });

    it("eth_call with all fields but mirrorNode throws 400", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(400, mockData.contractReverted);
      const result = await ethImpl.call(callData, "latest");
      expect(result).to.be.not.null;
      expect(result.code).to.eq(-32008);
      expect(result.name).to.eq("Contract revert executed");
      expect(result.message).to.contain(mockData.contractReverted._status.messages[0].message);
    });

    it("eth_call with all fields, but mirror node throws NOT_SUPPORTED", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };

      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(501, mockData.notSupported);

      sdkClientStub.submitContractCallQueryWithRetry.returns({
        asBytes: function () {
          return Uint8Array.of(0);
        },
      });

      const result = await ethImpl.call(callData, "latest");

      sinon.assert.calledWith(
        sdkClientStub.submitContractCallQueryWithRetry,
        contractAddress2,
        contractCallData,
        maxGasLimit,
        accountAddress1,
        "eth_call",
      );
      expect(result).to.equal("0x00");
    });

    it("eth_call with all fields, but mirror node throws CONTRACT_REVERTED", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };

      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);
      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(400, mockData.contractReverted);
      sinon.reset();
      const result = await ethImpl.call(callData, "latest");
      sinon.assert.notCalled(sdkClientStub.submitContractCallQueryWithRetry);
      expect(result).to.not.be.null;
      expect(result.code).to.eq(-32008);
      expect(result.name).to.eq("Contract revert executed");
      expect(result.message).to.contain(mockData.contractReverted._status.messages[0].message);
    });

    it("SDK returns a precheck error", async function () {
      const callData = {
        ...defaultCallData,
        from: accountAddress1,
        to: contractAddress2,
        data: contractCallData,
        gas: maxGasLimit,
      };

      restMock.onGet(`accounts/${accountAddress1}${noTransactions}`).reply(200, {
        account: "0.0.1723",
        evm_address: accountAddress1,
      });
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      web3Mock.onPost("contracts/call", { ...callData, estimate: false }).reply(400, {
        _status: {
          messages: [
            {
              message: "",
              detail: defaultErrorMessageText,
              data: defaultErrorMessageHex,
            },
          ],
        },
      });

      const result = await ethImpl.call(callData, "latest");

      expect(result).to.exist;
      expect(result.code).to.eq(-32008);
      expect(result.name).to.eq("Contract revert executed");
      expect(result.message).to.equal(`execution reverted: ${defaultErrorMessageText}`);
      expect(result.data).to.equal(defaultErrorMessageHex);
    });

    it("eth_call with missing `to` field", async function () {
      const args = [
        {
          ...defaultCallData,
          from: contractAddress1,
          data: contractCallData,
          gas: maxGasLimit,
        },
        "latest",
      ];

      await RelayAssertions.assertRejection(
        predefined.INVALID_CONTRACT_ADDRESS(undefined),
        ethImpl.call,
        false,
        ethImpl,
        args,
      );
    });

    it("eth_call with wrong `to` field", async function () {
      const args = [
        {
          ...defaultCallData,
          from: contractAddress1,
          data: contractCallData,
          gas: maxGasLimit,
        },
        "latest",
      ];

      await RelayAssertions.assertRejection(
        predefined.INVALID_CONTRACT_ADDRESS(wrongContractAddress),
        ethImpl.call,
        false,
        ethImpl,
        args,
      );
    });
  });

  describe("eth_sendRawTransaction", async function () {
    const accountAddress = "0x9eaee9E66efdb91bfDcF516b034e001cc535EB57";
    const accountEndpoint = `accounts/${accountAddress}${noTransactions}`;
    const gasPrice = "0xad78ebc5ac620000";
    const transactionIdServicesFormat = "0.0.902@1684375868.230217103";
    const transactionId = "0.0.902-1684375868-230217103";
    const value = "0x511617DE831B9E173";
    const contractResultEndpoint = `contracts/results/${transactionId}`;
    const ethereumHash = "0x6d20b034eecc8d455c4c040fb3763082d499353a8b7d318b1085ad8d7de15f7e";

    this.beforeEach(() => {
      sinon.restore();
      sdkClientStub = sinon.createStubInstance(SDKClient);
      sinon.stub(hapiServiceInstance, "getSDKClient").returns(sdkClientStub);
    });

    this.afterEach(() => {
      sinon.restore();
    });

    it("should return a predefined GAS_LIMIT_TOO_HIGH instead of NUMERIC_FAULT as precheck exception", async function () {
      // tx with 'gasLimit: BigNumber { value: "30678687678687676876786786876876876000" }'
      const txHash =
        "0x02f881820128048459682f0086014fa0186f00901714801554cbe52dd95512bedddf68e09405fba803be258049a27b820088bab1cad205887185174876e80080c080a0cab3f53602000c9989be5787d0db637512acdd2ad187ce15ba83d10d9eae2571a07802515717a5a1c7d6fa7616183eb78307b4657d7462dbb9e9deca820dd28f62";
      await RelayAssertions.assertRejection(
        predefined.GAS_LIMIT_TOO_HIGH(null, null),
        ethImpl.sendRawTransaction,
        false,
        ethImpl,
        [txHash],
      );
    });

    it("should return a computed hash if unable to retrieve EthereumHash from record due to contract revert", async function () {
      restMock.onGet(accountEndpoint).reply(200, {
        account: accountAddress,
        balance: {
          balance: Hbar.from(100_000_000_000, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      });

      const transaction = {
        chainId: 0x12a,
        to: accountAddress1,
        from: accountAddress,
        value,
        gasPrice,
        gasLimit: maxGasLimitHex,
      };

      const signed = await signTransaction(transaction);

      restMock.onGet(`transactions/${transactionId}`).reply(200, null);

      const resultingHash = await ethImpl.sendRawTransaction(signed, getRequestId());
      expect(resultingHash).to.equal(ethereumHash);
    });

    it("should throw internal error when transaction returned from mirror node is null", async function () {
      restMock.onGet(accountEndpoint).reply(200, {
        account: accountAddress,
        balance: {
          balance: Hbar.from(100_000_000_000, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      });

      const transaction = {
        chainId: 0x12a,
        to: accountAddress1,
        from: accountAddress,
        value,
        gasPrice,
        gasLimit: maxGasLimitHex,
      };

      const signed = await signTransaction(transaction);

      restMock.onGet(contractResultEndpoint).reply(404, mockData.notFound);
      restMock.onGet(`transactions/${transactionId}?nonce=0`).reply(200, null);

      sdkClientStub.submitEthereumTransaction.returns({
        transactionId: TransactionId.fromString(transactionIdServicesFormat),
      });

      const response = (await ethImpl.sendRawTransaction(signed, getRequestId())) as JsonRpcError;

      expect(response.code).to.equal(predefined.INTERNAL_ERROR().code);
      expect(`Error invoking RPC: ${response.message}`).to.equal(predefined.INTERNAL_ERROR(response.message).message);
    });

    it("should throw internal error when transactionID is invalid", async function () {
      restMock.onGet(accountEndpoint).reply(200, {
        account: accountAddress,
        balance: {
          balance: Hbar.from(100_000_000_000, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      });

      const transaction = {
        chainId: 0x12a,
        to: accountAddress1,
        from: accountAddress,
        value,
        gasPrice,
        gasLimit: maxGasLimitHex,
      };

      const signed = await signTransaction(transaction);

      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      sdkClientStub.submitEthereumTransaction.returns({
        transactionId: "",
      });

      const response = (await ethImpl.sendRawTransaction(signed, getRequestId())) as JsonRpcError;

      expect(response.code).to.equal(predefined.INTERNAL_ERROR().code);
      expect(`Error invoking RPC: ${response.message}`).to.equal(predefined.INTERNAL_ERROR(response.message).message);
    });

    it("should return hash from ContractResult mirror node api", async function () {
      restMock.onGet(accountEndpoint).reply(200, {
        account: accountAddress,
        balance: {
          balance: Hbar.from(100_000_000_000, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      });

      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });
      const transaction = {
        chainId: 0x12a,
        to: accountAddress1,
        from: accountAddress,
        value,
        gasPrice,
        gasLimit: maxGasLimitHex,
      };

      sdkClientStub.submitEthereumTransaction.returns({
        transactionId: TransactionId.fromString(transactionIdServicesFormat),
      });
      const signed = await signTransaction(transaction);

      const resultingHash = await ethImpl.sendRawTransaction(signed, getRequestId());
      expect(resultingHash).to.equal(ethereumHash);
    });
  });

  describe("eth_getStorageAt", async function () {
    it("eth_getStorageAt with match with block and slot less than 32 bytes and without leading zeroes", async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${defaultBlock.timestamp.to}&slot=0x101&limit=100&order=desc`,
        )
        .reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, "0x101", numberTo0x(blockNumber));
      expect(result).to.exist;
      expect(result).to.not.be.null;

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    it("eth_getStorageAt with match with block and slot less than 32 bytes and leading zeroes", async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${defaultBlock.timestamp.to}&slot=0x0000101&limit=100&order=desc`,
        )
        .reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, "0x0000101", numberTo0x(blockNumber));
      expect(result).to.exist;
      expect(result).to.not.be.null;

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    it("eth_getStorageAt with match with block", async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
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

    it("eth_getStorageAt with match with latest block", async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?slot=${defaultCurrentContractState.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, defaultCurrentContractState.state[0].slot, "latest");
      expect(result).to.exist;
      expect(result).to.not.be.null;

      // verify slot value
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    // Block number is a required param, this should not work and should be removed when/if validations are added.
    // Instead the relay should return `missing value for required argument <argumentIndex> error`.
    it("eth_getStorageAt with match null block", async function () {
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

    it("eth_getStorageAt should throw a predefined RESOURCE_NOT_FOUND when block not found", async function () {
      restMock.onGet(`blocks/${blockNumber}`).reply(200, null);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);

      const args = [contractAddress1, defaultDetailedContractResults.state_changes[0].slot, numberTo0x(blockNumber)];

      await RelayAssertions.assertRejection(
        predefined.RESOURCE_NOT_FOUND(),
        ethImpl.getStorageAt,
        false,
        ethImpl,
        args,
      );
    });

    it("eth_getStorageAt should return EthImpl.zeroHex32Byte when slot wrong", async function () {
      const wrongSlot = "0x0000000000000000000000000000000000000000000000000000000000001101";
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
      restMock
        .onGet(
          `contracts/${contractAddress1}/state?timestamp=${defaultBlock.timestamp.to}&slot=${wrongSlot}&limit=100&order=desc`,
        )
        .reply(200, defaultContractStateEmptyArray);

      const result = await ethImpl.getStorageAt(contractAddress1, wrongSlot, numberTo0x(blockNumber));
      expect(result).to.equal(EthImpl.zeroHex32Byte);
    });

    it("eth_getStorageAt should return old state when passing older block number", async function () {
      restMock.onGet(`blocks/${blockNumber}`).reply(200, olderBlock);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
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

    it("eth_getStorageAt should throw error when contract not found", async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet("blocks?limit=1&order=desc").reply(200, mostRecentBlock);
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

  describe("eth_getTransactionCount", async () => {
    const blockNumber = mockData.blocks.blocks[2].number;
    const blockNumberHex = numberTo0x(blockNumber);
    const transactionId = "0.0.1078@1686183420.196506746";

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

    it("should return 0x0 nonce for no block consideration with not found acoount", async () => {
      restMock.onGet(contractPath).reply(404, mockData.notFound);
      restMock.onGet(accountPath).reply(404, mockData.notFound);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, null);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it("should return latest nonce for no block consideration but valid account", async () => {
      restMock.onGet(contractPath).reply(404, mockData.notFound);
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, null);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it("should return 0x0 nonce for block 0 consideration", async () => {
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, "0");
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it("should return 0x0 nonce for block 1 consideration", async () => {
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, "1");
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it("should return latest nonce for latest block", async () => {
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, EthImpl.blockLatest);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it("should return latest nonce for pending block", async () => {
      restMock.onGet(accountPath).reply(200, mockData.account);
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, EthImpl.blockPending);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it("should return 0x0 nonce for earliest block with valid block", async () => {
      restMock.onGet(earliestBlockPath).reply(200, { blocks: [mockData.blocks.blocks[0]] });
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, EthImpl.blockEarliest);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it("should throw error for earliest block with invalid block", async () => {
      restMock.onGet(earliestBlockPath).reply(200, { blocks: [] });
      const args = [mockData.account.evm_address, EthImpl.blockEarliest];

      await RelayAssertions.assertRejection(
        predefined.INTERNAL_ERROR("No network blocks found"),
        ethImpl.getTransactionCount,
        true,
        ethImpl,
        args,
      );
    });

    it("should throw error for earliest block with non 0 or 1 block", async () => {
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

    it("should return nonce for request on historical numerical block", async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);
      restMock.onGet(accountPath).reply(200, { ...mockData.account, transactions: [defaultEthereumTransactions[0]] });
      restMock
        .onGet(accountTimestampFilteredPath)
        .reply(200, { ...mockData.account, transactions: defaultEthereumTransactions });
      restMock.onGet(`${contractResultsPath}`).reply(200, defaultDetailedContractResults);

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(`0x${Number(mockData.account.ethereum_nonce).toString(16)}`);
    });

    it("should throw error for account historical numerical block tag with missing block", async () => {
      restMock.onGet(blockPath).reply(404, mockData.notFound);

      const args = [mockData.account.evm_address, blockNumberHex];

      await RelayAssertions.assertRejection(predefined.UNKNOWN_BLOCK, ethImpl.getTransactionCount, true, ethImpl, args);
    });

    it("should throw error for account historical numerical block tag with error on latest block", async () => {
      restMock.onGet(blockPath).reply(404, mockData.notFound);
      restMock.onGet(latestBlockPath).reply(404, mockData.notFound);

      const args = [mockData.account.evm_address, blockNumberHex];

      await RelayAssertions.assertRejection(predefined.UNKNOWN_BLOCK, ethImpl.getTransactionCount, true, ethImpl, args);
    });

    it("should return valid nonce for historical numerical block close to latest", async () => {
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

    it("should return 0x0 nonce for historical numerical block with no ethereum transactions found", async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock.onGet(transactionPath(mockData.account.evm_address, 2)).reply(200, { transactions: [] });

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.zeroHex);
    });

    it("should return 0x1 nonce for historical numerical block with a single ethereum transactions found", async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock.onGet(transactionPath(mockData.account.evm_address, 2)).reply(200, { transactions: [{}] });

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.oneHex);
    });

    it("should throw for historical numerical block with a missing contracts results", async () => {
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

    it("should return valid nonce for historical numerical block when contract result sender is not address", async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock
        .onGet(transactionPath(mockData.account.evm_address, 2))
        .reply(200, { transactions: [{ transaction_id: transactionId }, {}] });
      restMock.onGet(contractResultsPath).reply(200, { address: mockData.contract.evm_address });
      restMock.onGet(accountPath).reply(200, mockData.account);

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it("should return valid nonce for historical numerical block", async () => {
      restMock.onGet(blockPath).reply(200, mockData.blocks.blocks[2]);

      const transactionPath = (addresss, num) =>
        `accounts/${addresss}?transactiontype=ETHEREUMTRANSACTION&timestamp=lte:${mockData.blocks.blocks[2].timestamp.to}&limit=${num}&order=desc`;
      restMock
        .onGet(transactionPath(mockData.account.evm_address, 2))
        .reply(200, { transactions: [{ transaction_id: transactionId }, {}] });
      restMock
        .onGet(contractResultsPath)
        .reply(200, { address: mockData.account.evm_address, nonce: mockData.account.ethereum_nonce - 1 });

      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, blockNumberHex);
      expect(nonce).to.exist;
      expect(nonce).to.equal(numberTo0x(mockData.account.ethereum_nonce));
    });

    it("should throw for -1 invalid block tag", async () => {
      const args = [mockData.account.evm_address, "-1"];

      await RelayAssertions.assertRejection(predefined.UNKNOWN_BLOCK, ethImpl.getTransactionCount, true, ethImpl, args);
    });

    it("should throw for invalid block tag", async () => {
      const args = [mockData.account.evm_address, "notablock"];

      await RelayAssertions.assertRejection(predefined.UNKNOWN_BLOCK, ethImpl.getTransactionCount, true, ethImpl, args);
    });

    it("should return 0x1 for pre-hip-729 contracts with nonce=null", async () => {
      restMock.onGet(accountPath).reply(200, { ...mockData.account, ethereum_nonce: null });
      const nonce = await ethImpl.getTransactionCount(mockData.account.evm_address, EthImpl.blockLatest);
      expect(nonce).to.exist;
      expect(nonce).to.equal(EthImpl.oneHex);
    });
  });
});

describe("Eth", async function () {
  this.timeout(10000);

  let ethImpl: EthImpl;
  this.beforeAll(() => {
    // @ts-ignore
    cacheService = new CacheService(logger.child({ name: `cache` }), registry);
    mirrorNodeInstance = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL,
      logger.child({ name: `mirror-node` }),
      registry,
      cacheService,
    );
    ethImpl = new EthImpl(null, mirrorNodeInstance, logger, "0x12a", registry, cacheService);
    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: "throwException" });
  });

  const contractEvmAddress = "0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9";
  const defaultTxHash = "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392";
  const defaultTransaction = {
    accessList: [],
    blockHash: "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    blockNumber: "0x11",
    chainId: "0x12a",
    from: `${defaultEvmAddress}`,
    gas: "0x7b",
    gasPrice: "0x4a817c80",
    hash: defaultTxHash,
    input: "0x0707",
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
    nonce: 1,
    r: "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    s: "0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354",
    to: "0x0000000000000000000000000000000000001389",
    transactionIndex: "0x1",
    type: 2,
    v: 1,
    value: "0x77359400",
  };

  const defaultDetailedContractResultByHash = {
    address: "0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9",
    amount: 2000000000,
    bloom:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    call_result: "0x0606",
    contract_id: "0.0.5001",
    created_contract_ids: ["0.0.7001"],
    error_message: null,
    from: "0x0000000000000000000000000000000000001f41",
    function_parameters: "0x0707",
    gas_limit: 1000000,
    gas_used: 123,
    timestamp: "167654.000123456",
    to: "0x0000000000000000000000000000000000001389",
    block_hash: "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042000102030405060708090a0b0c0d0e0f",
    block_number: 17,
    logs: [
      {
        address: "0x0000000000000000000000000000000000001389",
        bloom:
          "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        contract_id: "0.0.5001",
        data: "0x0123",
        index: 0,
        topics: ["0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750"],
      },
    ],
    result: "SUCCESS",
    transaction_index: 1,
    hash: "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
    state_changes: [
      {
        address: "0x0000000000000000000000000000000000001389",
        contract_id: "0.0.5001",
        slot: "0x0000000000000000000000000000000000000000000000000000000000000101",
        value_read: "0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750",
        value_written: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
      },
    ],
    status: "0x1",
    access_list: "0x",
    block_gas_used: 50000000,
    chain_id: "0x12a",
    gas_price: "0x4a817c80",
    max_fee_per_gas: "0x",
    max_priority_fee_per_gas: "0x",
    r: "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    s: "0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354",
    type: 2,
    v: 1,
    nonce: 1,
  };

  const defaultDetailedContractResultByHashReverted = {
    ...defaultDetailedContractResultByHash,
    ...{
      result: "CONTRACT_REVERT_EXECUTED",
      status: "0x0",
      error_message:
        "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d6520726576657274206d65737361676500000000000000000000000000",
    },
  };

  const defaultReceipt = {
    blockHash: "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    blockNumber: "0x11",
    cumulativeGasUsed: "0x2faf080",
    effectiveGasPrice: "0xad78ebc5ac620000",
    from: "0x0000000000000000000000000000000000001f41",
    to: "0x0000000000000000000000000000000000001389",
    gasUsed: "0x7b",
    logs: [
      {
        address: "0x0000000000000000000000000000000000001389",
        blockHash: "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
        blockNumber: "0x11",
        data: "0x0123",
        logIndex: "0x0",
        removed: false,
        topics: ["0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750"],
        transactionHash: "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
        transactionIndex: "0x1",
      },
    ],
    logsBloom:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    status: "0x1",
    transactionHash: "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
    transactionIndex: "0x1",
    contractAddress: "0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9",
    root: undefined,
  };

  this.afterEach(() => {
    restMock.resetHandlers();
  });

  it('should execute "eth_chainId"', async function () {
    const chainId = Relay.eth().chainId();

    expect(chainId).to.be.equal("0x" + Number(process.env.CHAIN_ID).toString(16));
  });

  it('should execute "eth_accounts"', async function () {
    const accounts = Relay.eth().accounts();

    expect(accounts).to.be.an("Array");
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
    expect(result).to.eq("0x0");
  });

  it('should execute "eth_getUncleCountByBlockNumber"', async function () {
    const result = await Relay.eth().getUncleCountByBlockNumber();
    expect(result).to.eq("0x0");
  });

  it('should execute "eth_hashrate"', async function () {
    const result = await Relay.eth().hashrate();
    expect(result).to.eq("0x0");
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
    expect(result).to.have.property("code");
    expect(result.code).to.be.equal(-32601);
    expect(result).to.have.property("name");
    expect(result.name).to.be.equal("Method not found");
    expect(result).to.have.property("message");
    expect(result.message).to.be.equal("Unsupported JSON-RPC method");
  });

  it('should execute "eth_maxPriorityFeePerGas"', async function () {
    const result = await Relay.eth().maxPriorityFeePerGas();
    expect(result).to.eq("0x0");
  });

  const unsupportedMethods = [
    "submitHashrate",
    "signTransaction",
    "sign",
    "sendTransaction",
    "protocolVersion",
    "coinbase",
  ];

  unsupportedMethods.forEach((method) => {
    it(`should execute "eth_${method}" and return unsupported message`, async function () {
      const result = await Relay.eth()[method]();
      expectUnsupportedMethod(result);
    });
  });

  describe("eth_getTransactionReceipt", async function () {
    this.beforeEach(() => {
      cacheService.clear();
    });

    it("returns `null` for non-existent hash", async function () {
      const txHash = "0x0000000000000000000000000000000000000000000000000000000000000001";
      restMock.onGet(`contracts/results/${txHash}`).reply(404, {
        _status: {
          messages: [
            {
              message: "No correlating transaction",
            },
          ],
        },
      });
      const receipt = await ethImpl.getTransactionReceipt(txHash);
      expect(receipt).to.be.null;
    });

    it("valid receipt on match", async function () {
      // mirror node request mocks
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      // Assert the data format
      RelayAssertions.assertTransactionReceipt(receipt, defaultReceipt);
    });

    it("valid receipt on match should hit cache", async function () {
      restMock.onGet(`contracts/results/${defaultTxHash}`).replyOnce(200, defaultDetailedContractResultByHash);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).replyOnce(404);

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

    it("valid receipt with evm address on match", async function () {
      // mirror node request mocks
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(200, {
        evm_address: contractEvmAddress,
      });
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      expect(receipt).to.exist;
      if (receipt == null) return;

      expect(RelayAssertions.validateHash(receipt.from, 40)).to.eq(true);
      if (receipt.contractAddress) {
        expect(RelayAssertions.validateHash(receipt.contractAddress, 40)).to.eq(true);
      }
      expect(receipt.contractAddress).to.eq(contractEvmAddress);
    });

    it("Handles null effectiveGasPrice", async function () {
      const contractResult = {
        ...defaultDetailedContractResultByHash,
        gas_price: null,
        max_fee_per_gas: null,
      };

      const uniqueTxHash = "0x07cdd7b820375d10d73af57a6a3e84353645fdb1305ea58ff52daa53ec640533";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, contractResult);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(uniqueTxHash);

      expect(receipt).to.exist;
      if (receipt == null) return;

      expect(receipt.effectiveGasPrice).to.eq("0x0");
    });

    it("handles empty bloom", async function () {
      const receiptWith0xBloom = {
        ...defaultDetailedContractResultByHash,
        bloom: "0x",
      };
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, receiptWith0xBloom);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      expect(receipt).to.exist;
      if (receipt == null) return;
      expect(receipt.logsBloom).to.eq(EthImpl.emptyBloom);
    });

    it("Adds a revertReason field for receipts with errorMessage", async function () {
      const receiptWithErrorMessage = {
        ...defaultDetailedContractResultByHash,
        error_message: defaultErrorMessageHex,
      };

      // fake unique hash so request dont re-use the cached value but the mock defined
      const uniqueTxHash = "0x04cad7b827375d10d73af57b6a3e843536457d31305ea58ff52dda53ec640533";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, receiptWithErrorMessage);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(uniqueTxHash);

      expect(receipt).to.exist;
      expect(receipt.revertReason).to.eq(defaultErrorMessageHex);
    });

    it("handles empty gas_used", async function () {
      const receiptWithNullGasUsed = {
        ...defaultDetailedContractResultByHash,
        gas_used: null,
      };

      // fake unique hash so request dont re-use the cached value but the mock defined
      const uniqueTxHash = "0x08cad7b827375d12d73af57b6a3e84353645fd31305ea59ff52dda53ec640533";
      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, receiptWithNullGasUsed);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(uniqueTxHash);

      expect(receipt).to.exist;
      if (receipt == null) return;
      expect(receipt.gasUsed).to.eq("0x0");
    });

    it("handles missing transaction index", async function () {
      // fake unique hash so request dont re-use the cached value but the mock defined
      const uniqueTxHash = "0x17cad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533";

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
      const receipt = await ethImpl.getTransactionReceipt(uniqueTxHash);

      expect(receipt).to.exist;

      expect(receipt.logs[0].transactionIndex).to.eq(null);
      expect(receipt.transactionIndex).to.eq(null);
    });

    it("valid receipt on cache match", async function () {
      // clear cache
      cacheService.clear();

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

      cacheService.set(cacheKeySyntheticLog1, cachedLog);

      // w no mirror node requests
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      // Assert the matching reciept
      expect(receipt.blockHash).to.eq(cachedLog.blockHash);
      expect(receipt.blockNumber).to.eq(cachedLog.blockNumber);
      expect(receipt.contractAddress).to.eq(cachedLog.address);
      expect(receipt.cumulativeGasUsed).to.eq(EthImpl.zeroHex);
      expect(receipt.effectiveGasPrice).to.eq(EthImpl.zeroHex);
      expect(receipt.from).to.eq(EthImpl.zeroAddressHex);
      expect(receipt.gasUsed).to.eq(EthImpl.zeroHex);
      expect(receipt.logs).to.deep.eq([cachedLog]);
      expect(receipt.logsBloom).to.be.eq(EthImpl.emptyBloom);
      expect(receipt.status).to.eq(EthImpl.oneHex);
      expect(receipt.to).to.eq(cachedLog.address);
      expect(receipt.transactionHash).to.eq(cachedLog.transactionHash);
      expect(receipt.transactionIndex).to.eq(cachedLog.transactionIndex);
      expect(receipt.root).to.eq(EthImpl.zeroHex32Byte);
    });
  });

  describe("eth_getTransactionByHash", async function () {
    const from = "0x00000000000000000000000000000000000003f7";
    const evm_address = "0xc37f417fa09933335240fca72dd257bfbde9c275";
    const contractResultMock = {
      address: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
      amount: 20,
      bloom:
        "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      call_result: "0x",
      contract_id: "0.0.1012",
      created_contract_ids: [],
      error_message: null,
      from: "0x00000000000000000000000000000000000003f7",
      function_parameters: "0x",
      gas_limit: 250000,
      gas_used: 200000,
      timestamp: "1692959189.214316721",
      to: "0x00000000000000000000000000000000000003f4",
      hash: "0x7e8a09541c80ccda1f5f40a1975e031ed46de5ad7f24cd4c37be9bac65149b9e",
      block_hash: "0xa414a76539f84ae1c797fa10d00e49d5e7a1adae556dcd43084551e671623d2eba825bcb7bbfd5b7e3fe59d63d8a167f",
      block_number: 61033,
      logs: [],
      result: "SUCCESS",
      transaction_index: 2,
      state_changes: [],
      status: "0x1",
      failed_initcode: null,
      block_gas_used: 200000,
      chain_id: "0x12a",
      gas_price: "0x",
      r: "0x85b423416d0164d0b2464d880bccb0679587c00673af8e016c8f0ce573be69b2",
      s: "0x3897a5ce2ace1f242d9c989cd9c163d79760af4266f3bf2e69ee288bcffb211a",
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

    it("returns 155 transaction for type 0", async function () {
      const uniqueTxHash = "0x27cad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533";
      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, {
        ...contractResultMock,
        type: 0,
      });

      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.be.an.instanceOf(Transaction);
    });

    it("returns 2930 transaction for type 1", async function () {
      const uniqueTxHash = "0x28cad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533";
      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, {
        ...contractResultMock,
        type: 1,
        access_list: [],
      });

      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.be.an.instanceOf(Transaction2930);
    });

    it("returns 1559 transaction for type 2", async function () {
      const uniqueTxHash = "0x27cad7b827375d12d73af57b7a3e84353645fd31305ea58ff52dda53ec640533";
      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, {
        ...contractResultMock,
        type: 2,
        access_list: [],
        max_fee_per_gas: "0x47",
        max_priority_fee_per_gas: "0x47",
      });

      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.be.an.instanceOf(Transaction1559);
    });

    it("returns `null` for non-existing hash", async function () {
      const uniqueTxHash = "0x27cAd7b838375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533";
      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(404, {
        _status: {
          messages: [
            {
              message: "No correlating transaction",
            },
          ],
        },
      });

      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.equal(null);
    });

    it("account should be cached", async function () {
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      const resBeforeCache = await ethImpl.getTransactionByHash(defaultTxHash);
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}${noTransactions}`).reply(404);
      const resAfterCache = await ethImpl.getTransactionByHash(defaultTxHash);
      expect(resBeforeCache).to.deep.equal(resAfterCache);
    });

    it("returns correct transaction for existing hash", async function () {
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      RelayAssertions.assertTransaction(result, defaultTransaction);
    });

    it("returns correct transaction for existing hash w no sigs", async function () {
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        r: null,
        s: null,
      };

      const uniqueTxHash = "0x97cad7b827375d12d73af57b6a3f84353645fd31305ea58ff52dda53ec640533";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      RelayAssertions.assertTransaction(result, {
        ...defaultTransaction,
        r: null,
        s: null,
      });
    });

    it("handles transactions with null gas_used", async function () {
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        gas_used: null,
      };
      const uniqueTxHash = "0x14aad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.not.be.null;

      expect(result).to.exist;
      expect(result.gas).to.eq("0x0");
    });

    it("handles transactions with null amount", async function () {
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        amount: null,
      };
      const uniqueTxHash = "0x0aaad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.not.be.null;

      expect(result).to.exist;
      expect(result.value).to.eq("0x0");
    });

    it("handles transactions with v as null", async function () {
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        v: null,
        type: 0,
      };
      const uniqueTxHash = "0xb4cad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640533";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.not.be.null;

      expect(result).to.exist;
      expect(result.v).to.eq("0x0");
    });

    it("handles transactions with undefined transaction_index", async function () {
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        transaction_index: undefined,
      };
      const uniqueTxHash = "0x14aad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640534";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.not.be.null;

      expect(result).to.exist;
      expect(result.transactionIndex).to.be.null;
    });

    it("handles transactions with undefined block_number", async function () {
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        block_number: undefined,
      };
      const uniqueTxHash = "0x14aad7b827375d12d73af57b6a3e84353645fd31305ea58ff52dda53ec640511";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.not.be.null;

      expect(result).to.exist;
      expect(result.blockNumber).to.be.null;
    });

    it("handles transactions with undefined transaction_index and block_number", async function () {
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        block_number: undefined,
        transaction_index: undefined,
      };

      const uniqueTxHash = "0x14aad7b827375d12d73af57b6a3e84353645fd31305ea58ff52d1a53ec640511";

      restMock.onGet(`contracts/results/${uniqueTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      const result = await ethImpl.getTransactionByHash(uniqueTxHash);
      expect(result).to.not.be.null;

      expect(result).to.exist;
      expect(result.blockNumber).to.be.null;
      expect(result.transactionIndex).to.be.null;
    });

    it("returns reverted transactions", async function () {
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHashReverted);

      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      RelayAssertions.assertTransaction(result, defaultTransaction);
    });

    it("throws error for reverted transactions when DEV_MODE=true", async function () {
      const initialDevModeValue = process.env.DEV_MODE;
      process.env.DEV_MODE = "true";

      const uniqueTxHash = "0xa8cad7b827375d12d73af57b6a3f84353645fd31305ea58ff52dda53ec640533";
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
  });
});
