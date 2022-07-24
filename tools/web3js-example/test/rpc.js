/*-
 *
 * Hedera JSON RPC Relay - Web3js Example
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

const { expect } = require('chai');
const Web3 = require('web3');
const Web3HttpProvider = require('web3-providers-http');

describe('RPC', function() {
  this.timeout(5 * 60000); // 5 minutes

  let contractAddress;
  const initialMsg = 'initial_msg';
  const updatedMsg = 'updated_msg';

  it('should be able to get the account balance', async function() {
    const showBalance = require('../scripts/showBalance');

    const balance = await showBalance();
    expect(Number(balance)).to.be.greaterThan(0);
  });
  it('should be able to transfer hbars between two accounts', async function() {
    const transferHbars = require('../scripts/transferHbars');

    const web3 = new Web3(new Web3HttpProvider(process.env.RELAY_ENDPOINT));
    const walletReceiver = await web3.eth.accounts.wallet.add(process.env.RECEIVER_PRIVATE_KEY);

    const hbarsBefore = (await web3.eth.getBalance(walletReceiver.address)).toString();
    await transferHbars();
    const hbarsAfter = (await web3.eth.getBalance(walletReceiver.address)).toString();

    expect(hbarsBefore).to.not.be.equal(hbarsAfter);
  });
  it('should be able to deploy a contract', async function() {
    const deployContract = require('../scripts/deployContract');

    contractAddress = await deployContract(initialMsg);
    expect(contractAddress).to.not.be.null;
  });
  it('should be able to make a contract view call', async function() {
    const contractViewCall = require('../scripts/contractViewCall');

    const res = await contractViewCall(contractAddress);
    expect(res).to.be.equal(initialMsg);
  });
  it('should be able to make a contract call', async function() {
    const contractViewCall = require('../scripts/contractViewCall');
    const contractCall = require('../scripts/contractCall');

    await contractCall(contractAddress, updatedMsg);
    const res = await contractViewCall(contractAddress);

    expect(res).to.be.equal(updatedMsg);
  });
});
