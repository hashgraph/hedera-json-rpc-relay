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
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts";
import {
  NewGravatar,
  UpdatedGravatar,
} from "../generated/GravatarRegistry/GravatarRegistry";

export function createNewGravatarEvent(
  id: BigInt,
  owner: Address,
  displayName: string,
  imageUrl: string,
): NewGravatar {
  let newGravatarEvent = changetype<NewGravatar>(newMockEvent());

  newGravatarEvent.parameters = new Array();

  newGravatarEvent.parameters.push(
    new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id)),
  );
  newGravatarEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)),
  );
  newGravatarEvent.parameters.push(
    new ethereum.EventParam(
      "displayName",
      ethereum.Value.fromString(displayName),
    ),
  );
  newGravatarEvent.parameters.push(
    new ethereum.EventParam("imageUrl", ethereum.Value.fromString(imageUrl)),
  );

  return newGravatarEvent;
}

export function createUpdatedGravatarEvent(
  id: BigInt,
  owner: Address,
  displayName: string,
  imageUrl: string,
): UpdatedGravatar {
  let updatedGravatarEvent = changetype<UpdatedGravatar>(newMockEvent());

  updatedGravatarEvent.parameters = new Array();

  updatedGravatarEvent.parameters.push(
    new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id)),
  );
  updatedGravatarEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)),
  );
  updatedGravatarEvent.parameters.push(
    new ethereum.EventParam(
      "displayName",
      ethereum.Value.fromString(displayName),
    ),
  );
  updatedGravatarEvent.parameters.push(
    new ethereum.EventParam("imageUrl", ethereum.Value.fromString(imageUrl)),
  );

  return updatedGravatarEvent;
}
