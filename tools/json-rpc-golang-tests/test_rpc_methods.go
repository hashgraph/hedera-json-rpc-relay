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
    mainnetChainId      = 295
    previewnetChainId   = 297
    testnetChainId      = 296
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
    var chainId int

    switch {
    case *mainnet:
        endpointUrl = mainnetEndpoint
        chainId = mainnetChainId
    case *previewnet:
        endpointUrl = previewnetEndpoint
        chainId = previewnetChainId
    default:
        endpointUrl = testnetEndpoint
        chainId = testnetChainId
    }

    client, err := ethclient.Dial(endpointUrl)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println("Connected to Ethereum client")

    privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")
    privateKey, err := crypto.HexToECDSA(privateKeyHex)
    if err != nil {
        log.Fatalf("Failed to parse private key: %v", err)
    }

    publicKey := privateKey.Public().(*ecdsa.PublicKey)
    fromAddress := crypto.PubkeyToAddress(*publicKey)

    // eth_blockNumber
    blockNumber, err := client.BlockNumber(context.Background())
    if err != nil {
        log.Fatalf("Failed to get block number: %v", err)
    }
    fmt.Printf("Current block number: %d\n", blockNumber)

    // eth_getBlockByNumber
    block, err := client.BlockByNumber(context.Background(), big.NewInt(int64(blockNumber)))
    if err != nil {
        log.Fatalf("Failed to get block by number: %v", err)
    }
    fmt.Printf("Block by number: %s\n", block.Hash().Hex())

    // eth_getTransactionByHash
    if len(block.Transactions()) > 0 {
        txHash := block.Transactions()[0].Hash()
        tx, isPending, err := client.TransactionByHash(context.Background(), txHash)
        if err != nil {
            log.Fatalf("Failed to get transaction by hash: %v", err)
        }
        fmt.Printf("Transaction by hash: %s (Pending: %t)\n", tx.Hash().Hex(), isPending)

        // eth_getTransactionReceipt
        receipt, err := client.TransactionReceipt(context.Background(), txHash)
        if err != nil {
            log.Fatalf("Failed to get transaction receipt: %v", err)
        }
        fmt.Printf("Transaction receipt: %s\n", receipt.Status)
    } else {
        fmt.Println("No transactions found in the latest block to test eth_getTransactionByHash and eth_getTransactionReceipt")
    }

    // eth_getBalance
    balance, err := client.BalanceAt(context.Background(), fromAddress, nil)
    if err != nil {
        log.Fatalf("Failed to get balance: %v", err)
    }
    fmt.Printf("Account balance: %s\n", balance.String())

    // eth_call (dummy call to self)
    msg := ethereum.CallMsg{
        From: fromAddress,
        To:   &fromAddress,
        Gas:  21000,
        Data: nil,
    }
    result, err := client.CallContract(context.Background(), msg, nil)
    if err != nil {
        log.Fatalf("Failed to call contract: %v", err)
    }
    fmt.Printf("eth_call result: %s\n", hex.EncodeToString(result))

    // eth_estimateGas
    gasEstimate, err := client.EstimateGas(context.Background(), msg)
    if err != nil {
        log.Fatalf("Failed to estimate gas: %v", err)
    }
    fmt.Printf("Gas estimate: %d\n", gasEstimate)

    // eth_gasPrice
    gasPrice, err := client.SuggestGasPrice(context.Background())
    if err != nil {
        log.Fatalf("Failed to get gas price: %v", err)
    }
    fmt.Printf("Gas price: %s\n", gasPrice.String())

    // eth_getTransactionCount
    nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
    if err != nil {
        log.Fatalf("Failed to get transaction count: %v", err)
    }
    fmt.Printf("Transaction count (nonce): %d\n", nonce)
    tx := types.NewTransaction(nonce, fromAddress, big.NewInt(0), 21000, gasPrice, nil)
    signedTx, err := types.SignTx(tx, types.NewEIP155Signer(big.NewInt(int64(chainId))), privateKey)
    if err != nil {
        log.Fatalf("Failed to sign transaction: %v", err)
    }

    err = client.SendTransaction(context.Background(), signedTx)
    if err != nil {
        log.Fatalf("Failed to send transaction: %v", err)
    }
    fmt.Printf("Sent raw transaction: %s\n", signedTx.Hash().Hex())
}
