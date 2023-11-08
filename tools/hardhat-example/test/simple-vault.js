/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const hre = require('hardhat');
const { expect } = require('chai');

function topicToAddress(topic) {
  return '0x' + topic.slice(-40);
}

describe('Test SimpleVault using the HTS System Contract Mock', function () {
  let signers;
  let deployer;
  let deployerAddress;

  let simpleVault;
  let htsAddress;
  let htsTokenContract;

  const initialTotalSupply = 2 ** 50;
  const htsSystemContractAddress = "0x0000000000000000000000000000000000000167";
  const exchangeRateSystemContractAddress = "0x0000000000000000000000000000000000000168";

  let htsSystemContract;
  let exchangeRateSystemContract;

  before(async function () {

    if (hre.network.name !== "hardhat") {
      this.skip();  // Skip all tests in this suite since it only the hardhat local node supports the hardhat_setCode method
    }

    // - - - - - DEPLOY REQUISITE SYSTEM CONTRACT MOCKS - - - - -
    const HtsSystemContractMockFactory = await ethers.getContractFactory("HtsSystemContractMock");
    const HtsSystemContractMock = await HtsSystemContractMockFactory.deploy();
    const htsSystemContractBytecode = await hre.network.provider.send("eth_getCode", [HtsSystemContractMock.address,]);
    await hre.network.provider.send("hardhat_setCode", [htsSystemContractAddress, htsSystemContractBytecode]);
    htsSystemContract = await hre.ethers.getContractAt("HtsSystemContractMock", htsSystemContractAddress);

    const ExchangeRatePrecompileMockFactory = await ethers.getContractFactory("ExchangeRatePrecompileMock");
    const ExchangeRatePrecompileMock = await ExchangeRatePrecompileMockFactory.deploy();
    const exchangeRatePrecompileMockBytecode = await hre.network.provider.send("eth_getCode", [ExchangeRatePrecompileMock.address,]);
    await hre.network.provider.send("hardhat_setCode", [exchangeRateSystemContractAddress, exchangeRatePrecompileMockBytecode]);
    exchangeRateSystemContract = await hre.ethers.getContractAt("ExchangeRatePrecompileMock", exchangeRateSystemContractAddress);

    await exchangeRateSystemContract.updateRate(1e7);

    signers = await hre.ethers.getSigners();

    deployer = signers[0];
    deployerAddress = deployer.address;

    const decimals = 8;

    const token = {
      name: "Token A",
      symbol: "TKNA",
      treasury: deployerAddress,
      memo: "",
      tokenSupplyType: false,
      maxSupply: initialTotalSupply,
      freezeDefault: false,
      tokenKeys: [],
      expiry: {
        second: 0,
        autoRenewAccount: deployerAddress,
        autoRenewPeriod: 0
      }
    };

    // - - - - - DEPLOY HTS Token via direct EOA call to HTS System Contract Mock - - - - -

    const createTokenExpectedResult = await htsSystemContract.connect(deployer).callStatic.createFungibleToken(token, initialTotalSupply, decimals);
    const expectedTokenAddress = createTokenExpectedResult.tokenAddress; // TODO: investigate why computing the expected address using the factory address and nonce doesn't work

    const factoryNonceInitial = await ethers.provider.getTransactionCount(htsSystemContractAddress)

    const createTokenTx = await htsSystemContract.connect(deployer).createFungibleToken(token, initialTotalSupply, decimals);
    const createTokenRc = await createTokenTx.wait();
    htsAddress = createTokenRc.events[1].args.token

    const factoryNonceFinal = await ethers.provider.getTransactionCount(htsSystemContractAddress)
    expect(factoryNonceInitial).to.be.eq(factoryNonceFinal - 1);
    expect(expectedTokenAddress).to.eq(htsAddress)

    htsTokenContract = await hre.ethers.getContractAt("HederaFungibleToken", htsAddress);

    const totalSupply = await htsTokenContract.totalSupply()
    const deployerBalance = await htsTokenContract.balanceOf(deployerAddress)

    expect(totalSupply).to.be.eq(initialTotalSupply);
    expect(deployerBalance).to.be.eq(initialTotalSupply);

    const SimpleVaultFactory = await ethers.getContractFactory("SimpleVault");
    simpleVault = await SimpleVaultFactory.deploy();
    await simpleVault.deployed();

    await simpleVault.associate(htsTokenContract.address);

    const isAssociatedWithHtsToken = await simpleVault.isAssociated(htsTokenContract.address);
    expect(isAssociatedWithHtsToken).to.be.true;
  });

  it('should be able to deploy HTS token via proxy', async function () {
    // - - - - - DEPLOY HTS Token via Proxy - - - - -
    const ProxyToHtsMock = await ethers.getContractFactory("ProxyToHtsMock");
    const proxyToHtsMock = await ProxyToHtsMock.deploy();
    await proxyToHtsMock.deployed();

    const createTokenViaProxyTx = await proxyToHtsMock.createTokenForSender();
    const createTokenViaProxyRc = await createTokenViaProxyTx.wait();

    const htsTokenAddress = topicToAddress(createTokenViaProxyRc.events[1].topics[1]);
    const htsTokenByProxy = await hre.ethers.getContractAt("HederaFungibleToken", htsTokenAddress);

    const balanceOfProxy = await htsTokenByProxy.balanceOf(proxyToHtsMock.address);
    const totalSupply = await htsTokenByProxy.totalSupply();

    expect(totalSupply).to.be.eq(balanceOfProxy);

    await htsSystemContract.connect(deployer).associateToken(deployerAddress, htsTokenByProxy.address);
    await proxyToHtsMock.connect(deployer).sweepToSender(htsTokenByProxy.address);

    const balanceOfProxyFinal = await htsTokenByProxy.balanceOf(proxyToHtsMock.address);
    const balanceOfDeployerFinal = await htsTokenByProxy.balanceOf(deployerAddress);

    expect(0).to.be.eq(balanceOfProxyFinal);
    expect(totalSupply).to.be.eq(balanceOfDeployerFinal);
  })

  it('should be able to deposit and withdraw to and from the vault', async function () {

    const depositAmount = 100;

    const vaultInitialBalance = await htsTokenContract.balanceOf(simpleVault.address);
    const deployerInitialBalance = await htsTokenContract.balanceOf(deployerAddress);

    const valueForDeposit = await simpleVault.callStatic.getCentsInTinybar(2);

    await htsTokenContract.connect(deployer).approve(simpleVault.address, depositAmount);

    await simpleVault.connect(deployer).deposit(htsAddress, depositAmount, {
      value: valueForDeposit
    });

    const vaultBalanceAfterDeposit = await htsTokenContract.balanceOf(simpleVault.address);
    const deployerBalanceAfterDeposit = await htsTokenContract.balanceOf(deployerAddress);

    expect(vaultBalanceAfterDeposit).to.be.eq(vaultInitialBalance.add(depositAmount));
    expect(deployerBalanceAfterDeposit).to.be.eq(deployerInitialBalance.sub(depositAmount));

    const withdrawAmount = 50;

    const valueForWithdraw = await simpleVault.callStatic.getCentsInTinybar(1);

    await simpleVault.connect(deployer).withdraw(htsAddress, withdrawAmount, {
      value: valueForWithdraw
    });

    const vaultBalanceAfterWithdraw = await htsTokenContract.balanceOf(simpleVault.address);
    const deployerBalanceAfterWithdraw = await htsTokenContract.balanceOf(deployerAddress);

    expect(vaultBalanceAfterWithdraw).to.be.eq(vaultBalanceAfterDeposit.sub(withdrawAmount));
    expect(deployerBalanceAfterWithdraw).to.be.eq(deployerBalanceAfterDeposit.add(withdrawAmount));

  });

});
