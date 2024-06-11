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

import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import pino from 'pino';
import { Registry } from 'prom-client';
import constants from '../../../src/lib/constants';
import HbarLimit from '../../../src/lib/hbarlimiter';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import MockAdapter from 'axios-mock-adapter';
import { MirrorNodeClient } from '../../../src/lib/clients/mirrorNodeClient';
import { EthImpl } from '../../../src/lib/eth';

export function contractResultsByNumberByIndexURL(number: number, index: number): string {
  return `contracts/results?block.number=${number}&transaction.index=${index}&limit=100&order=asc`;
}

export function contractResultsByHashByIndexURL(hash: string, index: number): string {
  return `contracts/results?block.hash=${hash}&transaction.index=${index}&limit=100&order=asc`;
}

export function balancesByAccountIdByTimestampURL(id: string, timestamp?: string): string {
  const timestampQuery = timestamp ? `&timestamp=${timestamp}` : '';
  return `balances?account.id=${id}${timestampQuery}`;
}

export function generateEthTestEnv(fixedFeeHistory = false) {
  process.env.ETH_FEE_HISTORY_FIXED = fixedFeeHistory.toString();
  const logger = pino();
  const registry = new Registry();
  const cacheService = new CacheService(logger.child({ name: `cache` }), registry);
  // @ts-ignore
  const mirrorNodeInstance = new MirrorNodeClient(
    process.env.MIRROR_NODE_URL || '',
    logger.child({ name: `mirror-node` }),
    registry,
    cacheService,
  );

  // @ts-ignore
  const restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: 'throwException' });
  // @ts-ignore
  const web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: 'throwException' });

  const duration = constants.HBAR_RATE_LIMIT_DURATION;
  const total = constants.HBAR_RATE_LIMIT_TINYBAR;
  const hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);

  const hapiServiceInstance = new HAPIService(logger, registry, hbarLimiter, cacheService);

  // @ts-ignore
  const ethImpl = new EthImpl(hapiServiceInstance, mirrorNodeInstance, logger, '0x12a', registry, cacheService);

  return {
    cacheService,
    mirrorNodeInstance,
    restMock,
    web3Mock,
    hapiServiceInstance,
    ethImpl,
    logger,
    registry,
  };
}
