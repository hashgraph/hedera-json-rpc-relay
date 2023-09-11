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

import { Gravatar } from "../generated/schema";
import {
  NewGravatar,
  UpdatedGravatar,
} from "../generated/GravatarRegistry/GravatarRegistry";

export function handleNewGravatar(event: NewGravatar): void {
  const gravatar = new Gravatar(event.params.id.toHexString());
  gravatar.owner = event.params.owner;
  gravatar.displayName = event.params.displayName;
  gravatar.imageUrl = event.params.imageUrl;
  gravatar.save();
}

export function handleUpdatedGravatar(event: UpdatedGravatar): void {
  const id = event.params.id.toHexString();
  let gravatar = Gravatar.load(id);
  if (gravatar == null) {
    gravatar = new Gravatar(id);
  }
  gravatar.owner = event.params.owner;
  gravatar.displayName = event.params.displayName;
  gravatar.imageUrl = event.params.imageUrl;
  gravatar.save();
}
