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

import path from 'path';
import dotenv from 'dotenv';
import { expect } from 'chai';
import sinon from 'sinon';
import { Registry } from 'prom-client';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import {SDKClient} from '../../src/lib/clients/sdkClient';
const registry = new Registry();
import pino from 'pino';
import {AccountId, Client, ContractCallQuery, PrivateKey, TransactionId, Hbar, Status} from "@hashgraph/sdk";
const logger = pino();
import constants from '../../src/lib/constants';

describe('SdkClient', async function () {
    this.timeout(20000);
    let sdkClient, client;

    before(() => {
        client = Client.forNetwork(JSON.parse(process.env.HEDERA_NETWORK));
        client = client.setOperator(
            AccountId.fromString(process.env.OPERATOR_ID_MAIN),
            PrivateKey.fromString(process.env.OPERATOR_KEY_MAIN)
        );

        sdkClient = new SDKClient(client, logger.child({ name: `consensus-node` }), registry);
    })

    describe('increaseCostAndRetryExecution', async () => {
        let queryStub, contractCallQuery;
        const successResponse = "0x00001";
        const costTinybars = 1000;
        const baseCost = Hbar.fromTinybars(costTinybars);

        beforeEach(() => {
            contractCallQuery = new ContractCallQuery()
                .setContractId('0.0.1010')
                .setPaymentTransactionId(TransactionId.generate(client.operatorAccountId))
            queryStub = sinon.stub(contractCallQuery, 'execute');
        })

        it('executes the query', async () => {
            queryStub.returns(successResponse);
            let {resp, cost} = await sdkClient.increaseCostAndRetryExecution(contractCallQuery, baseCost, client, 3, 0);
            expect(resp).to.eq(successResponse);
            expect(cost.toTinybars().toNumber()).to.eq(costTinybars);
            expect(queryStub.callCount).to.eq(1);
        });

        it('increases the cost when INSUFFICIENT_TX_FEE is thrown', async () => {
            queryStub.onCall(0).throws({
              status: Status.InsufficientTxFee
            });

            queryStub.onCall(1).returns(successResponse);
            let {resp, cost} = await sdkClient.increaseCostAndRetryExecution(contractCallQuery, baseCost, client, 3, 0);
            expect(resp).to.eq(successResponse);
            expect(cost.toTinybars().toNumber()).to.eq(costTinybars * constants.QUERY_COST_INCREMENTATION_STEP);
            expect(queryStub.callCount).to.eq(2);
        });

        it('increases the cost when INSUFFICIENT_TX_FEE is thrown on every repeat', async () => {
            queryStub.onCall(0).throws({
              status: Status.InsufficientTxFee
            });

            queryStub.onCall(1).throws({
              status: Status.InsufficientTxFee
            });

            queryStub.onCall(2).returns(successResponse);

            let {resp, cost} = await sdkClient.increaseCostAndRetryExecution(contractCallQuery, baseCost, client, 3, 0);
            expect(resp).to.eq(successResponse);
            expect(cost.toTinybars().toNumber()).to.eq(Math.floor(costTinybars * Math.pow(constants.QUERY_COST_INCREMENTATION_STEP, 2)));
            expect(queryStub.callCount).to.eq(3);
        });

        it('is repeated at most 4 times', async () => {
            try {
                queryStub.throws({
                    status: Status.InsufficientTxFee
                });

                let {resp, cost} = await sdkClient.increaseCostAndRetryExecution(contractCallQuery, baseCost, client, 3, 0);
            }
            catch(e: any) {
                expect(queryStub.callCount).to.eq(4);
                expect(e.status).to.eq(Status.InsufficientTxFee);
            }
        });

        it('should return cached getTinyBarGasFee value', async () => {
            const getFeeScheduleAndExchangeRateQueriesCount = async () => {
                const metrics = await registry.getMetricsAsJSON();
                const queries = metrics.length ? metrics[0]['values'].filter(e => e.metricName == 'rpc_relay_consensusnode_response_count') : [];
                const feeScheduleQueries = queries.length ? queries.filter(e => e.labels.interactingEntity == constants.FEE_SCHEDULE_FILE_ID)[0].value : 0;
                const exchangeRateQueries = queries.length ? queries.filter(e => e.labels.interactingEntity == constants.EXCHANGE_RATE_FILE_ID)[0].value : 0;

                return [feeScheduleQueries, exchangeRateQueries];
            };

            const [feeScheduleQueriesBefore, exchangeRateQueriesBefore] = await getFeeScheduleAndExchangeRateQueriesCount();
            for (let i = 0; i < 10; i++) {
                await sdkClient.getTinyBarGasFee('');
            }
            const [feeScheduleQueriesAfter, exchangeRateQueriesAfter] = await getFeeScheduleAndExchangeRateQueriesCount();

            expect(feeScheduleQueriesBefore + 1).to.eq(feeScheduleQueriesAfter);
            expect(exchangeRateQueriesBefore + 1).to.eq(exchangeRateQueriesAfter);
        });
    })
});
