package main

import (
    "crypto/ecdsa"
    "math/big"
    "log"
    "github.com/ethereum/go-ethereum/accounts/abi/bind"
)

func createTransactor(privateKey *ecdsa.PrivateKey, nonce uint64, gasPrice *big.Int, chainId *big.Int) *bind.TransactOpts {
    auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainId)
    if err != nil {
        log.Fatalf("Failed to create transactor: %v", err)
    }
    auth.Nonce = big.NewInt(int64(nonce))
    auth.Value = big.NewInt(0)
    auth.GasLimit = uint64(3000000)
    auth.GasPrice = gasPrice

    return auth
}

func calculateTransactionCost(gasLimit uint64, gasPrice *big.Int) *big.Int {
    return new(big.Int).Mul(big.NewInt(int64(gasLimit)), gasPrice)
}
