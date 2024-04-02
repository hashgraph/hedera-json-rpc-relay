/* -
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023-2024 Hedera Hashgraph, LLC
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

import { WS_CONSTANTS } from './constants';
import { Counter, Registry } from 'prom-client';

/**
 * Generates a Prometheus Counter metric for tracking WebSocket method calls.
 * Removes any existing metric with the same name from the provided registry before creating the new metric.
 * @param {Registry} register - The Prometheus Registry where the metric will be registered.
 * @returns {Counter} Returns a new Counter metric instance.
 */
export const generateMethodsCounter = (register: Registry) => {
  register.removeSingleMetric(WS_CONSTANTS.methodsCounter.name);
  return new Counter({
    name: WS_CONSTANTS.methodsCounter.name,
    help: WS_CONSTANTS.methodsCounter.help,
    labelNames: WS_CONSTANTS.methodsCounter.labelNames,
    registers: [register],
  });
};

/**
 * Generates a Prometheus Counter metric for tracking WebSocket method calls by IP address.
 * Removes any existing metric with the same name from the provided registry before creating the new metric.
 * @param {Registry} register - The Prometheus Registry where the metric will be registered.
 * @returns {Counter} Returns a new Counter metric instance.
 */
export const generateMethodsCounterById = (register: Registry) => {
  register.removeSingleMetric(WS_CONSTANTS.methodsCounterByIp.name);
  return new Counter({
    name: WS_CONSTANTS.methodsCounterByIp.name,
    help: WS_CONSTANTS.methodsCounterByIp.help,
    labelNames: WS_CONSTANTS.methodsCounterByIp.labelNames,
    registers: [register],
  });
};
