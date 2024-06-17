package main

import (
    "context"
    "crypto/ecdsa"
    "flag"
    "fmt"
    "log"
    "math/big"
    "os"
    "strings"

    "github.com/ethereum/go-ethereum/accounts/abi/bind"
    "github.com/ethereum/go-ethereum/crypto"
    "github.com/ethereum/go-ethereum/ethclient"
    "github.com/ethereum/go-ethereum/common"
    "github.com/joho/godotenv"
    greeter "hedera-golang-example-project/contracts"
)

const (
    mainnetEndpoint    = "https://mainnet.hashio.io/api"
    testnetEndpoint    = "https://testnet.hashio.io/api"
    previewnetEndpoint = "https://previewnet.hashio.io/api"

    mainnetChainId    = 295
    previewnetChainId = 297
    testnetChainId    = 296
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

    client, auth, fromAddress := initialise(endpointUrl, chainId, privateKeyHex)
    fmt.Printf("Using address: %s\n", fromAddress.Hex())

    balance, err := client.BalanceAt(context.Background(), fromAddress, nil)
    if err != nil {
        log.Fatalf("Failed to get balance: %v", err)
    }
    fmt.Printf("Account balance: %s\n", balance.String())

    initialGreeting := "initial_msg"
    _, instance := deployContract(auth, client, initialGreeting)

    input := "updated_msg"
    setGreeting(auth, client, instance, input)

    result := greet(instance)
    fmt.Printf("Greet method returned: %s\n", result)
}

func initialise(endpointUrl string, chainId int, privateKeyHex string) (*ethclient.Client, *bind.TransactOpts, common.Address) {
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

    publicKey := privateKey.Public()
    publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
    if !ok {
        log.Fatal("Failed to cast public key to ECDSA")
    }
    fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)

    nonce, err := client.NonceAt(context.Background(), fromAddress, nil)
    if err != nil {
        log.Fatalf("Failed to get nonce: %v", err)
    }
    fmt.Printf("Using nonce: %d\n", nonce)

    gasPrice, err := client.SuggestGasPrice(context.Background())
    if err != nil {
        log.Fatalf("Failed to get gas price: %v", err)
    }
    fmt.Printf("Using gas price: %s\n", gasPrice.String())

    auth := createTransactor(privateKey, nonce, gasPrice, big.NewInt(int64(chainId)))

    return client, auth, fromAddress
}

func deployContract(auth *bind.TransactOpts, client *ethclient.Client, initialGreeting string) (common.Address, *greeter.Store) {
    address, tx, instance, err := greeter.DeployStore(auth, client, initialGreeting)
    if err != nil {
        log.Fatalf("Failed to deploy contract: %v", err)
    }
    fmt.Printf("Contract deployed! Waiting for deployment transaction %s to be mined...\n", tx.Hash().Hex())
    bind.WaitMined(context.Background(), client, tx)
    fmt.Println("Contract deployed at address:", address.Hex())

    return address, instance
}

func setGreeting(auth *bind.TransactOpts, client *ethclient.Client, instance *greeter.Store, input string) {
    nonce, err := client.NonceAt(context.Background(), auth.From, nil)
    if err != nil {
        log.Fatalf("Failed to get nonce: %v", err)
    }
    auth.Nonce = big.NewInt(int64(nonce))
    tx, err := instance.SetGreeting(auth, input)
    if err != nil {
        log.Fatalf("Failed to call SetGreeting method: %v", err)
    }
    fmt.Printf("Called SetGreeting method with input '%s'. Waiting for transaction %s to be mined...\n", input, tx.Hash().Hex())
    bind.WaitMined(context.Background(), client, tx)
    fmt.Println("SetGreeting method call transaction mined")
}

func greet(instance *greeter.Store) string {
    callOpts := &bind.CallOpts{
        Context: context.Background(),
    }
    result, err := instance.Greet(callOpts)
    if err != nil {
        log.Fatalf("Failed to call Greet method: %v", err)
    }
    return result
}
