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

const QUIERIES = [
  {
    name: "ERC20_QUERY",
    actualData: "erc20S",
    expectedData: expected.erc20,
    query: ERC20_QUERY,
  },
  {
    name: "HTSFT_QUERY",
    actualData: "erc721S",
    expectedData: expected.erc721,
    query: HTSFT_QUERY,
  },
  {
    name: "NFTHTS_QUERY",
    actualData: "htsfts",
    expectedData: expected.htsfts,
    query: NFTHTS_QUERY,
  },
  {
    name: "ERC721_QUERY",
    actualData: "htsnfts",
    expectedData: expected.htsnfts,
    query: ERC721_QUERY,
  },
];

describe("Subgraph", () => {
  describe("Can index past events", () => {
    it("Indexes past GravatarRegistry events correctly", async () => {
      const result = await getData(GRAVATAR_QUERY);
      const gravatars = result.data.gravatars;

      expect(JSON.stringify(gravatars)).to.equal(
        JSON.stringify(expected.gravatar.initial),
      );
    });

    for (let index = 0; index < QUIERIES.length; index++) {
      it(`Indexes past ${QUIERIES[index].name} events correctly`, async () => {
        const query = QUIERIES[index];
        const result = await getData(query.query);
        const actualData = JSON.stringify(result.data[query.actualData]);
        const expectedData = JSON.stringify(query.expectedData.initial);
        expect(expectedData).to.equal(actualData);
      });
    }
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

    for (let index = 0; index < QUIERIES.length; index++) {
      it(`Indexes new ${QUIERIES[index].name} events correctly`, async () => {
        const query = QUIERIES[index];
        const result = await getData(query.query);
        const actualData = JSON.stringify(result.data[query.actualData]);
        const expectedData = JSON.stringify(query.expectedData.updated);
        expect(expectedData).to.equal(actualData);
      });
    }
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
