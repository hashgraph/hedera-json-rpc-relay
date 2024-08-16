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

import { Validator } from '.';
import { predefined } from '@hashgraph/json-rpc-relay';
import { IObjectSchema, IObjectValidation } from '../types/validator';

export const OBJECTS_VALIDATIONS: { [key: string]: IObjectSchema } = {
  blockHashObject: {
    name: 'BlockHashObject',
    failOnUnexpectedParams: true,
    properties: {
      blockHash: {
        type: 'blockHash',
        nullable: false,
      },
    },
  },
  blockNumberObject: {
    name: 'BlockNumberObject',
    failOnUnexpectedParams: true,
    properties: {
      blockNumber: {
        type: 'blockNumber',
        nullable: false,
      },
    },
  },
  filter: {
    name: 'FilterObject',
    failOnUnexpectedParams: true,
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
  transaction: {
    name: 'TransactionObject',
    failOnUnexpectedParams: true,
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
    name: 'EthSubscribeLogsParamsObject',
    failOnUnexpectedParams: true,
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

export class DefaultValidation<T extends object = any> implements IObjectValidation<T> {
  private readonly _object: T;
  protected readonly schema: IObjectSchema;

  constructor(schema: IObjectSchema, object: T) {
    this.schema = schema;
    this._object = object;
  }

  get object(): T {
    return this._object;
  }

  validate() {
    if (this.schema.failOnUnexpectedParams) {
      this.checkForUnexpectedParams();
    }
    return Validator.validateObject(this.object, this.schema);
  }

  name() {
    return this.schema.name;
  }

  checkForUnexpectedParams() {
    const expectedParams = Object.keys(this.schema.properties);
    const actualParams = Object.keys(this.object);
    const unknownParam = actualParams.find((param) => !expectedParams.includes(param));
    if (unknownParam) {
      throw predefined.INVALID_PARAMETER(`'${unknownParam}' for ${this.schema.name}`, `Unknown parameter`);
    }
  }
}

export class TransactionObject extends DefaultValidation {
  constructor(transaction: any) {
    super(OBJECTS_VALIDATIONS.transaction, transaction);
  }
}

export class FilterObject extends DefaultValidation {
  constructor(filter: any) {
    super(OBJECTS_VALIDATIONS.filter, filter);
  }

  validate() {
    if (this.object.blockHash && (this.object.toBlock || this.object.fromBlock)) {
      throw predefined.INVALID_PARAMETER(0, "Can't use both blockHash and toBlock/fromBlock");
    }
    return super.validate();
  }
}

export class BlockHashObject extends DefaultValidation {
  constructor(param: any) {
    super(OBJECTS_VALIDATIONS.blockHashObject, param);
  }
}

export class BlockNumberObject extends DefaultValidation {
  constructor(param: any) {
    super(OBJECTS_VALIDATIONS.blockNumberObject, param);
  }
}

export class EthSubscribeLogsParamsObject extends DefaultValidation {
  constructor(param: any) {
    super(OBJECTS_VALIDATIONS.ethSubscribeLogsParams, param);
  }

  validate() {
    const valid = super.validate();
    // address and is not an empty array
    if (
      valid &&
      Array.isArray(this.object.address) &&
      this.object.address.length === 0 &&
      OBJECTS_VALIDATIONS.ethSubscribeLogsParams.properties.address.required
    ) {
      throw predefined.MISSING_REQUIRED_PARAMETER(`'address' for ${this.schema.name}`);
    }

    return valid;
  }
}
