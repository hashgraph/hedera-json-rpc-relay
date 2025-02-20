// SPDX-License-Identifier: Apache-2.0

import { keccak256 } from '@ethersproject/keccak256';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { Client } from '@hashgraph/sdk';

import { Web3 } from '../index';

export class Web3Impl implements Web3 {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  clientVersion(): string {
    return 'relay/' + ConfigService.get('npm_package_version');
  }

  sha3(input: string): string {
    return keccak256(input);
  }
}
