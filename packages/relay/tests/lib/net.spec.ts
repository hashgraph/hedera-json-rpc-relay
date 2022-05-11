import { expect } from 'chai';
import { RelayImpl } from '@hashgraph/json-rpc-relay';

import pino from 'pino';
const logger = pino();

const Relay = new RelayImpl(logger);

describe('Net', async function() {
  it('should execute "net_listening"', async function() {
    const result = await Relay.net().listening();
    expect(result).to.eq(false);
  });
});
