import { JsonRpcError, predefined } from '@hashgraph/json-rpc-relay';

export const ERROR_CODE = -32602;
export const DEFAULT_HEX_ERROR = 'Expected 0x prefixed hexadecimal value';
export const HASH_ERROR = 'Expected 0x prefixed string representing the hash (32 bytes)';
export const ADDRESS_ERROR = 'Expected 0x prefixed string representing the address (20 bytes)';
export const BLOCK_NUMBER_ERROR = 'Expected 0x prefixed hexadecimal block number, or the string "latest", "earliest" or "pending"';
export const BLOCK_HASH_ERROR = `${HASH_ERROR} of a block`;
export const TRANSACTION_HASH_ERROR = `${HASH_ERROR} of a transaction`;
export const TOPIC_HASH_ERROR = `${HASH_ERROR} of a topic`;
export const TYPES = {
  "address": {
    test: (param: string) => new RegExp('^0[xX][a-fA-F0-9]{40}$').test(param),
    error: ADDRESS_ERROR
  },
  'blockNumber': {
    test: (param: string) => new RegExp('^0[xX][a-fA-F0-9]').test(param) || [ "earliest", "latests", "pending"].includes(param),
    error: BLOCK_NUMBER_ERROR
  },
  'blockHash': {
    test: (param: string) =>  new RegExp('^0[xX][0-9A-Fa-f]{64}$').test(param),
    error: BLOCK_HASH_ERROR
  },
  'transactionHash': {
    test: (param: string) =>  new RegExp('^0[xX][A-Fa-f0-9]{64}$').test(param),
    error: TRANSACTION_HASH_ERROR
  },
  'topicHash': {
    test: (param: string) =>  new RegExp('^0[xX][A-Fa-f0-9]{64}$').test(param),
    error: TOPIC_HASH_ERROR
  },
  'hex': {
    test: (param: string) => new RegExp('^0[xX][a-fA-F0-9]').test(param),
    error: DEFAULT_HEX_ERROR
  },
  'bool': {
    test: (param: string) => param === 'true' || param === 'false',
    error: 'Expected boolean'
  },
  "transaction": {
    test: (param: any) => {
      return Object.prototype.toString.call(param) === "[object Object]" ? new TransactionObject(param).validate(param) : false;
    },
    error: 'Expected Object'
  },
  "filter": {
    test: (param: any) => {
      return Object.prototype.toString.call(param) === "[object Object]" ? new FilterObject(param).validate(param) : false;
    },
    error: 'Expected Object'
  },
  "array": {
    test: (param: any) => {
      return Array.isArray(param) ? validateArray(param) : false;
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

  validate(props: any) {
    return validateObject(this, props);
  }
};

export class FilterObject {
  blockHash: string;
  address?: string;
  toBlock?: string;
  fromBlock?: string;
  topics?: string[];

  constructor (filter: any) {
    this.toBlock = filter.toBlock;
    this.blockHash = filter.blockHash;
    this.fromBlock = filter.fromBlock;
    this.topics = filter.topics;
    this.address = filter.address;
  }

  validate(props: any) {
    if (this.blockHash && (this.toBlock || this.fromBlock)) {
      return predefined.INVALID_PARAMETER(0, "Can't use both blockHash and toBlock/fromBlock");
    }

    return validateObject(this, props);
  }
};

export function validateParams(params: any, indexes: any)  {
  for (const index of Object.keys(indexes)) {
    const validation = indexes[Number(index)];
    const param = params[Number(index)];

    if (validation.required && param === undefined) {
      return predefined.MISSING_REQUIRED_PARAMETER(index);
    }

    const result: any = !TYPES[validation.type].test(param);
    if (result instanceof JsonRpcError) {
      return result;
    } else if(result === false) {
      return predefined.INVALID_PARAMETER(index, TYPES[validation.type].error);
    }
  }
}

function validateObject(obj: any, props: any) {
  for (const prop of Object.keys(props)) {
    const validation = props[prop];
    const param = obj[prop];

    if (validation.required && param === undefined) {
      return predefined.MISSING_REQUIRED_PARAMETER(prop);
    }

    if (validation.type && typeof validation.type === "string") {
      if (param !== undefined && !TYPES[validation.type].test(param)) {
        return predefined.INVALID_PARAMETER(prop, TYPES[validation.type].error);
      }
    }
  }

  return true;
}

function validateArray(array: string[]) {
  const isAddress = (element) => TYPES["address"].test(element);
  return !array.every(isAddress)
  ? predefined.INVALID_PARAMETER('addresses', TYPES["address"].error)
  : true;
}

export * as Validator from "./validator";
