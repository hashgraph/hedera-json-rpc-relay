#!/usr/bin/python3

from brownie import Token, accounts

def main():
    return Greeter.deploy("initial_msg", {'from': accounts[0]})
