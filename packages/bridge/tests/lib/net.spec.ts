import { expect } from 'chai';
import { BridgeImpl } from 'bridge';

const Bridge = new BridgeImpl();

describe('Net', async function() {
  it('should execute "net_listening"', async function() {
    const result = await Bridge.net().listening();
    expect(result).to.eq(false);
  });
});
