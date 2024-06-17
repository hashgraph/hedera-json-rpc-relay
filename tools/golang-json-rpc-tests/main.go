/*-
 *
 * Hedera Golang JSON RPC tests
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package main

import (
    "context"
    "crypto/ecdsa"
    "encoding/hex"
    "flag"
    "fmt"
    "log"
    "math/big"
    "os"
    "strings"

    "github.com/ethereum/go-ethereum"
    "github.com/ethereum/go-ethereum/accounts/abi/bind"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/core/types"
    "github.com/ethereum/go-ethereum/crypto"
    "github.com/ethereum/go-ethereum/ethclient"
    "github.com/joho/godotenv"
)

const (
    mainnetEndpoint     = "https://mainnet.hashio.io/api"
    testnetEndpoint     = "https://testnet.hashio.io/api"
    previewnetEndpoint  = "https://previewnet.hashio.io/api"
)

func main() {
    err := godotenv.Load()
    if err != nil {
        log.Fatalf("Error loading .env file")
    }
    mainnet := flag.Bool("mainnet", false, "Use mainnet network")
    previewnet := flag.Bool("previewnet", false, "Use previewnet network")
    privateKeyHex := os.Getenv("OPERATOR_PRIVATE_KEY")
    flag.Parse()
    var endpointUrl string
    switch {
    case *mainnet:
        endpointUrl = mainnetEndpoint
    case *previewnet:
        endpointUrl = previewnetEndpoint
    default:
        endpointUrl = testnetEndpoint
    }
    client, err := ethclient.Dial(endpointUrl)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println("Connected to Ethereum client")
    chainId, err := client.ChainID(context.Background())
    if err != nil {
        log.Fatalf("Failed to get chain ID: %v", err)
    }
    fmt.Printf("Chain ID: %s\n", chainId.String())
    privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")
    privateKey, err := crypto.HexToECDSA(privateKeyHex)
    if err != nil {
        log.Fatalf("Failed to parse private key: %v", err)
    }
    publicKey := privateKey.Public().(*ecdsa.PublicKey)
    fromAddress := crypto.PubkeyToAddress(*publicKey)
    signedTx := testSendDummyTransaction(client, fromAddress, privateKey, chainId)
    receipt := waitForTransaction(client, signedTx)
    blockNumber := receipt.BlockNumber
    txIndex := receipt.TransactionIndex
    blockHash := receipt.BlockHash
    newestBlock := big.NewInt(0)
    testFeeHistory(client, 5, newestBlock, []float64{10, 50, 90})
    testBlockByNumber(client, blockNumber)
    testTransactionByHash(client, signedTx.Hash().Hex())
    testTransactionReceipt(client, signedTx.Hash().Hex())
    testGetBalance(client, fromAddress)
    testEthCall(client, fromAddress)
    testEstimateGas(client, fromAddress)
    testGetGasPrice(client)
    testGetAccounts(client)
    testBlockByHash(client, blockHash)
    testFeeHistory(client, 5, newestBlock, []float64{10, 50, 90})
    testGetBlockTransactionCountByHash(client, blockHash)
    testGetBlockTransactionCountByNumber(client)
    testCodeAt(client, fromAddress)
    testGetLogs(client, fromAddress, nil)
    testStorageAt(client, fromAddress, "0x0")
    testGetTransactionByBlockHashAndIndex(client, blockHash, txIndex)
    testGetTransactionByBlockNumberAndIndex(client, blockHash, txIndex)
    testGetTransactionByHash(client, signedTx.Hash().Hex())
    testGetTransactionCount(client)
    testGetTransactionReceipt(client, signedTx.Hash().Hex())
    testSyncing(client)
}

func testBlockByHash(client *ethclient.Client, blockHash common.Hash) {
    block, err := client.BlockByHash(context.Background(), blockHash)
    if err != nil {
        log.Fatalf("Failed to get block by hash: %v", err)
    }
    fmt.Printf("Block by hash: %s\n", block.Hash().Hex())
}

func testBlockByNumber(client *ethclient.Client, blockNumber *big.Int) {
    block, err := client.BlockByNumber(context.Background(), blockNumber)
    if err != nil {
        log.Fatalf("Failed to get block by number: %v", err)
    }
    if block.Number().Cmp(blockNumber) != 0 {
        log.Fatalf("Block number mismatch: expected %s, got %s", blockNumber.String(), block.Number().String())
    }
    fmt.Printf("Block by number\n")
}

func testTransactionByHash(client *ethclient.Client, txHash string) {
    tx, isPending, err := client.TransactionByHash(context.Background(), common.HexToHash(txHash))
    if err != nil {
        log.Fatalf("Failed to get transaction by hash: %v", err)
    }
    fmt.Printf("Transaction by hash: %s (Pending: %t)\n", tx.Hash().Hex(), isPending)
}

func testTransactionReceipt(client *ethclient.Client, txHash string) {
    receipt, err := client.TransactionReceipt(context.Background(), common.HexToHash(txHash))
    if err != nil {
        log.Fatalf("Failed to get transaction receipt: %v", err)
    }
    if receipt == nil {
        fmt.Printf("Transaction receipt: null\n")
    } else if receipt.TxHash.Hex() != txHash {
        log.Fatalf("Receipt transaction hash mismatch: expected %s, got %s", txHash, receipt.TxHash.Hex())
    } else {
        fmt.Printf("Transaction receipt: %d\n", receipt.Status)
    }
}

func testGetBalance(client *ethclient.Client, fromAddress common.Address) {
    balance, err := client.BalanceAt(context.Background(), fromAddress, nil)
    if err != nil {
        log.Fatalf("Failed to get balance: %v", err)
    }
    if balance == nil {
        log.Fatalf("Balance is nil")
    }
    fmt.Printf("Account balance: %s\n", balance.String())
}

func testEthCall(client *ethclient.Client, fromAddress common.Address) {
    msg := ethereum.CallMsg{
        From: fromAddress,
        To:   &fromAddress,
        Data: []byte("0x"),
    }
    result, err := client.CallContract(context.Background(), msg, nil)
    if err != nil {
        log.Fatalf("Failed to call contract: %v", err)
    }
    fmt.Printf("eth_call result", hex.EncodeToString(result))
}

func testEstimateGas(client *ethclient.Client, fromAddress common.Address) {
    msg := ethereum.CallMsg{
        From:  fromAddress,
        To:    &fromAddress,
        Value: big.NewInt(10000000000),
        Gas:   21000,
        Data:  nil,
    }
    gasEstimate, err := client.EstimateGas(context.Background(), msg)
    if err != nil {
        log.Fatalf("Failed to estimate gas: %v", err)
    }
    if gasEstimate <= 0 {
        log.Fatalf("Gas estimate is invalid: %d", gasEstimate)
    }
    fmt.Printf("Gas estimate: %d\n", gasEstimate)
}

func testGetGasPrice(client *ethclient.Client) {
    gasPrice, err := client.SuggestGasPrice(context.Background())
    if err != nil {
        log.Fatalf("Failed to get gas price: %v", err)
    }
    if gasPrice.Cmp(big.NewInt(0)) <= 0 {
        log.Fatalf("Gas price is invalid: %s", gasPrice.String())
    }
    fmt.Printf("Gas price: %s\n", gasPrice.String())
}

func testSendDummyTransaction(client *ethclient.Client, fromAddress common.Address, privateKey *ecdsa.PrivateKey, chainId *big.Int) *types.Transaction {
    nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
    if err != nil {
        log.Fatalf("Failed to get transaction count: %v", err)
    }
    fmt.Printf("Transaction count (nonce): %d\n", nonce)

    gasPrice, err := client.SuggestGasPrice(context.Background())
    if err != nil {
        log.Fatalf("Failed to get gas price: %v", err)
    }

    txData := &types.AccessListTx{
        ChainID:    chainId,
        Nonce:      nonce,
        GasPrice:   gasPrice,
        Gas:        21000,
        To:         &fromAddress,
        Value:      big.NewInt(10000000000), // 0.01 Ether
        Data:       nil,
        AccessList: types.AccessList{},
    }

    tx := types.NewTx(txData)
    signer := types.NewEIP2930Signer(chainId)
    signedTx, err := types.SignTx(tx, signer, privateKey)
    if err != nil {
        log.Fatalf("Failed to sign transaction: %v", err)
    }

    v, r, s := signedTx.RawSignatureValues()
    fmt.Printf("R: %s\n", r.String())
    fmt.Printf("S: %s\n", s.String())
    fmt.Printf("V: %s\n", v.String())

    err = client.SendTransaction(context.Background(), signedTx)
    if err != nil {
        log.Fatalf("Failed to send transaction: %v", err)
    }
    fmt.Printf("Sent raw transaction: %s\n", signedTx.Hash().Hex())

    return signedTx
}

func testGetAccounts(client *ethclient.Client) {
    rpcClient := client.Client()

    var result []string
    err := rpcClient.CallContext(context.Background(), &result, "eth_accounts")
    if err != nil {
        log.Fatalf("Failed to get accounts: %v", err)
    }

    for _, account := range result {
        address := common.HexToAddress(account)
        balance, err := client.BalanceAt(context.Background(), address, nil)
        if (err != nil) {
            fmt.Printf("Failed to get balance for account %s: %v\n", account, err)
            continue
        }
        if balance == nil {
            log.Fatalf("Balance for account %s is nil", account)
        }
        fmt.Printf("Account %s balance: %s\n", account, balance.String())
    }
}

func testFeeHistory(client *ethclient.Client, blockCount uint64, newestBlock *big.Int, rewardPercentiles []float64) {
    ctx := context.Background()

    feeHistory, err := client.FeeHistory(ctx, blockCount, newestBlock, rewardPercentiles)
    if err != nil {
        log.Fatalf("Failed to get fee history: %v", err)
    }

    if feeHistory == nil {
        log.Fatalf("Fee history is nil")
    }

    fmt.Printf("Fee History:\n")
    fmt.Printf("Oldest Block: %s\n", feeHistory.OldestBlock.String())
    fmt.Printf("Gas Used Ratio: %v\n", feeHistory.GasUsedRatio)
    fmt.Printf("Reward: %v\n", feeHistory.Reward)
}

func waitForTransaction(client *ethclient.Client, tx *types.Transaction) *types.Receipt {
    ctx := context.Background()
    receipt, err := bind.WaitMined(ctx, client, tx)
    if err != nil {
        log.Fatalf("Failed to wait for transaction to be mined: %v", err)
    }
    if receipt == nil {
        log.Fatalf("Receipt is nil")
    }
    return receipt
}

func testGetBlockTransactionCountByHash(client *ethclient.Client, blockHash common.Hash) {
    txCount, err := client.TransactionCount(context.Background(), blockHash)
    if err != nil {
        log.Fatalf("Failed to get transaction count by block hash: %v", err)
    }
    if txCount < 0 {
        log.Fatalf("Transaction count is invalid: %d", txCount)
    }
    fmt.Printf("Transaction count by block hash %s: %d\n", blockHash.Hex(), txCount)
}

func testGetBlockTransactionCountByNumber(client *ethclient.Client) {
    txCount, err := client.PendingTransactionCount(context.Background())
    if err != nil {
        log.Fatalf("Failed to get transaction count by block number: %v", err)
    }
    if txCount < 0 {
        log.Fatalf("Transaction count is invalid: %d", txCount)
    }
    fmt.Printf("Transaction count by block number: %d\n", txCount)
}

func testCodeAt(client *ethclient.Client, address common.Address) {
    code, err := client.CodeAt(context.Background(), address, nil)
    if err != nil {
        log.Fatalf("Failed to get code at address: %v", err)
    }
    if code == nil {
        log.Fatalf("Code is nil")
    }
    fmt.Printf("Code at address %s: %s\n", address.Hex(), hex.EncodeToString(code)) // Not a SmartContract so empty string expected
}

func testGetLogs(client *ethclient.Client, address common.Address, topics []common.Hash) {
    query := ethereum.FilterQuery{
        Addresses: []common.Address{address},
        Topics:    [][]common.Hash{topics},
    }

    logs, err := client.FilterLogs(context.Background(), query)
    if err != nil {
        log.Fatalf("Failed to get logs: %v", err)
    }

    fmt.Printf("Logs for address %s:\n", address.Hex())
    if len(logs) == 0 {
        fmt.Printf("No logs found for address %s\n", address.Hex())
    } else {
        for _, vLog := range logs { // Not a SmartContract so empty result expected
            fmt.Printf("Log Block Number: %d\n", vLog.BlockNumber)
            fmt.Printf("Log Index: %d\n", vLog.Index)
            fmt.Printf("Log Data: %s\n", hex.EncodeToString(vLog.Data))
        }
    }
}

func testStorageAt(client *ethclient.Client, address common.Address, slot string) {
    slotHash := common.HexToHash(slot)
    storageValue, err := client.StorageAt(context.Background(), address, slotHash, nil)
    if err != nil {
        log.Fatalf("Failed to get storage at address: %v", err)
    }
    if storageValue == nil {
        log.Fatalf("Storage value is nil")
    }
    fmt.Printf("Storage at address %s slot %s: %s\n", address.Hex(), slot, hex.EncodeToString(storageValue))
}

func testGetTransactionByBlockHashAndIndex(client *ethclient.Client, blockHash common.Hash, index uint) {
    tx, err := client.TransactionInBlock(context.Background(), blockHash, index)
    if err != nil {
        log.Fatalf("Failed to get transaction by block hash and index: %v", err)
    }
    fmt.Printf("Transaction in block hash %s at index %d: %s\n", blockHash.Hex(), index, tx.Hash().Hex())
}

func testGetTransactionByBlockNumberAndIndex(client *ethclient.Client, blockHash common.Hash, index uint) {
    tx, err := client.TransactionInBlock(context.Background(), blockHash, index)
    if err != nil {
        log.Fatalf("Failed to get transaction by block number and index: %v", err)
    }
    fmt.Printf("Transaction in block number at index %d: %s\n", index, tx.Hash().Hex())
}

func testGetTransactionByHash(client *ethclient.Client, txHash string) {
    tx, _, err := client.TransactionByHash(context.Background(), common.HexToHash(txHash))
    if err != nil {
        log.Fatalf("Failed to get transaction by hash: %v", err)
    }
    if tx == nil {
        log.Fatalf("Transaction is nil")
    }
    fmt.Printf("Transaction by hash: %s\n", tx.Hash().Hex())
}

func testGetTransactionCount(client *ethclient.Client) {
    count, err := client.PendingTransactionCount(context.Background())
    if err != nil {
        log.Fatalf("Failed to get transaction count: %v", err)
    }
    if count < 0 {
        log.Fatalf("Transaction count is invalid: %d", count)
    }
    fmt.Printf("Transaction count for address %d\n", count)
}

func testGetTransactionReceipt(client *ethclient.Client, txHash string) {
    receipt, err := client.TransactionReceipt(context.Background(), common.HexToHash(txHash))
    if err != nil {
        log.Fatalf("Failed to get transaction receipt: %v", err)
    }
    if receipt == nil {
        log.Fatalf("Receipt is nil")
    }
    fmt.Printf("Transaction receipt for hash %s: %v\n", txHash, receipt)
}

func testSyncing(client *ethclient.Client) {
    syncing, err := client.SyncProgress(context.Background())
    if err != nil {
        log.Fatalf("Failed to get syncing status: %v", err)
    }
    if syncing == nil {
        fmt.Println("Not syncing")
    } else {
        fmt.Printf("Syncing: %+v\n", syncing)
    }
}
