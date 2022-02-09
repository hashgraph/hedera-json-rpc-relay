import { Bridge, Eth, Net, Parity, Web3 } from '../index';
import ParityImpl from './parity';
import Web3Impl from './web3';
import NetImpl from './net';
import EthImpl from './eth';

export default class BridgeImpl implements Bridge {
  private parityImpl: Parity = new ParityImpl();

  private web3Impl: Web3 = new Web3Impl();

  private netImpl: Net = new NetImpl();

  private ethImpl: Eth = new EthImpl();

  parity(): Parity {
    return this.parityImpl;
  }

  web3(): Web3 {
    return this.web3Impl;
  }

  net(): Net {
    return this.netImpl;
  }

  eth(): Eth {
    return this.ethImpl;
  }
}
