/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import dotenv from 'dotenv';
import findConfig from 'find-config';
import { Relay, Eth, Net, Web3 } from '../index';
import { Web3Impl } from './web3';
import { NetImpl } from './net';
import { EthImpl } from './eth';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { Logger } from 'pino';
import {MirrorNode} from "./mirrorNode";
import {MirrorNodeClient, NodeClient} from './clients';

export class RelayImpl implements Relay {
  private readonly clientMain:Client = this.initClient();
  private readonly web3Impl:Web3;
  private readonly netImpl:Net;
  private readonly ethImpl:Eth;

  constructor(logger:Logger) {
    this.web3Impl = new Web3Impl(this.clientMain);
    this.netImpl = new NetImpl(this.clientMain);

    const mirrorNode = new MirrorNode(logger.child({ name: `mirror-node`}));

    const mirrorNodeClient = new MirrorNodeClient(
        process.env.MIRROR_NODE_URL || '',
        logger.child({ name: `mirror-node`}));

    const nodeClient = new NodeClient(this.clientMain);

    this.ethImpl = new EthImpl(
        nodeClient,
        mirrorNode,
        mirrorNodeClient,
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
