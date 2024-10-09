#!/usr/bin/python3

import pytest

def test_account_balance(accounts):
    assert accounts[0].balance() > 0 # We need non empty account to test the transfer method...

def test_hbar_transfer(accounts):
    transfer_amount = 100
    initial_alice_balance = accounts[0].balance()
    initial_bob_balance = accounts[1].balance()
    accounts[0].transfer(accounts[1], transfer_amount)
    assert accounts[0].balance() == initial_alice_balance - transfer_amount
    assert accounts[1].balance() == initial_bob_balance + transfer_amount

def test_deploy(Greeter, accounts):
    deployed = Greeter.deploy("another_instance", {'from': accounts[0]})
    assert deployed.greet() == "another_instance"

def test_view_call(greeter, accounts):
    assert greeter.greet() == "initial_msg"

def test_call(greeter, accounts):
    greeter.setGreeting("updated_msg", {'from': accounts[0]})
    assert greeter.greet() == "updated_msg"
