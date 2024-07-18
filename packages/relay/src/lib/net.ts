/*-
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

import { Net } from '../index';
import constants from './constants';
import { Client } from '@hashgraph/sdk';

export class NetImpl implements Net {
  private client: Client;
  private readonly chainId: string;

  constructor(client: Client) {
    this.client = client;

    const hederaNetwork: string = (process.env.HEDERA_NETWORK || '{}').toLowerCase();
    this.chainId = process.env.CHAIN_ID || constants.CHAIN_IDS[hederaNetwork] || '298';
    if (this.chainId.startsWith('0x')) this.chainId = parseInt(this.chainId, 16).toString();
  }

  /**
   * We always return true for this.
   */
  listening(): boolean {
    return false;
  }

  /**
   * This is the chain id we registered.
   */
  version(): string {
    return this.chainId;
  }
}
