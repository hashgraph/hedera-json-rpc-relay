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

import Axios, { AxiosInstance } from 'axios';
import { Logger } from 'pino';
import { Utils } from '../helpers/utils';

export default class MetricsClient {
  private readonly logger: Logger;
  private readonly client: AxiosInstance;
  private readonly relayUrl: string;

  constructor(relayUrl: string, logger: Logger) {
    this.logger = logger;
    this.relayUrl = relayUrl;

    const metricsClient = Axios.create({
      baseURL: `${relayUrl}/metrics`,
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'GET',
      timeout: 5 * 1000,
    });

    this.client = metricsClient;
  }

  /**
   * Retrieves the value of a specified metric.
   *
   * The response from the /metrics endpoint is a large string with multiple rows of key-value pairs,
   * separated by " ", where the key is the metric name.
   * Rows may begin with #, which represents a comment and should be ignored.
   * This method retrieves the whole response, splits it into rows, finds the first row that starts with the
   * provided metric name and returns the corresponding value.
   *
   * Example extract:
   *
   * pc_relay_hbar_rate_remaining 11000000000
   * rpc_relay_cache 0
   * rpc_websocket_subscription_times_bucket{le="0.05"} 0
   * rpc_websocket_subscription_times_bucket{le="1"} 0
   * rpc_websocket_subscription_times_bucket{le="10"} 0
   * rpc_websocket_subscription_times_bucket{le="60"} 0
   *
   * @param metric
   * @param requestId
   */
  async get(metric: string, requestId?: string) {
    const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
    this.logger.debug(`${requestIdPrefix} [GET] Read all metrics from ${this.relayUrl}/metrics`);
    const allMetrics = (await this.client.get('')).data;
    const allMetricsArray = allMetrics.split('\n');
    const matchPattern = `${metric} `;
    const result = allMetricsArray.find((m) => m.startsWith(matchPattern));
    return result.replace(matchPattern, '');
  }
}
