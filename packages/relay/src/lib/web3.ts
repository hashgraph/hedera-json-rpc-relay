// SPDX-License-Identifier: Apache-2.0

import { Web3 } from '../index';
import { Client } from '@hashgraph/sdk';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';

export class Web3Impl implements Web3 {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  clientVersion(): string {
    return 'relay/' + ConfigService.get('npm_package_version');
  }
}
