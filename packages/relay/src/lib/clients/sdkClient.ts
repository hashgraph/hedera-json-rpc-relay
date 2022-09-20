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
    EthereumFlow
} from '@hashgraph/sdk';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { Logger } from "pino";
import { Gauge, Histogram, Registry } from 'prom-client';
import { formatRequestIdMessage } from '../../formatters';
import constants from './../constants';
import { SDKClientError } from './../errors/SDKClientError';

const _ = require('lodash');

export class SDKClient {
    static transactionMode = 'TRANSACTION';
    static queryMode = 'QUERY';
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

    private consensusNodeClientHistorgram;
    private operatorAccountGauge;
    private operatorAccountId;

    // populate with consensusnode requests via SDK
    constructor(clientMain: Client, logger: Logger, register: Registry) {
        this.clientMain = clientMain;
        this.logger = logger;
        this.register = register;
        this.operatorAccountId = clientMain.operatorAccountId ? clientMain.operatorAccountId.toString() : 'UNKNOWN';

        // clear and create metrics in registry
        const metricHistogramName = 'rpc_relay_consensusnode_response';
        register.removeSingleMetric(metricHistogramName);
        this.consensusNodeClientHistorgram = new Histogram({
            name: metricHistogramName,
            help: 'Relay consensusnode mode type status cost histogram',
            labelNames: ['mode', 'type', 'status', 'caller'],
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
    }

    async getAccountBalance(account: string, callerName: string, requestId?: string): Promise<AccountBalance> {
        return this.executeQuery(new AccountBalanceQuery()
            .setAccountId(AccountId.fromString(account)), this.clientMain, callerName, requestId);
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
            .setAccountId(AccountId.fromString(address)), this.clientMain, callerName, requestId);
    }

    async getContractByteCode(shard: number | Long, realm: number | Long, address: string, callerName: string, requestId?: string): Promise<Uint8Array> {
        return this.executeQuery(new ContractByteCodeQuery()
            .setContractId(ContractId.fromEvmAddress(shard, realm, address)), this.clientMain, callerName, requestId);
    }

    async getContractBalance(contract: string, callerName: string, requestId?: string): Promise<AccountBalance> {
        return this.executeQuery(new AccountBalanceQuery()
            .setContractId(ContractId.fromString(contract)), this.clientMain, callerName, requestId);
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
            .setFileId(address), this.clientMain, callerName, requestId);
    }

    async getRecord(transactionResponse: TransactionResponse) {
        return transactionResponse.getRecord(this.clientMain);
    }

    async submitEthereumTransaction(transactionBuffer: Uint8Array, callerName: string, requestId?: string): Promise<TransactionResponse> {
        return this.executeTransaction(new EthereumFlow()
          .setEthereumData(transactionBuffer), callerName, requestId);
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

        const cost = await contractCallQuery
            .getCost(this.clientMain);
        return this.executeQuery(contractCallQuery
            .setQueryPayment(cost), this.clientMain, callerName, requestId);
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

    private executeQuery = async (query: Query<any>, client: Client, callerName: string, requestId?: string) => {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        try {
            const resp = await query.execute(client);
            this.logger.info(`${requestIdPrefix} Consensus Node ${query.constructor.name} response: ${query.paymentTransactionId} ${Status.Success._code}`);
            // local free queries will have a '0.0.0' accountId on transactionId
            this.logger.trace(`${requestIdPrefix} ${callerName} query cost: ${query._queryPayment}`);

            this.captureMetrics(
                SDKClient.queryMode,
                query.constructor.name,
                Status.Success,
                query._queryPayment?.toTinybars().toNumber(),
                callerName);
            return resp;
        }
        catch (e: any) {
            const sdkClientError = new SDKClientError(e);
            if(sdkClientError.isValidNetworkError()) {
                this.logger.debug(`${requestIdPrefix} Consensus Node query response: ${query.constructor.name} ${sdkClientError.statusCode}`);
                this.captureMetrics(
                    SDKClient.queryMode,
                    query.constructor.name,
                    sdkClientError.status,
                    query._queryPayment?.toTinybars().toNumber(),
                    callerName);    
            }

            throw sdkClientError;
        }
    };

    private executeTransaction = async (transaction: Transaction | EthereumFlow, callerName: string, requestId?: string): Promise<TransactionResponse> => {
        const transactionType = transaction.constructor.name;
        const requestIdPrefix = formatRequestIdMessage(requestId);
        try {
            this.logger.info(`${requestIdPrefix} Execute ${transactionType} transaction`);
            const resp = await transaction.execute(this.clientMain);
            this.logger.info(`${requestIdPrefix} Consensus Node ${transactionType} transaction response: ${resp.transactionId.toString()} ${Status.Success._code}`);
            return resp;
        }
        catch (e: any) {
            const sdkClientError = new SDKClientError(e);
            if(sdkClientError.isValidNetworkError()) {
                this.logger.info(`${requestIdPrefix} Consensus Node ${transactionType} transaction response: ${sdkClientError.statusCode}`);
                this.captureMetrics(
                    SDKClient.transactionMode,
                    transactionType,
                    sdkClientError.statusCode,
                    0,
                    callerName);
            }

            throw sdkClientError;
        }
    };

    async executeGetTransactionRecord(resp: TransactionResponse, transactionName: string, callerName: string, requestId?: string): Promise<TransactionRecord> {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        try {
            if (!resp.getRecord) {
                throw new SDKClientError({}, `${requestIdPrefix} Invalid response format, expected record availability: ${JSON.stringify(resp)}`);
            }

            const transactionRecord: TransactionRecord = await resp.getRecord(this.clientMain);
            this.logger.info(`${requestIdPrefix} Consensus Node ${transactionName} record response: ${resp.transactionId.toString()} ${Status.Success._code}`);
            this.logger.trace(`${requestIdPrefix} ${resp.transactionId.toString()} ${callerName} transaction cost: ${transactionRecord.transactionFee}`);
            this.captureMetrics(
                SDKClient.transactionMode,
                transactionName,
                transactionRecord.receipt.status,
                transactionRecord.transactionFee.toTinybars().toNumber(),
                callerName);
            return transactionRecord;
        }
        catch (e: any) {
            // capture sdk record retrieval errors and shorten familiar stack trace
            const sdkClientError = new SDKClientError(e);
            this.captureMetrics(
                SDKClient.transactionMode,
                transactionName,
                sdkClientError.status,
                0,
                callerName);

            this.logger.debug(`${requestIdPrefix} Consensus Node ${transactionName} record response: ${resp.transactionId.toString()} ${sdkClientError.status}`);

            throw sdkClientError;
        }
    };

    private captureMetrics = (mode, type, status, cost, caller) => {
        const resolvedCost = cost ? cost : 0;
        this.consensusNodeClientHistorgram.labels(
            mode,
            type,
            status,
            caller)
            .observe(resolvedCost);
        this.operatorAccountGauge.labels(mode, type, this.operatorAccountId).dec(cost);
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
}
