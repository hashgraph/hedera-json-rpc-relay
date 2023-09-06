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

import * as dotenv from "dotenv";
import { expect } from "chai";
import fetch from "node-fetch";
import expected from "./expected.json";
import { isEqual } from "lodash";
import hre from "hardhat";

dotenv.config();

const URL = "http://127.0.0.1:8000/subgraphs/name/subgraph-example";
const GRAVATAR_QUERY = "query { gravatars { id owner displayName imageUrl } }";
const ERC20_QUERY =
  "query { erc20S { id supply type transfers { from to amount } } }";
const HTSFT_QUERY =
  "query { htsfts { id supply type transfers { from to amount } } }";
const NFTHTS_QUERY =
  "query { htsnfts { id owner type tokenId transfers { from to } } }";
const ERC721_QUERY =
  "query { erc721S { id owner type tokenId transfers { from to } } }";

describe("Subgraph", () => {
  describe("Can index past events", () => {
    it("Indexes past GravatarRegistry events correctly", async () => {
      const result = await getData(GRAVATAR_QUERY);
      const gravatars = result.data.gravatars;

      expect(JSON.stringify(gravatars)).to.equal(
        JSON.stringify(expected.gravatar.initial),
      );
    });

    it("Indexes past ExampleERC20 events correctly", async () => {
      const result = await getData(ERC20_QUERY);
      const erc20 = result.data.erc20S;

      expect(JSON.stringify(erc20)).to.equal(
        JSON.stringify(expected.erc20.initial),
      );
    });

    it("Indexes past ExampleERC721 events correctly", async () => {
      const result = await getData(ERC721_QUERY);
      const erc721 = result.data.erc721S;

      expect(JSON.stringify(erc721)).to.equal(
        JSON.stringify(expected.erc721.initial),
      );
    });

    it("Indexes past ExampleHTSFT events correctly", async () => {
      const result = await getData(HTSFT_QUERY);
      const htsft = result.data.htsfts;

      expect(JSON.stringify(htsft)).to.equal(
        JSON.stringify(expected.htsfts.initial),
      );
    });

    it("Indexes past ExampleHTSNFT events correctly", async () => {
      const result = await getData(NFTHTS_QUERY);
      const htsnfts = result.data.htsnfts;

      expect(JSON.stringify(htsnfts)).to.equal(
        JSON.stringify(expected.htsnfts.initial),
      );
    });
  });

  describe("Can index new events", () => {
    before("Interact with contracts", async () => {
      await hre.run("interactWithContracts");
      await new Promise((r) => setTimeout(r, 2000)); //set two second wait, so that the graph have time to index events
    });

    it("Indexes new GravatarRegistry events correctly", async () => {
      const result = await getData(GRAVATAR_QUERY);
      const gravatars = result.data.gravatars;

      expect(JSON.stringify(gravatars)).to.equal(
        JSON.stringify(expected.gravatar.updated),
      );
    });

    it("Indexes new ExampleERC20 events correctly", async () => {
      const result = await getData(ERC20_QUERY);
      const erc20 = result.data.erc20S;

      expect(JSON.stringify(erc20)).to.equal(
        JSON.stringify(expected.erc20.updated),
      );
    });

    it("Indexes new ExampleERC721 events correctly", async () => {
      const result = await getData(ERC721_QUERY);
      const erc721 = result.data.erc721S;

      expect(JSON.stringify(erc721)).to.equal(
        JSON.stringify(expected.erc721.updated),
      );
    });

    it("Indexes new ExampleHTSNFT events correctly", async () => {
      const result = await getData(NFTHTS_QUERY);
      const htsnfts = result.data.htsnfts;

      expect(JSON.stringify(htsnfts)).to.equal(
        JSON.stringify(expected.htsnfts.updated),
      );
    });
  });
});

async function getData(query: string) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query,
    }),
  });

  return await res.json();
}
