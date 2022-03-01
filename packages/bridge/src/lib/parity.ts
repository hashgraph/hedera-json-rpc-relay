import { Parity } from '../index';
import { Client } from '@hashgraph/sdk';

export class ParityImpl implements Parity {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  nextNonce() {}
}
