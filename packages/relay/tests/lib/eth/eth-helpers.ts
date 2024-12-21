/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import MockAdapter from 'axios-mock-adapter';
import EventEmitter from 'events';
import pino from 'pino';
import { register, Registry } from 'prom-client';

import { ConfigName } from '../../../../config-service/src/services/configName';
import { ConfigServiceTestHelper } from '../../../../config-service/tests/configServiceTestHelper';
import { MirrorNodeClient } from '../../../src/lib/clients/mirrorNodeClient';
import constants from '../../../src/lib/constants';
import { EvmAddressHbarSpendingPlanRepository } from '../../../src/lib/db/repositories/hbarLimiter/evmAddressHbarSpendingPlanRepository';
import { HbarSpendingPlanRepository } from '../../../src/lib/db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { IPAddressHbarSpendingPlanRepository } from '../../../src/lib/db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import { EthImpl } from '../../../src/lib/eth';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import { HbarLimitService } from '../../../src/lib/services/hbarLimitService';

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
  ConfigServiceTestHelper.dynamicOverride('ETH_FEE_HISTORY_FIXED', fixedFeeHistory);
  const logger = pino();
  const registry = new Registry();
  const cacheService = new CacheService(logger.child({ name: `cache` }), registry);
  // @ts-ignore
  const mirrorNodeInstance = new MirrorNodeClient(
    ConfigService.get(ConfigName.MIRROR_NODE_URL) as string || '',
    logger.child({ name: `mirror-node` }),
    registry,
    cacheService,
  );

  // @ts-ignore
  const restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: 'throwException' });
  // @ts-ignore
  const web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: 'throwException' });

  const duration = constants.HBAR_RATE_LIMIT_DURATION;
  const eventEmitter = new EventEmitter();

  const hbarSpendingPlanRepository = new HbarSpendingPlanRepository(cacheService, logger);
  const evmAddressHbarSpendingPlanRepository = new EvmAddressHbarSpendingPlanRepository(cacheService, logger);
  const ipAddressHbarSpendingPlanRepository = new IPAddressHbarSpendingPlanRepository(cacheService, logger);
  const hbarLimitService = new HbarLimitService(
    hbarSpendingPlanRepository,
    evmAddressHbarSpendingPlanRepository,
    ipAddressHbarSpendingPlanRepository,
    logger,
    register,
    duration,
  );

  const hapiServiceInstance = new HAPIService(logger, registry, cacheService, eventEmitter, hbarLimitService);

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
