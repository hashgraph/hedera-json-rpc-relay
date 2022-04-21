import dotenv from 'dotenv';
import findConfig from 'find-config';
import { Bridge, Eth, Net, Web3 } from '../index';
import { Web3Impl } from './web3';
import { NetImpl } from './net';
import { EthImpl } from './eth';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';

export class BridgeImpl implements Bridge {
  private clientMain: Client = this.initClient();
  private clientSendRawTx: Client = this.initClient('eth_sendRawTransaction');

  private web3Impl: Web3 = new Web3Impl(this.clientMain);

  private netImpl: Net = new NetImpl(this.clientMain);

  private ethImpl: Eth = new EthImpl(this.clientMain, this.clientSendRawTx);

  web3(): Web3 {
    return this.web3Impl;
  }

  net(): Net {
    return this.netImpl;
  }

  eth(): Eth {
    return this.ethImpl;
  }

  initClient(type: string | null = null): Client {
    dotenv.config({ path: findConfig('.env') || '' });
    const hederaNetwork: string = process.env.HEDERA_NETWORK || '{}';
    let client: Client;
    if (hederaNetwork in ['mainnet', 'testnet', 'previewnet']) {
      client = Client.forName(hederaNetwork);
    } else {
      client = Client.forNetwork(JSON.parse(hederaNetwork));
    }

    switch (type) {
      case 'eth_sendRawTransaction': {
        if (process.env.OPERATOR_ID_ETH_SENDRAWTRANSACTION && process.env.OPERATOR_KEY_ETH_SENDRAWTRANSACTION) {
          client = client.setOperator(
            AccountId.fromString(process.env.OPERATOR_ID_ETH_SENDRAWTRANSACTION),
            PrivateKey.fromString(process.env.OPERATOR_KEY_ETH_SENDRAWTRANSACTION)
          );
        }
        return client;
      }
      default: {
        if (process.env.OPERATOR_ID_MAIN && process.env.OPERATOR_KEY_MAIN) {
          client = client.setOperator(
            AccountId.fromString(process.env.OPERATOR_ID_MAIN),
            PrivateKey.fromString(process.env.OPERATOR_KEY_MAIN)
          );
        }
        return client;
      }
    }
  }
}
