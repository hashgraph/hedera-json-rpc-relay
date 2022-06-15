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

import {
    AccountBalanceQuery,
    AccountId,
    AccountInfoQuery,
    ContractCreateTransaction,
    ContractExecuteTransaction,
    ContractFunctionParameters,
    FileCreateTransaction,
    Hbar,
    HbarUnit,
    PrivateKey,
    Query,
    TokenAssociateTransaction,
    TokenCreateTransaction,
    Transaction,
    TransactionResponse,
    TransferTransaction
} from "@hashgraph/sdk";
import pino, {Logger} from "pino";
import Axios, {AxiosInstance} from 'axios';
import {BigNumber, ethers} from "ethers";
import type { TransactionRequest } from "@ethersproject/abstract-provider";
import Assertions from './assertions';
import axiosRetry from "axios-retry";
import ServicesClient from "./ServicesClient";
import {JsonRpcProvider} from "@ethersproject/providers";

export default class TestUtils {
    private readonly logger: Logger;
    private readonly mirrorNodeClient: AxiosInstance;
    private readonly services: ServicesClient;
    public readonly provider: JsonRpcProvider;
    private readonly servicesNetwork: string;

    constructor(args: {
        // Uses the JsonRpcProvided if it is provided, otherwise initializes a new one with serverUrl
        provider?: JsonRpcProvider
        serverUrl?: string,

        // ServicesClient options
        services: {
            network: string,
            key: string,
            accountId: string
        },

        // Uses the mirrorNodeClient if it is provided, otherwise initializes a new one with mirrorNodeUrl
        mirrorNodeClient?: AxiosInstance,
        mirrorNodeUrl?: string,

        logger?: Logger
    }) {

        if (!args.logger) {
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

            testLogger.info(`Setting up Mirror Node Client for ${args.mirrorNodeUrl} env`);
            this.logger = testLogger;
        }
        else {
            this.logger = args.logger;
        }

        if (!args.mirrorNodeClient) {
            const mirrorNodeClient = Axios.create({
                baseURL: `${args.mirrorNodeUrl}/api/v1`,
                responseType: 'json' as const,
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'GET',
                timeout: 5 * 1000
            });

            // allow retries given mirror node waits for consensus, record stream serialization, export and import before parsing and exposing
            axiosRetry(mirrorNodeClient, {
                retries: 5,
                retryDelay: (retryCount) => {
                    this.logger.info(`Retry delay ${retryCount * 1000} s`);
                    return retryCount * 1000;
                },
                retryCondition: (error) => {
                    this.logger.error(error, `Request failed`);

                    // if retry condition is not specified, by default idempotent requests are retried
                    return error.response.status === 400 || error.response.status === 404;
                }
            });

            this.logger = this.logger.child({name: 'rpc-acceptance-test'});
            this.mirrorNodeClient = mirrorNodeClient;
        }
        else {
            this.mirrorNodeClient = args.mirrorNodeClient;
        }

        this.servicesNetwork = args.services.network;
        this.services = new ServicesClient(
            args.services.network,
            args.services.key,
            args.services.accountId
        );

        if (!args.provider) {
            this.provider = new ethers.providers.JsonRpcProvider(args.serverUrl);
        }
        else {
            this.provider = args.provider;
        }

    }

    numberTo0x = (input: number): string => {
        return `0x${this.toHex(input)}`;
    };

    prune0x = (input: string): string => {
        return input.startsWith('0x') ? input.substring(2) : input;
    };

    toHex = (num) => {
        return parseInt(num).toString(16);
    };

    idToEvmAddress = (id): string => {
        Assertions.assertId(id);
        const [shard, realm, num] = id.split('.');

        return [
            '0x',
            this.toHex(shard).padStart(8, '0'),
            this.toHex(realm).padStart(16, '0'),
            this.toHex(num).padStart(16, '0'),
        ].join('');
    };

    executeQuery = async (query: Query<any>) => {
        try {
            this.logger.info(`Execute ${query.constructor.name} query`);
            return query.execute(this.services.client);
        }
        catch (e) {
            this.logger.error(e, `Error executing ${query.constructor.name} query`);
        }
    };

    executeTransaction = async (transaction: Transaction) => {
        try {
            this.logger.info(`Execute ${transaction.constructor.name} transaction`);
            const resp = await transaction.execute(this.services.client);
            this.logger.info(`Executed transaction ${resp.transactionId.toString()}`);
            return resp;
        }
        catch (e) {
            this.logger.error(e, `Error executing ${transaction.constructor.name} transaction`);
        }
    };

    executeAndGetTransactionReceipt = async (transaction: Transaction) => {
        let resp;
        try {
            resp = await this.executeTransaction(transaction);
            return resp.getReceipt(this.services.client);
        }
        catch (e) {
            this.logger.error(e,
                `Error retrieving receipt for ${resp === undefined ? transaction.constructor.name : resp.transactionId.toString()} transaction`);
        }
    };

