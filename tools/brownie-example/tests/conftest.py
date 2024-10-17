#!/usr/bin/python3

import pytest

# You can run your tests in isolation mode by connecting to a forked network of the Hedera chain.
# This will enable the snapshot method during testing, ensuring that each test starts with a clean state.
# @pytest.fixture(scope="function", autouse=True)
# def isolate(fn_isolation):
#     Rewinds the chain after each test to maintain proper isolation.
#     More information can be found here:
#     https://eth-brownie.readthedocs.io/en/v1.10.3/tests-pytest-intro.html#isolation-fixtures
#    pass

# This setup is not required for forked networks with pre-funded accounts.
@pytest.fixture(scope="module", autouse=True)
def shared_setup(accounts):
    accounts.load('bob')
    accounts.load('alice')

@pytest.fixture(scope="module")
def greeter(Greeter, accounts):
    return Greeter.deploy("initial_msg", {'from': accounts[0]})
