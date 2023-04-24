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
    AccountBalance,
    AccountBalanceQuery,
    AccountId, AccountInfoQuery,
    Client,
    ContractByteCodeQuery,
    ContractCallQuery,
    ExchangeRates,
    FeeSchedules,
    FileContentsQuery,
    ContractId,
    ContractFunctionResult,
    TransactionResponse,
    AccountInfo,
    HbarUnit,
    TransactionId,
    FeeComponents,
    Query,
    Transaction,
    TransactionRecord,
    Status,
    FileCreateTransaction,
    FileAppendTransaction,
    FileInfoQuery,
    EthereumTransaction,
    EthereumTransactionData,
    PrecheckStatusError,
    TransactionRecordQuery,
    Hbar,
} from '@hashgraph/sdk';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { Logger } from "pino";
import { Gauge, Histogram, Registry } from 'prom-client';
import { formatRequestIdMessage } from '../../formatters';
import HbarLimit from '../hbarlimiter';
import constants from './../constants';
import { SDKClientError } from './../errors/SDKClientError';
import { JsonRpcError, predefined } from './../errors/JsonRpcError';

const _ = require('lodash');

export class SDKClient {
    static transactionMode = 'TRANSACTION';
    static queryMode = 'QUERY';
    static recordMode = 'RECORD';
    /**
     * The client to use for connecting to the main consensus network. The account
     * associated with this client will pay for all operations on the main network.
     *
     * @private
     */
    private readonly clientMain: Client;

    /**
     * The logger used for logging all output from this class.
     * @private
     */
    private readonly logger: Logger;

    /**
     * The metrics register used for metrics tracking.
     * @private
     */
    private readonly register: Registry;

    /**
     * This limiter tracks hbar expenses and limits.
     * @private
     */
    private readonly hbarLimiter: HbarLimit;

    private consensusNodeClientHistogramCost;
    private consensusNodeClientHistogramGasFee;
    private operatorAccountGauge;
    private operatorAccountId;

