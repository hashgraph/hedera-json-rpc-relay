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

import { ITokenEvent } from "./types/token/ITokenEvent";
import { expect } from "chai";
import { IQueryResponse } from "./types/IQueryResponse";
import fetch from "node-fetch";
import { IGravatarEvent } from "./types/gravatar/IGravatarEvent";
import { IFungibleTokenEvent } from "./types/token/IFungibleTokenEvent";
import { INonFungibleTokenEvent } from "./types/token/INonFungibleTokenEvent";

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
  actual: Array<IGravatarEvent>,
  expected: Array<IGravatarEvent>,
): void {
  if (actual?.length !== expected.length) {
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

  if (FUNGIBLE_TYPES.includes(actual[0].type)) {
    for (let i = 0; i < actual.length; i++) {
      verifyFungibleTokenEvent(
        actual[i] as IFungibleTokenEvent,
        expected[i] as IFungibleTokenEvent,
      );
    }
  } else if (NON_FUNGIBLE_TYPES.includes(actual[0].type)) {
    for (let i = 0; i < actual.length; i++) {
      verifyNonFungibleTokenEvent(
        actual[i] as INonFungibleTokenEvent,
        expected[i] as INonFungibleTokenEvent,
      );
    }
  } else {
    expect.fail("Unsupported token type!");
  }
}

function verifyFungibleTokenEvent(
  actual: IFungibleTokenEvent,
  expected: IFungibleTokenEvent,
): void {
  verifyTokenEvent(actual, expected);
  expect(actual.supply).to.equal(expected.supply);
}

function verifyNonFungibleTokenEvent(
  actual: INonFungibleTokenEvent,
  expected: INonFungibleTokenEvent,
): void {
  verifyTokenEvent(actual, expected);
  expect(actual.owner).to.equal(expected.owner);
  expect(actual.tokenId).to.equal(expected.tokenId);
}

function verifyTokenEvent(actual: ITokenEvent, expected: ITokenEvent): void {
  expect(actual.id).to.equal(expected.id);
  expect(actual.type).to.equal(expected.type);
  expect(actual.transfers).to.have.deep.members(expected.transfers);
}
