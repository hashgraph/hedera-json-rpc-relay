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

import { Status } from '@hashgraph/sdk';

export class SDKClientError extends Error {
  public status: Status = Status.Unknown;
  private validNetworkError: boolean = false;

  constructor(e: any, message?: string) {
    super(e?.status?._code ? e.message : message);

    if (e?.status?._code) {
      this.validNetworkError = true;
      this.status = e.status;
    }

    Object.setPrototypeOf(this, SDKClientError.prototype);
  }

  get statusCode(): number {
    return this.status._code;
  }

  public isValidNetworkError(): boolean {
    return this.validNetworkError;
  }

  public isInvalidAccountId(): boolean {
    return this.isValidNetworkError() && this.statusCode === Status.InvalidAccountId._code;
  }

  public isInvalidContractId(): boolean {
    return (
      this.isValidNetworkError() &&
      (this.statusCode === Status.InvalidContractId._code ||
        this.message?.includes(Status.InvalidContractId.toString()))
    );
  }

  public isContractDeleted(): boolean {
    return this.statusCode == Status.ContractDeleted._code;
  }

  public isInsufficientTxFee(): boolean {
    return this.statusCode === Status.InsufficientTxFee._code;
  }

  public isContractRevertExecuted(): boolean {
    return this.statusCode == Status.ContractRevertExecuted._code;
  }

  public isTimeoutExceeded(): boolean {
    return this.statusCode === Status.Unknown._code && this.message?.includes('timeout exceeded');
  }

  public isGrpcTimeout(): boolean {
    // The SDK uses the same code for Grpc Timeout as INVALID_TRANSACTION_ID
    return this.statusCode === Status.InvalidTransactionId._code;
  }
}
