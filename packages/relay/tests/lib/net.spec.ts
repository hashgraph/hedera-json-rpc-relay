import { expect } from 'chai';
import { RelayImpl } from 'relay';

const Relay = new RelayImpl();

describe('Net', async function() {
  it('should execute "net_listening"', async function() {
    const result = await Relay.net().listening();
    expect(result).to.eq(false);
  });
});
