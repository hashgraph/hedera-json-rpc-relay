import { expect } from 'chai';
import sinon from 'sinon';
import pino from 'pino';
import { Registry } from 'prom-client';
import { RelayImpl } from '../../src';

describe('RelayImpl', () => {
  const logger = pino();
  const register = new Registry();
  let relay: RelayImpl;

  beforeEach(() => {
    relay = new RelayImpl(logger, register);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should initialize correctly with valid parameters', () => {
    expect(relay).to.be.an.instanceof(RelayImpl);
  });

  it('should return the correct web3 implementation', () => {
    const web3 = relay.web3();
    expect(web3).to.not.be.undefined;
  });

  it('should return the correct net implementation', () => {
    const net = relay.net();
    expect(net).to.not.be.undefined;
  });

  it('should return the correct eth implementation', () => {
    const eth = relay.eth();
    expect(eth).to.not.be.undefined;
  });

  it('should return the correct subscription implementation when enabled', () => {
    process.env.SUBSCRIPTIONS_ENABLED = 'true';
    relay = new RelayImpl(logger, register);

    const subs = relay.subs();
    expect(subs).to.not.be.undefined;
  });

  it('should return undefined subscription implementation when not enabled', () => {
    process.env.SUBSCRIPTIONS_ENABLED = 'false';
    relay = new RelayImpl(logger, register);

    const subs = relay.subs();
    expect(subs).to.be.undefined;
  });
});
