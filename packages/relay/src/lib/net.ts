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

import { Net } from '../index';
import { Client } from '@hashgraph/sdk';
import { predefined as Errors, JsonRpcError } from './errors';

export class NetImpl implements Net {
  private client: Client;
  private readonly chainId: string;

  constructor(client: Client, chainId: string) {
    this.client = client;
    this.chainId = chainId;
  }

  /**
   * We always return true for this.
   */
  listening(): boolean {
    return false;
  }

  /**
   * Method is not supported
   */
  peerCount(): JsonRpcError {
    return Errors['UNSUPPORTED_METHOD'];
  }

  /**
   * This is the chain id we registered.
   * TODO Support some config when launching the server for this. dotenv support?
   */
  version(): string {
    return this.chainId;
  }
}
