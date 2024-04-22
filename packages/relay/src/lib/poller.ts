/*-
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

import { Eth } from '../index';
import { Logger } from 'pino';
import { Registry, Gauge } from 'prom-client';

export interface Poll {
  tag: string;
  callback: Function;
  lastPolled?: string;
}

const LOGGER_PREFIX = 'Poller:';

export class Poller {
  private eth: Eth;
  private logger: Logger;
  private polls: Poll[];
  private interval?: NodeJS.Timer;
  private latestBlock?: string;
  private pollingInterval: number;
  private newHeadsEnabled: boolean;
  private activePollsGauge: Gauge;
  private activeNewHeadsPollsGauge: Gauge;

  private NEW_HEADS_EVENT = 'newHeads';

  constructor(eth: Eth, logger: Logger, register: Registry) {
    this.eth = eth;
    this.logger = logger;
    this.polls = [];
    this.pollingInterval = Number(process.env.WS_POLLING_INTERVAL) || 500;
    this.newHeadsEnabled = process.env.WS_NEW_HEADS_ENABLED ? Boolean(Number(process.env.WS_NEW_HEADS_ENABLED)) : true;

    const activePollsGaugeName = 'rpc_websocket_active_polls';
    register.removeSingleMetric(activePollsGaugeName);
    this.activePollsGauge = new Gauge({
      name: activePollsGaugeName,
      help: 'Relay websocket active polls count',
      registers: [register],
    });

    const activeNewHeadsPollsGaugeName = 'rpc_websocket_active_newheads_polls';
    register.removeSingleMetric(activeNewHeadsPollsGaugeName);
    this.activeNewHeadsPollsGauge = new Gauge({
      name: activeNewHeadsPollsGaugeName,
      help: 'Relay websocket active newHeads polls count',
      registers: [register],
    });
  }

  public poll() {
    this.polls.forEach(async (poll) => {
      try {
        this.logger.debug(`${LOGGER_PREFIX} Fetching data for tag: ${poll.tag}`);

        const { event, filters } = JSON.parse(poll.tag);
        let data;

        if (event === 'logs') {
          data = await this.eth.getLogs(
            null,
            poll.lastPolled || this.latestBlock || 'latest',
            'latest',
            filters?.address || null,
            filters?.topics || null,
          );

          poll.lastPolled = this.latestBlock;
        } else if (event === this.NEW_HEADS_EVENT && this.newHeadsEnabled) {
          data = await this.eth.getBlockByNumber('latest', filters?.includeTransactions ?? false);
          data.jsonrpc = '2.0';
          poll.lastPolled = this.latestBlock;
        } else {
          this.logger.error(`${LOGGER_PREFIX} Polling for unsupported event: ${event}. Tag: ${poll.tag}`);
        }

        if (Array.isArray(data)) {
          if (data.length) {
            this.logger.trace(`${LOGGER_PREFIX} Received ${data.length} results from tag: ${poll.tag}`);
            data.forEach((d) => {
              poll.callback(d);
            });
          }
        } else {
          this.logger.trace(`${LOGGER_PREFIX} Received 1 result from tag: ${poll.tag}`);
          poll.callback(data);
        }
      } catch (error) {
        this.logger.error(error, `Poller error`);
      }
    });
  }

  start() {
    this.logger.info(`${LOGGER_PREFIX} Starting polling with interval=${this.pollingInterval}`);
    this.interval = setInterval(async () => {
      this.latestBlock = await this.eth.blockNumber();
      this.poll();
    }, this.pollingInterval);
  }

  stop() {
    this.logger.info(`${LOGGER_PREFIX} Stopping polling`);
    if (this.isPolling()) {
      clearInterval(this.interval as NodeJS.Timeout);
      delete this.interval;
    }
  }

  async add(tag: string, callback: Function) {
    if (!this.hasPoll(tag)) {
      this.logger.info(`${LOGGER_PREFIX} Tag ${tag} added to polling list`);
      this.polls.push({
        tag,
        callback,
      });
      if (JSON.parse(tag).event === this.NEW_HEADS_EVENT) {
        this.activeNewHeadsPollsGauge.inc();
      } else {
        this.activePollsGauge.inc();
      }
    }

    if (!this.isPolling()) {
      this.start();
    }
  }

  remove(tag: string) {
    this.logger.info(`${LOGGER_PREFIX} Tag ${tag} removed from polling list`);
    const pollsAtStart = this.polls.length;
    this.polls = this.polls.filter((p) => p.tag !== tag);

    const pollsRemoved = pollsAtStart - this.polls.length;
    if (pollsRemoved > 0) {
      if (JSON.parse(tag).event === this.NEW_HEADS_EVENT) {
        this.activeNewHeadsPollsGauge.dec(pollsRemoved);
      } else {
        this.activePollsGauge.dec(pollsRemoved);
      }
    }

    if (!this.polls.length) {
      this.logger.info(`${LOGGER_PREFIX} No active polls.`);
      this.stop();
    }
  }

  hasPoll(tag): boolean {
    // Return boolean true if the polls array contains this tag
    return !!this.polls.filter((p) => p.tag === tag).length;
  }

  isPolling() {
    return !!this.interval;
  }
}
