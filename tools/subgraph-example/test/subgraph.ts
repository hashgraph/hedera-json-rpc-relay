import * as dotenv from "dotenv";
import { expect } from "chai";
import fetch from 'node-fetch'
import expected from './expected.json'
import { isEqual } from 'lodash'
import hre from 'hardhat';

dotenv.config();

const URL = "http://127.0.0.1:8000/subgraphs/name/subgraph-example";
const GRAVATAR_QUERY = "query { gravatars { id owner displayName imageUrl } }";
const ERC20_QUERY = "query { erc20S { id supply type transfers { from to amount } } }";
const HTS_QUERY = "query { htss { id supply type transfers { from to amount } } }";
const NFTHTS_QUERY = "query { htsnfts { id owner type tokenId transfers { from to } } }";
const ERC721_QUERY = "query { erc721S { id owner type tokenId transfers { from to } } }";

describe("Subgraph", () => {
  describe("Can index past events", () => {
    it("Indexes past GravatarRegistry events correctly", async () => {
      const result = await getData(GRAVATAR_QUERY);
      const gravatars = result.data.gravatars;

      expect(isEqual(gravatars, expected.gravatar.initial)).to.be.true;
    });

    it("Indexes past ExampleERC20 events correctly", async () => {
      const result = await getData(ERC20_QUERY);
      const erc20 = result.data.erc20S;

      expect(isEqual(erc20, expected.erc20.initial)).to.be.true;
    });

    it("Indexes past ExampleERC721 events correctly", async () => {
      const result = await getData(ERC721_QUERY);
      const erc721 = result.data.erc721S;

      expect(isEqual(erc721, expected.erc721.initial)).to.be.true;
    });

    it("Indexes past ExampleHTS events correctly", async () => {
      const result = await getData(HTS_QUERY);
      const hts = result.data.htss;

      expect(isEqual(hts, expected.htss.initial)).to.be.true;
    });

    it("Indexes past ExampleHTSNFT events correctly", async () => {
      const result = await getData(NFTHTS_QUERY);
      const htsnfts = result.data.htsnfts;

      expect(isEqual(htsnfts, expected.htsnfts.initial)).to.be.true;
    });
  })

  describe("Can index new events", () => {
    before("Interact with contracts", async () => {
      await hre.run('interactWithContracts');
      await new Promise(r => setTimeout(r, 2000)); //set two second wait, so that the graph have time to index events
    });

    it("Indexes new GravatarRegistry events correctly", async () => {
      const result = await getData(GRAVATAR_QUERY);
      const gravatars = result.data.gravatars;

      expect(isEqual(gravatars, expected.gravatar.updated)).to.be.true;
    });

    it("Indexes new ExampleERC20 events correctly", async () => {
      const result = await getData(ERC20_QUERY);
      const erc20 = result.data.erc20S;

      expect(isEqual(erc20, expected.erc20.updated)).to.be.true;
    });

    it("Indexes new ExampleERC721 events correctly", async () => {
      const result = await getData(ERC721_QUERY);
      const erc721 = result.data.erc721S;

      expect(isEqual(erc721, expected.erc721.updated)).to.be.true;
    });

    it("Indexes new ExampleHTS events correctly", async () => {
      const result = await getData(HTS_QUERY);
      const hts = result.data.htss;

      expect(isEqual(hts, expected.htss.updated)).to.be.true;
    });

    it("Indexes new ExampleHTSNFT events correctly", async () => {
      const result = await getData(NFTHTS_QUERY);
      const htsnfts = result.data.htsnfts;

      expect(isEqual(htsnfts, expected.htsnfts.updated)).to.be.true;
    });
  })
})

async function getData(query: string) {
  const res = await fetch(
    URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({
        query: query
      })
    }
  )

  return await res.json()
}
