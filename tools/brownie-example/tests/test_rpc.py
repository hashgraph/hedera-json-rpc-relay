#!/usr/bin/python3

import pytest

def test_account_balance(accounts):
    assert accounts[0].balance() == 10**21

@pytest.mark.parametrize("idx", range(5))
def test_hbar_transfer(accounts, idx):
    assert accounts[0].balance() == 10**21
    assert accounts[idx + 1].balance() == 10**21
    accounts[0].transfer(accounts[idx + 1], 10**20)
    assert accounts[0].balance() == 9 * 10**20
    assert accounts[idx + 1].balance() == 11 * 10**20

def test_deploy(Greeter, accounts):
    deployed = Greeter.deploy("another_instance", {'from': accounts[0]})
    assert deployed.greet() == "another_instance"

def test_view_call(greeter, accounts):
    assert greeter.greet() == "initial_msg"

def test_call(greeter, accounts):
    greeter.setGreeting("updated_msg", {'from': accounts[0]})
    assert greeter.greet() == "updated_msg"
