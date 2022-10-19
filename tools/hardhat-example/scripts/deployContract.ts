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
import {utils} from '@hashgraph/hethers';

export async function deployContract () {
  const provider = hre.ethers.provider;

  if (!process.env.OPERATOR_PRIVATE_KEY) {
    throw new Error("No OPERATOR_PRIVATE_KEY");
  }

  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const Greeter = await hre.ethers.getContractFactory('Greeter', wallet);
  const greeter = await Greeter.deploy('initial_msg');
  const contractAddress = (await greeter.deployTransaction.wait()).contractAddress;
  const contractId = utils.getAccountFromAddress(contractAddress);

  console.log(`Greeter contract id: ${utils.asAccountString(contractId)}`);
  console.log(`Greeter deployed to: ${contractAddress}`);

  return contractAddress;
};
