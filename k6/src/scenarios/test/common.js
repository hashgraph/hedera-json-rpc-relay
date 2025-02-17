// SPDX-License-Identifier: Apache-2.0

const errorField = 'error';
const resultField = 'result';

const isDebugMode = __ENV['DEBUG_MODE'] === 'true';

function isNonErrorResponse(response) {
  if (isDebugMode) {
    console.log(response);
  }
  //instead of doing multiple type checks,
  //lets just do the normal path and return false,
  //if an exception happens.
  try {
    if (response.status !== 200) {
      return false;
    }
    const body = JSON.parse(response.body);
    return body.hasOwnProperty(resultField) && !body.hasOwnProperty(errorField);
  } catch (e) {
    return false;
  }
}

function is400Status(response) {
  if (isDebugMode) {
    console.log(response);
  }
  try {
    return response.status === 400;
  } catch (e) {
    return false;
  }
}

function isErrorResponse(response) {
  if (isDebugMode) {
    console.log(response);
  }
  //instead of doing multiple type checks,
  //lets just do the normal path and return false,
  //if an exception happens.
  try {
    if (response.status === 200) {
      return false;
    }
    const body = JSON.parse(response.body);
    return body.hasOwnProperty(errorField) && !body.hasOwnProperty(resultField);
  } catch (e) {
    return false;
  }
}

const httpParams = {
  headers: {
    'Content-Type': 'application/json',
  },
};

let requestId = 1;
function getPayLoad(methodName, paramInput = []) {
  return JSON.stringify({
    id: requestId++,
    jsonrpc: '2.0',
    method: methodName,
    params: paramInput,
  });
}

export { isErrorResponse, isNonErrorResponse, httpParams, getPayLoad, is400Status };
