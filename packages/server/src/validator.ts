import { JsonRpcError, predefined } from '@hashgraph/json-rpc-relay';

export const ERROR_CODE = -32602;
export const DEFAULT_HEX_ERROR = 'Expected 0x prefixed hexadecimal value';
export const HASH_ERROR = 'Expected 0x prefixed string representing the hash (32 bytes)';
export const ADDRESS_ERROR = 'Expected 0x prefixed string representing the address (20 bytes)';
export const BLOCK_NUMBER_ERROR = 'Expected 0x prefixed hexadecimal block number, or the string "latest", "earliest" or "pending"';
export const BLOCK_HASH_ERROR = `${HASH_ERROR} of a block`;
export const TRANSACTION_HASH_ERROR = `${HASH_ERROR} of a transaction`;
export const TOPIC_HASH_ERROR = `${HASH_ERROR} of a topic`;
export const objects = {
  "transaction": {
    "from": {
      type: "address"
    },
    "to": {
      required: true,
      type: "address"
    },
    "gas": {
      type: "hex"
    },
    "gasPrice": {
      type: "hex"
    },
    "maxPriorityFeePerGas": {
      type: "hex"
    },
    "maxFeePerGas": {
      type: "hex"
    },
    "value": {
      type: "hex"
    },
    "data": {
      type: "hex"
    }
  },
  "filter": {
    "blockHash": {
      type: "blockHash"
    },
    "fromBlock": {
      type: "blockNumber"
    },
    "toBlock": {
      type: "blockNumber"
    },
    "address": {
      type: "address"
    },
    "topics": {
      type: ["array", 'topicHash']
    }
  }
};
export const TYPES = {
  "address": {
    test: (param: string) => /^0[xX][a-fA-F0-9]{40}$/.test(param),
    error: ADDRESS_ERROR
  },
  'blockNumber': {
    test: (param: string) => /^0[xX][a-fA-F0-9]/.test(param) || ["earliest", "latest", "pending"].includes(param),
    error: BLOCK_NUMBER_ERROR
  },
  'blockHash': {
    test: (param: string) =>  /^0[xX][0-9A-Fa-f]{64}$/.test(param),
    error: BLOCK_HASH_ERROR
  },
  'transactionHash': {
    test: (param: string) =>  /^0[xX][A-Fa-f0-9]{64}$/.test(param),
    error: TRANSACTION_HASH_ERROR
  },
  'topicHash': {
    test: (param: string) =>  /^0[xX][A-Fa-f0-9]{64}$/.test(param),
    error: TOPIC_HASH_ERROR
  },
  'hex': {
    test: (param: string) => /^0[xX][a-fA-F0-9]/.test(param),
    error: DEFAULT_HEX_ERROR
  },
  'bool': {
    test: (param: boolean) => param === true || param === false,
    error: 'Expected boolean'
  },
  "transaction": {
    test: (param: any) => {
      return Object.prototype.toString.call(param) === "[object Object]" ? new TransactionObject(param).validate() : false;
    },
    error: 'Expected Transaction object'
  },
  "filter": {
    test: (param: any) => {
      return Object.prototype.toString.call(param) === "[object Object]" ? new FilterObject(param).validate() : false;
    },
    error: 'Expected Filter object'
  },
  "array": {
    test: (param: any, innerType: any) => {
      return Array.isArray(param) ? validateArray(param, innerType) : false;
    },
    error: 'Expected Array'
  }
};

export class TransactionObject {
  from?: string;
  to: string;
  gas?: string;
  gasPrice?: string;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  value?: string;
  data?: string;

  constructor (transaction: any) {
    this.from = transaction.from;
    this.to = transaction.to;
    this.gas = transaction.gas;
    this.gasPrice = transaction.gasPrice;
    this.maxPriorityFeePerGas = transaction.maxPriorityFeePerGas;
    this.maxFeePerGas = transaction.maxFeePerGas;
    this.value = transaction.value;
    this.data = transaction.data;
  }

  validate() {
    return validateObject(this, objects.transaction);
  }

  name() {
    return "Transaction Object";
  }
};

export class FilterObject {
  blockHash: string;
  fromBlock?: string;
  toBlock?: string;
  address?: string;
  topics?: string[];

  constructor (filter: any) {
    this.blockHash = filter.blockHash;
    this.fromBlock = filter.fromBlock;
    this.toBlock = filter.toBlock;
    this.address = filter.address;
    this.topics = filter.topics;
  }

  validate() {
    if (this.blockHash && (this.toBlock || this.fromBlock)) {
      return predefined.INVALID_PARAMETER(0, "Can't use both blockHash and toBlock/fromBlock");
    }

    return validateObject(this, objects.filter);
  }

  name() {
    return "Filter Object";
  }
};

export function validateParams(params: any, indexes: any)  {
  for (const index of Object.keys(indexes)) {
    const validation = indexes[Number(index)];
    const param = params[Number(index)];

    if (validation.required && param === undefined) {
      return predefined.MISSING_REQUIRED_PARAMETER(index);
    }

    const paramType =
      Array.isArray(validation.type)
      ? TYPES[validation.type[0]]
      : TYPES[validation.type];

    if (paramType === undefined) {
      return predefined.INTERNAL_ERROR(`Missing or unsupported param type '${validation.type}'`);
    }

    if (param !== undefined) {
      const result: any = paramType.test(param);

      if (result instanceof JsonRpcError) {
        return result;
      } else if(result === false) {
        return predefined.INVALID_PARAMETER(index, paramType.error);
      }
    }
  }
}

function validateObject(obj: any, props: any) {
  for (const prop of Object.keys(props)) {
    const validation = props[prop];
    const param = obj[prop];

    if (validation.required && param === undefined) {
      return predefined.MISSING_REQUIRED_PARAMETER(`'${prop}' for ${obj.name()}`);
    }

    if (typeof validation.type === "string") {
      if (param !== undefined && !TYPES[validation.type].test(param)) {
        return predefined.INVALID_PARAMETER(`'${prop}' for ${obj.name()}`, TYPES[validation.type].error);
      }
    } else if(Array.isArray(validation.type)) {
      if (param !== undefined && !TYPES[validation.type[0]].test(param, validation.type[1])) {
        return predefined.INVALID_PARAMETER(`'${prop}' for ${obj.name()}`, TYPES[validation.type[1]].error);
      }
    } else {
      return predefined.INTERNAL_ERROR(`Unsupported param type ${validation.type} for ${obj.name()}`);
    }
  }

  return true;
}

function validateArray(array: any[], innerType: string) {
  const isInnerType = (element: any) => TYPES[innerType].test(element);
  return !array.every(isInnerType)
  ? predefined.INVALID_PARAMETER('addresses', TYPES[innerType].error)
  : true;
}

export * as Validator from "./validator";
