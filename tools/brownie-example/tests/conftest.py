#!/usr/bin/python3

import pytest

# You can also run your tests in isolation mode. In order to do so you have to connect to the forked network of
# the Hedera chain you want to run this tests on (snapshot method will be used during tests)
#@pytest.fixture(scope="function", autouse=True)
#def isolate(fn_isolation):
    # perform a chain rewind after completing each test, to ensure proper isolation
    # https://eth-brownie.readthedocs.io/en/v1.10.3/tests-pytest-intro.html#isolation-fixtures
#    pass

# This setup will not be needed for forked networks, which pre-created accounts
@pytest.fixture(scope="module", autouse=True)
def shared_setup(accounts):
    accounts.load('bob')
    accounts.load('alice')

@pytest.fixture(scope="module")
def greeter(Greeter, accounts):
    return Greeter.deploy("initial_msg", {'from': accounts[0]})
