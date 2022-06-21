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
import { BN, constants, expectEvent, expectRevert} from '@openzeppelin/test-helpers';
import { AliasAccount } from '../clients/servicesClient';
import { ethers, BigNumber } from 'ethers';

import ERC20MockJson from '../contracts/ERC20Mock.json';
import ERC20DecimalsMockJson from '../contracts/ERC20DecimalsMock.json';

import {expect} from "chai";
const { ZERO_ADDRESS } = constants;
import {
    shouldBehaveLikeERC20,
    shouldBehaveLikeERC20Transfer,
    shouldBehaveLikeERC20Approve,
} from '../helpers/erc20.behaviour';

describe('ERC20 Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    const CHAIN_ID = process.env.CHAIN_ID || 0;

    // @ts-ignore
    const {servicesNode, mirrorNode, relay, logger} = global;


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
        // contract = await servicesNode.deployContract(erc20Json, 2000000, new Uint8Array(), initialSupply);
        // const initialBalance = BigNumber.from(new Hbar(100).toTinybars().toString()).mul(10 ** 10);

        const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, accounts[0].wallet);
        let contract = await factory.deploy(...constructorArgs, {
            chainId: Number(CHAIN_ID),
            maxPriorityFeePerGas: 720000000000,
            maxFeePerGas: 720000000000,
            gasLimit: 300000,
            type: 2
        });

        // FIXME Temporary workaround until .deployed() and .wait() issues are resolved
        // await contract.deployed();
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

        it('test test', function () {
            shouldBehaveLikeERC20(contract, 'ERC20', initialSupply, initialHolder, recipient, anotherAccount);
        });

        // describe('decrease allowance', function () {
        //     describe('when the spender is not the zero address', function () {
        //         const spender = recipient;
        //
        //         function shouldDecreaseApproval(amount) {
        //             describe('when there was no approved amount before', function () {
        //                 it('reverts', async function () {
        //                     await expectRevert(contract.decreaseAllowance(
        //                         spender, amount, {from: initialHolder}), 'ERC20: decreased allowance below zero',
        //                     );
        //                 });
        //             });
        //
        //             describe('when the spender had an approved amount', function () {
        //                 const approvedAmount = amount;
        //
        //                 beforeEach(async function () {
        //                     await contract.approve(spender, approvedAmount, {from: initialHolder});
        //                 });
        //
        //                 it('emits an approval event', async function () {
        //                     expectEvent(
        //                         await contract.decreaseAllowance(spender, approvedAmount, {from: initialHolder}),
        //                         'Approval',
        //                         {owner: initialHolder, spender: spender, value: new BN(0)},
        //                     );
        //                 });
        //
        //                 it('decreases the spender allowance subtracting the requested amount', async function () {
        //                     await contract.decreaseAllowance(spender, approvedAmount.sub(1), {from: initialHolder});
        //
        //                     expect(await contract.allowance(initialHolder, spender)).to.be.bignumber.equal('1');
        //                 });
        //
        //                 it('sets the allowance to zero when all allowance is removed', async function () {
        //                     await contract.decreaseAllowance(spender, approvedAmount, {from: initialHolder});
        //                     expect(await contract.allowance(initialHolder, spender)).to.be.bignumber.equal('0');
        //                 });
        //
        //                 it('reverts when more than the full allowance is removed', async function () {
        //                     await expectRevert(
        //                         contract.decreaseAllowance(spender, approvedAmount.add(1), {from: initialHolder}),
        //                         'ERC20: decreased allowance below zero',
        //                     );
        //                 });
        //             });
        //         }
        //
        //         describe('when the sender has enough balance', function () {
        //             const amount = initialSupply;
        //
        //             shouldDecreaseApproval(amount);
        //         });
        //
        //         describe('when the sender does not have enough balance', function () {
        //             const amount = initialSupply.add(1);
        //
        //             shouldDecreaseApproval(amount);
        //         });
        //     });
        //
        //     describe('when the spender is the zero address', function () {
        //         const amount = initialSupply;
        //         const spender = ZERO_ADDRESS;
        //
        //         it('reverts', async function () {
        //             await expectRevert(contract.decreaseAllowance(
        //                 spender, amount, {from: initialHolder}), 'ERC20: decreased allowance below zero',
        //             );
        //         });
        //     });
        // });

        /*

        describe('increase allowance', function () {
            const amount = initialSupply;

            describe('when the spender is not the zero address', function () {
                const spender = recipient;

                describe('when the sender has enough balance', function () {
                    it('emits an approval event', async function () {
                        expectEvent(
                            await contract.increaseAllowance(spender, amount, {from: initialHolder}),
                            'Approval',
                            {owner: initialHolder, spender: spender, value: amount},
                        );
                    });

                    describe('when there was no approved amount before', function () {
                        it('approves the requested amount', async function () {
                            await contract.increaseAllowance(spender, amount, {from: initialHolder});

                            expect(await contract.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
                        });
                    });

                    describe('when the spender had an approved amount', function () {
                        beforeEach(async function () {
                            await contract.approve(spender, new BN(1), {from: initialHolder});
                        });

                        it('increases the spender allowance adding the requested amount', async function () {
                            await contract.increaseAllowance(spender, amount, {from: initialHolder});

                            expect(await contract.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.add(1));
                        });
                    });
                });

                describe('when the sender does not have enough balance', function () {
                    const amount = initialSupply.add(1);

                    it('emits an approval event', async function () {
                        expectEvent(
                            await contract.increaseAllowance(spender, amount, {from: initialHolder}),
                            'Approval',
                            {owner: initialHolder, spender: spender, value: amount},
                        );
                    });

                    describe('when there was no approved amount before', function () {
                        it('approves the requested amount', async function () {
                            await contract.increaseAllowance(spender, amount, {from: initialHolder});

                            expect(await contract.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
                        });
                    });

                    describe('when the spender had an approved amount', function () {
                        beforeEach(async function () {
                            await contract.approve(spender, new BN(1), {from: initialHolder});
                        });

                        it('increases the spender allowance adding the requested amount', async function () {
                            await contract.increaseAllowance(spender, amount, {from: initialHolder});

                            expect(await contract.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.add(1));
                        });
                    });
                });
            });

            describe('when the spender is the zero address', function () {
                const spender = ZERO_ADDRESS;

                it('reverts', async function () {
                    await expectRevert(
                        contract.increaseAllowance(spender, amount, {from: initialHolder}), 'ERC20: approve to the zero address',
                    );
                });
            });
        });

        describe('_mint', function () {
            const amount = new BN(50);
            it('rejects a null account', async function () {
                await expectRevert(
                    contract.mint(ZERO_ADDRESS, amount), 'ERC20: mint to the zero address',
                );
            });

            describe('for a non zero account', function () {
                beforeEach('minting', async function () {
                    this.receipt = await contract.mint(recipient, amount);
                });

                it('increments totalSupply', async function () {
                    const expectedSupply = initialSupply.add(amount);
                    expect(await contract.totalSupply()).to.be.bignumber.equal(expectedSupply);
                });

                it('increments recipient balance', async function () {
                    expect(await contract.balanceOf(recipient)).to.be.bignumber.equal(amount);
                });

                it('emits Transfer event', async function () {
                    const event = expectEvent(
                        this.receipt,
                        'Transfer',
                        {from: ZERO_ADDRESS, to: recipient},
                    );

                    expect(event.args.value).to.be.bignumber.equal(amount);
                });
            });
        });

        describe('_burn', function () {
            it('rejects a null account', async function () {
                await expectRevert(contract.burn(ZERO_ADDRESS, new BN(1)),
                    'ERC20: burn from the zero address');
            });

            describe('for a non zero account', function () {
                it('rejects burning more than balance', async function () {
                    await expectRevert(contract.burn(
                        initialHolder, initialSupply.add(1)), 'ERC20: burn amount exceeds balance',
                    );
                });

                const describeBurn = function (description, amount) {
                    describe(description, function () {
                        beforeEach('burning', async function () {
                            this.receipt = await contract.burn(initialHolder, amount);
                        });

                        it('decrements totalSupply', async function () {
                            const expectedSupply = initialSupply.sub(amount);
                            expect(await contract.totalSupply()).to.be.bignumber.equal(expectedSupply);
                        });

                        it('decrements initialHolder balance', async function () {
                            const expectedBalance = initialSupply.sub(amount);
                            expect(await contract.balanceOf(initialHolder)).to.be.bignumber.equal(expectedBalance);
                        });

                        it('emits Transfer event', async function () {
                            const event = expectEvent(
                                this.receipt,
                                'Transfer',
                                {from: initialHolder, to: ZERO_ADDRESS},
                            );

                            expect(event.args.value).to.be.bignumber.equal(amount);
                        });
                    });
                };

                describeBurn('for entire balance', initialSupply);
                describeBurn('for less amount than balance', initialSupply.sub(1));
            });
        });

        describe('_transfer', function () {
            shouldBehaveLikeERC20Transfer(contract, 'ERC20', initialHolder, recipient, initialSupply, function (from, to, amount) {
                return contract.transferInternal(from, to, amount);
            });

            describe('when the sender is the zero address', function () {
                it('reverts', async function () {
                    await expectRevert(contract.transferInternal(ZERO_ADDRESS, recipient, initialSupply),
                        'ERC20: transfer from the zero address',
                    );
                });
            });
        });

        describe('_approve', function () {
            shouldBehaveLikeERC20Approve(contract, 'ERC20', initialHolder, recipient, initialSupply, function (owner, spender, amount) {
                return contract.approveInternal(owner, spender, amount);
            });

            describe('when the owner is the zero address', function () {
                it('reverts', async function () {
                    await expectRevert(contract.approveInternal(ZERO_ADDRESS, recipient, initialSupply),
                        'ERC20: approve from the zero address',
                    );
                });
            });
        });
        */
    });
});
