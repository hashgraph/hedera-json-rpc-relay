/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
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

import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { handleApproval } from "../src/example-erc-20";
import { createApprovalEvent } from "./example-erc-20-utils";

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let owner = Address.fromString(
      "0x0000000000000000000000000000000000000001",
    );
    let spender = Address.fromString(
      "0x0000000000000000000000000000000000000001",
    );
    let value = BigInt.fromI32(234);
    let newApprovalEvent = createApprovalEvent(owner, spender, value);
    handleApproval(newApprovalEvent);
  });

  afterAll(() => {
    clearStore();
  });

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("Approval created and stored", () => {
    assert.entityCount("Approval", 1);

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "Approval",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "owner",
      "0x0000000000000000000000000000000000000001",
    );
    assert.fieldEquals(
      "Approval",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "spender",
      "0x0000000000000000000000000000000000000001",
    );
    assert.fieldEquals(
      "Approval",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "value",
      "234",
    );

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  });
});
