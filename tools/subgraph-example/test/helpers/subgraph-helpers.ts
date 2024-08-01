/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
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

import { ITokenEvent } from "../types/token/ITokenEvent";
import { expect } from "chai";
import { IQueryResponse } from "../types/IQueryResponse";
import fetch from "node-fetch";
import { IGravatarEvent } from "../types/gravatar/IGravatarEvent";
import {
  FungibleTokenStrategy,
  NonFungibleTokenStrategy,
  TokenAssertionStrategy,
} from "../assertions/TokenAssertionStrategy";

const URL = "http://127.0.0.1:8000/subgraphs/name/subgraph-example";

export async function getData<T>(query: string): Promise<IQueryResponse<T>> {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query,
    }),
  });

  return await res.json();
}

export function verifyGravatarEvents(
  actual: Array<IGravatarEvent>,
  expected: Array<IGravatarEvent>,
): void {
  if (actual.length !== expected.length) {
    expect.fail("Actual and expected lengths do not match!");
  }
  expect(actual).to.have.deep.members(expected);
}

export function verifyTokenEvents(
  actual: Array<ITokenEvent>,
  expected: Array<ITokenEvent>,
): void {
  if (actual.length !== expected.length) {
    expect.fail("Actual and expected lengths do not match!");
  }

  if (actual.length === 0) {
    return;
  }

  let strategy: TokenAssertionStrategy;

  if (TokenAssertionStrategy.isFungibleToken(actual[0])) {
    strategy = new FungibleTokenStrategy();
  } else if (TokenAssertionStrategy.isNonFungibleToken(actual[0])) {
    strategy = new NonFungibleTokenStrategy();
  } else {
    expect.fail("Unsupported token type!");
  }

  for (let i = 0; i < actual.length; i++) {
    strategy.assertEquals(actual[i], expected[i]);
  }
}
