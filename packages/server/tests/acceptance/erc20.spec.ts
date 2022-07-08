/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

// external resources
import { solidity } from "ethereum-waffle";
import chai, {expect} from "chai";
chai.use(solidity);

import { AliasAccount } from '../clients/servicesClient';
import { ethers, BigNumber } from 'ethers';
import ERC20MockJson from '../contracts/ERC20Mock.json';
import Assertions from '../helpers/assertions';
import {Utils} from '../helpers/utils';


describe('ERC20 Acceptance Tests', async function () {
    this.timeout(240 * 1000); // 240 seconds
    const {servicesNode, relay, logger} = global;

    // cached entities
    const accounts: AliasAccount[] = [];
    let initialHolder;
    let recipient;
    let anotherAccount;
    const contracts:[any] = [];

    const name = Utils.randomString(10);
    const symbol = Utils.randomString(5);
    const initialSupply = BigNumber.from(10000);

    const testTitles = [
        // {testName: 'ERC20 Contract', expectedBytecode: ERC20MockJson.deployedBytecode},
        {testName: 'HTS token', expectedBytecode: '0x0'}
    ];

    before(async () => {
        accounts[0] = await servicesNode.createAliasAccount(30, relay.provider);
        accounts[1] = await servicesNode.createAliasAccount(10, relay.provider);
        accounts[2] = await servicesNode.createAliasAccount(10, relay.provider);

        initialHolder = accounts[0].address;
        recipient = accounts[1].address;
        anotherAccount = accounts[2].address;

        // contracts.push(await deployErc20([name, symbol, initialHolder, initialSupply], ERC20MockJson));
        contracts.push(await createHTS(name, symbol, accounts[0].accountId.toString(), 10000, accounts[0].privateKey.publicKey, ERC20MockJson.abi));
    });

    for (const i in testTitles) {
        describe(testTitles[i].testName, async function () {
            let contract;

            before(async function () {
                contract = contracts[i];
            });

            it('has a name', async function () {
                expect(await contract.name()).to.equal(name);
            });

            it('has a symbol', async function () {
                expect(await contract.symbol()).to.equal(symbol);
            });

            it('has 18 decimals', async function () {
                expect(await contract.decimals()).to.be.equal(18);
            });

            it('Relay can execute "eth_getCode" for ERC20 contract with evmAddress', async function () {
                const res = await relay.call('eth_getCode', [contract.address]);
                expect(res).to.eq(testTitles[i].expectedBytecode);
            });

            describe('should behave like erc20', function() {
                describe('total supply', function () {
                    it('returns the total amount of tokens', async function () {
                        const supply = await contract.totalSupply();
                        expect(supply.toString()).to.be.equal(initialSupply.toString());
                    });
                });

                describe('balanceOf', function () {
                    describe('when the requested account has no tokens', function () {
                        it('returns zero', async function () {
                            const otherBalance = await contract.balanceOf(anotherAccount);
                            expect(otherBalance.toString()).to.be.equal('0');
                        });
                    });

                    describe('when the requested account has some tokens', function () {
                        it('returns the total amount of tokens', async function () {
                            const balance = await contract.balanceOf(initialHolder);
                            expect(balance.toString()).to.be.equal(initialSupply.toString());
                        });
                    });
                });

                describe('transfer from', function () {
                    let spender;
                    let spenderWallet;

                    before(async function () {
                        spender = accounts[1].address;
                        spenderWallet = accounts[1].wallet;
                    });

                    describe('when the token owner is not the zero address', function () {
                        let tokenOwner, tokenOwnerWallet;
                        before(async function () {
                            tokenOwner = accounts[0].address;
                            tokenOwnerWallet = accounts[0].wallet;
                        });

                        describe('when the recipient is not the zero address', function () {
                            let to, toWallet;
                            before(async function () {
                                to = accounts[2].address;
                                toWallet = accounts[2].wallet;
                            });

                            describe('when the spender has enough allowance', function () {
                                before(async function () {
                                    await contract.approve(spender, initialSupply, { from: tokenOwner });
                                });

                                describe('when the token owner has enough balance', function () {
                                    let amount, tx;
                                    before(async function () {
                                        amount = initialSupply;
                                        const ownerBalance = await contract.balanceOf(tokenOwner);
                                        const toBalance = await contract.balanceOf(to);
                                        expect(ownerBalance.toString()).to.be.equal(amount.toString());
                                        expect(toBalance.toString()).to.be.equal('0');
                                        tx = await contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount);
                                        logger.debug(tx);
                                    });

                                    it('transfers the requested amount', async function () {
                                        const ownerBalance = await contract.balanceOf(tokenOwner);
                                        const toBalance = await contract.balanceOf(to);
                                        expect(ownerBalance.toString()).to.be.equal('0');
                                        expect(toBalance.toString()).to.be.equal(amount.toString());
                                    });

                                    it('decreases the spender allowance', async function () {
                                        const allowance = await contract.allowance(tokenOwner, spender);
                                        expect(allowance.toString()).to.be.equal('0');
                                    });

                                    it('emits a transfer event', async function () {
                                        await expect(tx)
                                            .to.emit(contract, 'Transfer')
                                            .withArgs(tokenOwnerWallet.address, toWallet.address, amount);
                                    });

                                    it('emits an approval event', async function () {
                                        await expect(tx)
                                            .to.emit(contract, 'Approval')
                                            .withArgs(tokenOwnerWallet.address, spenderWallet.address, await contract.allowance(tokenOwner, spender));
                                    });
                                });

                                describe('when the token owner does not have enough balance', function () {
                                    let amount;

                                    beforeEach('reducing balance', async function () {
                                        amount = initialSupply;
                                        await contract.transfer(to, 1, { from: tokenOwner });
                                    });

                                    it('reverts', async function () {
                                        await expectRevert(
                                            contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                            'CALL_EXCEPTION'
                                        );
                                    });
                                });
                            });

                            describe('when the spender does not have enough allowance', function () {
                                let allowance;

                                before(async function () {
                                    allowance = initialSupply.sub(1);
                                });

                                beforeEach(async function () {
                                    await contract.approve(spender, allowance, { from: tokenOwner });
                                });

                                describe('when the token owner has enough balance', function () {
                                    let amount;
                                    before(async function () {
                                        amount = initialSupply;
                                    });

                                    it('reverts', async function () {
                                        await expectRevert(
                                            contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                            `CALL_EXCEPTION`,
                                        );
                                    });
                                });

                                describe('when the token owner does not have enough balance', function () {
                                    let amount;
                                    before(async function () {
                                        amount = allowance;
                                    });

                                    beforeEach('reducing balance', async function () {
                                        await contract.transfer(to, 2, { from: tokenOwner });
                                    });

                                    it('reverts', async function () {
                                        await expectRevert(
                                            contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                            `CALL_EXCEPTION`,
                                        );
                                    });
                                });
                            });

                            describe('when the spender has unlimited allowance', function () {
                                beforeEach(async function () {
                                    await contract.connect(tokenOwnerWallet).approve(spender, ethers.constants.MaxUint256);
                                });

                                it('does not decrease the spender allowance', async function () {
                                    await contract.connect(spenderWallet).transferFrom(tokenOwner, to, 1);
                                    const allowance = await contract.allowance(tokenOwner, spender);
                                    expect(allowance.toString()).to.be.equal(ethers.constants.MaxUint256.toString());
                                });

                                it('does not emit an approval event', async function () {
                                    await expect(await contract.connect(spenderWallet).transferFrom(tokenOwner, to, 1))
                                        .to.not.emit(contract, 'Approval');
                                });
                            });
                        });

                        describe('when the recipient is the zero address', function () {
                            let amount, to, tokenOwnerWallet;

                            beforeEach(async function () {
                                amount = initialSupply;
                                to = ethers.constants.AddressZero;
                                tokenOwnerWallet = accounts[0].wallet;
                                await contract.connect(tokenOwnerWallet).approve(spender, amount);
                            });

                            it('reverts', async function () {
                                await expectRevert(contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                    `CALL_EXCEPTION`);
                            });
                        });
                    });
                });
            });
        });
    }

    const expectRevert = async (promise, code) => {
        const tx = await promise;
        try {
            await tx.wait();
            Assertions.expectedError();
        }
        catch(e:any) {
            expect(e).to.exist;
            expect(e.code).to.eq(code);
        }
    };

    async function deployErc20(constructorArgs:any[] = [], contractJson) {
        const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, accounts[0].wallet);
        let contract = await factory.deploy(...constructorArgs);
        await contract.deployed();

        // re-init the contract with the deployed address
        const receipt = await relay.provider.getTransactionReceipt(contract.deployTransaction.hash);
        contract = new ethers.Contract(receipt.to, contractJson.abi, accounts[0].wallet);
        return contract;
    };

    const createHTS = async(tokenName, symbol, treasuryAccountId, initialSupply, adminPublicKey, abi) => {
        const hts = await servicesNode.createHTS({
            tokenName,
            symbol,
            treasuryAccountId,
            initialSupply,
            adminPublicKey
        });

        await servicesNode.associateHTSToken(accounts[0].accountId, hts.tokenId, accounts[0].privateKey);
        await servicesNode.associateHTSToken(accounts[1].accountId, hts.tokenId, accounts[1].privateKey);
        await servicesNode.associateHTSToken(accounts[2].accountId, hts.tokenId, accounts[2].privateKey);

        await servicesNode.approveHTSToken(accounts[0].accountId, hts.tokenId);
        await servicesNode.approveHTSToken(accounts[1].accountId, hts.tokenId);
        await servicesNode.approveHTSToken(accounts[2].accountId, hts.tokenId);

        await servicesNode.transferHTSToken(accounts[0].accountId, hts.tokenId, 10000);
        // await servicesNode.transferHTSToken(accounts[1].accountId, hts.tokenId, 10000, accounts[0].accountId);
        // await servicesNode.transferHTSToken(accounts[2].accountId, hts.tokenId, 10000, accounts[1].accountId);
        // await servicesNode.transferHTSToken(accounts[0].accountId, hts.tokenId, 10000, accounts[2].accountId);
        //
        //
        // await servicesNode.transferHTSToken(accounts[1].accountId, hts.tokenId, 10000);
        // await servicesNode.transferHTSToken(servicesNode.client.operatorAccountId, hts.tokenId, 10000, accounts[1].accountId);
        //
        // await servicesNode.transferHTSToken(accounts[2].accountId, hts.tokenId, 10000);
        // await servicesNode.transferHTSToken(servicesNode.client.operatorAccountId, hts.tokenId, 10000, accounts[2].accountId);

        const evmAddress = Utils.idToEvmAddress(hts.tokenId.toString());
        const contract = new ethers.Contract(evmAddress, abi, accounts[0].wallet);

        const balance0 = await contract.balanceOf(accounts[0].address);
        const balance1 = await contract.balanceOf(accounts[1].address);
        const balance2 = await contract.balanceOf(accounts[2].address);

        logger.info(`balance0: ${balance0}`);
        logger.info(`balance1: ${balance1}`);
        logger.info(`balance2: ${balance2}`);


        return contract;
    };
});