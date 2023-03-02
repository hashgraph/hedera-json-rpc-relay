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

// external resources
import { solidity } from "ethereum-waffle";
import chai, {expect} from "chai";
chai.use(solidity);

import {Utils} from '../../helpers/utils';
const {ethers} = require('ethers');

describe('@web-socket Acceptance Tests', async function () {
    this.timeout(240 * 1000); // 240 seconds
    const CHAIN_ID = process.env.CHAIN_ID || 0;

    // cached entities
    let requestId;
    let wsProvider;
    let subId;

    // this.beforeAll(async () => {
    //     wsProvider = new ethers.providers.WebSocketProvider(
    //         `ws://localhost:${process.env.WEB_SOCKET_PORT}`
    //     );
    // });

    this.beforeEach(async () => {
        requestId = Utils.generateRequestId();
    });

    describe('Connection', async function () {
        it('tests are running', async function () {
            expect(1).to.eq(1);
        });

        // it('establishes connection', async function () {
        //     expect(wsProvider).to.exist;
        //     expect(wsProvider._wsReady).to.eq(true);
        //     expect(1).to.eq(1);
        // });
        //
        // it('Socket server responds to the eth_chainId event', async function () {
        //     const response = await wsProvider.send('eth_chainId');
        //     expect(response).to.eq(CHAIN_ID);
        // });
        //
        // it('Socket server responds to a eth_subscribe event', async function () {
        //     subId = await wsProvider.send('eth_subscribe', ['logs', {
        //           address: '0x23f5e49569A835d7bf9AefD30e4f60CdD570f225',
        //           topics: [
        //               '0xc8b501cbd8e69c98c535894661d25839eb035b096adfde2bba416f04cc7ce987'
        //           ]
        //     }]);
        //
        //     expect(ethers.utils.isHexString(subId, 16)).to.eq(true);
        // });
        //
        // it('Socket server responds to a eth_unsubscribe event', async function () {
        //     const res = await wsProvider.send('eth_unsubscribe', [subId]);
        //     expect(res).to.eq(true);
        // });
    });
});
