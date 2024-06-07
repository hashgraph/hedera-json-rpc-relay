package main

import (
	"context"
	"fmt"
	"log"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	// Connect to your Ethereum node
	client, err := ethclient.Dial("http://127.0.0.1:8000")
	if err != nil {
		log.Fatalf("Failed to connect to the Ethereum client: %v", err)
	}
	defer client.Close()

	// Fetch the chain ID
 //   chainId, err := client.ChainID(context.Background())
 //   if err != nil {
  //      log.Fatalf("Failed to fetch chain ID: %v", err)
   // }

    //fmt.Printf("Connected to network with Chain ID: %s\n", chainId.String())
	// Transaction hash to fetch
	txHash := common.HexToHash("65486c84522a4f581aeaf5d2b17dc7993c76c916e78158f375d0c89d625e4979")

	// Fetch the transaction
	tx, isPending, err := client.TransactionByHash(context.Background(), txHash)

	if err != nil {
		log.Fatalf("Failed to fetch transaction: %v", err)
	}

	fmt.Printf("Transaction: %+v\n", tx)
	fmt.Printf("Is Pending: %v\n", isPending)
}