import path from 'path';
import dotenv from 'dotenv';
import { expect } from 'chai';
import { RelayImpl } from '@hashgraph/json-rpc-relay';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

import pino from 'pino';
const logger = pino();

const Relay = new RelayImpl(logger);

describe('Web3', async function() {
  it('should execute "web3_clientVersion"', async function() {
    const clientVersion = await Relay.web3().clientVersion();

    expect(clientVersion).to.be.equal('relay/' + process.env.npm_package_version);
  });
});
