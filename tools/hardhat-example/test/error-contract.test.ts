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
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import {
  ErrorContract
} from '../types';

import {
  deployOverrides
} from './utils';

describe('ErrorContract', function() {

  let errorContract: ErrorContract;

  before(async () => {
    const ErrorContract = await ethers.getContractFactory('ErrorContract');
    const _errorContract = await ErrorContract.deploy(deployOverrides);
    const deployRc = await _errorContract.deployTransaction.wait();
    const errorContractAddress = deployRc.contractAddress;

    console.log('deployed ErrorContract:', errorContractAddress);

    errorContract = await ethers.getContractAt('ErrorContract', errorContractAddress);
  });

  it('should simply revert', async function() {
    await expect(errorContract.revertWithNothing()).to.be.revertedWithoutReason();
  });

  it('should revert with string', async function() {
    await expect(errorContract.revertWithString()).to.be.revertedWith("Some revert message");
  });

  it('should revert with custom error', async function() {
    await expect(errorContract.revertWithCustomError())
      .to.be.revertedWithCustomError(
        errorContract,
        "SomeCustomError"
      );
  });

  it('should revert with panic', async function() {
    await expect(errorContract.revertWithPanic())
      .to.be.revertedWithPanic(
        PANIC_CODES.DIVISION_BY_ZERO
      );

  });
});
