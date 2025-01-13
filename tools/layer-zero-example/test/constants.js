/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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

module.exports = {
  // we're using the official LZ endpoints
  // and a list of all EIDs can be found here
  // EIDs are defined in the layer zero documentation https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts#contract-address-table
  HEDERA_EID: 40285,
  BSC_EID: 40102,

  // a random account
  RECEIVER_ADDRESS: '0xF51c7a9407217911d74e91642dbC58F18E51Deac'
};
