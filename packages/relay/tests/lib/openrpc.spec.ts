/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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
import { validateOpenRPCDocument, parseOpenRPCDocument } from "@open-rpc/schema-utils-js";

import Ajv from 'ajv';

import path from 'path';
import pino from 'pino';
import axios from 'axios';
import sinon from 'sinon';
import dotenv from 'dotenv';
import MockAdapter from 'axios-mock-adapter';
import { RelayImpl } from '@hashgraph/json-rpc-relay';
import { Registry } from 'prom-client';

import { EthImpl } from '../../src/lib/eth';
import { SDKClient } from '../../src/lib/clients';
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';

import openRpcSchema from "../../../../docs/openrpc.json";
import {
    blockHash,
    blockNumber,
    bytecode,
    contractAddress1,
    contractAddress2,
    contractAddress3,
    contractId1,
    contractId2,
    contractTimestamp1,
    contractTimestamp2,
    contractTimestamp3,
    defaultBlock,
    defaultCallData,
    defaultContract,
    defaultContractResults,
    defaultDetailedContractResultByHash,
    defaultDetailedContractResults,
    defaultDetailedContractResults2,
    defaultDetailedContractResults3,
    defaultEvmAddress,
    defaultFromLongZeroAddress,
    defaultLogs,
    defaultLogTopics,
    defaultNetworkFees,
    defaultTransaction,
    defaultTxHash,
    signedTransactionHash
} from '../helpers';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

process.env.npm_package_version = "relay/0.0.1-SNAPSHOT";

const logger = pino();
const registry = new Registry();
const Relay = new RelayImpl(logger, registry);

let mock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let sdkClientStub: any;


