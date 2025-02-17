// SPDX-License-Identifier: Apache-2.0

import { Net } from '../index';
import { Client } from '@hashgraph/sdk';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';

export class NetImpl implements Net {
  private client: Client;
  private readonly chainId: string;

  constructor(client: Client) {
    this.client = client;

    this.chainId = parseInt(ConfigService.get('CHAIN_ID'), 16).toString();
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
