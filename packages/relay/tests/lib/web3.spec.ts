import path from 'path';
import dotenv from 'dotenv';
import { expect } from 'chai';
import { RelayImpl } from 'relay';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

const Relay = new RelayImpl();

describe('Web3', async function() {
  it('should execute "web3_clientVersion"', async function() {
    const clientVersion = await Relay.web3().clientVersion();

    expect(clientVersion).to.be.equal('relay/' + process.env.npm_package_version);
  });
});