    getRecordResponseDetails = async (resp: TransactionResponse) => {
        this.logger.info(`Retrieve record for ${resp.transactionId.toString()}`);
        const record = await resp.getRecord(this.services.client);
        const nanoString = record.consensusTimestamp.nanos.toString();
        const executedTimestamp = `${record.consensusTimestamp.seconds}.${nanoString.padStart(9, '0')}`;
        const transactionId = record.transactionId;
        const transactionIdNanoString = transactionId.validStart.nanos.toString();
        const executedTransactionId = `${transactionId.accountId}-${transactionId.validStart.seconds}-${transactionIdNanoString.padStart(9, '0')}`;
        this.logger.info(`executedTimestamp: ${executedTimestamp}, executedTransactionId: ${executedTransactionId}`);
        return { executedTimestamp, executedTransactionId };
    };

    callMirrorNode = (path: string) => {
        this.logger.debug(`[GET] mirrornode ${path} endpoint`);
        return this.mirrorNodeClient.get(path);
    };

    callSupportedRelayMethod = async (methodName: string, params: any[]) => {
        const res = await this.callRelay(methodName, params);
        this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(res)}`);
        return res;
    };

    callFailingRelayMethod = async (methodName: string, params: any[]) => {
        try {
            const res = await this.callRelay(methodName, params);
            this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(res)}`);
            Assertions.expectedError();
        }
        catch (err) {
            Assertions.failedResponce(err);
            return err;
        }
    };

    callUnsupportedRelayMethod = async (methodName: string, params: any[]) => {
        try {
            const res = await this.callRelay(methodName, params);
            this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(res)}`);
            Assertions.expectedError();
        }
        catch (err) {
            Assertions.unsupportedResponse(err);
            return err;
        }
    };

    callRelay = async (methodName: string, params: any[]) => {
        this.logger.debug(`[POST] to relay '${methodName}' with params [${params}]`);
        return await this.provider.send(methodName, params);
    };

    createEthCompatibleAccount = async (privateKeyHex: null | string, initialBalance = 5000) => {
        let privateKey;
        if (privateKeyHex) {
            privateKey = PrivateKey.fromBytesECDSA(Buffer.from(privateKeyHex, 'hex'));
        }
        else {
            privateKey = PrivateKey.generateECDSA();
        }

        const publicKey = privateKey.publicKey;
        const aliasAccountId = publicKey.toAccountId(0, 0);

        this.logger.trace(`New Eth compatible privateKey: ${privateKey}`);
        this.logger.trace(`New Eth compatible publicKey: ${publicKey}`);
        this.logger.debug(`New Eth compatible account ID: ${aliasAccountId.toString()}`);

        this.logger.info(`Transfer transaction attempt`);
        const aliasCreationResponse = await this.executeTransaction(new TransferTransaction()
            .addHbarTransfer(this.services.client.operatorAccountId, new Hbar(initialBalance).negated())
            .addHbarTransfer(aliasAccountId, new Hbar(initialBalance)));

        this.logger.debug(`Get ${aliasAccountId.toString()} receipt`);
        await aliasCreationResponse.getReceipt(this.services.client);

        const balance = await this.executeQuery(new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId));

        this.logger.info(`Balances of the new account: ${balance.toString()}`);

        const accountInfo = await this.executeQuery(new AccountInfoQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId));

        this.logger.info(`New account Info: ${accountInfo.accountId.toString()}`);
        return {
            accountInfo,
            privateKey,
            utils: new TestUtils({
                mirrorNodeClient: this.mirrorNodeClient,
                logger: this.logger,
                provider: this.provider,
                services: {
                    network: this.servicesNetwork,
                    key: privateKey.toString(),
                    accountId: accountInfo.accountId.toString()
                }
            })
        };
    };

    createToken = async () => {
        const symbol = Math.random().toString(36).slice(2, 6).toUpperCase();
        this.logger.trace(`symbol = ${symbol}`);
        const resp = await this.executeAndGetTransactionReceipt(new TokenCreateTransaction()
            .setTokenName(`relay-acceptance token ${symbol}`)
            .setTokenSymbol(symbol)
            .setDecimals(3)
            .setInitialSupply(1000)
            .setTreasuryAccountId(this.services.client.operatorAccountId));

        this.logger.trace(`get token id from receipt`);
        const tokenId = resp.tokenId;
        this.logger.info(`token id = ${tokenId.toString()}`);
        return tokenId;
    };

    associateAndTransferToken = async (accountId: AccountId, pk: PrivateKey, tokenId) => {
        this.logger.info(`Associate account ${accountId.toString()} with token ${tokenId.toString()}`);
        await this.executeAndGetTransactionReceipt(
            await new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
                .freezeWith(this.services.client)
                .sign(pk));

        this.logger.debug(
            `Associated account ${accountId.toString()} with token ${tokenId.toString()}`
        );

        this.executeAndGetTransactionReceipt(new TransferTransaction()
            .addTokenTransfer(tokenId, this.services.client.operatorAccountId, -10)
            .addTokenTransfer(tokenId, accountId, 10));

        this.logger.debug(
            `Sent 10 tokens from account ${this.services.client.operatorAccountId.toString()} to account ${accountId.toString()} on token ${tokenId.toString()}`
        );

        const balances = await this.executeQuery(new AccountBalanceQuery()
            .setAccountId(accountId));

        this.logger.debug(
            `Token balances for ${accountId.toString()} are ${balances.tokens
                .toString()
                .toString()}`
        );
    };

    sendFileClosingCryptoTransfer = async (accountId: AccountId) => {
        const aliasCreationResponse = await this.executeTransaction(new TransferTransaction()
            .addHbarTransfer(this.services.client.operatorAccountId, new Hbar(1, HbarUnit.Millibar).negated())
            .addHbarTransfer(accountId, new Hbar(1, HbarUnit.Millibar)));

        await aliasCreationResponse.getReceipt(this.services.client);

        const balance = await this.executeQuery(new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(accountId), this.services.client);

        this.logger.info(`Balances of the new account: ${balance.toString()}`);
    };

    createParentContract = async (parentContract) => {
        const contractByteCode = (parentContract.deployedBytecode.replace('0x', ''));

        const fileReceipt = await this.executeAndGetTransactionReceipt(new FileCreateTransaction()
            .setKeys([this.services.client.operatorPublicKey])
            .setContents(contractByteCode));

        // Fetch the receipt for transaction that created the file
        // The file ID is located on the transaction receipt
        const fileId = fileReceipt.fileId;
        this.logger.info(`contract bytecode file: ${fileId.toString()}`);

        // Create the contract
        const contractReceipt = await this.executeAndGetTransactionReceipt(new ContractCreateTransaction()
            .setConstructorParameters(
                new ContractFunctionParameters()
            )
            .setGas(75000)
            .setInitialBalance(100)
            .setBytecodeFileId(fileId)
            .setAdminKey(this.services.client.operatorPublicKey));

        // Fetch the receipt for the transaction that created the contract

        // The conract ID is located on the transaction receipt
        const contractId = contractReceipt.contractId;

        this.logger.info(`new contract ID: ${contractId.toString()}`);

        return contractId;
    };

    executeContractCall = async (contractId) => {
        // Call a method on a contract exists on Hedera, but is allowed to mutate the contract state
        this.logger.info(`Execute contracts ${contractId}'s createChild method`);
        const contractExecTransactionResponse =
            await this.executeTransaction(new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(75000)
                .setFunction(
                    "createChild",
                    new ContractFunctionParameters()
                        .addUint256(1000)
                ));

        const resp = await this.getRecordResponseDetails(contractExecTransactionResponse);
        const contractExecuteTimestamp = resp.executedTimestamp;
        const contractExecutedTransactionId = resp.executedTransactionId;

        return {contractExecuteTimestamp, contractExecutedTransactionId};
    };

    getBalance = async (address, block = 'latest') => {
        return await this.provider.getBalance(address, block);
    };

    signRawTransaction = async (tx: TransactionRequest, privateKey) => {
        const wallet = new ethers.Wallet(privateKey.toStringRaw(), this.provider);
        return await wallet.signTransaction(tx);
    };

    subtractBigNumberHexes = (hex1, hex2) => {
        return BigNumber.from(hex1).sub(BigNumber.from(hex2));
    };

    /**
     * @param evmAddress
     *
     * Returns: The nonce of the account with the provided `evmAddress`
     */
    getAccountNonce = async (evmAddress): Promise<number> => {
        const nonce = await this.provider.send('eth_getTransactionCount', [evmAddress, 'latest']);
        return Number(nonce);
    };

    /**
     * @param tx
     * @param privateKey
     * Signs a transaction request with the provided privateKey and sends it via `ethers.jsonRpcProvider`.
     * This invokes the relay logic from eth.ts/sendRawTransaction.
     *
     * Returns: Transaction hash
     */
    sendRawTransaction = async (tx, privateKey): Promise<string> => {
        const signedTx = await this.signRawTransaction(tx, privateKey);
        const txHash = await this.provider.send('eth_sendRawTransaction', [signedTx]);

        // Since the transactionId is not available in this context
        // Wait for the transaction to be processed and imported in the mirror node with axios-retry
        await this.callMirrorNode(`contracts/results/${txHash}`);
        return txHash;
    };
}