describe("Open RPC Specification", function () {

    let rpcDocument: any;
    let methodsResponseSchema: { [method: string]: any };
    let ethImpl: EthImpl;

    this.beforeAll(async () => {
        rpcDocument = await parseOpenRPCDocument(JSON.stringify(openRpcSchema));
        methodsResponseSchema = rpcDocument.methods.reduce((res: { [method: string]: any }, method: any) => ({
            ...res,
            [method.name]: method.result.schema
        }), {});

        // mock axios
        const instance = axios.create({
            baseURL: 'https://localhost:5551/api/v1',
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10 * 1000
        });

        // @ts-ignore
        mock = new MockAdapter(instance, { onNoMatch: "throwException" });
        // @ts-ignore
        mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry, instance);
        sdkClientStub = sinon.createStubInstance(SDKClient);
        // @ts-ignore
        ethImpl = new EthImpl(sdkClientStub, mirrorNodeInstance, logger, '0x12a');

        // mocked data
        mock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
        mock.onGet(`blocks/${defaultBlock.number}`).reply(200, defaultBlock);
        mock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
        mock.onGet('network/fees').reply(200, defaultNetworkFees);
        mock.onGet(`network/fees?timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultNetworkFees);
        mock.onGet(`contracts/${contractAddress1}`).reply(200, null);
        mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
        mock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultLogs);
        mock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
        mock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
        mock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
        mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
        mock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResults);
        mock.onGet(`contracts/${contractId1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
        mock.onGet(`contracts/${contractId1}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResults2);
        mock.onGet(`contracts/${contractId2}/results/${contractTimestamp3}`).reply(200, defaultDetailedContractResults3);
        mock.onGet(`accounts/${contractAddress1}`).reply(200, { account: contractAddress1 });
        mock.onGet(`accounts/${contractAddress3}`).reply(200, { account: contractAddress3 });
        mock.onGet(`accounts/0xbC989b7b17d18702663F44A6004cB538b9DfcBAc`).reply(200, { account: '0xbC989b7b17d18702663F44A6004cB538b9DfcBAc' });
        mock.onGet(`accounts/${defaultFromLongZeroAddress}`).reply(200, {
            from: `${defaultEvmAddress}`
          });
        for (const log of defaultLogs.logs) {
        mock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
        }
        mock.onPost(`contracts/call`, {...defaultCallData, estimate: false}).reply(200, {result: '0x12'});
        sdkClientStub.getAccountBalanceInWeiBar.returns(1000);
        sdkClientStub.getAccountBalanceInTinyBar.returns(100000000000);
        sdkClientStub.getContractByteCode.returns(Buffer.from(bytecode.replace('0x', ''), 'hex'));
        sdkClientStub.getAccountInfo.returns({ ethereumNonce: '0x1' });
        sdkClientStub.submitEthereumTransaction.returns({});
    });

    const validateResponseSchema = (schema: any, response: any) => {
        const ajv = new Ajv();
        ajv.validate(schema, response);

        if (ajv.errors && ajv.errors.length > 0) {
            console.log({
                errors: ajv.errors
            });
        }

        expect(ajv.errors).to.be.null;
    }

    it(`validates the openrpc document`, async () => {
        const rpcDocument = await parseOpenRPCDocument(JSON.stringify(openRpcSchema));
        const isValid = validateOpenRPCDocument(rpcDocument);

        expect(isValid).to.be.true;
    });

    it('should execute "eth_accounts"', function () {
        const response = ethImpl.accounts();

        validateResponseSchema(methodsResponseSchema.eth_accounts, response);
    });

    it('should execute "eth_blockNumber"', async function () {
        const response = await ethImpl.blockNumber();

        validateResponseSchema(methodsResponseSchema.eth_blockNumber, response);
    });

    it('should execute "eth_call"', async function () {
        const response = await ethImpl.call(defaultCallData, 'latest');
        validateResponseSchema(methodsResponseSchema.eth_call, response);
    });

    it('should execute "eth_chainId"', function () {
        const response = ethImpl.chainId();

        validateResponseSchema(methodsResponseSchema.eth_chainId, response);
    });

    it('should execute "eth_coinbase"', function () {
        const response = ethImpl.coinbase();

        validateResponseSchema(methodsResponseSchema.eth_coinbase, response);
    });

    it('should execute "eth_estimateGas"', async function () {
        const response = await ethImpl.estimateGas({}, null);

        validateResponseSchema(methodsResponseSchema.eth_estimateGas, response);
    });

    it('should execute "eth_feeHistory"', async function () {
        const response = await ethImpl.feeHistory(1, 'latest', [0]);

        validateResponseSchema(methodsResponseSchema.eth_feeHistory, response);
    });

    it('should execute "eth_gasPrice"', async function () {
        const response = await ethImpl.gasPrice();

        validateResponseSchema(methodsResponseSchema.eth_gasPrice, response);
    });

    it('should execute "eth_getBalance"', async function () {
        const response = await ethImpl.getBalance(contractAddress1, 'latest');

        validateResponseSchema(methodsResponseSchema.eth_getBalance, response);
    });

    it('should execute "eth_getBlockByHash" with hydrated = true', async function () {
        const response = await ethImpl.getBlockByHash(blockHash, true);

        validateResponseSchema(methodsResponseSchema.eth_getBlockByHash, response);
    });

    it('should execute "eth_getBlockByHash" with hydrated = false', async function () {
        const response = await ethImpl.getBlockByHash(blockHash, true);

        validateResponseSchema(methodsResponseSchema.eth_getBlockByHash, response);
    });

    it('should execute "eth_getBlockByNumber" with hydrated = true', async function () {
        const response = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), true);

        validateResponseSchema(methodsResponseSchema.eth_getBlockByNumber, response);
    });

    it('should execute "eth_getBlockByNumber" with hydrated = false', async function () {
        const response = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), false);

        validateResponseSchema(methodsResponseSchema.eth_getBlockByNumber, response);
    });

    it('should execute "eth_getBlockTransactionCountByHash"', async function () {
        const response = await ethImpl.getBlockTransactionCountByHash(blockHash);

        validateResponseSchema(methodsResponseSchema.eth_getBlockTransactionCountByHash, response);
    });

    it('should execute "eth_getBlockTransactionCountByNumber" with block tag', async function () {
        const response = await ethImpl.getBlockTransactionCountByNumber('latest');

        validateResponseSchema(methodsResponseSchema.eth_getBlockTransactionCountByNumber, response);
    });

    it('should execute "eth_getBlockTransactionCountByNumber" with block number', async function () {
        const response = await ethImpl.getBlockTransactionCountByNumber('0x3');

        validateResponseSchema(methodsResponseSchema.eth_getBlockTransactionCountByNumber, response);
    });

    it('should execute "eth_getCode" with block tag', async function() {
        mock.onGet(`tokens/${defaultContractResults.results[0].contract_id}`).reply(404);
        const response = await ethImpl.getCode(contractAddress1, 'latest');

        validateResponseSchema(methodsResponseSchema.eth_getCode, response);
    });

    it('should execute "eth_getCode" with block number', async function() {
        mock.onGet(`tokens/${defaultContractResults.results[0].contract_id}`).reply(404);
        const response = await ethImpl.getCode(contractAddress1, '0x3');

        validateResponseSchema(methodsResponseSchema.eth_getCode, response);
    });

    it('should execute "eth_getLogs" with no filters', async function () {
        const response = await ethImpl.getLogs(null, null, null, null, null);

        validateResponseSchema(methodsResponseSchema.eth_getLogs, response);
    });

    it('should execute "eth_getLogs" with topics filter', async function () {
        const filteredLogs = {
            logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
        };
        mock.onGet(
            `contracts/results/logs` +
            `?timestamp=gte:${defaultBlock.timestamp.from}` +
            `&timestamp=lte:${defaultBlock.timestamp.to}` +
            `&topic0=${defaultLogTopics[0]}&topic1=${defaultLogTopics[1]}` +
            `&topic2=${defaultLogTopics[2]}&topic3=${defaultLogTopics[3]}&limit=100&order=asc`
        ).reply(200, filteredLogs);
        mock.onGet('blocks?block.number=gte:0x5&block.number=lte:0x10').reply(200, {
            blocks: [defaultBlock]
        });
        for (const log of filteredLogs.logs) {
            mock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
        }

        const response = await ethImpl.getLogs(null, null, null, null, defaultLogTopics);

        validateResponseSchema(methodsResponseSchema.eth_getLogs, response);
    });

    it('should execute "eth_getTransactionByBlockHashAndIndex"', async function () {
        const response = await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash, EthImpl.numberTo0x(defaultBlock.count));

        validateResponseSchema(methodsResponseSchema.eth_getTransactionByBlockHashAndIndex, response);
    });

    it('should execute "eth_getTransactionByBlockNumberAndIndex"', async function () {
        const response = await ethImpl.getTransactionByBlockNumberAndIndex(EthImpl.numberTo0x(defaultBlock.number), EthImpl.numberTo0x(defaultBlock.count));

        validateResponseSchema(methodsResponseSchema.eth_getTransactionByBlockNumberAndIndex, response);
    });

    it('should execute "eth_getTransactionByHash"', async function () {
        const response = await ethImpl.getTransactionByHash(defaultTxHash);

        validateResponseSchema(methodsResponseSchema.eth_getTransactionByHash, response);
    });

    it('should execute "eth_getTransactionCount"', async function () {
        const response = await ethImpl.getTransactionCount(contractAddress1, 'latest');

        validateResponseSchema(methodsResponseSchema.eth_getTransactionCount, response);
    });

    it('should execute "eth_getTransactionReceipt"', async function () {
        mock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
        const response = await ethImpl.getTransactionReceipt(defaultTxHash);

        validateResponseSchema(methodsResponseSchema.eth_getTransactionReceipt, response);
    });

    it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
        const response = await ethImpl.getUncleByBlockHashAndIndex();

        validateResponseSchema(methodsResponseSchema.eth_getUncleByBlockHashAndIndex, response);
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
        const response = await ethImpl.getUncleByBlockNumberAndIndex();

        validateResponseSchema(methodsResponseSchema.eth_getUncleByBlockNumberAndIndex, response);
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
        const response = await ethImpl.getUncleByBlockNumberAndIndex();

        validateResponseSchema(methodsResponseSchema.eth_getUncleByBlockNumberAndIndex, response);
    });

    it('should execute "eth_getUncleCountByBlockHash"', async function () {
        const response = await ethImpl.getUncleCountByBlockHash();

        validateResponseSchema(methodsResponseSchema.eth_getUncleCountByBlockHash, response);
    });

    it('should execute "eth_getUncleCountByBlockNumber"', async function () {
        const response = await ethImpl.getUncleCountByBlockNumber();

        validateResponseSchema(methodsResponseSchema.eth_getUncleCountByBlockNumber, response);
    });

    it('should execute "eth_getWork"', async function () {
        const response = ethImpl.getWork();

        validateResponseSchema(methodsResponseSchema.eth_getWork, response);
    });

    it('should execute "eth_hashrate"', async function () {
        const response = await ethImpl.hashrate();

        validateResponseSchema(methodsResponseSchema.eth_hashrate, response);
    });

    it('should execute "eth_mining"', async function () {
        const response = await ethImpl.mining();

        validateResponseSchema(methodsResponseSchema.eth_mining, response);
    });

    it('should execute "eth_protocolVersion"', async function () {
        const response = ethImpl.protocolVersion();

        validateResponseSchema(methodsResponseSchema.eth_protocolVersion, response);
    });

    it('should execute "eth_sendRawTransaction"', async function () {
        const response = await ethImpl.sendRawTransaction(signedTransactionHash);

        validateResponseSchema(methodsResponseSchema.eth_sendRawTransaction, response);
    });

    it('should execute "eth_sendTransaction"', async function () {
        const response = ethImpl.sendTransaction();

        validateResponseSchema(methodsResponseSchema.eth_sendTransaction, response);
    });

    it('should execute "eth_signTransaction"', async function () {
        const response = ethImpl.signTransaction();

        validateResponseSchema(methodsResponseSchema.eth_signTransaction, response);
    });

    it('should execute "eth_sign"', async function () {
        const response = ethImpl.sign();

        validateResponseSchema(methodsResponseSchema.eth_sign, response);
    });

    it('should execute "eth_submitHashrate"', async function () {
        const response = ethImpl.submitHashrate();

        validateResponseSchema(methodsResponseSchema.eth_submitHashrate, response);
    });

    it('should execute "eth_submitWork"', async function () {
        const response = await ethImpl.submitWork();

        validateResponseSchema(methodsResponseSchema.eth_submitWork, response);
    });

    it('should execute "eth_syncing"', async function () {
        const response = await ethImpl.syncing();

        validateResponseSchema(methodsResponseSchema.eth_syncing, response);
    });

    it('should execute "net_listening"', function () {
        const response = Relay.net().listening();

        validateResponseSchema(methodsResponseSchema.net_listening, response);
    });

    it('should execute "net_version"', function () {
        const response = Relay.net().version()

        validateResponseSchema(methodsResponseSchema.net_version, response);
    });

    it('should execute "web3_clientVersion"', function () {
        const response = Relay.web3().clientVersion()

        validateResponseSchema(methodsResponseSchema.web3_clientVersion, response);
    });
});
