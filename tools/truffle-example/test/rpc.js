/*-
 *
 * Hedera JSON RPC Relay - Truffle Example
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

const Web3 = require("web3");
const Web3HttpProvider = require("web3-providers-http");
const Greeter = artifacts.require("Greeter");
const web3 = new Web3(new Web3HttpProvider(`${process.env.RELAY_URL}:${process.env.RELAY_PORT}`));
const operatorWallet = web3.eth.accounts.privateKeyToAccount(process.env.OPERATOR_PRIVATE_KEY);
const receiverWallet = web3.eth.accounts.privateKeyToAccount(process.env.RECEIVER_PRIVATE_KEY);

describe("RPC", async function () {
  this.timeout(5 * 60000); // 5 minutes

  let contractInstance;
  const initialMsg = "initial_msg";
  const updatedMsg = "updated_msg";
  it("should be able to deploy a contract", async function () {
    contractInstance = await Greeter.new(initialMsg);

    expect(contractInstance).to.haveOwnProperty("address");
    expect(contractInstance.address).to.not.be.null;
  });
  it("should be able to call a view contract method", async function () {
    const callRes = await contractInstance.greet();

    expect(callRes).to.equal(initialMsg);
  });
  it("should be able to call a contract method that changes the state", async function () {
    const msgBefore = await contractInstance.greet();
    await contractInstance.setGreeting(updatedMsg);
    // 5 seconds sleep to propagate the changes to mirror node
    await new Promise((r) => setTimeout(r, 5000));
    const msgAfter = await contractInstance.greet();

    expect(msgBefore).to.not.equal(msgAfter);
    expect(msgAfter).to.equal(updatedMsg);
  });
  it("should be able to get the account balance", async function () {
    const balance = await web3.eth.getBalance(operatorWallet.address);
    expect(Number(balance)).to.be.greaterThan(0);
  });
  it("should be able to transfer hbars between two accounts", async function () {
    const hbarsBefore = (await web3.eth.getBalance(receiverWallet.address)).toString();
    // Keep in mind that TINYBAR to WEIBAR coefficient is 10_000_000_000
    const signedTx = await operatorWallet.signTransaction({
      to: receiverWallet.address,
      value: 10_000_000_000,
      gas: 300_000,
    });
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    const hbarsAfter = (await web3.eth.getBalance(receiverWallet.address)).toString();

    expect(hbarsBefore).to.not.be.equal(hbarsAfter);
  });
});
