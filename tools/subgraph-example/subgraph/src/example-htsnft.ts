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

import { Transfer as TransferEvent } from "../generated/ExampleERC721/ExampleERC721";
import { HTSNFT, Transfer } from "../generated/schema";

// Schema:
// id: ID! # String
// owner: Bytes! # Address
// transfers: [Transfer!]! @derivedFrom(field: "token") # One-to-many relationship with reverse lookup
// type: TokenType!
export function handleTransfer(event: TransferEvent): void {
  let token = HTSNFT.load(
    event.address.toHexString() + "-" + event.params.tokenId.toString()
  );

  if (!token) {
    token = new HTSNFT(
      event.address.toHexString() + "-" + event.params.tokenId.toString()
    );
    token.type = "HTSNFT";
    token.tokenId = event.params.tokenId;
    token.owner = event.params.to;
    token.save();
  }

  const transfer = new Transfer(
    event.address.toHexString() + "-" + event.transaction.hash.toHexString()
  );

  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.token = token.id;
  transfer.save();
}
