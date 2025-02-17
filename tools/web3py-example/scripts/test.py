# SPDX-License-Identifier: Apache-2.0

import os
import unittest
from dotenv import load_dotenv
from web3 import Web3
from solcx import install_solc, compile_files

def setup_environment():
    """
    Returns:
    - w3: Initialized Web3 instance
    - acc: Web3 account object
    """
    # install solc
    install_solc(version='0.8.24')

    # load values from our .env file
    load_dotenv()
    OPERATOR_PRIVATE_KEY = os.getenv('OPERATOR_PRIVATE_KEY')
    RELAY_ENDPOINT = os.getenv('RELAY_ENDPOINT')

    # connect to chain
    w3 = Web3(Web3.HTTPProvider(RELAY_ENDPOINT))

    # get account from pk
    acc = w3.eth.account.from_key(OPERATOR_PRIVATE_KEY)

    return w3, acc


def get_balance(w3, acc):
    """
    Args:
    - w3: Initialized Web3 instance
    - acc: Web3 account object

    Returns:
    - Account balance in wei
    """
    balance = w3.eth.get_balance(acc.address)
    return balance


def deploy_contract(w3, acc):
    """
    Args:
    - w3: Initialized Web3 instance
    - acc: Web3 account object

    Returns:
    - tuple: (Deployed contract instance, Contract address)
    """
    # compile our Greeter contract
    compiled_sol = compile_files(['contract/Greeter.sol'], output_values=['abi', 'bin'], optimize=True)

    # retrieve the contract interface
    contract_id, contract_interface = compiled_sol.popitem()

    bytecode = contract_interface['bin']
    abi = contract_interface['abi']

    # create web3.py contract instance
    Greeter = w3.eth.contract(abi=abi, bytecode=bytecode)

    # build transaction
    unsent_tx_hash = Greeter.constructor().build_transaction({
        "from": acc.address,
        "nonce": w3.eth.get_transaction_count(acc.address),
    })

    # sign transaction
    signed_tx = w3.eth.account.sign_transaction(unsent_tx_hash, private_key=acc.key)

    # send transaction
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    # create instance of deployed contract
    greeter = w3.eth.contract(
        address=tx_receipt.contractAddress,
        abi=abi
    )

    return greeter, tx_receipt.contractAddress


def contract_view_call(greeter):
    """
    Args:
    - greeter: Deployed Greeter contract instance

    Returns:
    - Current greeting message
    """
    greeting = greeter.functions.greet().call()
    return greeting


def contract_call(w3, acc, greeter):
    """
    Args:
    - w3: Initialized Web3 instance
    - acc: Web3 account object
    - greeter: Deployed Greeter contract instance

    Returns:
    - Updated greeting message
    """
    # build contract call transaction
    unsent_call_tx_hash = greeter.functions.setGreeting('Hello2').build_transaction({
        "from": acc.address,
        "nonce": w3.eth.get_transaction_count(acc.address),
    })

    # sign transaction
    signed_call_tx = w3.eth.account.sign_transaction(unsent_call_tx_hash, private_key=acc.key)

    # send transaction
    call_tx_hash = w3.eth.send_raw_transaction(signed_call_tx.rawTransaction)
    w3.eth.wait_for_transaction_receipt(call_tx_hash)

    # Verify the greeting has been updated
    new_greeting = greeter.functions.greet().call()
    return new_greeting


class TestGreeterContract(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.w3, cls.acc = setup_environment()
        cls.greeter, cls.contract_address = deploy_contract(cls.w3, cls.acc)

    def test_get_balance(self):
        balance = get_balance(self.w3, self.acc)
        self.assertIsInstance(balance, int, "Account balance is an integer")

    def test_deploy_contract(self):
        self.assertTrue(self.contract_address.startswith('0x'), "Contract address starts with '0x'")

    def test_call_view(self):
        greeting = contract_view_call(self.greeter)
        self.assertEqual(greeting, 'Hello', "Initial greeting matches expected value")

    def test_contract_call(self):
        new_greeting = contract_call(self.w3, self.acc, self.greeter)
        self.assertEqual(new_greeting, 'Hello2', "Updated greeting matches expected value")

        final_greeting = contract_view_call(self.greeter)
        self.assertEqual(final_greeting, 'Hello2', "Final greeting matches expected value after update")


if __name__ == "__main__":
    unittest.main()
