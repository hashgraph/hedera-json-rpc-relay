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

    testBlockByNumber(client, big.NewInt(5086904))
    testTransactionByHash(client, "4b970a3c02af09d646d2bc099b94d95cd2c9b7c92d1bf42e65eee0258016a234")
    testTransactionReceipt(client, "4b970a3c02af09d646d2bc099b94d95cd2c9b7c92d1bf42e65eee0258016a234")
    testGetBalance(client, fromAddress)
    testEthCall(client, fromAddress)
    testEstimateGas(client, fromAddress)
    testGetGasPrice(client)
    testSendDummyTransaction(client, fromAddress, privateKey, chainId)
}

func testBlockByNumber(client *ethclient.Client, blockNumber *big.Int) {
    block, err := client.BlockByNumber(context.Background(), blockNumber)
    if err != nil {
        log.Fatalf("Failed to get block by number: %v", err)
    }
    fmt.Printf("Block by number: %s\n", block.Hash().Hex())
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
    } else {
        fmt.Printf("Transaction receipt: %d\n", receipt.Status)
    }
}

func testGetBalance(client *ethclient.Client, fromAddress common.Address) {
    balance, err := client.BalanceAt(context.Background(), fromAddress, nil)
    if err != nil {
        log.Fatalf("Failed to get balance: %v", err)
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
    fmt.Printf("eth_call result: %s\n", hex.EncodeToString(result))
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
    fmt.Printf("Gas estimate: %d\n", gasEstimate)
}

func testGetGasPrice(client *ethclient.Client) {
    gasPrice, err := client.SuggestGasPrice(context.Background())
    if err != nil {
        log.Fatalf("Failed to get gas price: %v", err)
    }
    fmt.Printf("Gas price: %s\n", gasPrice.String())
}

func testSendDummyTransaction(client *ethclient.Client, fromAddress common.Address, privateKey *ecdsa.PrivateKey, chainId int) {
    nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
    if err != nil {
        log.Fatalf("Failed to get transaction count: %v", err)
    }
    fmt.Printf("Transaction count (nonce): %d\n", nonce)

    gasPrice, err := client.SuggestGasPrice(context.Background())
    if err != nil {
        log.Fatalf("Failed to get gas price: %v", err)
    }

    tx := types.NewTransaction(nonce, fromAddress, big.NewInt(10000000000), 21000, gasPrice, nil)
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
