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
import { Registry } from 'prom-client';
import { RelayImpl } from '@hashgraph/json-rpc-relay';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

import pino from 'pino';
const logger = pino();

const Relay = new RelayImpl(logger, new Registry());

describe('Web3', async function() {
  it('should execute "web3_clientVersion"', async function() {
    const clientVersion = await Relay.web3().clientVersion();

    expect(clientVersion).to.be.equal('relay/' + process.env.npm_package_version);
  });
});
