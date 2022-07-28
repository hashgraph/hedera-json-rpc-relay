
/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

export class MirrorNodeClientError extends Error {
    public statusCode: number;

    static statusCodes = {
        TIMEOUT: 567,
        NOT_FOUND: 404
    };
  
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
  
      Object.setPrototypeOf(this, MirrorNodeClientError.prototype);
    }

    public isTimeout(): boolean {
        return this.statusCode === MirrorNodeClientError.statusCodes.TIMEOUT;
    }

    public isNotFound(): boolean {
        return this.statusCode === MirrorNodeClientError.statusCodes.NOT_FOUND;
    }
  }
  