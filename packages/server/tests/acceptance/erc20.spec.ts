/*-
 *
 * Hedera JSON RPC Relay
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

// external resources
import { solidity } from "ethereum-waffle";
import chai, { expect } from "chai";
chai.use(solidity);

import { AliasAccount } from '../clients/servicesClient';
import { Utils } from '../helpers/utils';
import { ethers, BigNumber } from 'ethers';
import ERC20MockJson from '../contracts/ERC20Mock.json';
import Assertions from '../helpers/assertions';
import { EthImpl } from "@hashgraph/json-rpc-relay/src/lib/eth";
import Constants from '../../../server/tests/helpers/constants';

const extractRevertReason = (errorReason: string) => {
    const pattern = /(?<=reverted: ).*/;
    return errorReason.match(pattern)?.[0] || '';
};

describe('@erc20 Acceptance Tests', async function () {
    this.timeout(240 * 1000); // 240 seconds
    const { servicesNode, relay }: any = global;

    // cached entities
    const accounts: AliasAccount[] = [];
    let initialHolder;
    let recipient;
    let anotherAccount;
    let requestId;

    const contracts: [any] = [];

    const name = Utils.randomString(10);
    const symbol = Utils.randomString(5);
    const initialSupply = BigNumber.from(10000);

    const ERC20 = 'ERC20 Contract';
    const HTS = 'HTS token';

    const testTitles = [
        { testName: ERC20, expectedBytecode: ERC20MockJson.deployedBytecode },
        { testName: HTS }
    ];

    this.beforeAll(async () => {
        requestId = Utils.generateRequestId();

        accounts[0] = await servicesNode.createAliasAccount(60, relay.provider, requestId);
        accounts[1] = await servicesNode.createAliasAccount(30, relay.provider, requestId);
        accounts[2] = await servicesNode.createAliasAccount(30, relay.provider, requestId);

        initialHolder = accounts[0].address;
        recipient = accounts[1].address;
        anotherAccount = accounts[2].address;

        // allow mirror node a 5 full record stream write windows (5 sec) and a buffer to persist setup details
        await new Promise(r => setTimeout(r, 5000));

        contracts.push(await Utils.deployContractWithEthers([name, symbol, initialHolder, initialSupply], ERC20MockJson, accounts[0].wallet, relay));
        contracts.push(await Utils.createHTS(name, symbol, accounts[0], 10000, ERC20MockJson.abi, [accounts[1], accounts[2]], accounts[0], servicesNode, requestId));
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

            describe('should behave like erc20', function () {
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

                                it('@release contract owner transfers tokens', async function () {
                                    tx = await contract.connect(tokenOwnerWallet).transfer(to, amount);
                                    // 5 seconds sleep to propagate the changes to mirror node
                                    await new Promise(r => setTimeout(r, 5000));
                                    const ownerBalance = await contract.balanceOf(tokenOwner);
                                    const toBalance = await contract.balanceOf(to);
                                    expect(ownerBalance.toString()).to.be.equal('0');
                                    expect(toBalance.toString()).to.be.equal(amount.toString());

                                });

                                it('emits a transfer event', async function () {
                                    const transferEvent = (await tx.wait()).events.filter(e => e.event === Constants.HTS_CONTRACT_EVENTS.Transfer)[0].args;
                                    expect(transferEvent.from).to.eq(tokenOwnerWallet.address);
                                    expect(transferEvent.to).to.eq(toWallet.address);
                                    expect(transferEvent.value).to.eq(amount);
                                });

                                it('other account transfers tokens back to owner', async function () {
                                    tx = await contract.connect(toWallet).transfer(tokenOwner, amount);
                                    // 5 seconds sleep to propagate the changes to mirror node
                                    await new Promise(r => setTimeout(r, 5000));
                                    const ownerBalance = await contract.balanceOf(tokenOwner);
                                    const toBalance = await contract.balanceOf(to);
                                    expect(ownerBalance.toString()).to.be.equal(amount.toString());
                                    expect(toBalance.toString()).to.be.equal('0');
                                });
                            });

                            describe('when the spender has enough allowance', function () {
                                let tx, receipt;
                                before(async function () {
                                    tx = await contract.connect(tokenOwnerWallet).approve(spender, initialSupply, await Utils.gasOptions(requestId));
                                    receipt = await tx.wait();
                                    // 5 seconds sleep to propagate the changes to mirror node
                                    await new Promise(r => setTimeout(r, 5000));
                                });

                                it('emits an approval event', async function () {
                                    const allowance = await contract.allowance(tokenOwner, spender);
                                    const approvalEvent = (await tx.wait()).events.filter(e => e.event === Constants.HTS_CONTRACT_EVENTS.Approval)[0].args;
                                    expect(approvalEvent.owner).to.eq(tokenOwnerWallet.address);
                                    expect(approvalEvent.spender).to.eq(spenderWallet.address);
                                    expect(approvalEvent.value).to.eq(allowance);
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
                                        tx = await contract.connect(spenderWallet).transferFrom(tokenOwner, to, initialSupply, await Utils.gasOptions(requestId));
                                        const receipt = await tx.wait();
                                        // 5 seconds sleep to propagate the changes to mirror node
                                        await new Promise(r => setTimeout(r, 5000));
                                        const ownerBalance = await contract.balanceOf(tokenOwner);
                                        const toBalance = await contract.balanceOf(to);
                                        expect(ownerBalance.toString()).to.be.equal('0');
                                        expect(toBalance.toString()).to.be.equal(amount.toString());

                                        const allowance = await contract.allowance(tokenOwner, spender);
                                        expect(allowance.toString()).to.be.equal('0');
                                    });

                                    it('decreases the spender allowance', async function () {
                                        const allowance = await contract.allowance(tokenOwner, spender);
                                        expect(allowance.toString()).to.be.equal('0');
                                    });

                                    it('emits a transfer event', async function () {
                                        const transferEvent = (await tx.wait()).events.filter(e => e.event === Constants.HTS_CONTRACT_EVENTS.Transfer)[0].args;
                                        expect(transferEvent.from).to.eq(tokenOwnerWallet.address);
                                        expect(transferEvent.to).to.eq(toWallet.address);
                                        expect(transferEvent.value).to.eq(amount);
                                    });
                                });

                                describe('when the token owner does not have enough balance', function () {
                                    let amount;

                                    beforeEach('reducing balance', async function () {
                                        amount = initialSupply;
                                        // await contract.connect(tokenOwnerWallet).approve(spender, initialSupply, await Utils.gasOptions(requestId));
                                        // await contract.transfer(to, 1, await Utils.gasOptions(1_500_000));
                                        // // 5 seconds sleep to propagate the changes to mirror node
                                        // await new Promise(r => setTimeout(r, 5000));                                        
                                    });

                                    it('reverts', async function () {
                                     try {
                                        await contract.connect(tokenOwnerWallet).approve(spender, initialSupply, await Utils.gasOptions(requestId));
                                        await contract.transfer(to, 1, await Utils.gasOptions(1_500_000));
                                        // 5 seconds sleep to propagate the changes to mirror node
                                        await new Promise(r => setTimeout(r, 5000));     

                                        await Assertions.expectRevert(
                                            contract.connect(spenderWallet).transferFrom(tokenOwner, to, initialSupply),
                                            Constants.CALL_EXCEPTION
                                        );
                                     }catch(e){
                                        // eth_estimateGas gets called by ethers
                                        // so we need to catch the error and check that the reason is the expected one,
                                        // in addition to validating the CALL_EXCEPTION   
                                        expect(extractRevertReason(e.error.reason)).to.be.equal('ERC20: transfer amount exceeds balance');
                                     }
                                    });
                                });
                            });

                            describe('when the spender does not have enough allowance', function () {
                                let allowance;

                                before(async function () {
                                    allowance = initialSupply.sub(1);
                                });

                                beforeEach(async function () {
                                    await contract.approve(spender, allowance, await Utils.gasOptions(requestId));
                                });

                                describe('when the token owner has enough balance', function () {
                                    let amount;
                                    before(async function () {
                                        // allowance = initialSupply.sub(1);
                                        amount = initialSupply;
                                        // await contract.approve(spender, allowance, await Utils.gasOptions(requestId));
                                    });

                                    it('reverts', async function () {
                                        try {
                                            await Assertions.expectRevert(contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                            Constants.CALL_EXCEPTION);
                                        } catch(e) {
                                            // eth_estimateGas gets called by ethers
                                            // so we need to catch the error and check that the reason is the expected one,
                                            // in addition to validating the CALL_EXCEPTION   
                                            expect(extractRevertReason(e.error.reason)).to.be.equal('ERC20: insufficient allowance');                                            
                                        }                                          
                                    });
                                });

                                describe('when the token owner does not have enough balance', function () {
                                    let amount;
                                    before(async function () {
                                        amount = allowance;
                                    });

                                    beforeEach('reducing balance', async function () {
                                        await contract.transfer(to, 2, await Utils.gasOptions(1_500_000));
                                    });

                                    it('reverts', async function () {
                                        try {
                                            await Assertions.expectRevert(contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                            Constants.CALL_EXCEPTION);
                                        } catch(e) {
                                            // eth_estimateGas gets called by ethers
                                            // so we need to catch the error and check that the reason is the expected one,
                                            // in addition to validating the CALL_EXCEPTION   
                                            expect(extractRevertReason(e.error.reason)).to.be.equal('ERC20: transfer amount exceeds balance');                                     
                                        }                                                                               
                                    });
                                });
                            });

                            describe('@release when the spender has unlimited allowance', function () {
                                beforeEach(async function () {
                                    await contract.connect(tokenOwnerWallet).approve(spender, ethers.constants.MaxUint256, await Utils.gasOptions(requestId));

                                    // 5 seconds sleep to propagate the changes to mirror node
                                    await new Promise(r => setTimeout(r, 5000));
                                });

                                if (testTitles[i].testName !== HTS) {
                                    it('does not decrease the spender allowance', async function () {
                                        try{
                                            await contract.connect(spenderWallet).transferFrom(tokenOwner, to, 1);
                                        }catch(e){
                                            // eth_estimateGas gets called by ethers
                                            // so we need to catch the error and check that the reason is the expected one,
                                            // in addition to validating the allowance   
                                            expect(extractRevertReason(e.error.reason)).to.be.equal('ERC20: transfer amount exceeds balance');                                              
                                        }
                                        
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
                                // tokenOwnerWallet = accounts[2].wallet;
                                await contract.connect(tokenOwnerWallet).approve(spender, amount, await Utils.gasOptions(requestId, 1_500_000));
                            });

                            it('reverts', async function () {
                                try {
                                    await Assertions.expectRevert(contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount),
                                    Constants.CALL_EXCEPTION);
                                } catch(e) {
                                    // eth_estimateGas gets called by ethers
                                    // so we need to catch the error and check that the reason is the expected one,
                                    // in addition to validating the CALL_EXCEPTION   
                                    expect(extractRevertReason(e.error.reason)).to.be.equal('ERC20: transfer to the zero address');                                                                         
                                }
                            });
                        });
                    });
                });
            });
        });
    }
});
