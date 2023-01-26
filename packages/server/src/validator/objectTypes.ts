import { Validator } from ".";
import { predefined } from '@hashgraph/json-rpc-relay';

export const OBJECTS_VALIDATIONS = {
  "blockHashObject": {
    "blockHash": {
      type: "blockHash",
      nullable: false
    }
  },
  "blockNumberObject": {
    "blockNumber": {
      type: "blockNumber",
      nullable: false
    }
  },
  "filter": {
    "blockHash": {
      type: "blockHash",
      nullable: false
    },
    "fromBlock": {
      type: "blockNumber",
      nullable: false
    },
    "toBlock": {
      type: "blockNumber",
      nullable: false
    },
    "address": {
      type: "addressFilter",
      nullable: false
    },
    "topics": {
      type: "topics",
      nullable: false
    }
  },
  "transaction": {
    "from": {
      type: "address",
      nullable: false
    },
    "to": {
      type: "address",
      nullable: false
    },
    "gas": {
      type: "hex",
      nullable: false
    },
    "gasPrice": {
      type: "hex",
      nullable: false
    },
    "maxPriorityFeePerGas": {
      type: "hex",
      nullable: false
    },
    "maxFeePerGas": {
      type: "hex",
      nullable: false
    },
    "value": {
      type: "hex",
      nullable: false
    },
    "data": {
      type: "hex",
      nullable: false
    },
    "type": {
      type: "hex",
      nullable: false
    },
    "chainId": {
      type: "hex",
      nullable: false
    },
    "nonce": {
      type: "hex",
      nullable: false
    },
    "input": {
      type: "hex",
      nullable: false
    },
    "accessList": {
      type: "array",
      nullable: false
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
    console.log(`transaction: ${JSON.stringify(this)}`)
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

