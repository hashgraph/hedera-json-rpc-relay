/* -
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

export interface IExecuteTransactionEventPayload {
  transactionId: string;
  callerName: string;
  requestId: string;
  txConstructorName: string;
  operatorAccountId: string;
  interactingEntity: string;
}

export interface IExecuteQueryEventPayload {
  executionType: string;
  transactionId: string;
  txConstructorName: string;
  callerName: string;
  cost: number;
  gasUsed: number;
  interactingEntity: string;
  status: string;
  requestId: string;
}

export enum ExecutionType {
  QUERY_EXECUTTION = `QUERY_EXECUTTION`,
  TRANSACTION_EXECUTION = `TRANSACTION_EXECUTION`,
  RECORD_QUERY_EXECUTION = `RECORD_QUERY_EXECUTION`,
}
