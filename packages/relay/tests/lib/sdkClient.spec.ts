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
const registry = new Registry();
import pino from 'pino';
import {AccountId, Client, ContractCallQuery, PrivateKey, TransactionId, Hbar, Status} from "@hashgraph/sdk";
const logger = pino();
import constants from '../../src/lib/constants';
import HbarLimit from '../../src/lib/hbarlimiter';
import { ClientCache, SDKClient } from '../../src/lib/clients';

describe('SdkClient', async function () {
    this.timeout(20000);
    let sdkClient, client, hbarLimiter;

    before(() => {
        client = Client.forNetwork(JSON.parse(process.env.HEDERA_NETWORK!));
        client = client.setOperator(
            AccountId.fromString(process.env.OPERATOR_ID_MAIN!),
            PrivateKey.fromString(process.env.OPERATOR_KEY_MAIN!)
        );
        const duration = constants.HBAR_RATE_LIMIT_DURATION;
        const total = constants.HBAR_RATE_LIMIT_TINYBAR;
        hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);
        sdkClient = new SDKClient(client, logger.child({ name: `consensus-node` }), hbarLimiter, { costHistogram: undefined, gasHistogram: undefined }, new ClientCache(logger.child({ name: `cache` }), registry));
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
            const getFeeScheduleStub = sinon.stub(sdkClient, 'getFeeSchedule').callsFake(() => {
                return {
                    current: {
                        transactionFeeSchedule: [{
                            hederaFunctionality: {
                                _code: constants.ETH_FUNCTIONALITY_CODE
                            },
                            fees: [{
                                servicedata: undefined
                            }]
                        }]
                    }
                };
            });
            const getExchangeRateStub = sinon.stub(sdkClient, 'getExchangeRate').callsFake(() => {});
            const convertGasPriceToTinyBarsStub = sinon.stub(sdkClient, 'convertGasPriceToTinyBars').callsFake(() => 0x160c);

            for (let i = 0; i < 5; i++) {
                await sdkClient.getTinyBarGasFee('');
            }

            sinon.assert.calledOnce(getFeeScheduleStub);
            sinon.assert.calledOnce(getExchangeRateStub);
            sinon.assert.calledOnce(convertGasPriceToTinyBarsStub);
        });
    })
});
