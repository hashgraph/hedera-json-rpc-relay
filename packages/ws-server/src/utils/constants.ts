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

export const WS_CONSTANTS = {
  methodsCounter: {
    name: 'rpc_websocket_method_counter',
    help: 'Relay websocket total methods called',
    labelNames: ['method'],
  },
  methodsCounterByIp: {
    name: 'rpc_websocket_method_by_ip_counter',
    help: 'Relay websocket methods called by ip',
    labelNames: ['ip', 'method'],
  },
  connLimiter: {
    activeConnectionsMetric: {
      name: 'rpc_websocket_active_connections',
      help: 'Relay websocket active connections',
    },
    ipConnectionsMetric: {
      name: 'rpc_websocket_active_connections_per_ip',
      help: 'Relay websocket active connections by ip',
      labelNames: ['ip'],
    },
    connectionLimitMetric: {
      name: 'rpc_websocket_total_connection_limit_enforced',
      help: 'Relay websocket total connection limits enforced',
    },
    ipConnectionLimitMetric: {
      name: 'rpc_websocket_total_connection_limit_by_ip_enforced',
      help: 'Relay websocket total connection limits by ip enforced',
      labelNames: ['ip'],
    },
    inactivityTTLLimitMetric: {
      name: 'rpc_websocket_total_connection_limit_by_ttl_enforced',
      help: 'Relay websocket total connection ttl limits enforced',
    },
  },
  METHODS: {
    ETH_SUBSCRIBE: 'eth_subscribe',
    ETH_UNSUBSCRIBE: 'eth_unsubscribe',
    ETH_CHAIN_ID: 'eth_chainId',
    ETH_SEND_RAW_TRANSACTION: 'eth_sendRawTransaction',
  },
};
