/*
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

export class RequestDetails {
  requestId: string;
  ipAddress: string;
  connectionId?: string;

  constructor(details: { requestId: string; ipAddress: string; connectionId?: string }) {
    this.requestId = details.requestId;
    this.ipAddress = details.ipAddress;
    this.connectionId = details.connectionId;
  }

  get formattedRequestId(): string {
    return this.requestId ? `[Request ID: ${this.requestId}]` : '';
  }

  get formattedConnectionId(): string | undefined {
    return this.connectionId ? `[Connection ID: ${this.connectionId}]` : '';
  }

  get formattedLogPrefix(): string {
    const connectionId = this.formattedConnectionId;
    const requestId = this.formattedRequestId;
    if (connectionId && requestId) {
      return `${connectionId} ${requestId}`;
    }
    return connectionId || requestId;
  }
}
