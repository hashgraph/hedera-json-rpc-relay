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

import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import { WS_CONSTANTS } from '../utils/constants';
import os from 'os';

type WsMetricCounterTitles =
  | 'methodsCounter'
  | 'methodsCounterByIp'
  | 'totalMessageCounter'
  | 'totalOpenedConnections'
  | 'totalClosedConnections';

type WsMetricGaugeTitles = 'cpuUsageGauge' | 'memoryUsageGauge';
type WsMetricHistogramTitles = 'connectionDuration' | 'messageDuration';

export default class WsMetricRegistry {
  private methodsCounter: Counter; // tracks WebSocket method calls.
  private methodsCounterByIp: Counter; // tracks WebSocket method calls by IP address.
  private totalMessageCounter: Counter; // tracks the total messages sent to the websocket.
  private totalClosedConnections: Counter; // tracks the total websocket closed connections
  private totalOpenedConnections: Counter; // tracks the total websocket established connections
  private connectionDuration: Histogram; // tracks the duration of websocket connections in seconds
  private messageDuration: Histogram; // tracks the duration of websocket connections in seconds

  /**
   * Creates an instance of WsMetricRegistry.
   * @param {Registry} register - The Prometheus registry to use.
   */
  constructor(register: Registry) {
    this.methodsCounter = this.generateCounterMetric(register, 'methodsCounter');
    this.messageDuration = this.generateHistogramMetric(register, 'messageDuration');
    this.methodsCounterByIp = this.generateCounterMetric(register, 'methodsCounterByIp');
    this.totalMessageCounter = this.generateCounterMetric(register, 'totalMessageCounter');
    this.connectionDuration = this.generateHistogramMetric(register, 'connectionDuration');
    this.totalOpenedConnections = this.generateCounterMetric(register, 'totalOpenedConnections');
    this.totalClosedConnections = this.generateCounterMetric(register, 'totalClosedConnections');

    // @notice code below will generate and init cpuUsageGauge and memoryUsageGauge which send metrics to the registry when start-up
    this.initUsageGaugeMetric(register, 'cpuUsageGauge', 'CPU');
    this.initUsageGaugeMetric(register, 'memoryUsageGauge', 'Memory Usage');
  }

  /**
   * Generates a counter metric based on the provided title and registers it with the given registry.
   * @param {Registry} register - The registry where the metric will be registered.
   * @param {WsMetricCounterTitles} metricTitle - The title of the metric to generate.
   * @returns {Counter} The generated counter metric.
   */
  private generateCounterMetric = (register: Registry, metricTitle: WsMetricCounterTitles): Counter => {
    register.removeSingleMetric(WS_CONSTANTS[metricTitle].name);
    return new Counter({
      name: WS_CONSTANTS[metricTitle].name,
      help: WS_CONSTANTS[metricTitle].help,
      labelNames: WS_CONSTANTS[metricTitle]['labelNames'] || [],
      registers: [register],
    });
  };

  /**
   * Generates a histogram metric based on the provided title and registers it with the given registry.
   * @param {Registry} register - The registry where the metric will be registered.
   * @param {WsMetricHistogramTitles} metricTitle - The title of the metric to generate.
   * @returns {Histogram} The generated histogram metric.
   */
  private generateHistogramMetric = (register: Registry, metricTitle: WsMetricHistogramTitles): Histogram => {
    register.removeSingleMetric(WS_CONSTANTS[metricTitle].name);
    return new Histogram({
      name: WS_CONSTANTS[metricTitle].name,
      help: WS_CONSTANTS[metricTitle].help,
      labelNames: WS_CONSTANTS[metricTitle]['labelNames'] || [],
      buckets: WS_CONSTANTS[metricTitle]['buckets'] || [],
      registers: [register],
    });
  };

  /**
   * Initializes a gauge metric for CPU or Memory Usage using the provided registry, metric title, and mode.
   * @param {Registry} register - The Prometheus registry where the metric will be registered.
   * @param {WsMetricGaugeTitles} metricTitle - The title of the metric to be initialized.
   * @param {'CPU' | 'Memory Usage'} mode - The mode indicating whether to collect CPU or Memory Usage metrics.
   * @returns {Gauge} A Prometheus Gauge metric instance.
   */
  private initUsageGaugeMetric = (
    register: Registry,
    metricTitle: WsMetricGaugeTitles,
    mode: 'CPU' | 'Memory Usage',
  ): Gauge => {
    register.removeSingleMetric(WS_CONSTANTS[metricTitle].name);
    return new Gauge({
      name: WS_CONSTANTS[metricTitle].name,
      help: WS_CONSTANTS[metricTitle].help,
      labelNames: WS_CONSTANTS[metricTitle]['labelNames'] || [],
      registers: [register],
      async collect() {
        switch (mode) {
          case 'CPU':
            const cpuUsage = process.cpuUsage();
            const totalCpus = os.cpus().length;
            const cpuUsagePercentage = ((cpuUsage.user + cpuUsage.system) / 1000000 / totalCpus) * 100;
            this.set({ cpu: 'CPU' }, cpuUsagePercentage);
            break;
          case 'Memory Usage':
            const memoryUsage = process.memoryUsage();
            this.set({ memory: 'Memory Usage' }, memoryUsage.heapUsed);
            break;
        }
      },
    });
  };

  /**
   * Get metric counter based on metric title
   * @returns {Counter}
   */
  public getCounter(metricTitle: WsMetricCounterTitles): Counter {
    return this[metricTitle];
  }

  /**
   * Get metric histogram based on metric title
   * @returns {Histogram}
   */
  public getHistogram(metricTitle: WsMetricHistogramTitles): Histogram {
    return this[metricTitle];
  }
}
