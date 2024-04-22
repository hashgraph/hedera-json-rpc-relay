/* -
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

import { Gauge, Registry } from 'prom-client';

/**
 * Generates a Prometheus Counter metric for tracking WebSocket method calls.
 * Removes any existing metric with the same name from the provided registry before creating the new metric.
 * @param {Registry} register - The Prometheus Registry where the metric will be registered.
 * @param {any} gaugeInfo - Information of the counter.
 * @returns {Gauge} Returns a new Counter metric instance.
 */
export const generateMemoryGauge = (register: Registry, gaugeInfo: any): Gauge => {
  register.removeSingleMetric(gaugeInfo.name);
  return new Gauge({
    name: gaugeInfo.name,
    help: gaugeInfo.help,
    labelNames: gaugeInfo.labelNames,
    registers: [register],
    async collect() {
      const memoryUsage = process.memoryUsage();
      this.set({ memory: 'Memory Usage' }, memoryUsage.heapUsed);
    },
  });
};
