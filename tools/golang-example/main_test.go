package main

import (
    "context"
    "crypto/ecdsa"
    "math/big"
    "os"
    "strings"
    "testing"
    "log"

    "github.com/ethereum/go-ethereum/accounts/abi/bind"
    "github.com/ethereum/go-ethereum/crypto"
    "github.com/ethereum/go-ethereum/ethclient"
    "github.com/ethereum/go-ethereum/common"
    "github.com/joho/godotenv"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"

    greeter "hedera-golang-example-project/contracts"
)

var (
    endpointUrl string
    chainId     int
)

func init() {
    err := godotenv.Load()
    if err != nil {
        log.Fatalf("Error loading .env file")
    }
    endpointUrl = testnetEndpoint
    chainId = testnetChainId
}

func setup(t *testing.T) (*ethclient.Client, *ecdsa.PrivateKey, *bind.TransactOpts, common.Address) {
    client, err := ethclient.Dial(endpointUrl)
    require.NoError(t, err)

    privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(os.Getenv("OPERATOR_PRIVATE_KEY"), "0x"))
    require.NoError(t, err)

    publicKey := privateKey.Public().(*ecdsa.PublicKey)
    fromAddress := crypto.PubkeyToAddress(*publicKey)

    nonce, err := client.NonceAt(context.Background(), fromAddress, nil)
    require.NoError(t, err)

    gasPrice, err := client.SuggestGasPrice(context.Background())
    require.NoError(t, err)

    auth := createTransactor(privateKey, nonce, gasPrice, big.NewInt(int64(chainId)))

    return client, privateKey, auth, fromAddress
}

func TestGetAccountBalance(t *testing.T) {
    client, _, _, fromAddress := setup(t)

    balance, err := client.BalanceAt(context.Background(), fromAddress, nil)
    require.NoError(t, err)

    t.Logf("Account balance: %s", balance.String())
    assert.True(t, balance.Cmp(big.NewInt(0)) > 0, "Balance should be greater than zero")
}

func TestDeployContract(t *testing.T) {
    client, _, auth, _ := setup(t)

    initialGreeting := "initial_msg"
    address, tx, instance, err := greeter.DeployStore(auth, client, initialGreeting)
    require.NoError(t, err)

    bind.WaitMined(context.Background(), client, tx)

    t.Logf("Contract deployed at address: %s", address.Hex())
    assert.NotEmpty(t, address.Hex(), "Contract address should not be empty")
    assert.NotNil(t, instance, "Contract instance should not be nil")
}

func TestContractViewCall(t *testing.T) {
    client, _, auth, _ := setup(t)

    initialGreeting := "initial_msg"
    _, tx, instance, err := greeter.DeployStore(auth, client, initialGreeting)
    require.NoError(t, err)

    bind.WaitMined(context.Background(), client, tx)

    callOpts := &bind.CallOpts{
        Context: context.Background(),
    }

    result, err := instance.Greet(callOpts)
    require.NoError(t, err)

    t.Logf("Greet method returned: %s", result)
    assert.Equal(t, initialGreeting, result, "Greet method should return the initial greeting")
}

func TestContractCall(t *testing.T) {
    client, _, auth, fromAddress := setup(t)

    initialGreeting := "initial_msg"
    _, tx, instance, err := greeter.DeployStore(auth, client, initialGreeting)
    require.NoError(t, err)

    bind.WaitMined(context.Background(), client, tx)

    input := "updated_msg"
    nonce, err := client.NonceAt(context.Background(), fromAddress, nil)
    require.NoError(t, err)

    auth.Nonce = big.NewInt(int64(nonce))
    tx, err = instance.SetGreeting(auth, input)
    require.NoError(t, err)

    bind.WaitMined(context.Background(), client, tx)
}
