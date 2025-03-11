// SPDX-License-Identifier: Apache-2.0

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
const MIRROR_NODE_UPSTREAM_FAIL = 'MIRROR NODE UPSTREAM FAIL';
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
  '-32020': new HttpStatusCodeAndMessage(500, MIRROR_NODE_UPSTREAM_FAIL),
  default: new HttpStatusCodeAndMessage(400, JSON_RPC_ERROR),
};
