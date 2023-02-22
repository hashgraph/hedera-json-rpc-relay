/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

export default function jsonResp(id, error, result) {
  const response: any = {};

  if (error && result) {
    throw new Error('Mutually exclusive error and result exist');
  }

  if (id !== null && typeof id !== 'string' && typeof id !== 'number') {
    throw new TypeError(`Invalid id type ${typeof id}`);
  }

  if (typeof result !== 'undefined') {
    response.result = result;
  } else if (error) {
    if (typeof error.code !== 'number') {
      throw new TypeError(`Invalid error code type ${typeof error.code}`);
    }

    if (typeof error.message !== 'string') {
      throw new TypeError(`Invalid error message type ${typeof error.message}`);
    }

    response.error = error;
  } else {
    throw new Error('Missing result or error');
  }

  response.jsonrpc = '2.0';
  response.id = id;
  return response;
}
