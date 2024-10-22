/*
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
