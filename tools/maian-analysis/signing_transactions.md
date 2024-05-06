### Overview

The point of this document is to analyze how different web3 providers handle the eth_sendTransaction method.

Method [eth_sendTransaction](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendtransaction) creates a new message call transaction or a contract creation, if the data field contains code, and signs it using the account specified in "from" field.

The main focus of the analysis is detecting the source of the private key used to sign the transaction across multiple JSON RPC API implementations.

### Comparison

1. [GETH](https://geth.ethereum.org/docs/interacting-with-geth/rpc/ns-personal) (historically). This is the implementation required by the MAIAN tool.
    - Private key is provided by [eth_personal_importRawKey](https://web3js.readthedocs.io/en/v1.2.7/web3-eth-personal.html#importrawkey). Password is submitted together with the private key, and will be required to unlock this key in the next steps.
    - Account has to be [unlocked](https://web3js.readthedocs.io/en/v1.2.7/web3-eth-personal.html#unlockaccount) in order to be used to signing the transaction. In order to unlock the account user has to submit the password it is associated with.
    - eth_sendTransaction can be used. If the account provided in the "from" field is unlocked its private key will be used to create a signature.

IMPORTANT! Sending your account password over an unsecured HTTP RPC connection is highly insecure. The usage of this method is already deprecated in GETH. An alternative way of using an additional tool called Clef is proposed to avoid sending secured data through JSON RPC.

2. [Infura](https://docs.infura.io/api/networks/ethereum/json-rpc-methods/eth_sendtransaction)
    - Method is not present in Infura's implementation of JSON RPC.
    - Recent versions of Web3 client (i.e. v1.2) support a method called eth_sendTransaction, but it signs the transaction locally using the private key of the account and then sends the transaction via web3.eth.sendSignedTransaction (a wrapper for eth_sendRawTransaction). This approach enhances security by avoiding the transmission of private keys.

3. [Alchemy](https://docs.alchemy.com/reference/ethereum-api-endpoints)
    - Implementation of method eth_sendTransaction is not implemented.
    - Approach recommended by Infura (signing transactions locally) is also applicable when using Alchemy.

MAIAN uses an outdated version of the Web3.py client which is not capable of signing the transaction in a way similar to the one described in Infura`s documentation. Updating it would be required to make this tool work properly with any modern, secure, JSON RPC API.
