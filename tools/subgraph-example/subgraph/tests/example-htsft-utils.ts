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

import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import {
  Approval,
  ExampleHTSFTTransfer,
} from "../generated/ExampleHTSFT/ExampleHTSFT";

export function createApprovalEvent(
  owner: Address,
  spender: Address,
  value: BigInt,
): Approval {
  let approvalEvent = changetype<Approval>(newMockEvent());

  approvalEvent.parameters = new Array();

  approvalEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)),
  );
  approvalEvent.parameters.push(
    new ethereum.EventParam("spender", ethereum.Value.fromAddress(spender)),
  );
  approvalEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)),
  );

  return approvalEvent;
}

export function createExampleHTSFTTransferEvent(
  from: Address,
  to: Address,
  value: BigInt,
): ExampleHTSFTTransfer {
  let exampleHtsFTTransferEvent = changetype<ExampleHTSFTTransfer>(
    newMockEvent(),
  );

  exampleHtsFTTransferEvent.parameters = new Array();

  exampleHtsFTTransferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from)),
  );
  exampleHtsFTTransferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to)),
  );
  exampleHtsFTTransferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)),
  );

  return exampleHtsFTTransferEvent;
}
