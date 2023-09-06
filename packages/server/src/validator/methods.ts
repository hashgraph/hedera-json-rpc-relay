export const METHODS = {
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
      type: 'blockNumber',
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
      type: 'blockNumber',
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
      type: ['array'],
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
      type: 'blockNumber',
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
};
