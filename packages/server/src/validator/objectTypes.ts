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

import { predefined } from '@hashgraph/json-rpc-relay';
import { ITracerConfig } from '@hashgraph/json-rpc-relay/src/lib/types';
import { TracerType, Validator } from '.';
import { IObjectSchema, IObjectValidation } from '../types/validator/objectTypes';

export const OBJECTS_VALIDATIONS: { [key: string]: IObjectSchema } = {
  blockHashObject: {
    properties: {
      blockHash: {
        type: 'blockHash',
        nullable: false,
      },
    },
  },
  blockNumberObject: {
    properties: {
      blockNumber: {
        type: 'blockNumber',
        nullable: false,
      },
    },
  },
  filter: {
    properties: {
      blockHash: {
        type: 'blockHash',
        nullable: false,
      },
      fromBlock: {
        type: 'blockNumber',
        nullable: false,
      },
      toBlock: {
        type: 'blockNumber',
        nullable: false,
      },
      address: {
        type: 'addressFilter',
        nullable: false,
      },
      topics: {
        type: 'topics',
        nullable: false,
      },
    },
  },
  callTracerConfig: {
    failOnEmpty: true,
    properties: {
      onlyTopCall: {
        type: 'boolean',
        nullable: false,
        required: false,
      },
    },
  },
  opcodeLoggerConfig: {
    failOnEmpty: true,
    properties: {
      enableMemory: {
        type: 'boolean',
        nullable: false,
        required: false,
      },
      disableStack: {
        type: 'boolean',
        nullable: false,
        required: false,
      },
      disableStorage: {
        type: 'boolean',
        nullable: false,
        required: false,
      },
    },
  },
  tracerConfigWrapper: {
    failOnEmpty: true,
    properties: {
      tracer: {
        type: 'tracerType',
        nullable: false,
        required: false,
      },
      tracerConfig: {
        type: 'tracerConfig',
        nullable: false,
        required: false,
      },
    },
  },
  transaction: {
    properties: {
      from: {
        type: 'address',
        nullable: false,
      },
      to: {
        type: 'address',
        nullable: true,
      },
      gas: {
        type: 'hex',
        nullable: false,
      },
      gasPrice: {
        type: 'hex',
        nullable: false,
      },
      maxPriorityFeePerGas: {
        type: 'hex',
        nullable: false,
      },
      maxFeePerGas: {
        type: 'hex',
        nullable: false,
      },
      value: {
        type: 'hex',
        nullable: false,
      },
      data: {
        type: 'hex',
        nullable: true,
      },
      type: {
        type: 'hex',
        nullable: false,
      },
      chainId: {
        type: 'hex',
        nullable: false,
      },
      nonce: {
        type: 'hex',
        nullable: false,
      },
      input: {
        type: 'hex',
        nullable: false,
      },
      accessList: {
        type: 'array',
        nullable: false,
      },
    },
  },
  ethSubscribeLogsParams: {
    properties: {
      address: {
        type: 'addressFilter',
        nullable: false,
        required: false,
      },
      topics: {
        type: 'topics',
        nullable: false,
      },
    },
  },
};

export class CallTracerConfig implements IObjectValidation {
  onlyTopCall: boolean;

  constructor(config: any) {
    this.onlyTopCall = config.onlyTopCall;
  }

  validate() {
    return Validator.validateObject(this, OBJECTS_VALIDATIONS.callTracerConfig);
  }

  name() {
    return this.constructor.name;
  }
}

export class OpcodeLoggerConfig implements IObjectValidation {
  enableMemory?: boolean;
  disableStack?: boolean;
  disableStorage?: boolean;

  constructor(config: any) {
    this.enableMemory = config.enableMemory;
    this.disableStack = config.disableStack;
    this.disableStorage = config.disableStorage;
  }

  validate() {
    return Validator.validateObject(this, OBJECTS_VALIDATIONS.opcodeLoggerConfig);
  }

  name() {
    return this.constructor.name;
  }
}

export class TracerConfigWrapper implements IObjectValidation {
  tracer: TracerType;
  tracerConfig: ITracerConfig;

  constructor(config: any) {
    this.tracer = config.tracer;
    this.tracerConfig = config.tracerConfig;
  }

  validate() {
    return Validator.validateObject(this, OBJECTS_VALIDATIONS.tracerConfigWrapper);
  }

  name() {
    return this.constructor.name;
  }
}

export class TransactionObject implements IObjectValidation {
  from?: string;
  to: string;
  gas?: string;
  gasPrice?: string;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  value?: string;
  data?: string;

  constructor(transaction: any) {
    Validator.checkForUnexpectedParams(transaction, OBJECTS_VALIDATIONS.transaction, this.name());
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
}

export class FilterObject implements IObjectValidation {
  blockHash: string;
  fromBlock?: string;
  toBlock?: string;
  address?: string | string[];
  topics?: string[] | string[][];

  constructor(filter: any) {
    Validator.checkForUnexpectedParams(filter, OBJECTS_VALIDATIONS.filter, this.name());
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
}

export class BlockHashObject implements IObjectValidation {
  blockHash: string;

  constructor(param: any) {
    Validator.checkForUnexpectedParams(param, OBJECTS_VALIDATIONS.blockHashObject, this.name());
    this.blockHash = param.blockHash;
  }

  validate() {
    return Validator.validateObject(this, OBJECTS_VALIDATIONS.blockHashObject);
  }

  name() {
    return this.constructor.name;
  }
}

export class BlockNumberObject implements IObjectValidation {
  blockNumber: string;

  constructor(param: any) {
    Validator.checkForUnexpectedParams(param, OBJECTS_VALIDATIONS.blockNumberObject, this.name());
    this.blockNumber = param.blockNumber;
  }

  validate() {
    return Validator.validateObject(this, OBJECTS_VALIDATIONS.blockNumberObject);
  }

  name() {
    return this.constructor.name;
  }
}

export class EthSubscribeLogsParamsObject implements IObjectValidation {
  address?: string | string[];
  topics?: string[] | string[][];

  constructor(param: any) {
    Validator.checkForUnexpectedParams(param, OBJECTS_VALIDATIONS.ethSubscribeLogsParams, this.name());
    this.address = param.address;
    this.topics = param.topics;
  }

  validate() {
    const valid = Validator.validateObject(this, OBJECTS_VALIDATIONS.ethSubscribeLogsParams);
    // address and is not an empty array
    if (
      valid &&
      Array.isArray(this.address) &&
      this.address.length === 0 &&
      OBJECTS_VALIDATIONS.ethSubscribeLogsParams.properties.address.required
    ) {
      throw predefined.MISSING_REQUIRED_PARAMETER(`'address' for ${this.name()}`);
    }

    return valid;
  }

  name() {
    return this.constructor.name;
  }
}
