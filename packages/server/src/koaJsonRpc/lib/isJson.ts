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

function isString(x) {
  return Object.prototype.toString.call(x) === "[object String]";
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === "[object Object]";
}

function isJson(x) {
  console.log("X", x);
  if (!x) return false;
  if (isObject(x)) return x;
  if (!isString(x)) return false;

  try {
    const t = JSON.parse(x);
    return t;
  } catch (err) {
    console.log("PARSE ERROR");
    return false;
  }
}

module.exports = isJson;
