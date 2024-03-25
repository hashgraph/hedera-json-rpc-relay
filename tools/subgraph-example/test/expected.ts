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

import { GravatarEvent } from "./types/gravatar/GravatarEvent";
import { FungibleTokenEvent } from "./types/token/FungibleTokenEvent";
import { NonFungibleTokenEvent } from "./types/token/NonFungibleTokenEvent";

export default {
  gravatar: {
    initial: [
      new GravatarEvent({
        id: "0x1",
        owner: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
        displayName: "My Gravatar",
        imageUrl: "https://example.com/gravatars/my_gravatar.png",
      }),
    ],
    updated: [
      new GravatarEvent({
        id: "0x1",
        owner: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
        displayName: "My Updated Gravatar",
        imageUrl: "https://example.com/gravatars/my_gravatar.png",
      }),
      new GravatarEvent({
        id: "0x2",
        owner: "0x05fba803be258049a27b820088bab1cad2058871",
        displayName: "Second Gravatar",
        imageUrl: "https://example.com/gravatars/second_gravatar.png",
      }),
    ],
  },
  erc20: {
    initial: [
      new FungibleTokenEvent({
        id: "0x23f5e49569a835d7bf9aefd30e4f60cdd570f225",
        supply: "20",
        type: "ERC20",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
            amount: "20",
          },
          {
            from: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
            to: "0x05fba803be258049a27b820088bab1cad2058871",
            amount: "1",
          },
        ],
      }),
    ],
    updated: [
      new FungibleTokenEvent({
        id: "0x23f5e49569a835d7bf9aefd30e4f60cdd570f225",
        supply: "20",
        type: "ERC20",
        transfers: [
          {
            from: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
            to: "0x05fba803be258049a27b820088bab1cad2058871",
            amount: "1",
          },
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
            amount: "20",
          },
          {
            from: "0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69",
            to: "0x05fba803be258049a27b820088bab1cad2058871",
            amount: "1",
          },
        ],
      }),
    ],
  },
  erc721: {
    initial: [
      new NonFungibleTokenEvent({
        id: "0x8a7fa94487d0d0460550e5f3f80a663c39ac8b10-1",
        owner: "0x05fba803be258049a27b820088bab1cad2058871",
        type: "ERC721",
        tokenId: "1",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x05fba803be258049a27b820088bab1cad2058871",
          },
        ],
      }),
    ],
    updated: [
      new NonFungibleTokenEvent({
        id: "0x8a7fa94487d0d0460550e5f3f80a663c39ac8b10-1",
        owner: "0x05fba803be258049a27b820088bab1cad2058871",
        type: "ERC721",
        tokenId: "1",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x05fba803be258049a27b820088bab1cad2058871",
          },
        ],
      }),
      new NonFungibleTokenEvent({
        id: "0x8a7fa94487d0d0460550e5f3f80a663c39ac8b10-2",
        owner: "0x05fba803be258049a27b820088bab1cad2058871",
        type: "ERC721",
        tokenId: "2",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x05fba803be258049a27b820088bab1cad2058871",
          },
        ],
      }),
    ],
  },
  htsfts: {
    initial: [
      new FungibleTokenEvent({
        id: "0x0000000000000000000000000000000000000409",
        supply: "1000",
        type: "HTSFT",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x0000000000000000000000000000000000000002",
            amount: "1000",
          },
        ],
      }),
    ],
    updated: [
      new FungibleTokenEvent({
        id: "0x0000000000000000000000000000000000000409",
        supply: "1000",
        type: "HTSFT",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x0000000000000000000000000000000000000002",
            amount: "1000",
          },
          {
            from: "0x0000000000000000000000000000000000000002",
            to: "0x00000000000000000000000000000000000003f5",
            amount: "10",
          },
        ],
      }),
    ],
  },
  htsnfts: {
    initial: [
      new NonFungibleTokenEvent({
        id: "0x000000000000000000000000000000000000040c-1",
        owner: "0x0000000000000000000000000000000000000002",
        type: "HTSNFT",
        tokenId: "1",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x0000000000000000000000000000000000000002",
          },
        ],
      }),
    ],
    updated: [
      new NonFungibleTokenEvent({
        id: "0x000000000000000000000000000000000000040c-1",
        owner: "0x0000000000000000000000000000000000000002",
        type: "HTSNFT",
        tokenId: "1",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x0000000000000000000000000000000000000002",
          },
        ],
      }),
      new NonFungibleTokenEvent({
        id: "0x000000000000000000000000000000000000040c-2",
        owner: "0x0000000000000000000000000000000000000002",
        type: "HTSNFT",
        tokenId: "2",
        transfers: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x0000000000000000000000000000000000000002",
          },
        ],
      }),
    ],
  },
};
