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

export type IMethodValidation = {
  [index: number]: IMethodParamValidation;
};

export type IMethodParamValidation = {
  type: string;
  required?: boolean;
};

export const METHODS: { [key: string]: IMethodValidation } = {
  eth_estimateGas: {
    0: {
      type: 'transaction',
      required: true,
    },
    1: {
      type: 'blockNumber',
    },
  },
  eth_getBalance: {
    0: {
      type: 'address',
      required: true,
    },
    1: {
      type: 'blockNumber|blockHash',
      required: true,
    },
  },
  eth_getCode: {
    0: {
      type: 'address',
      required: true,
    },
    1: {
      type: 'blockNumber|blockHash',
      required: true,
    },
  },
  eth_getBlockByNumber: {
    0: {
      required: true,
      type: 'blockNumber',
    },
    1: {
      required: true,
      type: 'boolean',
    },
  },
  eth_getBlockByHash: {
    0: {
      required: true,
      type: 'blockHash',
    },
    1: {
      required: true,
      type: 'boolean',
    },
  },
  eth_getTransactionCount: {
    0: {
      required: true,
      type: 'address',
    },
    1: {
      required: true,
      type: 'blockNumber|blockHash',
    },
  },
  eth_call: {
    0: {
      required: true,
      type: 'transaction',
    },
    1: {
      required: true,
      type: 'blockParams',
    },
  },
  eth_sendRawTransaction: {
    0: {
      required: true,
      type: 'hex',
    },
  },
  eth_getTransactionReceipt: {
    0: {
      required: true,
      type: 'transactionHash',
    },
  },
  eth_getTransactionByHash: {
    0: {
      required: true,
      type: 'transactionHash',
    },
  },
  eth_feeHistory: {
    0: {
      required: true,
      type: 'hex',
    },
    1: {
      required: true,
      type: 'blockNumber',
    },
    2: {
      type: 'array',
    },
  },
  eth_getBlockTransactionCountByHash: {
    0: {
      required: true,
      type: 'blockHash',
    },
  },
  eth_getBlockTransactionCountByNumber: {
    0: {
      required: true,
      type: 'blockNumber',
    },
  },
  eth_getLogs: {
    0: {
      type: 'filter',
      required: true,
    },
  },
  eth_getStorageAt: {
    0: {
      required: true,
      type: 'address',
    },
    1: {
      required: true,
      type: 'hex',
    },
    2: {
      type: 'blockNumber|blockHash',
    },
  },
  eth_getTransactionByBlockHashAndIndex: {
    0: {
      required: true,
      type: 'blockHash',
    },
    1: {
      required: true,
      type: 'hex',
    },
  },
  eth_getTransactionByBlockNumberAndIndex: {
    0: {
      required: true,
      type: 'blockNumber',
    },
    1: {
      required: true,
      type: 'hex',
    },
  },
  eth_uninstallFilter: {
    0: {
      required: true,
      type: 'hex',
    },
  },
  eth_getFilterLogs: {
    0: {
      required: true,
      type: 'hex',
    },
  },
  debug_traceTransaction: {
    0: {
      required: true,
      type: 'transactionHash|transactionId',
    },
    1: {
      required: false,
      type: 'tracerConfigWrapper|tracerConfig|tracerType',
    },
    2: {
      required: false,
      type: 'tracerConfig',
    },
  },
};
