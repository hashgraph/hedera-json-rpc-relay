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
import ERC20DecimalsMockJson from '../contracts/ERC20DecimalsMock.json';

import Assertions from '../helpers/assertions';


describe('ERC20 Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    const CHAIN_ID = process.env.CHAIN_ID || 0;

    // @ts-ignore
    const {servicesNode, mirrorNode, relay} = global;

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

    // cached entities
    const accounts: AliasAccount[] = [];
    let contract;
    let initialHolder;
    let recipient;
    let anotherAccount;

    const name = 'My Token';
    const symbol = 'MTKN';


    const initialSupply = BigNumber.from(10000);

    const createContract = async (constructorArgs:any[] = [], contractJson) => {
        const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, accounts[0].wallet);
        let contract = await factory.deploy(...constructorArgs, {
            chainId: Number(CHAIN_ID),
            maxPriorityFeePerGas: 720000000000,
            maxFeePerGas: 720000000000,
            gasLimit: 300000,
            type: 2
        });

        await contract.deployed();

        // FIXME mirror node calls should not be made
        const contractResult = await mirrorNode.get(`/contracts/results/${contract.deployTransaction.hash}`);
        const mirrorContract = await mirrorNode.get(`/contracts/${contractResult.contract_id}`);
        contract = new ethers.Contract(mirrorContract.evm_address, contractJson.abi, accounts[0].wallet);
        return contract;
    };

    before(async () => {
        accounts[0] = await servicesNode.createAliasAccount(2000000000, relay.provider);
        accounts[1] = await servicesNode.createAliasAccount(200, relay.provider);
        accounts[2] = await servicesNode.createAliasAccount(200, relay.provider);

        initialHolder = accounts[0].address;
        recipient = accounts[1].address;
        anotherAccount = accounts[2].address;

        contract = await createContract([name, symbol, initialHolder, initialSupply], ERC20MockJson);
    });

    describe('Mocked ERC20 Contract', function () {
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
            expect(res).to.eq(ERC20MockJson.deployedBytecode);
        });

        describe('set decimals', function () {
            const decimals = 6;

            it('can set decimals during construction', async function () {

                const decimalsContract = await createContract([name, symbol, decimals], ERC20DecimalsMockJson);
                expect(await decimalsContract.decimals()).to.be.equal(decimals);
            });
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
                        tokenOwner = initialHolder;
                        tokenOwnerWallet = accounts[0].wallet;
                    });

                    describe('when the recipient is not the zero address', function () {
                        let to, toWallet;
                        before(async function () {
                            to = anotherAccount;
                            toWallet = accounts[2].wallet;
                        });

                        describe('when the spender has enough allowance', function () {
                            before(async function () {
                                await contract.approve(spender, initialSupply, { from: initialHolder });
                            });

                            describe('when the token owner has enough balance', function () {
                                let amount, tx, receipt;
                                before(async function () {
                                    amount = initialSupply;
                                    tx = await contract.connect(spenderWallet).transferFrom(tokenOwner, to, amount);
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
});
