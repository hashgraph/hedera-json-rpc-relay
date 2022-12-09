import * as dotenv from "dotenv";
import { expect } from "chai";
import fetch from 'node-fetch'

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

    before("Fetch data from subgraph", async () => {

      // erc20s = await getData(ERC20_QUERY);
      // erc721s = await getData(ERC721_QUERY);
    });

    it("Indexes past GravatarRegistry events correctly", async () => {
      const result = await getData(GRAVATAR_QUERY);
      const gravatars = result.data.gravatars;

      expect(gravatars.length).to.eq(1);
      expect(gravatars[0].displayName).to.eq("My Gravatar");
      expect(gravatars[0].imageUrl).to.eq("https://example.com/gravatars/1");
    })

    it("Indexes past ExampleERC20 events correctly", async () => {
      const result = await getData(ERC20_QUERY);
      const erc20s = result.data.erc20S;

      expect(erc20s.length).to.eq(1);
      expect(erc20s[0].type).to.eq("ERC20");
      expect(erc20s[0].supply).to.eq(20);
      expect(erc20s[0].transfers.length).to.eq(1);
      expect(erc20s[0].transfers[0].amount).to.eq(20);
    })

    it("Indexes past ExampleERC721 events correctly", async () => {
      const result = await getData(ERC721_QUERY);
      const erc721s = result.data.erc721S;

      expect(erc721s.length).to.eq(1);
      expect(erc721s[0].type).to.eq("ERC721");
      expect(erc721s[0].tokenId).to.eq("0x1");
      expect(erc721s[0].transfers.length).to.eq(1);
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
