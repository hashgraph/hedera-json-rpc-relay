import os
import pytest
from dotenv import load_dotenv
from web3 import Web3
from solcx import install_solc, compile_files

SOLC_VERSION = 'latest'
CONTRACT_FILE = 'Greeter.sol'

@pytest.fixture(scope='module')
def w3():
    load_dotenv()
    http_chain_url = os.getenv('HTTP_CHAIN_URL')
    return Web3(Web3.HTTPProvider(http_chain_url))

@pytest.fixture(scope='module')
def account(w3):
    private_key = os.getenv('PRIVATE_KEY')
    return w3.eth.account.from_key(private_key)

@pytest.fixture(scope='module')
def contract_interface():
    install_solc(version=SOLC_VERSION)
    compiled_sol = compile_files([CONTRACT_FILE], output_values=['abi', 'bin'])
    contract_id, contract_interface = compiled_sol.popitem()
    return contract_interface

@pytest.fixture(scope='module')
def deployed_contract(w3, account, contract_interface):
    abi, bytecode = contract_interface['abi'], contract_interface['bin']
    Greeter = w3.eth.contract(abi=abi, bytecode=bytecode)
    transaction = Greeter.constructor().build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
    })
    signed_tx = w3.eth.account.sign_transaction(transaction, private_key=account.key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return w3.eth.contract(address=tx_receipt.contractAddress, abi=abi)

def test_account_balance(w3, account):
    balance = w3.eth.get_balance(account.address)
    assert balance > 0, "Account balance should be greater than zero"

def test_contract_deployment(deployed_contract):
    assert deployed_contract.functions.greet().call() == "Hello", "Contract should be deployed with initial greeting 'Hello'"

def test_contract_call(w3, account, deployed_contract):
    transaction = deployed_contract.functions.setGreeting('Hello2').build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
    })
    signed_tx = w3.eth.account.sign_transaction(transaction, private_key=account.key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
    assert deployed_contract.functions.greet().call() == "Hello2", "Contract should update greeting to 'Hello2'"

if __name__ == "__main__":
    pytest.main()