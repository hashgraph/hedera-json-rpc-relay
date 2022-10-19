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
import { expect } from 'chai';
import { GreeterFactory } from '../types';

import {
  deployOverrides
} from './utils';

describe('GreeterFactory', function() {

  let greeterFactory: GreeterFactory;

  before(async () => {

    const GreeterFactory = await ethers.getContractFactory('GreeterFactory');

    greeterFactory = await GreeterFactory.deploy(deployOverrides);

    const greeterFactoryAddress = (await greeterFactory.deployTransaction.wait()).contractAddress;

    greeterFactory = GreeterFactory.attach(
      greeterFactoryAddress
    ) as GreeterFactory;

    console.log('GreeterFactory deployed to:', greeterFactoryAddress);

  });

  it('should be able to create1 Greeter', async function() {
    const tx = await greeterFactory.create1Greeter('hello world', deployOverrides);
    const rc = await tx.wait();

    console.log('create1 events:', rc.events);
  });

  it('should be able to transfer hbars between two accounts', async function() {

    const tx = await greeterFactory.create2Greeter('hello world', deployOverrides);
    const rc = await tx.wait();

    console.log('create2 events:', rc.events);

  });

});
