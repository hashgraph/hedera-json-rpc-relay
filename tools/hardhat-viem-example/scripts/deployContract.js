/*-
 *
 * Hedera Hardhat Viem Example Project
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

const hre = require('hardhat');

module.exports = async () => {
  //Deploy contract providing
  //name of contract as first parameter
  //array with constructor parameters from our contract as the second one
  //We use wait to receive the transaction (deployment) receipt, which contains contractAddress
  const greeter = await hre.viem.deployContract('Greeter', ['initial_msg']);

  console.log(`Greeter deployed to: ${greeter.address}`);

  return greeter.address;
};
