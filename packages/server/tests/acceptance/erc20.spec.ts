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
import { EthImpl } from "@hashgraph/json-rpc-relay/src/lib/eth";


describe('@erc20 Acceptance Tests', async function () {
    this.timeout(240 * 1000); // 240 seconds
    const {servicesNode, relay} = global;

    // cached entities
    const accounts: AliasAccount[] = [];
    let initialHolder;
    let recipient;
    let anotherAccount;
    let requestId;

    const contracts:[any] = [];

    const name = Utils.randomString(10);
    const symbol = Utils.randomString(5);
    const initialSupply = BigNumber.from(10000);

    const ERC20 = 'ERC20 Contract';
    const HTS = 'HTS token';

    const testTitles = [
        {testName: ERC20, expectedBytecode: ERC20MockJson.deployedBytecode},
        {testName: HTS}
    ];

    this.beforeAll(async () => {
        requestId = Utils.generateRequestId();

        accounts[0] = await servicesNode.createAliasAccount(30, relay.provider, requestId);
        accounts[1] = await servicesNode.createAliasAccount(15, relay.provider, requestId);
        accounts[2] = await servicesNode.createAliasAccount(15, relay.provider, requestId);

        initialHolder = accounts[0].address;
        recipient = accounts[1].address;
        anotherAccount = accounts[2].address;

        // alow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
        await new Promise(r => setTimeout(r, 5000));

        contracts.push(await deployErc20([name, symbol, initialHolder, initialSupply], ERC20MockJson));
        contracts.push(await createHTS(name, symbol, accounts[0], 10000, ERC20MockJson.abi, [accounts[1], accounts[2]]));
    });

    this.beforeEach(async () => {
        requestId = Utils.generateRequestId();
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
                const res = await relay.call('eth_getCode', [contract.address, 'latest'], requestId);
                const expectedBytecode = `${EthImpl.redirectBytecodePrefix}${contract.address.slice(2)}${EthImpl.redirectBytecodePostfix}`
                if (testTitles[i].testName !== HTS) {
                    expect(res).to.eq(testTitles[i].expectedBytecode);
                } else {
                    expect(res).to.eq(expectedBytecode);
                }
            });

            describe('should behave like erc20', function() {
                describe('total supply', function () {
                    it('@release returns the total amount of tokens', async function () {
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
                        it('@release returns the total amount of tokens', async function () {
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

                            describe('when the spender has enough tokens', function () {
                                let amount, tx;
                                before(async function () {
                                    amount = initialSupply;
                                });

                                it ('@release contract owner transfers tokens', async function () {
                                    tx = await contract.connect(tokenOwnerWallet).transfer(to, amount);
                                    const ownerBalance = await contract.balanceOf(tokenOwner);
                                    const toBalance = await contract.balanceOf(to);
                                    expect(ownerBalance.toString()).to.be.equal('0');
                                    expect(toBalance.toString()).to.be.equal(amount.toString());

                                });

                                it('emits a transfer event', async function () {
                                    await expect(tx)
                                        .to.emit(contract, 'Transfer')
                                        .withArgs(tokenOwnerWallet.address, toWallet.address, amount);
                                });

                                it ('other account transfers tokens back to owner', async function () {
                                    tx = await contract.connect(toWallet).transfer(tokenOwner, amount);
                                    const ownerBalance = await contract.balanceOf(tokenOwner);
                                    const toBalance = await contract.balanceOf(to);
                                    expect(ownerBalance.toString()).to.be.equal(amount.toString());
                                    expect(toBalance.toString()).to.be.equal('0');
                                });
                            });

                            describe('when the spender has enough allowance', function () {
                                let tx, receipt;
                                before(async function () {
                                    tx = await contract.connect(tokenOwnerWallet).approve(spender, initialSupply, {gasLimit: 1_000_000});
                                    receipt = await tx.wait();
                                });

                                it('emits an approval event', async function () {
                                    const allowance = await contract.allowance(tokenOwner, spender);
                                    await expect(tx)
                                        .to.emit(contract, 'Approval')
                                        .withArgs(tokenOwnerWallet.address, spenderWallet.address, allowance);
                                });

                                describe('when the token owner has enough balance', function () {
                                    let amount, tx;
                                    before(async function () {
                                        amount = initialSupply;
                                        const ownerBalance = await contract.balanceOf(tokenOwner);
                                        const toBalance = await contract.balanceOf(to);
                                        expect(ownerBalance.toString()).to.be.equal(amount.toString());
                                        expect(toBalance.toString()).to.be.equal('0');
                                    });

                                    it('transfers the requested amount', async function () {
                                        tx = await contract.connect(spenderWallet).transferFrom(tokenOwner, to, initialSupply, {gasLimit: 1_000_000});
                                        const receipt = await tx.wait();
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
                                });

                                describe('when the token owner does not have enough balance', function () {
                                    let amount;

                                    beforeEach('reducing balance', async function () {
                                        amount = initialSupply;
                                        await contract.transfer(to, 1);
                                    });

                                    it('reverts', async function () {
                                        await Assertions.expectRevert(
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
                                    await contract.approve(spender, allowance, {gasLimit: 1_000_000});
                                });

                                describe('when the token owner has enough balance', function () {
                                    let amount;
                                    before(async function () {
                                        amount = initialSupply;
                                    });

                                    it('reverts', async function () {
                                        await Assertions.expectRevert(
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
                                        await contract.transfer(to, 2);
                                    });

                                    it('reverts', async function () {
                                        await Assertions.expectRevert(
                                            contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                            `CALL_EXCEPTION`,
                                        );
                                    });
                                });
                            });

                            describe('@release when the spender has unlimited allowance', function () {
                                beforeEach(async function () {
                                    await contract.connect(tokenOwnerWallet).approve(spender, ethers.constants.MaxUint256, {gasLimit: 1_000_000});
                                });

                                if (testTitles[i].testName !== HTS) {
                                    it('does not decrease the spender allowance', async function () {
                                        await contract.connect(spenderWallet).transferFrom(tokenOwner, to, 1);
                                        const allowance = await contract.allowance(tokenOwner, spender);
                                        expect(allowance.toString()).to.be.equal(ethers.constants.MaxUint256.toString());
                                    });
                                }
                                else {
                                    it('decreases the spender allowance', async function () {
                                        await contract.connect(spenderWallet).transferFrom(tokenOwner, to, 1);
                                        const allowance = await contract.allowance(tokenOwner, spender);
                                        expect(allowance.toString()).to.be.equal((initialSupply.toNumber() - 1).toString());
                                    });
                                }
                            });
                        });

                        describe('when the recipient is the zero address', function () {
                            let amount, to, tokenOwnerWallet;

                            beforeEach(async function () {
                                amount = initialSupply;
                                to = ethers.constants.AddressZero;
                                tokenOwnerWallet = accounts[0].wallet;
                                await contract.connect(tokenOwnerWallet).approve(spender, amount, {gasLimit: 1_000_000});
                            });

                            it('reverts', async function () {
                                await Assertions.expectRevert(contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                    `CALL_EXCEPTION`);
                            });
                        });
                    });
                });
            });
        });
    }


    async function deployErc20(constructorArgs:any[] = [], contractJson) {
        const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, accounts[0].wallet);
        let contract = await factory.deploy(...constructorArgs);
        await contract.deployed();

        // re-init the contract with the deployed address
        const receipt = await relay.provider.getTransactionReceipt(contract.deployTransaction.hash);
        contract = new ethers.Contract(receipt.to, contractJson.abi, accounts[0].wallet);
        return contract;
    }

    const createHTS = async(tokenName, symbol, adminAccount, initialSupply, abi, associatedAccounts) => {
        const htsResult = await servicesNode.createHTS({
            tokenName,
            symbol,
            treasuryAccountId: adminAccount.accountId.toString(),
            initialSupply,
            adminPrivateKey: adminAccount.privateKey,
        });

        // Associate and approve token for all accounts
        for (const account of associatedAccounts) {
            await servicesNode.associateHTSToken(account.accountId, htsResult.receipt.tokenId, account.privateKey, htsResult.client, requestId);
            await servicesNode.approveHTSToken(account.accountId, htsResult.receipt.tokenId, htsResult.client, requestId);
        }

        // Setup initial balance of token owner account
        await servicesNode.transferHTSToken(accounts[0].accountId, htsResult.receipt.tokenId, initialSupply, htsResult.client, requestId);
        const evmAddress = Utils.idToEvmAddress(htsResult.receipt.tokenId.toString());
        return new ethers.Contract(evmAddress, abi, accounts[0].wallet);
    };
});
