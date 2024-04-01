import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers, network } from 'hardhat';
import { deployContract, loadFixture } from 'ethereum-waffle';
import PiggyBankABI from '../../artifacts/contracts/PiggyBank.sol/PiggyBank.json';

describe('Piggy Bank Test Suite', () => {
  const LOCAL_TESTNET_CHAIN_ID = 1337;
  const CURRENT_NETWORK_CHAINID = network.config.chainId;

  describe('Testing Without Fixture', () => {
    let piggyBank: Contract, signers;

    it('Should deploy the contract without fixture', async () => {
      signers = await ethers.getSigners();
      piggyBank = await deployContract(signers[0], PiggyBankABI, []);

      expect(piggyBank instanceof ethers.Contract).to.be.true;
      expect(await piggyBank.getChainId()).to.eq(CURRENT_NETWORK_CHAINID);
      expect(piggyBank.deployTransaction.chainId).to.eq(CURRENT_NETWORK_CHAINID);
      expect(piggyBank.deployTransaction.chainId).to.not.eq(LOCAL_TESTNET_CHAIN_ID);
    });

    it('Should execute getBalance() to get current balance', async () => {
      expect(await piggyBank.getBalance()).to.eq(0);
    });

    it('Should execute deposit() to deposit more fund', async () => {
      const FUND = 10_000_000_000;
      const tx = await piggyBank.deposit({ value: FUND });
      await tx.wait();
      expect(await piggyBank.getBalance()).to.eq(FUND / 10 ** 10);
    });
  });

  describe('Testing With Fixture', () => {
    /**
     * @notice Creates pre-defined testing scenarios (contract deployment in this case) and snapshots the blockchain's state using the fixture feature.
     * This functionality is only available on the default local test network provided by the development framework (Hardhat in this case).
     *
     * @notice It's a common convention in Ethereum development tools to use chainId 1337 for local test networks.
     */
    const fixture = async ([signer]: any) => {
      const piggyBank = await deployContract(signer, PiggyBankABI, []);
      return { piggyBank };
    };

    it('Should deploy the contract with fixture', async () => {
      const { piggyBank } = await loadFixture(fixture);
      expect(piggyBank instanceof ethers.Contract).to.be.true;
      expect(await piggyBank.getChainId()).to.eq(LOCAL_TESTNET_CHAIN_ID);
      expect(piggyBank.deployTransaction.chainId).to.eq(LOCAL_TESTNET_CHAIN_ID);
      expect(piggyBank.deployTransaction.chainId).to.not.eq(CURRENT_NETWORK_CHAINID);
    });

    it('Should execute getBalance() to get current balance', async () => {
      const { piggyBank } = await loadFixture(fixture);
      expect(await piggyBank.getBalance()).to.eq(0);
    });

    it('Should execute deposit() to deposit more fund', async () => {
      const { piggyBank } = await loadFixture(fixture);
      const FUND = 10_000_000_000;
      const tx = await piggyBank.deposit({ value: FUND });
      await tx.wait();
      expect(await piggyBank.getBalance()).to.eq(FUND);
    });
  });
});
