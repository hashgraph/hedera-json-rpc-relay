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

import { IMethodParamValidation, IObjectSchema, ITypeValidation, Validator } from '.';
import { JsonRpcError, predefined } from '@hashgraph/json-rpc-relay';

export function validateParam(index: number | string, param: any, validation: IMethodParamValidation) {
  const paramType = getParamType(validation.type);

  if (paramType === undefined) {
    throw predefined.INTERNAL_ERROR(`Missing or unsupported param type '${validation.type}'`);
  }

  if (requiredIsMissing(param, validation.required)) {
    throw predefined.MISSING_REQUIRED_PARAMETER(index);
  }

  if (param != null && Array.isArray(paramType)) {
    const results: any[] = [];
    for (const validator of paramType) {
      const result = validator.test(param);
      results.push(result);
    }
    if (!results.some((item) => item === true)) {
      const errorMessages = paramType.map((validator) => validator.error).join(' OR ');
      throw predefined.INVALID_PARAMETER(index, `The value passed is not valid: ${param}. ${errorMessages}`);
    }
  }

  if (param != null && !Array.isArray(paramType)) {
    if (!paramType.test(param)) {
      throw predefined.INVALID_PARAMETER(index, `${paramType.error}, value: ${param}`);
    }
  }
}

function getParamType(validationType: string): ITypeValidation | ITypeValidation[] {
  if (validationType?.includes('|')) {
    return validationType.split('|').map((type) => Validator.TYPES[type]);
  } else {
    return Validator.TYPES[validationType];
  }
}

export function validateObject(object: any, filters: IObjectSchema) {
  for (const property of Object.keys(filters.properties)) {
    const validation = filters.properties[property];
    const param = object[property];

    if (requiredIsMissing(param, validation.required)) {
      throw predefined.MISSING_REQUIRED_PARAMETER(`'${property}' for ${object.name()}`);
    }

    if (isValidAndNonNullableParam(param, validation.nullable)) {
      try {
        const result = Validator.TYPES[validation.type].test(param);

        if (!result) {
          throw predefined.INVALID_PARAMETER(
            `'${property}' for ${object.name()}`,
            `${Validator.TYPES[validation.type].error}, value: ${param}`,
          );
        }
      } catch (error: any) {
        if (error instanceof JsonRpcError) {
          throw predefined.INVALID_PARAMETER(
            `'${property}' for ${object.name()}`,
            `${Validator.TYPES[validation.type].error}, value: ${param}`,
          );
        }

        throw error;
      }
    }
  }

  const paramsMatchingFilters = Object.keys(filters.properties).filter((key) => object[key] !== undefined);
  return !filters.failOnEmpty || paramsMatchingFilters.length > 0;
}

export function validateArray(array: any[], innerType?: string) {
  if (!innerType) return true;

  const isInnerType = (element: any) => Validator.TYPES[innerType].test(element);

  return array.every(isInnerType);
}

export function hasUnexpectedParams(actual: any, expected: IObjectSchema, object: string) {
  const expectedParams = Object.keys(expected.properties);
  const actualParams = Object.keys(actual);
  const unknownParam = actualParams.find((param: any) => !expectedParams.includes(param));
  if (unknownParam) {
    throw predefined.INVALID_PARAMETER(`'${unknownParam}' for ${object}`, `Unknown parameter`);
  }
}

export function requiredIsMissing(param: any, required?: boolean) {
  return required && param === undefined;
}

export function isValidAndNonNullableParam(param: any, nullable: boolean) {
  return param !== undefined && (param !== null || !nullable);
}
