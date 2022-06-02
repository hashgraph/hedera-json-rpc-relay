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
    EthereumTransaction,
    ExchangeRates,
    FileContentsQuery,
    ContractId,
    ContractFunctionResult,
    TransactionResponse,
    AccountInfo,
    HbarUnit,
    TransactionId
} from '@hashgraph/sdk';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';

export class SDKClient {
    private static EXCHANGE_RATE_FILE_ID = "0.0.112";
    /**
     * The client to use for connecting to the main consensus network. The account
     * associated with this client will pay for all operations on the main network.
     *
     * @private
     */
    private readonly clientMain: Client;

    // populate with consensusnode requests via SDK
    constructor(clientMain: Client) {
        this.clientMain = clientMain;
    }


    async getAccountBalance(account: string): Promise<AccountBalance> {
        return (new AccountBalanceQuery()
            .setAccountId(SDKClient.toAccountId(account)))
            .execute(this.clientMain);
    }

    async getAccountBalanceInWeiBar(account: string): Promise<BigNumber> {
        const balance = await (new AccountBalanceQuery()
            .setAccountId(SDKClient.toAccountId(account)))
            .execute(this.clientMain);

        return balance.hbars
            .to(HbarUnit.Tinybar)
            .multipliedBy(10_000_000_000);
    }

    async getAccountInfo(address: string): Promise<AccountInfo> {
        return (new AccountInfoQuery()
            .setAccountId(SDKClient.toAccountId(address)))
            .execute(this.clientMain);
    }

    async getContractByteCode(shard: number | Long, realm: number | Long, address: string): Promise<Uint8Array> {
        return (new ContractByteCodeQuery()
            .setContractId(ContractId.fromEvmAddress(shard, realm, address)))
            .execute(this.clientMain);
    }

    async getExchangeRate(): Promise<ExchangeRates> {
        const exchangeFileBytes = await this.getFileIdBytes(SDKClient.EXCHANGE_RATE_FILE_ID);

        return ExchangeRates.fromBytes(exchangeFileBytes);
    }

    async getFileIdBytes(address: string): Promise<Uint8Array> {
        return (new FileContentsQuery()
            .setFileId(address)
            .execute(this.clientMain));
    }

    async getRecord(transactionResponse: TransactionResponse) {
        return transactionResponse.getRecord(this.clientMain);
    }

    async submitEthereumTransaction(transactionBuffer: Uint8Array): Promise<TransactionResponse> {
        return (new EthereumTransaction()
            .setEthereumData(transactionBuffer))
            .execute(this.clientMain);
    }

    async submitContractCallQuery(to: string, data: string, gas: number): Promise<ContractFunctionResult> {
        const contract = SDKClient.prune0x(to);
        const callData = SDKClient.prune0x(data);
        const contractId = contract.startsWith("00000000000")
            ? ContractId.fromSolidityAddress(contract)
            : ContractId.fromEvmAddress(0, 0, contract);

        const contractCallQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setFunctionParameters(Buffer.from(callData, 'hex'))
            .setGas(gas);

        if (this.clientMain.operatorAccountId !== null) {
            contractCallQuery
                .setPaymentTransactionId(TransactionId.generate(this.clientMain.operatorAccountId));
        }

        const cost = await contractCallQuery
            .getCost(this.clientMain);
        return contractCallQuery
            .setQueryPayment(cost)
            .execute(this.clientMain);
    }

    /**
   * Internal helper method that converts an ethAddress (with, or without a leading 0x)
   * into an alias friendly AccountId.
   * @param ethAddress
   * @private
   */
    private static toAccountId(ethAddress: string) {
        return AccountId.fromEvmAddress(0, 0, SDKClient.prune0x(ethAddress));
    }

    /**
     * Internal helper method that prepends a leading 0x if there isn't one.
     * @param input
     * @private
     */
    private static prepend0x(input: string): string {
        return input.startsWith('0x')
            ? input
            : '0x' + input;
    }

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
}
