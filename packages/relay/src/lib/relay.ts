import dotenv from 'dotenv';
import findConfig from 'find-config';
import { Relay, Eth, Net, Web3 } from '../index';
import { Web3Impl } from './web3';
import { NetImpl } from './net';
import { EthImpl } from './eth';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { Logger } from 'pino';
import {MirrorNode} from "./mirrorNode";

export class RelayImpl implements Relay {
  private readonly clientMain:Client = this.initClient();
  private readonly web3Impl:Web3;
  private readonly netImpl:Net;
  private readonly ethImpl:Eth;

  constructor(logger:Logger) {
    this.web3Impl = new Web3Impl(this.clientMain);
    this.netImpl = new NetImpl(this.clientMain);

    const mirrorNode = new MirrorNode(
        process.env.MIRROR_NODE_URL || '',
        logger.child({ name: `mirror-node`}));

    this.ethImpl = new EthImpl(
        this.clientMain,
        mirrorNode,
        logger.child({ name: 'relay-eth' }));
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
