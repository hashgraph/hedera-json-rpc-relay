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

import { ITokenEvent } from "../types/token/ITokenEvent";
import { expect } from "chai";
import { IFungibleTokenEvent } from "../types/token/IFungibleTokenEvent";
import { INonFungibleTokenEvent } from "../types/token/INonFungibleTokenEvent";

const FUNGIBLE_TYPES = ["ERC20", "HTSFT"];
const NON_FUNGIBLE_TYPES = ["ERC721", "HTSNFT"];

export abstract class TokenAssertionStrategy {
  protected abstract verify(actual: ITokenEvent, expected: ITokenEvent): void;

  assertEquals(actual: ITokenEvent, expected: ITokenEvent): void {
    expect(actual.id).to.equal(expected.id);
    expect(actual.type).to.equal(expected.type);
    expect(actual.transfers).to.have.deep.members(expected.transfers);
    this.verify(actual, expected);
  }

  static isFungibleToken(event: ITokenEvent): event is IFungibleTokenEvent {
    return FUNGIBLE_TYPES.includes(event.type);
  }

  static isNonFungibleToken(
    event: ITokenEvent,
  ): event is INonFungibleTokenEvent {
    return NON_FUNGIBLE_TYPES.includes(event.type);
  }
}

export class FungibleTokenStrategy extends TokenAssertionStrategy {
  protected verify(
    actual: IFungibleTokenEvent,
    expected: IFungibleTokenEvent,
  ): void {
    expect(actual.supply).to.equal(expected.supply);
  }
}

export class NonFungibleTokenStrategy extends TokenAssertionStrategy {
  protected verify(
    actual: INonFungibleTokenEvent,
    expected: INonFungibleTokenEvent,
  ): void {
    expect(actual.owner).to.equal(expected.owner);
    expect(actual.tokenId).to.equal(expected.tokenId);
  }
}
