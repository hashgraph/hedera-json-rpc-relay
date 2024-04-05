/* -
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

/**
 * Formats an ID message for logging purposes.
 * @param {string } title - The title of the ID to be formatted.
 * @param {string | undefined} id - The ID to be formatted.
 * @returns {string} Returns a formatted ID message if an ID is provided, otherwise an empty string.
 */
export const formatIdMessage = (title: string, id?: string): string => {
  return id ? `[${title}: ${id}]` : '';
};
