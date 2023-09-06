/*-
 *
 * Hedera JSON RPC Relay
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

export default class InvalidParamsError extends Error {
  constructor(message) {
    let caption;
    let stack;
    super();
    this.name = 'InvalidParamsError';
    this.message = message;
    stack = new Error().stack?.split('\n');
    if (message) {
      caption = `${this.name}: ${message}`;
    } else {
      caption = this.name;
    }
    stack.splice(0, 2, caption);
    this.stack = stack.join('\n');
  }

  toString() {
    return this.stack;
  }
}
