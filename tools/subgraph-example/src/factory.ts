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

import { log } from "@graphprotocol/graph-ts";

import { Greeter as GreeterTemplate } from '../generated/templates';
import { Greeter1, Greeter2 } from '../generated/schema';
import { CreatedGreeter1, CreatedGreeter2 } from "../generated/GreeterFactory/GreeterFactory";

export function handleGreeter1Created(event: CreatedGreeter1): void {
  log.error('----------- in handleGreeter1Created', []);

  const greeter1Address = event.params.greeter.toHexString();

  const greeter1 = new Greeter1(greeter1Address) as Greeter1;
  greeter1.save();
  // track the create1 Greeter contract logs
  GreeterTemplate.create(event.params.greeter); // NO issue here since Log.address === event.params.greeter
}

export function handleGreeter2Created(event: CreatedGreeter2): void {
  log.error('----------- in handleGreeter2Created', []);

  const greeter2Address = event.params.greeter.toHexString();

  const greeter2 = new Greeter2(greeter2Address) as Greeter2;
  greeter2.save();
  // track this create2 Greeter contract's logs
  GreeterTemplate.create(event.params.greeter); // issue here since Log.address !== event.params.greeter
}
