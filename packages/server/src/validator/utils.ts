import { Validator } from ".";
import { JsonRpcError, predefined } from '@hashgraph/json-rpc-relay';

export function validateParam(index: number | string, param: any, validation: any) {
  const isArray = Array.isArray(validation.type);
  const containsOr = validation.type?.includes('|');
  const paramType = getParamType(isArray, containsOr, validation.type);

  if (paramType === undefined) {
    throw predefined.INTERNAL_ERROR(`Missing or unsupported param type '${validation.type}'`);
  }

  if (requiredIsMissing(param, validation.required)) {
    throw predefined.MISSING_REQUIRED_PARAMETER(index);
  }

  if (param != null && Array.isArray(paramType)) {
    const results: any[] = [];
    for(const type of paramType) {
      const validator = Validator.TYPES[type];
      const result = validator.test(param);
        results.push(result);
    }
    if(results.every((item) => item === false)) {
      throw predefined.INVALID_PARAMETER(index, `The value passed is not a valid blockHash/blockNumber/blockTag value: ${param}`);
    }
  }

  if (param != null && !Array.isArray(paramType)) {
    const result = isArray ? paramType.test(index, param, validation.type[1]) : paramType.test(param);
    if(result === false) {
      throw predefined.INVALID_PARAMETER(index, `${paramType.error}, value: ${param}`);
    }
  }
}

function getParamType(isArray: boolean, containsOr: boolean, validationType: string) {
  let paramType;
  if(isArray && !containsOr) {
    paramType = Validator.TYPES[validationType[0]];
  } else if (!isArray && containsOr) {
    paramType = validationType.split('|');
  } else {
    paramType = Validator.TYPES[validationType];
  }

  return paramType;
}

export function validateObject(object: any, filters: any) {
  for (const property of Object.keys(object)) {
    const validation = filters[property];
    const param = object[property];
    let result;

    if (requiredIsMissing(param, validation.required)) {
      throw predefined.MISSING_REQUIRED_PARAMETER(`'${property}' for ${object.name()}`);
    }

    if (isValidAndNonNullableParam(param, validation.nullable)) {
      try {
        result = Validator.TYPES[validation.type].test(param);

        if(!result) {
          throw predefined.INVALID_PARAMETER(`'${property}' for ${object.name()}`, `${Validator.TYPES[validation.type].error}, value: ${param}`);
        }
      } catch(error: any) {
        if (error instanceof JsonRpcError) {
          throw predefined.INVALID_PARAMETER(`'${property}' for ${object.name()}`, `${Validator.TYPES[validation.type].error}, value: ${param}`);
        }

        throw error;
      }
    }
  }

  return true;
}

export function validateArray(array: any[], innerType?: string) {
  if (!innerType) return true;

  const isInnerType = (element: any) => Validator.TYPES[innerType].test(element);

  return array.every(isInnerType);
}

export function hasUnexpectedParams(actual: any, expected: any, object: string) {
  const expectedParams = Object.keys(expected);
  const actualParams = Object.keys(actual);
  const unknownParam = actualParams.find((param: any) => !expectedParams.includes(param));
  if (unknownParam) {
    throw predefined.INVALID_PARAMETER(`'${unknownParam}' for ${object}`, `Unknown parameter`);
  }
};

export function requiredIsMissing(param: any, required: boolean) {
  return required && param === undefined;
}

export function isValidAndNonNullableParam(param: any, nullable: boolean) {
  return param !== undefined && (param !== null || !nullable);
}
