/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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
export class HttpStatusCodeAndMessage {
  public statusCode: number;
  public StatusName: string;

  constructor(statusCode: number, statusName: string) {
    this.statusCode = statusCode;
    this.StatusName = statusName;
  }
}

const INTERNAL_ERROR = 'INTERNAL ERROR';
const INVALID_PARAMS_ERROR = 'INVALID PARAMS ERROR';
const INVALID_REQUEST = 'INVALID REQUEST';
const IP_RATE_LIMIT_EXCEEDED = 'IP RATE LIMIT EXCEEDED';
const JSON_RPC_ERROR = 'JSON RPC ERROR';
const CONTRACT_REVERT = 'CONTRACT REVERT';
const METHOD_NOT_FOUND = 'METHOD NOT FOUND';
const DEPENDENT_SERVICE_IMMATURE_RECORDS = 'DEPENDENT SERVICE IMMATURE RECORDS';

export const RpcErrorCodeToStatusMap = {
  '3': new HttpStatusCodeAndMessage(200, CONTRACT_REVERT),
  '-32603': new HttpStatusCodeAndMessage(500, INTERNAL_ERROR),
  '-32015': new HttpStatusCodeAndMessage(503, DEPENDENT_SERVICE_IMMATURE_RECORDS),
  '-32600': new HttpStatusCodeAndMessage(400, INVALID_REQUEST),
  '-32602': new HttpStatusCodeAndMessage(400, INVALID_PARAMS_ERROR),
  '-32601': new HttpStatusCodeAndMessage(400, METHOD_NOT_FOUND),
  '-32605': new HttpStatusCodeAndMessage(409, IP_RATE_LIMIT_EXCEEDED),
  default: new HttpStatusCodeAndMessage(400, JSON_RPC_ERROR),
};
