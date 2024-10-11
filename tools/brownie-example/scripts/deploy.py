#!/usr/bin/python3

from brownie import Greeter, accounts

def main():
    accounts.load('bob')
    return Greeter.deploy("initial_msg", {'from': accounts[0]})
