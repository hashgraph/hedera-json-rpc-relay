import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers, network } from 'hardhat';
import { deployContract, loadFixture } from 'ethereum-waffle';
import TokenCreateArtifact from '../../contract-artifacts/HTS/example/TokenCreate/token-create/TokenCreateContract.sol/TokenCreateContract.json';
import { getSignerCompressedPublicKey, updateAccountKeysViaHapi } from '../utils/helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('HTS - Token Create Test Suite', () => {
  const LOCAL_TESTNET_CHAIN_ID = 1337;
  const CURRENT_NETWORK_CHAINID = network.config.chainId;

  describe('Testing Without Fixture', () => {
    let tokenCreateContract: Contract, signers: SignerWithAddress[];

    it('Should deploy the contract without fixture', async () => {
      signers = await ethers.getSigners();

      tokenCreateContract = await deployContract(signers[0], TokenCreateArtifact, []);
      await updateAccountKeysViaHapi([tokenCreateContract.address]);

      expect(tokenCreateContract instanceof ethers.Contract).to.be.true;
      expect(tokenCreateContract.deployTransaction.chainId).to.eq(CURRENT_NETWORK_CHAINID);
      expect(tokenCreateContract.deployTransaction.chainId).to.not.eq(LOCAL_TESTNET_CHAIN_ID);
    });

    it('Should execute createFungibleTokenWithSECP256K1AdminKeyPublic()', async () => {
      const adminKey = getSignerCompressedPublicKey();

      const tx = await tokenCreateContract.createFungibleTokenWithSECP256K1AdminKeyPublic(
        signers[0].address,
        adminKey,
        {
          value: BigInt(20000000000000000000),
          gasLimit: 1_000_000,
        },
      );

      const receipt = await tx.wait();
      const { tokenAddress } = receipt.events.filter((e: any) => e.event === `CreatedToken`)[0].args;

      expect(tokenAddress).to.not.null;
      expect(ethers.utils.isAddress(tokenAddress)).to.to.true;
    });
  });

  describe('Testing With Fixture', () => {
    const fixture = async ([signer]: any) => {
      const tokenCreateContract = await deployContract(signer, TokenCreateArtifact, []);
      return { tokenCreateContract };
    };

    it('Should deploy the contract with fixture', async () => {
      const { tokenCreateContract } = await loadFixture(fixture);
      await updateAccountKeysViaHapi([tokenCreateContract.address]);
      expect(tokenCreateContract instanceof ethers.Contract).to.be.true;
      expect(tokenCreateContract.deployTransaction.chainId).to.eq(LOCAL_TESTNET_CHAIN_ID);
      expect(tokenCreateContract.deployTransaction.chainId).to.not.eq(CURRENT_NETWORK_CHAINID);
    });

    it('Should FAIL createFungibleTokenWithSECP256K1AdminKeyPublic()', async () => {
      const { tokenCreateContract } = await loadFixture(fixture);
      await updateAccountKeysViaHapi([tokenCreateContract.address]);

      const signers = await ethers.getSigners();
      const adminKey = getSignerCompressedPublicKey();

      try {
        await tokenCreateContract.createFungibleTokenWithSECP256K1AdminKeyPublic(signers[0].address, adminKey, {
          value: BigInt(20000000000000000000),
          gasLimit: 1_000_000,
        });
        expect(true).to.eq(false);
      } catch (error: any) {
        expect(error.reason).to.eq('transaction failed');
        expect(error.code).to.eq('CALL_EXCEPTION');
        expect(error.transaction.chainId).to.eq(LOCAL_TESTNET_CHAIN_ID);
      }
    });
  });
});
