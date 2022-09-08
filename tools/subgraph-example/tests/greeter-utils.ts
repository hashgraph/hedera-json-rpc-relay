/*-
 *
 * Hedera JSON RPC Relay - Subgraph Example
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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
import { ethereum } from "@graphprotocol/graph-ts";
import { GreetingSet } from "../generated/Greeter/Greeter";

export function createGreetingSetEvent(greeting: string): GreetingSet {
  let greetingSetEvent = changetype<GreetingSet>(newMockEvent());

  greetingSetEvent.parameters = new Array();

  greetingSetEvent.parameters.push(
    new ethereum.EventParam("greeting", ethereum.Value.fromString(greeting))
  );

  return greetingSetEvent;
}
