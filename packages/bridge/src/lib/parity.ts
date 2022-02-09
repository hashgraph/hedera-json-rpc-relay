import { Parity } from '../index';

export default class ParityImpl implements Parity {
  nextNonce(): number {
    return 0;
  }
}
