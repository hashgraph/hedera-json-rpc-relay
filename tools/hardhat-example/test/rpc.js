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

const hre = require('hardhat');
const { expect } = require('chai');

describe('RPC', function() {
  let contractAddress;

  it('should be able to get the account balance', async function() {
    const balance = await hre.run('show-balance');
    expect(Number(balance)).to.be.greaterThan(0);
  });
  it('should be able to transfer hbars between two accounts', async function() {
    const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
    const walletReceiver = new hre.ethers.Wallet(process.env.RECEIVER_PRIVATE_KEY, provider);

    const hbarsBefore = (await walletReceiver.getBalance()).toString();
    await hre.run('transfer-hbars');
    const hbarsAfter = (await walletReceiver.getBalance()).toString();
    expect(hbarsBefore).to.not.be.equal(hbarsAfter);
  });
  it('should be able to deploy a contract', async function() {
    contractAddress = await hre.run('deploy-contract');
    expect(contractAddress).to.not.be.null;
  });
  it('should be able to make a contract view call', async function() {
    const res = await hre.run('contract-view-call', { contractAddress });
    expect(res).to.be.equal('initial_msg');
  });
  it('should be able to make a contract call', async function() {
    const msg = 'updated_msg';
    await hre.run('contract-call', { contractAddress, msg });
    const res = await hre.run('contract-view-call', { contractAddress });
    expect(res).to.be.equal(msg);
  });
});
