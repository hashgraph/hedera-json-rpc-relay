import { Net } from '../index';

export default class NetImpl implements Net {
  /**
   * We always return true for this.
   */
  listening(): boolean {
    return true;
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
  version(): number {
    return 0x12a;
  }
}
