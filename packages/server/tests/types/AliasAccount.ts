// SPDX-License-Identifier: Apache-2.0

import { AccountId, KeyList, PrivateKey } from '@hashgraph/sdk';
import ServicesClient from '../clients/servicesClient';
import { ethers } from 'ethers';

export interface AliasAccount {
  readonly alias: AccountId;
  readonly accountId: AccountId;
  readonly address: string;
  readonly client: ServicesClient;
  readonly privateKey: PrivateKey;
  readonly wallet: ethers.Wallet;
  readonly keyList: KeyList | undefined;
}
