/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.24',
  defaultNetwork: 'testnet',
  networks: {
    mainnet: {
      name: 'mainnet',
      url: 'https://mainnet.hashio.io/api',
      chainId: 295,
      accounts: [process.env.OPERATOR_PK],
      mirrorNodeREST: 'https://mainnet-public.mirrornode.hedera.com'
    },
    testnet: {
      name: 'testnet',
      url: 'https://testnet.hashio.io/api',
      chainId: 296,
      accounts: [process.env.OPERATOR_PK],
      mirrorNodeREST: 'https://testnet.mirrornode.hedera.com'
    },
    previewnet: {
      name: 'previewnet',
      url: 'https://previewnet.hashio.io/api',
      chainId: 297,
      accounts: [process.env.OPERATOR_PK],
      mirrorNodeREST: 'https://previewnet.mirrornode.hedera.com'
    }
  }
};
