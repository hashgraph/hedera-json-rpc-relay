/*-
 *
 * Hedera JSON RPC Relay - Truffle Example
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

const Greeter = artifacts.require('Greeter');

contract('Greeter', () => {
  let contractInstance;
  const initialMsg = 'initial_msg';
  const updatedMsg = 'updated_msg';

  it('should be able to deploy a contract', async () => {
    contractInstance = await Greeter.new(initialMsg);

    expect(contractInstance).to.haveOwnProperty('address');
    expect(contractInstance.address).to.not.be.null;
  });
  it('should be able to call a view contract method', async () => {
    const callRes = await contractInstance.greet();

    expect(callRes).to.equal(initialMsg);
  });
  it('should be able to call a contract method that changes the state', async () => {
    const msgBefore = await contractInstance.greet();
    await contractInstance.setGreeting(updatedMsg);
    const msgAfter = await contractInstance.greet();

    expect(msgBefore).to.not.equal(msgAfter);
    expect(msgAfter).to.equal(updatedMsg);
  });
});
