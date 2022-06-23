const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS, MAX_UINT256 } = constants;

function shouldBehaveLikeERC20 (contract, errorPrefix, initialSupply, initialHolder, recipient, anotherAccount) {
    describe('total supply', function () {
        it('returns the total amount of tokens', async function () {
            try {
                const res = await contract.totalSupply();
            }
            catch(e) {
                console.log(e);
            }
            expect(await contract.totalSupply()).to.be.bignumber.equal(initialSupply);
        });
    });

    describe('balanceOf', function () {
        describe('when the requested account has no tokens', function () {
            it('returns zero', async function () {
                expect(await contract.balanceOf(anotherAccount)).to.be.bignumber.equal('0');
            });
        });

        describe('when the requested account has some tokens', function () {
            it('returns the total amount of tokens', async function () {
                expect(await contract.balanceOf(initialHolder)).to.be.bignumber.equal(initialSupply);
            });
        });
    });

    describe('transfer', function () {
        shouldBehaveLikeERC20Transfer(contract, errorPrefix, initialHolder, recipient, initialSupply,
            function (from, to, value) {
                return contract.transfer(to, value, { from });
            },
        );
    });

    describe('transfer from', function () {
        const spender = recipient;

        describe('when the token owner is not the zero address', function () {
            const tokenOwner = initialHolder;

            describe('when the recipient is not the zero address', function () {
                const to = anotherAccount;

                describe('when the spender has enough allowance', function () {
                    beforeEach(async function () {
                        await contract.approve(spender, initialSupply, { from: initialHolder });
                    });

                    describe('when the token owner has enough balance', function () {
                        const amount = initialSupply;

                        it('transfers the requested amount', async function () {
                            await contract.transferFrom(tokenOwner, to, amount, { from: spender });

                            expect(await contract.balanceOf(tokenOwner)).to.be.bignumber.equal('0');

                            expect(await contract.balanceOf(to)).to.be.bignumber.equal(amount);
                        });

                        it('decreases the spender allowance', async function () {
                            expect(await contract.allowance(tokenOwner, spender)).to.be.bignumber.equal('0');
                        });

                        it('emits a transfer event', async function () {
                            expectEvent(
                                await contract.transferFrom(tokenOwner, to, amount, { from: spender }),
                                'Transfer',
                                { from: tokenOwner, to: to, value: amount },
                            );
                        });

                        it('emits an approval event', async function () {
                            expectEvent(
                                await contract.transferFrom(tokenOwner, to, amount, { from: spender }),
                                'Approval',
                                { owner: tokenOwner, spender: spender, value: await contract.allowance(tokenOwner, spender) },
                            );
                        });
                    });

                    describe('when the token owner does not have enough balance', function () {
                        const amount = initialSupply;

                        beforeEach('reducing balance', async function () {
                            await contract.transfer(to, 1, { from: tokenOwner });
                        });

                        it('reverts', async function () {
                            await expectRevert(
                                contract.transferFrom(tokenOwner, to, amount, { from: spender }),
                                `${errorPrefix}: transfer amount exceeds balance`,
                            );
                        });
                    });
                });

                describe('when the spender does not have enough allowance', function () {
                    const allowance = initialSupply.sub(1);

                    beforeEach(async function () {
                        await contract.approve(spender, allowance, { from: tokenOwner });
                    });

                    describe('when the token owner has enough balance', function () {
                        const amount = initialSupply;

                        it('reverts', async function () {
                            await expectRevert(
                                contract.transferFrom(tokenOwner, to, amount, { from: spender }),
                                `${errorPrefix}: insufficient allowance`,
                            );
                        });
                    });

                    describe('when the token owner does not have enough balance', function () {
                        const amount = allowance;

                        beforeEach('reducing balance', async function () {
                            await contract.transfer(to, 2, { from: tokenOwner });
                        });

                        it('reverts', async function () {
                            await expectRevert(
                                contract.transferFrom(tokenOwner, to, amount, { from: spender }),
                                `${errorPrefix}: transfer amount exceeds balance`,
                            );
                        });
                    });
                });

                describe('when the spender has unlimited allowance', function () {
                    beforeEach(async function () {
                        await contract.approve(spender, MAX_UINT256, { from: initialHolder });
                    });

                    it('does not decrease the spender allowance', async function () {
                        await contract.transferFrom(tokenOwner, to, 1, { from: spender });

                        expect(await contract.allowance(tokenOwner, spender)).to.be.bignumber.equal(MAX_UINT256);
                    });

                    it('does not emit an approval event', async function () {
                        expectEvent.notEmitted(
                            await contract.transferFrom(tokenOwner, to, 1, { from: spender }),
                            'Approval',
                        );
                    });
                });
            });

            describe('when the recipient is the zero address', function () {
                const amount = initialSupply;
                const to = ZERO_ADDRESS;

                beforeEach(async function () {
                    await contract.approve(spender, amount, { from: tokenOwner });
                });

                it('reverts', async function () {
                    await expectRevert(contract.transferFrom(
                        tokenOwner, to, amount, { from: spender }), `${errorPrefix}: transfer to the zero address`,
                    );
                });
            });
        });

        describe('when the token owner is the zero address', function () {
            const amount = 0;
            const tokenOwner = ZERO_ADDRESS;
            const to = recipient;

            it('reverts', async function () {
                await expectRevert(
                    contract.transferFrom(tokenOwner, to, amount, { from: spender }),
                    'from the zero address',
                );
            });
        });
    });

    describe('approve', function () {
        shouldBehaveLikeERC20Approve(contract, errorPrefix, initialHolder, recipient, initialSupply,
            function (owner, spender, amount) {
                return contract.approve(spender, amount, { from: owner });
            },
        );
    });
}

