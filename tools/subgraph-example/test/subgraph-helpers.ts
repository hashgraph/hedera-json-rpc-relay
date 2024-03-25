/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
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

import { TokenEvent } from "./types/token/TokenEvent";
import { expect } from "chai";
import { IQueryResponse } from "./types/IQueryResponse";
import fetch from "node-fetch";
import { GravatarEvent } from "./types/gravatar/GravatarEvent";
import { FungibleTokenEvent } from "./types/token/FungibleTokenEvent";
import { NonFungibleTokenEvent } from "./types/token/NonFungibleTokenEvent";

const URL = "http://127.0.0.1:8000/subgraphs/name/subgraph-example";

const FUNGIBLE_TYPES = ["ERC20", "HTSFT"];
const NON_FUNGIBLE_TYPES = ["ERC721", "HTSNFT"];

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
  actual: Array<GravatarEvent>,
  expected: Array<GravatarEvent>,
): void {
  if (actual.length !== expected.length) {
    expect.fail("Actual and expected lengths do not match!");
  }
  expect(actual).to.have.deep.members(expected);
}

export function verifyTokenEvents(
  actual: Array<TokenEvent>,
  expected: Array<TokenEvent>,
): void {
  if (actual.length !== expected.length) {
    expect.fail("Actual and expected lengths do not match!");
  }

  if (actual.length === 0) {
    return;
  }

  const compareFn = <T extends TokenEvent>(a: T, b: T) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b));

  if (FUNGIBLE_TYPES.includes(actual[0].type)) {
    const actualEvents = actual
      .map((event) => event as FungibleTokenEvent)
      .sort(compareFn);
    const expectedEvents = expected
      .map((event) => event as FungibleTokenEvent)
      .sort(compareFn);
    for (let i = 0; i < actualEvents.length; i++) {
      verifyFungibleTokenEvent(actualEvents[i], expectedEvents[i]);
    }
  } else if (NON_FUNGIBLE_TYPES.includes(actual[0].type)) {
    const actualEvents = actual
      .map((event) => event as NonFungibleTokenEvent)
      .sort(compareFn);
    const expectedEvents = expected
      .map((event) => event as NonFungibleTokenEvent)
      .sort(compareFn);
    for (let i = 0; i < actual.length; i++) {
      verifyNonFungibleTokenEvent(actualEvents[i], expectedEvents[i]);
    }
  } else {
    expect.fail("Unsupported token type!");
  }
}

function verifyFungibleTokenEvent(
  actual: FungibleTokenEvent,
  expected: FungibleTokenEvent,
): void {
  verifyTokenEvent(actual, expected);
  expect(actual.supply).to.equal(expected.supply);
}

function verifyNonFungibleTokenEvent(
  actual: NonFungibleTokenEvent,
  expected: NonFungibleTokenEvent,
): void {
  verifyTokenEvent(actual, expected);
  expect(actual.owner).to.equal(expected.owner);
  expect(actual.tokenId).to.equal(expected.tokenId);
}

function verifyTokenEvent(actual: TokenEvent, expected: TokenEvent): void {
  expect(actual.id).to.equal(expected.id);
  expect(actual.type).to.equal(expected.type);
  expect(actual.transfers).to.have.deep.members(expected.transfers);
}
