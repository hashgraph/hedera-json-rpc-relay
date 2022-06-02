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

// external resources
import {
    Client,
    PrivateKey,
    Hbar,
    HbarUnit,
    AccountId,
    AccountBalanceQuery,
    AccountInfoQuery,
    ContractCreateTransaction,
    ContractExecuteTransaction,
    ContractFunctionParameters,
    FileCreateTransaction,
    Query,
    TokenAssociateTransaction,
    TokenCreateTransaction,
    Transaction,
    TransactionResponse,
    TransferTransaction,
} from "@hashgraph/sdk";
import Axios, { AxiosInstance } from 'axios';
import { expect } from 'chai';
import dotenv from 'dotenv';
import path from 'path';
import pino from 'pino';
import shell from 'shelljs';

// local resources
import parentContract from './parentContract/Parent.json';
import app from '../src/server';

const testLogger = pino({
    name: 'hedera-json-rpc-relay',
    level: process.env.LOG_LEVEL || 'trace',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: true
        }
    }
});
const logger = testLogger.child({ name: 'rpc-acceptance-test' });


dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const useLocalNode = process.env.LOCAL_NODE || 'true';

// const refs
const legacyTransactionHex = 'f864012f83018000947e3a9eaf9bcc39e2ffa38eb30bf7a93feacbc18180827653820277a0f9fbff985d374be4a55f296915002eec11ac96f1ce2df183adf992baa9390b2fa00c1e867cc960d9c74ec2e6a662b7908ec4c8cc9f3091e886bcefbeb2290fb792';
const eip155TransactionHex = 'f86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83';
const londonTransactionHex = '02f902e082012a80a00000000000000000000000000000000000000000000000000000000000004e20a0000000000000000000000000000000000000000000000000000000746a528800830f42408080b9024d608060405261023a806100136000396000f3fe60806040526004361061003f5760003560e01c806312065fe01461008f5780633ccfd60b146100ba5780636f64234e146100d1578063b6b55f251461012c575b3373ffffffffffffffffffffffffffffffffffffffff167ff1b03f708b9c39f453fe3f0cef84164c7d6f7df836df0796e1e9c2bce6ee397e346040518082815260200191505060405180910390a2005b34801561009b57600080fd5b506100a461015a565b6040518082815260200191505060405180910390f35b3480156100c657600080fd5b506100cf610162565b005b3480156100dd57600080fd5b5061012a600480360360408110156100f457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506101ab565b005b6101586004803603602081101561014257600080fd5b81019080803590602001909291905050506101f6565b005b600047905090565b3373ffffffffffffffffffffffffffffffffffffffff166108fc479081150290604051600060405180830381858888f193505050501580156101a8573d6000803e3d6000fd5b50565b8173ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f193505050501580156101f1573d6000803e3d6000fd5b505050565b80341461020257600080fd5b5056fea265627a7a72315820f8f84fc31a845064b5781e908316f3c591157962deabb0fd424ed54f256400f964736f6c63430005110032c001a01f7e8e436e6035ef7e5cd1387e2ad679e74d6a78a2736efe3dee72e531e28505a042b40a9cf56aad4530a5beaa8623f1ac3554d59ac1e927c672287eb45bfe7b8d';


// cached entities
let client: Client;
let tokenId;
let opPrivateKey;
let contractId;
let contractExecuteTimestamp;
let contractExecutedTransactionId;
let mirrorBlock;
let mirrorContract;
let mirrorContractDetails;
let mirrorPrimaryAccount;
let mirrorSecondaryAccount;

