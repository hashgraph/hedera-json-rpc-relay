
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
    public errorMessage?: string;

    static retryErrorCodes: Array<number> = [400, 404, 408, 425, 500]

    static ErrorCodes = {
      ECONNABORTED: 504,
      CONTRACT_REVERT_EXECUTED : 400
    };

    static statusCodes = {
      NOT_FOUND: 404
    };

    constructor(error: any, statusCode: number) {
        if (error.response?.data?._status?.messages?.length) {
            const msg = error.response.data._status.messages[0];
            const {message, data} = msg;
            super(message);

            this.errorMessage = data;
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
        return this.statusCode === MirrorNodeClientError.ErrorCodes.CONTRACT_REVERT_EXECUTED && this.message === 'NOT_SUPPORTED';
    }
  }
