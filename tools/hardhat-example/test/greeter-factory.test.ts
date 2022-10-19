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

import {ethers} from 'hardhat';
import { Greeter, GreeterFactory } from '../types';

import {
  deployOverrides
} from './utils';

describe('GreeterFactory', function() {

  let greeterFactory: GreeterFactory;

  let greeter1: Greeter;
  let greeter2: Greeter;

  before(async () => {

    const GreeterFactory = await ethers.getContractFactory('GreeterFactory');

    greeterFactory = await GreeterFactory.deploy(deployOverrides);

    const deployRc = await greeterFactory.deployTransaction.wait();
    const greeterFactoryAddress = deployRc.contractAddress;
    // const greeterFactoryAddress = '0x0000000000000000000000000000000000000408';

    greeterFactory = GreeterFactory.attach(
      greeterFactoryAddress
    ) as GreeterFactory;

    console.log('GreeterFactory deployed to:', greeterFactoryAddress, '@block:', deployRc.blockNumber);

  });

  // it('should be able to create1 Greeter', async function() {
  //   console.log('dummy test');
  // });

  it('should be able to create1 Greeter', async function() {
    const tx = await greeterFactory.create1Greeter('hello world', deployOverrides);
    const rc = await tx.wait();

    console.log('create1 events:', rc.events);

    if (!rc.events || !rc.events[0]) {
      throw new Error('No CreatedGreeter1 event');
    }

    const createdGreeterEvent = rc.events[0];

    const greeterAddress = createdGreeterEvent?.args?.greeter;

    if (!greeterAddress) {
      throw new Error('No CreatedGreeter1.greeter');
    }

    greeter1 = await ethers.getContractAt('Greeter', greeterAddress);
  });

  it('should be able to transfer hbars between two accounts', async function() {

    const tx = await greeterFactory.create2Greeter('hello world', deployOverrides);
    const rc = await tx.wait();

    console.log('create2 events:', rc.events);

    if (!rc.events || !rc.events[0]) {
      throw new Error('No CreatedGreeter2 event');
    }

    const createdGreeterEvent = rc.events[0];

    const greeterAddress = createdGreeterEvent?.args?.greeter;

    if (!greeterAddress) {
      throw new Error('No CreatedGreeter2.greeter');
    }

    greeter2 = await ethers.getContractAt('Greeter', greeterAddress);

  });

  it('should be able to setGreeting in greeter1', async function() {

    await new Promise(r => setTimeout(r, 4_000)); // wait 2 blocks

    const tx = await greeter1.setGreeting('hello from greeter1');
    const rc = await tx.wait();

    console.log("greeter1 events", rc.events);
  });

  it('should be able to setGreeting in greeter2', async function() {
    const tx = await greeter2.setGreeting('hello from greeter2');
    const rc = await tx.wait();

    console.log("greeter2 events", rc.events);
  });

});