describe('RPC Server Integration Tests', async function () {
    this.timeout(180 * 1000);

    before(async function () {
        logger.info(`Setting up SDK Client for ${process.env['HEDERA_NETWORK']} env`);
        setupClient();

        if (useLocalNode === 'true') {
            // set env variables for docker images until local-node is updated
            process.env['NETWORK_NODE_IMAGE_TAG'] = '0.26.2-patch.3';
            process.env['HAVEGED_IMAGE_TAG'] = '0.25.4';
            process.env['MIRROR_IMAGE_TAG'] = '0.58.0-rc1';
            logger.trace(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

            // start local-node
            logger.debug('Start local node and genereate accounts');
            shell.exec('npx hedera-local start');
            shell.exec('npx hedera-local generate-accounts 0');
            logger.trace('Hedera Hashgraph local node env started');
        }

        // set up mirror node contents
        logger.info('Submit eth account create transactions via crypto transfers');
        // 1. Crypto create with alias - metamask flow
        const { accountInfo: primaryAccountInfo, privateKey: primaryKey } = await createEthCompatibleAccount();
        const { accountInfo: secondaryAccountInfo, privateKey: secondaryKey } = await createEthCompatibleAccount();

        logger.info('Create and execute contracts');
        // 2. contract create amd execute
        // Take Parent contract used in mirror node acceptance tests since it's well use
        await createParentContract();
        await executeContractCall();

        logger.info('Create token');
        // 3. Token create
        await createToken();

        logger.info('Associate and transfer tokens');
        // 4. associate and transfer 2 tokens
        await associateAndTransferToken(primaryAccountInfo.accountId, primaryKey);
        await associateAndTransferToken(secondaryAccountInfo.accountId, secondaryKey);

        logger.info('Send file close crypto transfers');
        // 5. simple crypto trasnfer to ensure file close
        await sendFileClosingCryptoTransfer(primaryAccountInfo.accountId);
        await sendFileClosingCryptoTransfer(secondaryAccountInfo.accountId);

        const mirrorNodeClient = Axios.create({
            baseURL: 'http://localhost:5551/api/v1',
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'GET',
            timeout: 5 * 1000
        });


        // get contract details
        const mirrorContractResponse = await callMirrorNode(mirrorNodeClient, `/contracts/${contractId}`);
        mirrorContract = mirrorContractResponse.data;

        // get contract details
        const mirrorContractDetailsResponse = await callMirrorNode(mirrorNodeClient, `/contracts/${contractId}/results/${contractExecuteTimestamp}`);
        mirrorContractDetails = mirrorContractDetailsResponse.data;

        // get block
        const mirrorBlockResponse = await callMirrorNode(mirrorNodeClient, `/blocks?block.number=${mirrorContractDetails.block_number}`);
        mirrorBlock = mirrorBlockResponse.data.blocks[0];

        const mirrorPrimaryAccountResponse = await callMirrorNode(mirrorNodeClient, `accounts?account.id=${primaryAccountInfo.accountId}`);
        mirrorPrimaryAccount = mirrorPrimaryAccountResponse.data.accounts[0];

        const mirrorSecondaryAccountResponse = await callMirrorNode(mirrorNodeClient, `accounts?account.id=${secondaryAccountInfo.accountId}`);
        mirrorSecondaryAccount = mirrorSecondaryAccountResponse.data.accounts[0];

        // start relay
        logger.info(`Start relay on port ${process.env.SERVER_PORT}`);
        this.testServer = app.listen({ port: process.env.SERVER_PORT });
        this.relayClient = Axios.create({
            baseURL: 'http://localhost:7546',
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
            timeout: 5 * 1000
        });
    });

    after(function () {
        if (useLocalNode === 'true') {
            // stop local-node
            logger.info('Shutdown local node');
            shell.exec('npx hedera-local stop');
        }

        // stop relay
        logger.info('Stop relay');
        if (this.testServer !== undefined) {
            this.testServer.close();
        }
    });

    it('should execute "eth_chainId"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_chainId', [null]);
        expect(res.data.result).to.be.equal('0x12a');
    });

    it('should execute "eth_getBlockByHash"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getBlockByHash', [mirrorBlock.hash, 'true']);

        const blockResult = res.data.result;
        expect(blockResult.hash).to.be.equal(mirrorBlock.hash.slice(0, 66));
        expect(blockResult.number).to.be.equal(numberTo0x(mirrorBlock.number));
        expect(blockResult).to.have.property('transactions');
        expect(blockResult.transactions.length).to.be.greaterThan(0);
    });

    it('should execute "eth_getBlockByNumber"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getBlockByNumber', [mirrorBlock.number, true]);

        const blockResult = res.data.result;
        expect(blockResult.hash).to.be.equal(mirrorBlock.hash.slice(0, 66));
        expect(blockResult.number).to.be.equal(numberTo0x(mirrorBlock.number));
        expect(blockResult).to.have.property('transactions');
        expect(blockResult.transactions.length).to.be.greaterThan(0);
    });

    it('should execute "eth_getBalance" for primary account', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorPrimaryAccount.evm_address, 'latest']);
        expect(res.data.result).to.not.be.equal('0x0');
        expect(res.data.result).to.eq('0x566527b339630a400');
    });

    it('should execute "eth_getBalance" for secondary account', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorSecondaryAccount.evm_address, 'latest']);
        expect(res.data.result).to.not.be.equal('0x0');
        expect(res.data.result).to.eq('0x566527b339630a400');
    });

    it('should execute "eth_getBalance" for non-existing account', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getBalance', ['0x5555555555555555555555555555555555555555', 'latest']);
        expect(res.data.result).to.eq('0x0');
    });

    it('should execute "eth_getBalance" for contract', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorContract.evm_address, 'latest']);
        expect(res.data.result).to.eq('0x56bc75e2d63100000');
    });

    it('should execute "eth_getBlockTransactionCountByHash"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getBlockTransactionCountByHash', [mirrorBlock.hash]);
        expect(res.data.result).to.be.equal(mirrorBlock.count);
    });

    it('should execute "eth_getBlockTransactionCountByNumber"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getBlockTransactionCountByNumber', [mirrorBlock.number]);
        expect(res.data.result).to.be.equal(mirrorBlock.count);
    });

    it('should execute "eth_getTransactionByBlockHashAndIndex"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getTransactionByBlockHashAndIndex', [mirrorContractDetails.block_hash, mirrorContractDetails.transaction_index]);

        const transactionResult = res.data.result;
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "eth_getTransactionByBlockNumberAndIndex"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getTransactionByBlockNumberAndIndex', [mirrorContractDetails.block_number, mirrorContractDetails.transaction_index]);

        const transactionResult = res.data.result;
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "net_listening"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'net_listening', []);
        expect(res.data.result).to.be.equal('false');
    });

    it('should execute "net_version"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'net_version', []);
        expect(res.data.result).to.be.equal('0x12a');
    });

    it('should execute "eth_estimateGas"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_estimateGas', []);
        expect(res.data.result).to.contain('0x');
        expect(res.data.result).to.not.be.equal('0x');
        expect(res.data.result).to.not.be.equal('0x0');
    });

    it('should execute "eth_gasPrice"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_gasPrice', []);
        expect(res.data.result).to.be.equal('0xa7a3582000');
    });

    it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getUncleByBlockHashAndIndex', []);
        expect(res.data.result).to.be.null;
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getUncleByBlockNumberAndIndex', []);
        expect(res.data.result).to.be.null;
    });

    it('should execute "eth_getUncleCountByBlockHash"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getUncleCountByBlockHash', []);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_getUncleCountByBlockNumber"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_getUncleCountByBlockNumber', []);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_getWork"', async function () {
        callUnsupportedRelayMethod(this.relayClient, 'eth_getWork', []);
    });

    it('should execute "eth_hashrate"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_hashrate', []);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_mining"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_mining', []);
        expect(res.data.result).to.be.equal(false);
    });

    it('should execute "eth_submitWork"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_submitWork', []);
        expect(res.data.result).to.be.equal(false);
    });

    it('should execute eth_sendRawTransaction legacy', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_sendRawTransaction', ['0x' + legacyTransactionHex]);
        expect(res.data.result).to.be.equal('0x9ffbd69c44cf643ed8d1e756b505e545e3b5dd3a6b5ef9da1d8eca6679706594');
    });

    it('should execute "eth_sendRawTransaction" london', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_sendRawTransaction', ['0x' + londonTransactionHex]);
        expect(res.data.result).to.be.equal('0xcdbbfb6400aab319f97d32c38e285f0d0399c2b48b683f04878b5f07eb0d50e3');
    });

    it('should execute "eth_syncing"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'eth_syncing', []);
        expect(res.data.result).to.be.equal(false);
    });

    it('should execute "web3_client_version"', async function () {
        const res = await callSupportedRelayMethod(this.relayClient, 'web3_client_version', []);
        expect(res.data.result).to.contain('relay/');
    });

    it('should execute "eth_protocolVersion"', async function () {
        callUnsupportedRelayMethod(this.relayClient, 'eth_protocolVersion', []);
    });

    const callMirrorNode = (mirrorNodeClient: AxiosInstance, path: string) => {
        logger.debug(`[GET] mirrornode ${path} endpoint`);
        return mirrorNodeClient.get(path);
    };

    const callSupportedRelayMethod = async (client: any, methodName: string, params: any[]) => {
        const resp = await callRelay(client, methodName, params);
        logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(resp.data.result)}`);

        expect(resp.data).to.have.property('result');
        expect(resp.data.id).to.be.equal('2');

        return resp;
    };

    const callUnsupportedRelayMethod = async (client: any, methodName: string, params: any[]) => {
        const resp = await callRelay(client, methodName, params);
        logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(resp.data.error)}`);

        expect(resp.data).to.have.property('error');
        expect(resp.data.error.code).to.be.equal(-32601);
        expect(resp.data.error.name).to.be.equal('Method not found');
        expect(resp.data.error.message).to.be.equal('Unsupported JSON-RPC method');

        return resp;
    };

    const callRelay = async (client: any, methodName: string, params: any[]) => {
        logger.debug(`[POST] to relay '${methodName}' with params [${params}]`);
        const resp = await client.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': methodName,
            'params': params
        });

        expect(resp).to.not.be.null;
        expect(resp).to.have.property('data');
        expect(resp.data).to.have.property('id');
        expect(resp.data).to.have.property('jsonrpc');
        expect(resp.data.jsonrpc).to.be.equal('2.0');

        return resp;
    };

    const setupClient = () => {
        opPrivateKey = PrivateKey.fromString(process.env.OPERATOR_KEY_MAIN);
        client = Client
            .forNetwork({
                '127.0.0.1:50211': '0.0.3'
            })
            .setOperator(AccountId.fromString(process.env.OPERATOR_ID_MAIN), opPrivateKey);
    };

    const createEthCompatibleAccount = async () => {
        const privateKey = PrivateKey.generateECDSA();
        const publicKey = privateKey.publicKey;
        const aliasAccountId = publicKey.toAccountId(0, 0);

        logger.trace(`New Eth compatible privateKey: ${privateKey}`);
        logger.trace(`New Eth compatible publicKey: ${publicKey}`);
        logger.debug(`New Eth compatible account ID: ${aliasAccountId.toString()}`);

        logger.info(`Transfer transaction attempt`);
        const aliasCreationResponse = await executeTransaction(new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(100).negated())
            .addHbarTransfer(aliasAccountId, new Hbar(100)));

        logger.debug(`Get ${aliasAccountId.toString()} receipt`);
        await aliasCreationResponse.getReceipt(client);

        const balance = await executeQuery(new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId));

        logger.info(`Balances of the new account: ${balance.toString()}`);

        const accountInfo = await executeQuery(new AccountInfoQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId));

        logger.info(`New account Info: ${accountInfo.accountId.toString()}`);
        return { accountInfo, privateKey };
    };

    const createToken = async () => {
        const symbol = Math.random().toString(36).slice(2, 6).toUpperCase();
        logger.trace(`symbol = ${symbol}`);
        const resp = await executeAndGetTransactionReceipt(new TokenCreateTransaction()
            .setTokenName(`relay-acceptance token ${symbol}`)
            .setTokenSymbol(symbol)
            .setDecimals(3)
            .setInitialSupply(1000)
            .setTreasuryAccountId(client.operatorAccountId));

        logger.trace(`get token id from receipt`);
        tokenId = resp.tokenId;
        logger.info(`token id = ${tokenId.toString()}`);
    };

    const associateAndTransferToken = async (accountId: AccountId, pk: PrivateKey) => {
        logger.info(`Associate account ${accountId.toString()} with token ${tokenId.toString()}`);
        await executeAndGetTransactionReceipt(
            await new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
                .freezeWith(client)
                .sign(pk));

        logger.debug(
            `Associated account ${accountId.toString()} with token ${tokenId.toString()}`
        );

        executeAndGetTransactionReceipt(new TransferTransaction()
            .addTokenTransfer(tokenId, client.operatorAccountId, -10)
            .addTokenTransfer(tokenId, accountId, 10));

        logger.debug(
            `Sent 10 tokens from account ${client.operatorAccountId.toString()} to account ${accountId.toString()} on token ${tokenId.toString()}`
        );

        const balances = await executeQuery(new AccountBalanceQuery()
            .setAccountId(accountId));

        logger.debug(
            `Token balances for ${accountId.toString()} are ${balances.tokens
                .toString()
                .toString()}`
        );
    };

    const sendFileClosingCryptoTransfer = async (accountId: AccountId) => {
        const aliasCreationResponse = await executeTransaction(new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(1, HbarUnit.Millibar).negated())
            .addHbarTransfer(accountId, new Hbar(1, HbarUnit.Millibar)));

        await aliasCreationResponse.getReceipt(client);

        const balance = await executeQuery(new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(accountId));

        logger.info(`Balances of the new account: ${balance.toString()}`);
    };

    const createParentContract = async () => {
        const contractByteCode = (parentContract.deployedBytecode.replace('0x', ''));

        const fileReceipt = await executeAndGetTransactionReceipt(new FileCreateTransaction()
            .setKeys([client.operatorPublicKey])
            .setContents(contractByteCode));

        // Fetch the receipt for transaction that created the file
        // The file ID is located on the transaction receipt
        const fileId = fileReceipt.fileId;
        logger.info(`contract bytecode file: ${fileId.toString()}`);

        // Create the contract
        const contractReceipt = await executeAndGetTransactionReceipt(new ContractCreateTransaction()
            .setConstructorParameters(
                new ContractFunctionParameters()
            )
            .setGas(75000)
            .setInitialBalance(100)
            .setBytecodeFileId(fileId)
            .setAdminKey(client.operatorPublicKey));

        // Fetch the receipt for the transaction that created the contract

        // The conract ID is located on the transaction receipt
        contractId = contractReceipt.contractId;

        logger.info(`new contract ID: ${contractId.toString()}`);
    };

    const executeContractCall = async () => {
        // Call a method on a contract exists on Hedera, but is allowed to mutate the contract state
        logger.info(`Execute contracts ${contractId}'s createChild method`);
        const contractExecTransactionResponse =
            await executeTransaction(new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(75000)
                .setFunction(
                    "createChild",
                    new ContractFunctionParameters()
                        .addUint256(1000)
                ));

        const resp = await getRecordResponseDetails(contractExecTransactionResponse);
        contractExecuteTimestamp = resp.executedTimestamp;
        contractExecutedTransactionId = resp.executedTransactionId;
    };

    const executeQuery = async (query: Query<any>) => {
        try {
            logger.info(`Execute ${query.constructor.name} query`);
            return query.execute(client);
        }
        catch (e) {
            logger.error(e, `Error executing ${query.constructor.name} query`);
        }
    };

    const executeTransaction = async (transaction: Transaction) => {
        try {
            logger.info(`Execute ${transaction.constructor.name} transaction`);
            const resp = await transaction.execute(client);
            logger.info(`Executed transaction ${resp.transactionId.toString()}`);
            return resp;
        }
        catch (e) {
            logger.error(e, `Error executing ${transaction.constructor.name} transaction`);
        }
    };

    const executeAndGetTransactionReceipt = async (transaction: Transaction) => {
        let resp;
        try {
            resp = await executeTransaction(transaction);
            return resp.getReceipt(client);
        }
        catch (e) {
            logger.error(e,
                `Error retrieving receipt for ${resp === undefined ? transaction.constructor.name : resp.transactionId.toString()} transaction`);
        }
    };

    const getRecordResponseDetails = async (resp: TransactionResponse) => {
        logger.info(`Retrieve record for ${resp.transactionId.toString()}`);
        const record = await resp.getRecord(client);
        const nanoString = record.consensusTimestamp.nanos.toString();
        const executedTimestamp = `${record.consensusTimestamp.seconds}.${nanoString.padStart(9, '0')}`;
        const transactionId = record.transactionId;
        const transactionIdNanoString = transactionId.validStart.nanos.toString();
        const executedTransactionId = `${transactionId.accountId}-${transactionId.validStart.seconds}-${transactionIdNanoString.padStart(9, '0')}`;
        logger.info(`executedTimestamp: ${executedTimestamp}, executedTransactionId: ${executedTransactionId}`);
        return { executedTimestamp, executedTransactionId };
    };

    const numberTo0x = (input: number): string => {
        return `0x${input.toString(16)}`;
    };

    const prune0x = (input: string): string => {
        return input.startsWith('0x') ? input.substring(2) : input;
    };
});