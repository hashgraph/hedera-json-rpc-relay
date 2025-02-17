// SPDX-License-Identifier: Apache-2.0

const hre = require('hardhat');
const { expect } = require('chai');

describe('RPC', function () {
  let contractAddress;

  it('should be able to get the account balance', async function () {
    const balance = await hre.run('show-balance');
    expect(Number(balance)).to.be.greaterThan(0);
  });

  it('should be able to deploy a contract', async function () {
    contractAddress = await hre.run('deploy-contract');
    expect(contractAddress).to.not.be.null;
  });

  it('should be able to make a contract view call', async function () {
    const res = await hre.run('contract-view-call', { contractAddress });
    expect(res).to.be.equal('initial_msg');
  });

  it('should be able to make a contract call', async function () {
    const msg = 'updated_msg';
    await hre.run('contract-call', { contractAddress, msg });
    const res = await hre.run('contract-view-call', { contractAddress });
    expect(res).to.be.equal(msg);
  });
});
