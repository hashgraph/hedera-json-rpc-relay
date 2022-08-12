/*-
 * ‌
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
 * ​
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
 * ‍
 */

const errorField = "error";
const resultField = "result";

function isNonErrorResponse(response) {
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

function isErrorResponse(response) {
  //instead of doing multiple type checks,
  //lets just do the normal path and return false,
  //if an exception happens.
  try {
    if (response.status !== 200) {
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
    jsonrpc: "2.0",
    method: methodName,
    params: paramInput
  });
}

export {isErrorResponse, isNonErrorResponse, httpParams, getPayLoad};
