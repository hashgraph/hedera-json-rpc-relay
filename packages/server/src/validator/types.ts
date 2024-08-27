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

import * as Constants from './constants';
import { CallTracerConfig, OpcodeLoggerConfig, TracerConfigWrapper, Validator } from '.';
import { ITypeValidation } from '../types/validator';
import {
  ICallTracerConfig,
  IOpcodeLoggerConfig,
  ITracerConfig,
  ITracerConfigWrapper,
} from '@hashgraph/json-rpc-relay/src/lib/types';

export const TYPES: { [key: string]: ITypeValidation } = {
  address: {
    test: (param: string) => new RegExp(Constants.BASE_HEX_REGEX + '{40}$').test(param),
    error: Constants.ADDRESS_ERROR,
  },
  addressFilter: {
    test: (param: string | string[]) => {
      return Array.isArray(param)
        ? Validator.validateArray(param.flat(), 'address')
        : new RegExp(Constants.BASE_HEX_REGEX + '{40}$').test(param);
    },
    error: `${Constants.ADDRESS_ERROR} or an array of addresses`,
  },
  array: {
    test: (param: any, innerType?: any) => {
      return Array.isArray(param) ? Validator.validateArray(param, innerType) : false;
    },
    error: 'Expected Array',
  },
  blockHash: {
    test: (param: string) => new RegExp(Constants.BASE_HEX_REGEX + '{64}$').test(param),
    error: Constants.BLOCK_HASH_ERROR,
  },
  blockNumber: {
    test: (param: string) =>
      (/^0[xX]([1-9A-Fa-f][0-9A-Fa-f]{0,13}|0)$/.test(param) && Number.MAX_SAFE_INTEGER >= Number(param)) ||
      ['earliest', 'latest', 'pending', 'finalized', 'safe'].includes(param),
    error: Constants.BLOCK_NUMBER_ERROR,
  },
  boolean: {
    test: (param: boolean) => param === true || param === false,
    error: 'Expected boolean type',
  },
  blockParams: {
    test: (param: any) => {
      if (Object.prototype.toString.call(param) === '[object Object]') {
        if (param.hasOwnProperty('blockHash')) {
          return new Validator.BlockHashObject(param).validate();
        }
        return new Validator.BlockNumberObject(param).validate();
      }
      return (
        (/^0[xX]([1-9A-Fa-f]+[0-9A-Fa-f]{0,13}|0)$/.test(param) && Number.MAX_SAFE_INTEGER >= Number(param)) ||
        ['earliest', 'latest', 'pending', 'finalized', 'safe'].includes(param)
      );
    },
    error: Constants.BLOCK_PARAMS_ERROR,
  },
  filter: {
    test: (param: any) => {
      if (Object.prototype.toString.call(param) === '[object Object]') {
        return new Validator.FilterObject(param).validate();
      }

      return false;
    },
    error: `Expected FilterObject`,
  },
  hex: {
    test: (param: string) => new RegExp(Constants.BASE_HEX_REGEX + '*$').test(param),
    error: Constants.DEFAULT_HEX_ERROR,
  },
  hex64: {
    test: (param: string) => new RegExp(Constants.BASE_HEX_REGEX + '{1,64}$').test(param),
    error: Constants.HASH_ERROR,
  },
  topicHash: {
    test: (param: string) => new RegExp(Constants.BASE_HEX_REGEX + '{64}$').test(param) || param === null,
    error: Constants.TOPIC_HASH_ERROR,
  },
  topics: {
    test: (param: string[] | string[][]) => {
      return Array.isArray(param) ? Validator.validateArray(param.flat(), 'topicHash') : false;
    },
    error: `Expected an array or array of arrays containing ${Constants.HASH_ERROR} of a topic`,
  },
  transaction: {
    test: (param: any) => {
      if (Object.prototype.toString.call(param) === '[object Object]') {
        return new Validator.TransactionObject(param).validate();
      }

      return false;
    },
    error: 'Expected TransactionObject',
  },
  transactionHash: {
    test: (param: string) => new RegExp(Constants.BASE_HEX_REGEX + '{64}$').test(param),
    error: Constants.TRANSACTION_HASH_ERROR,
  },
  transactionId: {
    test: (param: string) => new RegExp(Constants.TRANSACTION_ID_REGEX).test(param),
    error: Constants.TRANSACTION_ID_ERROR,
  },
  tracerType: {
    test: (param: any): param is Constants.TracerType =>
      typeof param === 'string' &&
      Object.values(Constants.TracerType)
        .map((tracerType) => tracerType.toString())
        .includes(param),
    error: 'Expected TracerType',
  },
  callTracerConfig: {
    test: (param: any): param is ICallTracerConfig => {
      if (param && typeof param === 'object') {
        return new CallTracerConfig(param).validate();
      }
      return false;
    },
    error: 'Expected CallTracerConfig',
  },
  opcodeLoggerConfig: {
    test: (param: any): param is IOpcodeLoggerConfig => {
      if (param && typeof param === 'object') {
        return new OpcodeLoggerConfig(param).validate();
      }
      return false;
    },
    error: 'Expected OpcodeLoggerConfig',
  },
  tracerConfig: {
    test: (param: Record<string, any>): param is ITracerConfig => {
      if (param && typeof param === 'object') {
        const isEmptyObject = Object.keys(param).length === 0;
        const isValidCallTracerConfig = TYPES.callTracerConfig.test(param);
        const isValidOpcodeLoggerConfig = TYPES.opcodeLoggerConfig.test(param);
        return isEmptyObject || isValidCallTracerConfig || isValidOpcodeLoggerConfig;
      }
      return false;
    },
    error: 'Expected TracerConfig',
  },
  tracerConfigWrapper: {
    test: (param: any): param is ITracerConfigWrapper => {
      if (param && typeof param === 'object') {
        return new TracerConfigWrapper(param).validate();
      }
      return false;
    },
    error: 'Expected TracerConfigWrapper which contains a valid TracerType and/or TracerConfig',
  },
};
