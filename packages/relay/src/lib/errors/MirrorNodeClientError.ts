
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
    public data?: string;
    public detail?: string;

    static ErrorCodes = {
      ECONNABORTED: 504,
      CONTRACT_REVERT_EXECUTED : 400,
      NOT_SUPPORTED: 501
    };

    static statusCodes = {
      NOT_FOUND: 404,
      TOO_MANY_REQUESTS: 429,
      NO_CONTENT: 204
    };

    constructor(error: any, statusCode: number) {
        // web3 module sends errors in this format, this is why we need a check to distinguish
        if (error.response?.data?._status?.messages?.length) {
            const msg = error.response.data._status.messages[0];
            const {message, detail, data} = msg;
            super(message);

            this.detail = detail;
            this.data = data;
        }
        else {
            super(error.message);
        }

        this.statusCode = statusCode;
        Object.setPrototypeOf(this, MirrorNodeClientError.prototype);
    }

    public isTimeout(): boolean {
      return this.statusCode === MirrorNodeClientError.ErrorCodes.ECONNABORTED;
    }

    public isContractReverted(): boolean {
        return this.statusCode === MirrorNodeClientError.ErrorCodes.CONTRACT_REVERT_EXECUTED;
    }

    public isNotFound(): boolean {
      return this.statusCode === MirrorNodeClientError.statusCodes.NOT_FOUND;
    }

    public isNotSupported(): boolean {
        return this.statusCode === MirrorNodeClientError.ErrorCodes.NOT_SUPPORTED;
    }

    public isEmpty(): boolean {
      return this.statusCode === MirrorNodeClientError.statusCodes.NO_CONTENT;
    }

    public isRateLimit(): boolean {
      return this.statusCode === MirrorNodeClientError.statusCodes.TOO_MANY_REQUESTS;
    }

    public isNotSupportedSystemContractOperaton(): boolean {
      return this.message === 'Precompile not supported';
    }
  }