function shouldBehaveLikeERC20Transfer (contract, errorPrefix, from, to, balance, transfer) {
    describe('when the recipient is not the zero address', function () {
        describe('when the sender does not have enough balance', function () {
            const amount = balance.add(1);

            it('reverts', async function () {
                await expectRevert(transfer.call(this, from, to, amount),
                    `${errorPrefix}: transfer amount exceeds balance`,
                );
            });
        });

        describe('when the sender transfers all balance', function () {
            const amount = balance;

            it('transfers the requested amount', async function () {
                await transfer.call(this, from, to, amount);

                expect(await contract.balanceOf(from)).to.be.bignumber.equal('0');

                expect(await contract.balanceOf(to)).to.be.bignumber.equal(amount);
            });

            it('emits a transfer event', async function () {
                expectEvent(
                    await transfer.call(this, from, to, amount),
                    'Transfer',
                    { from, to, value: amount },
                );
            });
        });

        describe('when the sender transfers zero tokens', function () {
            const amount = new BN('0');

            it('transfers the requested amount', async function () {
                await transfer.call(this, from, to, amount);

                expect(await contract.balanceOf(from)).to.be.bignumber.equal(balance);

                expect(await contract.balanceOf(to)).to.be.bignumber.equal('0');
            });

            it('emits a transfer event', async function () {
                expectEvent(
                    await transfer.call(this, from, to, amount),
                    'Transfer',
                    { from, to, value: amount },
                );
            });
        });
    });

    describe('when the recipient is the zero address', function () {
        it('reverts', async function () {
            await expectRevert(transfer.call(this, from, ZERO_ADDRESS, balance),
                `${errorPrefix}: transfer to the zero address`,
            );
        });
    });
}

function shouldBehaveLikeERC20Approve (contract, errorPrefix, owner, spender, supply, approve) {
    describe('when the spender is not the zero address', function () {
        describe('when the sender has enough balance', function () {
            const amount = supply;

            it('emits an approval event', async function () {
                expectEvent(
                    await approve.call(this, owner, spender, amount),
                    'Approval',
                    { owner: owner, spender: spender, value: amount },
                );
            });

            describe('when there was no approved amount before', function () {
                it('approves the requested amount', async function () {
                    await approve.call(this, owner, spender, amount);

                    expect(await contract.allowance(owner, spender)).to.be.bignumber.equal(amount);
                });
            });

            describe('when the spender had an approved amount', function () {
                beforeEach(async function () {
                    await approve.call(this, owner, spender, new BN(1));
                });

                it('approves the requested amount and replaces the previous one', async function () {
                    await approve.call(this, owner, spender, amount);

                    expect(await contract.allowance(owner, spender)).to.be.bignumber.equal(amount);
                });
            });
        });

        describe('when the sender does not have enough balance', function () {
            const amount = supply.add(1);

            it('emits an approval event', async function () {
                expectEvent(
                    await approve.call(this, owner, spender, amount),
                    'Approval',
                    { owner: owner, spender: spender, value: amount },
                );
            });

            describe('when there was no approved amount before', function () {
                it('approves the requested amount', async function () {
                    await approve.call(this, owner, spender, amount);

                    expect(await contract.allowance(owner, spender)).to.be.bignumber.equal(amount);
                });
            });

            describe('when the spender had an approved amount', function () {
                beforeEach(async function () {
                    await approve.call(this, owner, spender, new BN(1));
                });

                it('approves the requested amount and replaces the previous one', async function () {
                    await approve.call(this, owner, spender, amount);

                    expect(await contract.allowance(owner, spender)).to.be.bignumber.equal(amount);
                });
            });
        });
    });

    describe('when the spender is the zero address', function () {
        it('reverts', async function () {
            await expectRevert(approve.call(this, owner, ZERO_ADDRESS, supply),
                `${errorPrefix}: approve to the zero address`,
            );
        });
    });
}

module.exports = {
    shouldBehaveLikeERC20,
    shouldBehaveLikeERC20Transfer,
    shouldBehaveLikeERC20Approve,
};