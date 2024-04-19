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

import { Counter, Registry } from 'prom-client';
import { WS_CONSTANTS } from '../utils/constants';

type WsMetricTitle = 'methodsCounter' | 'methodsCounterByIp' | 'totalMessageCounter';

export default class WsMetricRegistry {
  private methodsCounter: Counter; // tracks WebSocket method calls.
  private methodsCounterByIp: Counter; // tracks WebSocket method calls by IP address.
  private totalMessageCounter: Counter; // tracks the total messages sent to the websocket.

  /**
   * Creates an instance of WsMetricRegistry.
   * @param {Registry} register - The Prometheus registry to use.
   */
  constructor(register: Registry) {
    this.methodsCounter = this.generateCounterMetric(register, 'methodsCounter');
    this.methodsCounterByIp = this.generateCounterMetric(register, 'methodsCounterByIp');
    this.totalMessageCounter = this.generateCounterMetric(register, 'totalMessageCounter');
  }

  /**
   * Get metric based on metric title
   * @returns {Counter}
   */
  public get(metricTitle: WsMetricTitle): Counter {
    return this[metricTitle];
  }

  /**
   * Generates a counter metric using the provided registry and metric title.
   * @param {Registry} register - The Prometheus registry where the metric will be registered.
   * @param {WsMetricTitle} metricTitle - The title of the metric to be generated.
   * @returns {Counter} A Prometheus Counter metric instance.
   */
  private generateCounterMetric = (register: Registry, metricTitle: WsMetricTitle): Counter => {
    register.removeSingleMetric(WS_CONSTANTS[metricTitle].name);
    return new Counter({
      name: WS_CONSTANTS[metricTitle].name,
      help: WS_CONSTANTS[metricTitle].help,
      labelNames: WS_CONSTANTS[metricTitle]['labelNames'] || [],
      registers: [register],
    });
  };
}
