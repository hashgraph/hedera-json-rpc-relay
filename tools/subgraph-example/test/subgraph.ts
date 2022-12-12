import * as dotenv from "dotenv";
import { expect } from "chai";
import fetch from 'node-fetch'
import expected from './expected.json'
import isEqual from 'lodash/isequal'
import hre from 'hardhat';

dotenv.config();

const URL = "http://127.0.0.1:8000/subgraphs/name/subgraph-example"
const GRAVATAR_QUERY = "query { gravatars { id owner displayName imageUrl } }"
const ERC20_QUERY = "query { erc20S { id supply type transfers { from to amount } } }"
const ERC721_QUERY = "query { erc721S { id owner type tokenId transfers { from to } } }"

describe("Subgraph", () => {
  let gravatars = {};
  let erc20s = {};
  let erc721s = {};

  // before("Deploy subgraph", async () => {
  //   console.log("Deploying subgraph!");
  //   execSync('npm run graph-local-clean');
  //   execSync('npm run graph-local -- --detach');
  //   await sleep(5000);
  //   execSync('npm run create-local');
  //   execSync('npm run deploy-local -- --network local --version-label 0.0.1')
  // })

  describe("Can index past events", () => {
    it("Indexes past GravatarRegistry events correctly", async () => {
      const result = await getData(GRAVATAR_QUERY);
      const gravatars = result.data.gravatars;

      expect(isEqual(gravatars, expected.gravatar.initial)).to.be.true;
    })

    it("Indexes past ExampleERC20 events correctly", async () => {
      const result = await getData(ERC20_QUERY);
      const erc20 = result.data.erc20S;

      expect(isEqual(erc20, expected.erc20.initial)).to.be.true;
    })

    it("Indexes past ExampleERC721 events correctly", async () => {
      const result = await getData(ERC721_QUERY);
      const erc721 = result.data.erc721S;

      expect(isEqual(erc721, expected.erc721.initial)).to.be.true;
    })
  })

  describe("Can index new events", () => {
    before("Interact with contracts", async () => {
      await hre.run('interactWithContracts')
    })

    it("Indexes past GravatarRegistry events correctly", async () => {
      const result = await getData(GRAVATAR_QUERY);
      const gravatars = result.data.gravatars;

      expect(isEqual(gravatars, expected.gravatar.updated)).to.be.true;
    })

    it("Indexes past ExampleERC20 events correctly", async () => {
      const result = await getData(ERC20_QUERY);
      const erc20 = result.data.erc20S;

      expect(isEqual(erc20, expected.erc20.updated)).to.be.true;
    })

    it("Indexes past ExampleERC721 events correctly", async () => {
      const result = await getData(ERC721_QUERY);
      const erc721 = result.data.erc721S;

      expect(isEqual(erc721, expected.erc721.updated)).to.be.true;
    })
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
