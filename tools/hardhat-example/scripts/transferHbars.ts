/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
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

import hre from 'hardhat';

export async function transferHbars (amount = 100_000_000_000) {
  const provider = hre.ethers.provider;

  if (!process.env.OPERATOR_PRIVATE_KEY) {
    throw new Error('No OPERATOR_PRIVATE_KEY');
  }

  if (!process.env.RECEIVER_PRIVATE_KEY) {
    throw new Error('No RECEIVER_PRIVATE_KEY');
  }

  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const walletReceiver = new hre.ethers.Wallet(process.env.RECEIVER_PRIVATE_KEY, provider);

  console.log(`Balance before tx: ${await walletReceiver.getBalance()}`);
  // Keep in mind that TINYBAR to WEIBAR coefficient is 10_000_000_000
  await wallet.sendTransaction({
    to: walletReceiver.address,
    value: amount // 10 tinybars
  });
  //delay of 3 sec before fetching the new balance, because often it's too fast when querying and the balance is the same like before transfer transaciton
  await new Promise(r => setTimeout(r, 3000));
  console.log(`Balance after tx: ${await walletReceiver.getBalance()}`);
};
