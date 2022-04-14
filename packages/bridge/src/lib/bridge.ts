import dotenv from 'dotenv';
import findConfig from 'find-config';
import { Bridge, Eth, Net, Web3 } from '../index';
import { Web3Impl } from './web3';
import { NetImpl } from './net';
import { EthImpl } from './eth';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';

export class BridgeImpl implements Bridge {
  private client: Client = this.initClient();

  private web3Impl: Web3 = new Web3Impl(this.client);

  private netImpl: Net = new NetImpl(this.client);

  private ethImpl: Eth = new EthImpl(this.client);

  web3(): Web3 {
    return this.web3Impl;
  }

  net(): Net {
    return this.netImpl;
  }

  eth(): Eth {
    return this.ethImpl;
  }

  initClient(): Client {
    dotenv.config({ path: findConfig('.env') || '' });
    const hederaNetwork: string = process.env.HEDERA_NETWORK || '{}';

    let client: Client;
    if (hederaNetwork in ['mainnet', 'testnet', 'previewnet']) {
      client = Client.forName(hederaNetwork);
    } else {
      client = Client.forNetwork(JSON.parse(hederaNetwork));
    }
    
    client = client.setOperator(
      AccountId.fromString(process.env.OPERATOR_ID || ''),
      PrivateKey.fromString(process.env.OPERATOR_KEY || '')
    );

    return client;
  }
}
