import { Net } from '../index'
import { Client } from '@hashgraph/sdk'

export class NetImpl implements Net {
  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  /**
   * We always return true for this.
   */
  listening(): boolean {
    return true
  }

  /**
   * TODO: We should get this value from the address book...
   */
  peerCount(): number {
    return 26;
  }

  /**
   * This is the chain id we registered.
   * TODO Support some config when launching the server for this. dotenv support?
   */
  version(): string {
    return "0x012a"
  }
}
