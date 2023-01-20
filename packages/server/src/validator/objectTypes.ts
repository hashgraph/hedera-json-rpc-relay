import { Validator } from ".";
import { predefined } from '@hashgraph/json-rpc-relay';

export const OBJECTS_VALIDATIONS = {
  "blockHashObject": {
    "blockHash": {
      type: "blockHash"
    }
  },
  "blockNumberObject": {
    "blockNumber": {
      type: "blockNumber"
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
      type: "addressFilter"
    },
    "topics": {
      type: "topics"
    }
  },
  "transaction": {
    "from": {
      type: "address"
    },
    "to": {
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
    },
    "type": {
      type: "hex"
    },
    "chainId": {
      type: "hex"
    },
    "nonce": {
      type: "hex"
    },
    "input": {
      type: "hex"
    }
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

  constructor(transaction: any) {
    Validator.hasUnexpectedParams(transaction, OBJECTS_VALIDATIONS.transaction, this.name());
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
    return Validator.validateObject(this, OBJECTS_VALIDATIONS.transaction);
  }

  name() {
    return this.constructor.name;
  }
};

export class FilterObject {
  blockHash: string;
  fromBlock?: string;
  toBlock?: string;
  address?: string | string[];
  topics?: string[] | string[][];

  constructor (filter: any) {
    Validator.hasUnexpectedParams(filter, OBJECTS_VALIDATIONS.filter, this.name());
    this.blockHash = filter.blockHash;
    this.fromBlock = filter.fromBlock;
    this.toBlock = filter.toBlock;
    this.address = filter.address;
    this.topics = filter.topics;
  }

  validate() {
    if (this.blockHash && (this.toBlock || this.fromBlock)) {
      throw predefined.INVALID_PARAMETER(0, "Can't use both blockHash and toBlock/fromBlock");
    }

    return Validator.validateObject(this, OBJECTS_VALIDATIONS.filter);
  }

  name() {
    return this.constructor.name;
  }
};

export class BlockHashObject {
  blockHash: string;

  constructor (param: any) {
    Validator.hasUnexpectedParams(param, OBJECTS_VALIDATIONS.blockHashObject, this.name());
    this.blockHash = param.blockHash;
  }

  validate() {
    return Validator.validateObject(this, OBJECTS_VALIDATIONS.blockHashObject);
  }

  name() {
    return this.constructor.name;
  }
};

export class BlockNumberObject {
  blockNumber: string;

  constructor (param: any) {
    Validator.hasUnexpectedParams(param, OBJECTS_VALIDATIONS.blockNumberObject, this.name());
    this.blockNumber = param.blockNumber;
  }

  validate() {
    return Validator.validateObject(this, OBJECTS_VALIDATIONS.blockNumberObject);
  }

  name() {
    return this.constructor.name;
  }
};

