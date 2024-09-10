/*-
 *
 * Hedera JSON RPC Relay
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

export const BASE_HEX_REGEX = '^0[xX][a-fA-F0-9]';
export const ERROR_CODE = -32602;
export const DEFAULT_HEX_ERROR = 'Expected 0x prefixed hexadecimal value';
export const HASH_ERROR = 'Expected 0x prefixed string representing the hash (32 bytes)';
export const ADDRESS_ERROR = 'Expected 0x prefixed string representing the address (20 bytes)';
export const BLOCK_NUMBER_ERROR =
  'Expected 0x prefixed hexadecimal block number, or the string "latest", "earliest" or "pending"';
export const BLOCK_PARAMS_ERROR = `Expected ${HASH_ERROR} in object, 0x prefixed hexadecimal block number, or the string "latest", "earliest" or "pending"`;
export const BLOCK_HASH_ERROR = `Expected ${HASH_ERROR} of a block`;
export const TRANSACTION_HASH_ERROR = `Expected ${HASH_ERROR} of a transaction`;
export const TRANSACTION_ID_ERROR = `Expected a transaction ID string in the format "shard.realm.num-sss-nnn" where sss are seconds and nnn are nanoseconds`;
export const TRANSACTION_ID_REGEX = /^(\d)\.(\d)\.(\d{1,10})-(\d{1,19})-(\d{1,9})$/;
export const TOPIC_HASH_ERROR = `Expected ${HASH_ERROR} of a topic`;
export const INVALID_BLOCK_HASH_TAG_NUMBER = 'The value passed is not a valid blockHash/blockNumber/blockTag value:';
export enum TracerType {
  CallTracer = 'callTracer',
  OpcodeLogger = 'opcodeLogger',
}