    // populate with consensusnode requests via SDK
    constructor(clientMain: Client, logger: Logger, register: Registry) {
        this.clientMain = clientMain;

        if (process.env.CONSENSUS_MAX_EXECUTION_TIME) {
            // sets the maximum time in ms for the SDK to wait when submitting
            // a transaction/query before throwing a TIMEOUT error
            this.clientMain = clientMain.setMaxExecutionTime(Number(process.env.CONSENSUS_MAX_EXECUTION_TIME));
        }

        this.logger = logger;
        this.register = register;
        this.operatorAccountId = clientMain.operatorAccountId ? clientMain.operatorAccountId.toString() : 'UNKNOWN';

        // clear and create metrics in registry
        const metricHistogramCost = 'rpc_relay_consensusnode_response';
        register.removeSingleMetric(metricHistogramCost);
        this.consensusNodeClientHistogramCost = new Histogram({
            name: metricHistogramCost,
            help: 'Relay consensusnode mode type status cost histogram',
            labelNames: ['mode', 'type', 'status', 'caller', 'interactingEntity'],
            registers: [register]
        });
        const metricHistogramGasFee = 'rpc_relay_consensusnode_gasfee';
        register.removeSingleMetric(metricHistogramGasFee);
        this.consensusNodeClientHistogramGasFee = new Histogram({
            name: metricHistogramGasFee,
            help: 'Relay consensusnode mode type status gas fee histogram',
            labelNames: ['mode', 'type', 'status', 'caller', 'interactingEntity'],
            registers: [register]
        });

        const metricGaugeName = 'rpc_relay_operator_balance';
        register.removeSingleMetric(metricGaugeName);
        this.operatorAccountGauge = new Gauge({
            name: metricGaugeName,
            help: 'Relay operator balance gauge',
            labelNames: ['mode', 'type', 'accountId'],
            registers: [register],
            async collect() {
                // Invoked when the registry collects its metrics' values.
                // Allows for updated account balance tracking
                try {
                    const accountBalance = await (new AccountBalanceQuery()
                        .setAccountId(clientMain.operatorAccountId!))
                        .execute(clientMain);
                    this.labels({ 'accountId': clientMain.operatorAccountId!.toString() })
                        .set(accountBalance.hbars.toTinybars().toNumber());
                } catch (e: any) {
                    logger.error(e, `Error collecting operator balance. Skipping balance set`);
                }
            },
        });

        const duration = parseInt(process.env.HBAR_RATE_LIMIT_DURATION!);
        const total = parseInt(process.env.HBAR_RATE_LIMIT_TINYBAR!);
        this.hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, register);
    }

    async getAccountBalance(account: string, callerName: string, requestId?: string): Promise<AccountBalance> {
        return this.executeQuery(new AccountBalanceQuery()
            .setAccountId(AccountId.fromString(account)), this.clientMain, callerName, account, requestId);
    }

    async getAccountBalanceInTinyBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
        const balance = await this.getAccountBalance(account, callerName, requestId);
        return balance.hbars.to(HbarUnit.Tinybar);
    }
    
    async getAccountBalanceInWeiBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
        const balance = await this.getAccountBalance(account, callerName, requestId);
        return SDKClient.HbarToWeiBar(balance);
    }

    async getAccountInfo(address: string, callerName: string, requestId?: string): Promise<AccountInfo> {
        return this.executeQuery(new AccountInfoQuery()
            .setAccountId(AccountId.fromString(address)), this.clientMain, callerName, address, requestId);
    }

    async getContractByteCode(shard: number | Long, realm: number | Long, address: string, callerName: string, requestId?: string): Promise<Uint8Array> {
        return this.executeQuery(new ContractByteCodeQuery()
            .setContractId(ContractId.fromEvmAddress(shard, realm, address)), this.clientMain, callerName, address, requestId);
    }

    async getContractBalance(contract: string, callerName: string, requestId?: string): Promise<AccountBalance> {
        return this.executeQuery(new AccountBalanceQuery()
            .setContractId(ContractId.fromString(contract)), this.clientMain, callerName, contract, requestId);
    }

    async getContractBalanceInWeiBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
        const balance = await this.getContractBalance(account, callerName, requestId);
        return SDKClient.HbarToWeiBar(balance);
    }

    async getExchangeRate(callerName: string, requestId?: string): Promise<ExchangeRates> {
        const exchangeFileBytes = await this.getFileIdBytes(constants.EXCHANGE_RATE_FILE_ID, callerName, requestId);

        return ExchangeRates.fromBytes(exchangeFileBytes);
    }

    async getFeeSchedule(callerName: string, requestId?: string): Promise<FeeSchedules> {
        const feeSchedulesFileBytes = await this.getFileIdBytes(constants.FEE_SCHEDULE_FILE_ID, callerName, requestId);

        return FeeSchedules.fromBytes(feeSchedulesFileBytes);
    }

    async getTinyBarGasFee(callerName: string, requestId?: string): Promise<number> {
        const feeSchedules = await this.getFeeSchedule(callerName, requestId);
        if (_.isNil(feeSchedules.current) || feeSchedules.current?.transactionFeeSchedule === undefined) {
            throw new SDKClientError({}, 'Invalid FeeSchedules proto format');
        }

        for (const schedule of feeSchedules.current?.transactionFeeSchedule) {
            if (schedule.hederaFunctionality?._code === constants.ETH_FUNCTIONALITY_CODE && schedule.fees !== undefined) {
                // get exchange rate & convert to tiny bar
                const exchangeRates = await this.getExchangeRate(callerName, requestId);

                return this.convertGasPriceToTinyBars(schedule.fees[0].servicedata, exchangeRates);
            }
        }

        throw new SDKClientError({}, `${constants.ETH_FUNCTIONALITY_CODE} code not found in feeSchedule`);
    }

    async getFileIdBytes(address: string, callerName: string, requestId?: string): Promise<Uint8Array> {
        return this.executeQuery(new FileContentsQuery()
            .setFileId(address), this.clientMain, callerName, address, requestId);
    }

    async getRecord(transactionResponse: TransactionResponse) {
        return transactionResponse.getRecord(this.clientMain);
    }

    async submitEthereumTransaction(transactionBuffer: Uint8Array, callerName: string, requestId?: string): Promise<TransactionResponse> {
        const ethereumTransactionData: EthereumTransactionData = EthereumTransactionData.fromBytes(transactionBuffer);
        const ethereumTransaction = new EthereumTransaction();
        const interactingEntity = ethereumTransactionData.toJSON()['to'].toString();

        if (ethereumTransactionData.toBytes().length <= 5120) {
            ethereumTransaction.setEthereumData(ethereumTransactionData.toBytes());
        } else {
            const fileId = await this.createFile(ethereumTransactionData.callData, this.clientMain, requestId);
            if(!fileId) {
                const requestIdPrefix = formatRequestIdMessage(requestId);
                throw new SDKClientError({}, `${requestIdPrefix} No fileId created for transaction. `);
            }
            ethereumTransactionData.callData = new Uint8Array();
            ethereumTransaction.setEthereumData(ethereumTransactionData.toBytes()).setCallDataFileId(fileId)
        }

        const tinybarsGasFee = await this.getTinyBarGasFee('eth_sendRawTransaction');
        ethereumTransaction.setMaxTransactionFee(Hbar.fromTinybars(Math.floor(tinybarsGasFee * constants.BLOCK_GAS_LIMIT)));

        return this.executeTransaction(ethereumTransaction, callerName, interactingEntity, requestId);
    }

    async submitContractCallQuery(to: string, data: string, gas: number, from: string, callerName: string, requestId?: string): Promise<ContractFunctionResult> {
        const contract = SDKClient.prune0x(to);
        const contractId = contract.startsWith("00000000000")
            ? ContractId.fromSolidityAddress(contract)
            : ContractId.fromEvmAddress(0, 0, contract);

        const contractCallQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(gas);

        // data is optional and can be omitted in which case fallback function will be employed
        if (data) {
            contractCallQuery.setFunctionParameters(Buffer.from(SDKClient.prune0x(data), 'hex'));
        }

        if (from) {
            contractCallQuery.setSenderAccountId(AccountId.fromEvmAddress(0,0, from))
        }

        if (this.clientMain.operatorAccountId !== null) {
            contractCallQuery
                .setPaymentTransactionId(TransactionId.generate(this.clientMain.operatorAccountId));
        }

        return this.executeQuery(contractCallQuery, this.clientMain, callerName, to, requestId);
    }

    async submitContractCallQueryWithRetry(to: string, data: string, gas: number, from: string, callerName: string, requestId?: string): Promise<ContractFunctionResult> {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        let retries = 0;
        let resp;
        while (parseInt(process.env.CONTRACT_QUERY_TIMEOUT_RETRIES || '1') > retries) {
            try {
                resp = await this.submitContractCallQuery(to, data, gas, from, callerName, requestId);
                return resp;
            } catch (e: any) {
                const sdkClientError = new SDKClientError(e, e.message);
                if (sdkClientError.isTimeoutExceeded()) {
                    const delay = retries * 1000;
                    this.logger.trace(`${requestIdPrefix} Contract call query failed with status ${sdkClientError.message}. Retrying again after ${delay}ms ...`);
                    retries++;
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                if (e instanceof JsonRpcError) {
                    throw e;
                }
                throw sdkClientError;
            }
        }
        return resp;
    }

    async increaseCostAndRetryExecution(query: Query<any>, baseCost: Hbar, client: Client, maxRetries: number, currentRetry: number, requestId?: string) {
        const baseMultiplier = constants.QUERY_COST_INCREMENTATION_STEP;
        const multiplier = Math.pow(baseMultiplier, currentRetry);

        const cost = Hbar.fromTinybars(
            baseCost._valueInTinybar.multipliedBy(multiplier).toFixed(0)
        );

        try {
            const resp = await query.setQueryPayment(cost).execute(client);
            return {resp, cost};
        }
        catch(e: any) {
            const sdkClientError = new SDKClientError(e, e.message);
            if (maxRetries > currentRetry && sdkClientError.isInsufficientTxFee()) {
                const newRetry = currentRetry + 1;
                this.logger.info(`${requestId} Retrying query execution with increased cost, retry number: ${newRetry}`);
                return await this.increaseCostAndRetryExecution(query, baseCost, client, maxRetries, newRetry, requestId);
            }

            throw e;
        }
    }

    private convertGasPriceToTinyBars = (feeComponents: FeeComponents | undefined, exchangeRates: ExchangeRates) => {
        // gas -> tinCents:  gas / 1000
        // tinCents -> tinyBars: tinCents * exchangeRate (hbarEquiv/ centsEquiv)
        if (feeComponents === undefined || feeComponents.contractTransactionGas === undefined) {
            return constants.DEFAULT_TINY_BAR_GAS;
        }

        return Math.ceil(
            (feeComponents.contractTransactionGas.toNumber() / 1_000) * (exchangeRates.currentRate.hbars / exchangeRates.currentRate.cents)
        );
    };

    private executeQuery = async (query: Query<any>, client: Client, callerName: string, interactingEntity: string, requestId?: string) => {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        const currentDateNow = Date.now();
        try {
            const shouldLimit = this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.queryMode, callerName);
            if (shouldLimit) {
                throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
            }

            let resp, cost;
            if (query.paymentTransactionId) {
                const baseCost = await query.getCost(this.clientMain);
                const res = await this.increaseCostAndRetryExecution(query, baseCost, client, 3, 0, requestId);
                resp = res.resp;
                cost = res.cost.toTinybars().toNumber();
                this.hbarLimiter.addExpense(cost, currentDateNow);
            }
            else {
                resp = await query.execute(client);
                cost = query._queryPayment?.toTinybars().toNumber();
            }

            this.logger.info(`${requestIdPrefix} ${query.paymentTransactionId} ${callerName} ${query.constructor.name} status: ${Status.Success} (${Status.Success._code}), cost: ${query._queryPayment}`);
            this.captureMetrics(
                SDKClient.queryMode,
                query.constructor.name,
                Status.Success,
                cost,
                0,
                callerName,
                interactingEntity);
            return resp;
        }
        catch (e: any) {
            const cost = query._queryPayment?.toTinybars().toNumber();
            const sdkClientError = new SDKClientError(e, e.message);
            this.captureMetrics(
                SDKClient.queryMode,
                query.constructor.name,
                sdkClientError.status,
                cost,
                0,
                callerName,
                interactingEntity);
            this.logger.trace(`${requestIdPrefix} ${query.paymentTransactionId} ${callerName} ${query.constructor.name} status: ${sdkClientError.status} (${sdkClientError.status._code}), cost: ${query._queryPayment}`);
            if (cost) {
                this.hbarLimiter.addExpense(cost, currentDateNow);
            }

            if (e instanceof PrecheckStatusError && e.contractFunctionResult?.errorMessage) {
                throw predefined.CONTRACT_REVERT(e.contractFunctionResult.errorMessage);
            }

            if (e instanceof JsonRpcError){
                throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
            }

            if (sdkClientError.isGrpcTimeout()) {
                throw predefined.REQUEST_TIMEOUT;
            }
            throw sdkClientError;
        }
    };

    private executeTransaction = async (transaction: Transaction, callerName: string, interactingEntity: string, requestId?: string): Promise<TransactionResponse> => {
        const transactionType = transaction.constructor.name;
        const requestIdPrefix = formatRequestIdMessage(requestId);
        const currentDateNow = Date.now();
        try {
            const shouldLimit = this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.transactionMode, callerName);
            if (shouldLimit) {
                throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
            }

            this.logger.info(`${requestIdPrefix} Execute ${transactionType} transaction`);
            const resp = await transaction.execute(this.clientMain);
            this.logger.info(`${requestIdPrefix} ${resp.transactionId} ${callerName} ${transactionType} status: ${Status.Success} (${Status.Success._code})`);
            return resp;
        }
        catch (e: any) {
            const sdkClientError = new SDKClientError(e, e.message);
            let transactionFee: number | Hbar = 0;

            // if valid network error utilize transaction id
            if (sdkClientError.isValidNetworkError()) {

                try {
                    const transactionRecord = await new TransactionRecordQuery()
                        .setTransactionId(transaction.transactionId!)
                        .setNodeAccountIds(transaction.nodeAccountIds!)
                        .setValidateReceiptStatus(false)
                        .execute(this.clientMain);
                    transactionFee = transactionRecord.transactionFee;

                    this.captureMetrics(
                        SDKClient.transactionMode,
                        transactionType,
                        sdkClientError.status,
                        transactionFee.toTinybars().toNumber(),
                        transactionRecord?.contractFunctionResult?.gasUsed,
                        callerName,
                        interactingEntity);

                    this.hbarLimiter.addExpense(transactionFee.toTinybars().toNumber(), currentDateNow);
                } catch (err: any) {
                    const recordQueryError = new SDKClientError(err, err.message);
                    this.logger.error(recordQueryError, `${requestIdPrefix} Error raised during TransactionRecordQuery for ${transaction.transactionId}`);
                }
            }

            this.logger.trace(`${requestIdPrefix} ${transaction.transactionId} ${callerName} ${transactionType} status: ${sdkClientError.status} (${sdkClientError.status._code}), cost: ${transactionFee}`);
            if (e instanceof JsonRpcError){
                throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
            }
            throw sdkClientError;
        }
    };

    async executeGetTransactionRecord(resp: TransactionResponse, transactionName: string, callerName: string, interactingEntity: string, requestId?: string): Promise<TransactionRecord> {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        const currentDateNow = Date.now();
        try {
            if (!resp.getRecord) {
                throw new SDKClientError({}, `${requestIdPrefix} Invalid response format, expected record availability: ${JSON.stringify(resp)}`);
            }
            const shouldLimit = this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.recordMode, transactionName);
            if (shouldLimit) {
                throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
            }

            const transactionRecord: TransactionRecord = await resp.getRecord(this.clientMain);
            const cost = transactionRecord.transactionFee.toTinybars().toNumber();
            this.hbarLimiter.addExpense(cost, currentDateNow);
            this.logger.info(`${requestIdPrefix} ${resp.transactionId} ${callerName} ${transactionName} record status: ${Status.Success} (${Status.Success._code}), cost: ${transactionRecord.transactionFee}`);
            this.captureMetrics(
                SDKClient.transactionMode,
                transactionName,
                transactionRecord.receipt.status,
                cost,
                transactionRecord?.contractFunctionResult?.gasUsed,
                callerName,
                interactingEntity);

            this.hbarLimiter.addExpense(cost, currentDateNow);

            return transactionRecord;
        }
        catch (e: any) {
            // capture sdk record retrieval errors and shorten familiar stack trace
            const sdkClientError = new SDKClientError(e, e.message);
            let transactionFee: number | Hbar = 0;
            if (sdkClientError.isValidNetworkError()) {
                try {
                    // pull transaction record for fee
                    const transactionRecord = await new TransactionRecordQuery()
                        .setTransactionId(resp.transactionId!)
                        .setNodeAccountIds([resp.nodeId])
                        .setValidateReceiptStatus(false)
                        .execute(this.clientMain);
                    transactionFee = transactionRecord.transactionFee;

                    this.captureMetrics(
                        SDKClient.transactionMode,
                        transactionName,
                        sdkClientError.status,
                        transactionFee.toTinybars().toNumber(),
                        transactionRecord?.contractFunctionResult?.gasUsed,
                        callerName,
                        interactingEntity);

                    this.hbarLimiter.addExpense(transactionFee.toTinybars().toNumber(), currentDateNow);
                } catch (err: any) {
                    const recordQueryError = new SDKClientError(err, err.message);
                    this.logger.error(recordQueryError, `${requestIdPrefix} Error raised during TransactionRecordQuery for ${resp.transactionId}`);
                }
            }

            this.logger.debug(`${requestIdPrefix} ${resp.transactionId} ${callerName} ${transactionName} record status: ${sdkClientError.status} (${sdkClientError.status._code}), cost: ${transactionFee}`);
            
            if (e instanceof JsonRpcError){
                throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
            }
            throw sdkClientError;
        }
    };

    private captureMetrics = (mode, type, status, cost, gas, caller, interactingEntity) => {
        const resolvedCost = cost ? cost : 0;
        const resolvedGas = typeof gas === 'object' ? gas.toInt() : 0;
        this.consensusNodeClientHistogramCost.labels(
          mode,
          type,
          status,
          caller,
          interactingEntity)
          .observe(resolvedCost);
        this.consensusNodeClientHistogramGasFee.labels(
          mode,
          type,
          status,
          caller,
          interactingEntity)
          .observe(resolvedGas);
    };

    /**
     * Internal helper method that removes the leading 0x if there is one.
     * @param input
     * @private
     */
    private static prune0x(input: string): string {
        return input.startsWith('0x')
            ? input.substring(2)
            : input;
    }

    private static HbarToWeiBar(balance: AccountBalance): BigNumber {
        return balance.hbars
        .to(HbarUnit.Tinybar)
        .multipliedBy(constants.TINYBAR_TO_WEIBAR_COEF);
    }

    private createFile = async (callData: Uint8Array, client: Client, requestId?: string) => {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        const hexedCallData = Buffer.from(callData).toString("hex");

        const fileId = (
            (
                await (
                    await new FileCreateTransaction()
                        .setContents(hexedCallData.substring(0, 4096))
                        .setKeys(
                            client.operatorPublicKey
                                ? [client.operatorPublicKey]
                                : []
                        )
                        .execute(client)
                ).getReceipt(client)
            ).fileId
        );

        if (fileId && callData.length > 4096) {
            await (
                await new FileAppendTransaction()
                    .setFileId(fileId)
                    .setContents(
                        hexedCallData.substring(4096, hexedCallData.length)
                    )
                    .setChunkSize(4096)
                    .execute(client)
            ).getReceipt(client);
        }

        // Ensure that the calldata file is not empty
        if(fileId) {
            const fileSize = await (
                await new FileInfoQuery()
                .setFileId(fileId)
                .execute(client)
            ).size;    

            if(callData.length > 0 && fileSize.isZero()) {
                throw new SDKClientError({}, `${requestIdPrefix} Created file is empty. `);
            }    
            this.logger.trace(`${requestIdPrefix} Created file with fileId: ${fileId} and file size ${fileSize}`);
        }

        return fileId;
    }
}
