const { expect } = require('chai');
const hre = require('hardhat');
const { ethers } = hre;

const ONE_HBAR = 1n * 100_000_000n;
const WEIBAR_COEF = 10_000_000_000n;
const ONE_HBAR_AS_WEIBAR = ONE_HBAR * WEIBAR_COEF;

describe('WHBAR', function() {
  let signers;
  let contract;

  before(async function() {
    signers = await ethers.getSigners();
  });

  it('should deploy the WHBAR contract', async function() {
    const contractFactory = await ethers.getContractFactory('WHBAR');
    contract = await contractFactory.deploy();

    await contract.waitForDeployment();
    expect(contract).to.not.be.undefined;
  });

  it('should get name', async function() {
    expect(await contract.name()).to.equal('Wrapped HBAR');
  });

  it('should get symbol', async function() {
    expect(await contract.symbol()).to.equal('WHBAR');
  });

  it('should get decimals', async function() {
    expect(await contract.decimals()).to.equal(8);
  });

  it('should get totalSupply', async function() {
    expect(await contract.totalSupply()).to.equal(0);
  });

  it('should deposit 1 hbar', async function() {

    const hbarBalanceBefore = await ethers.provider.getBalance(signers[0].address);
    const whbarBalanceBefore = await contract.balanceOf(signers[0].address);
    const totalSupplyBefore = await contract.totalSupply();

    const txDeposit = await contract.deposit({
      value: ONE_HBAR_AS_WEIBAR
    });
    await txDeposit.wait();

    const hbarBalanceAfter = await ethers.provider.getBalance(signers[0].address);
    const whbarBalanceAfter = await contract.balanceOf(signers[0].address);
    const totalSupplyAfter = await contract.totalSupply();

    expect(hbarBalanceBefore - hbarBalanceAfter).to.be.greaterThanOrEqual(ONE_HBAR_AS_WEIBAR);
    expect(whbarBalanceAfter - whbarBalanceBefore).to.equal(ONE_HBAR);
    expect(totalSupplyBefore + ONE_HBAR).to.equal(totalSupplyAfter);
  });

  it('should withdraw 1 hbar', async function() {
    const txDeposit = await contract.deposit({
      value: ONE_HBAR_AS_WEIBAR
    });
    await txDeposit.wait();

    const hbarBalanceBefore = await ethers.provider.getBalance(signers[0].address);
    const whbarBalanceBefore = await contract.balanceOf(signers[0].address);
    const totalSupplyBefore = await contract.totalSupply();

    const txWithdraw = await contract.withdraw(ONE_HBAR);
    await txWithdraw.wait();

    const hbarBalanceAfter = await ethers.provider.getBalance(signers[0].address);
    const whbarBalanceAfter = await contract.balanceOf(signers[0].address);
    const totalSupplyAfter = await contract.totalSupply();

    expect(hbarBalanceBefore - hbarBalanceAfter).to.be.lessThanOrEqual(ONE_HBAR_AS_WEIBAR);
    expect(whbarBalanceBefore - ONE_HBAR).to.equal(whbarBalanceAfter);
    expect(totalSupplyBefore - ONE_HBAR).to.equal(totalSupplyAfter);
  });

  it('should be able to transfer', async function() {
    const receiver = (ethers.Wallet.createRandom()).address;
    const receiverBalanceBefore = await contract.balanceOf(receiver);

    const txDeposit = await contract.deposit({
      value: ONE_HBAR_AS_WEIBAR
    });
    await txDeposit.wait();

    const txTransfer = await contract.transfer(receiver, ONE_HBAR);
    await txTransfer.wait();

    const receiverBalanceAfter = await contract.balanceOf(receiver);
    expect(receiverBalanceBefore).to.equal(0);
    expect(receiverBalanceAfter).to.equal(ONE_HBAR);
  });

  it('should be able to approve', async function() {
    const receiverAddress = (ethers.Wallet.createRandom()).address;
    const amount = 5644;

    const txApprove = await contract.approve(receiverAddress, amount);
    await txApprove.wait();

    expect(await contract.allowance(signers[0].address, receiverAddress)).to.equal(amount);
  });
});
