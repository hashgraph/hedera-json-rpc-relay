# Layer Zero examples

### OApp

Message-passing interface to send and receive arbitrary pieces of data between contracts existing on different chains.

- Deploying the oapp contract on each network we're going to interact
```
npx hardhat deploy-oapp --network hedera_testnet
npx hardhat deploy-oapp --network bsc_testnet
```

- In order to connect oapps together, we need to set the peer of the target oapp, more info can be found here https://docs.layerzero.network/v2/developers/evm/getting-started#connecting-your-contracts
```
npx hardhat set-peer --source <hedera_oapp_address> --target <bsc_oapp_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oapp_address> --target <hedera_oapp_address> --network bsc_testnet
```

- Fill the .env

- On these steps, we're sending messages from one chain to another and vice versa
```
npx hardhat test --grep "OAppTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "OAppTests @bsc @send" --network bsc_testnet
```

- Wait a couple of minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

- Finally we're checking whether the messages are received on both chains
```
npx hardhat test --grep "OAppTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "OAppTests @bsc @test" --network bsc_testnet
```

### OFT

Allows fungible tokens to be transferred across multiple chains.

- Deploying OFT tokens which under the hood are ERC20s and contain the messaging between chains functionality provided by LZ
```
npx hardhat deploy-oft --decimals 18 --mint 1000000000000000000 --network hedera_testnet
npx hardhat deploy-oft --decimals 18 --mint 1000000000000000000 --network bsc_testnet
```

- In order to connect OFTs together, we need to set the peer of the target OFT, more info can be found here https://docs.layerzero.network/v2/developers/evm/getting-started#connecting-your-contracts
```
npx hardhat set-peer --source <hedera_oft_address> --target <bsc_oft_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oft_address> --target <hedera_oft_address> --network bsc_testnet
```

- Fill the .env

- On these steps, we're sending tokens between chains. That means we're burning tokens on the source chain and minting new ones on the destination chain
```
npx hardhat test --grep "OFTTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "OFTTests @bsc @send" --network bsc_testnet
```

- Wait a couple of minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

- Finally we're checking whether the token balances are as expected on both the source and destination chains.
```
npx hardhat test --grep "OFTTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "OFTTests @bsc @test" --network bsc_testnet
```

### OFT Adapter

If your token already exists on the chain you want to connect, you can deploy the OFT Adapter contract to act as an intermediary lockbox for the token.

- Deploying ERC20 tokens on each chain
```
npx hardhat deploy-erc20 --decimals 18 --mint 10000000000000000000 --network hedera_testnet
npx hardhat deploy-erc20 --decimals 18 --mint 10000000000000000000 --network bsc_testnet
```

- Deploying an OFT Adapter which will be used as a lockbox of ERC20s deployed the step above
```
npx hardhat deploy-oft-adapter --token <erc20_hedera_address> --network hedera_testnet
npx hardhat deploy-oft-adapter --token <erc20_bsc_address> --network bsc_testnet
```

- In order to connect OFT Adapters together, we need to set the peer of the target OFT Adapter, more info can be found here https://docs.layerzero.network/v2/developers/evm/getting-started#connecting-your-contracts
```
npx hardhat set-peer --source <hedera_oft_adapter_address> --target <bsc_oft_adapter_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oft_adapter_address> --target <hedera_oft_adapter_address> --network bsc_testnet
```

- Fill the .env

- Here we're funding the Adapter on both chains with some liquidity and after that we're approving it to spend the signer's token
```
npx hardhat test --grep "OFTAdapterTests @hedera @fund-and-approve" --network hedera_testnet
npx hardhat test --grep "OFTAdapterTests @bsc @fund-and-approve" --network bsc_testnet
```

- On these steps, we're sending already existing tokens that are used by OFT Adapter between different chains
```
npx hardhat test --grep "OFTAdapterTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "OFTAdapterTests @bsc @send" --network bsc_testnet
```

- Wait a couple of minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

- Finally we're checking the balances on each chain
```
npx hardhat test --grep "OFTAdapterTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "OFTAdapterTests @bsc @test" --network bsc_testnet
```

### ONFT

Allows non-fungible tokens to be transferred across multiple chains.

- Deploying ONFT tokens which under the hood are ERC721s and contain the messaging between chains functionality provided by LZ
```
npx hardhat deploy-onft --network hedera_testnet
npx hardhat deploy-onft --network bsc_testnet
```

- In order to connect ONFTs together, we need to set the peer of the target ONFT, more info can be found here https://docs.layerzero.network/v2/developers/evm/getting-started#connecting-your-contracts
```
npx hardhat set-peer --source <hedera_onft_address> --target <bsc_onft_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_onft_address> --target <hedera_onft_address> --network bsc_testnet
```

- Fill the .env

- On these steps, we're sending NFTs between chains. That means we're burning the NFT on the source chain and minting new one on the destination chain
```
npx hardhat test --grep "ONFTTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "ONFTTests @bsc @send" --network bsc_testnet
```

- Wait a couple of minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

- Finally we're checking whether the NFTs are transferred successfully
```
npx hardhat test --grep "ONFTTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "ONFTTests @bsc @send" --network bsc_testnet
```

### ONFT Adapter

If your NFT contract already exists on the chain you want to connect, you can deploy the ONFT Adapter contract to act as an intermediary lockbox.

- Deploying ERC721s on each chain we want to connect
```
npx hardhat deploy-erc721 --network hedera_testnet
npx hardhat deploy-erc721 --network bsc_testnet
```

- Deploying an ONFT Adapter which will be used as a lockbox of ERC721s deployed the step above
```
npx hardhat deploy-onft-adapter --token <erc721_hedera_address> --network hedera_testnet
npx hardhat deploy-onft-adapter --token <erc721_bsc_address> --network bsc_testnet
```

- In order to connect ONFT Adapters together, we need to set the peer of the target ONFT Adapter, more info can be found here https://docs.layerzero.network/v2/developers/evm/getting-started#connecting-your-contracts
```
npx hardhat set-peer --source <hedera_onft_adapter_address> --target <bsc_onft_adapter_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_onft_adapter_address> --target <hedera_onft_adapter_address> --network bsc_testnet
```

- Fill the .env

- First, we have to mint some NFTs on each chain
```
npx hardhat test --grep "ONFTAdapterTests @hedera @mint" --network hedera_testnet
npx hardhat test --grep "ONFTAdapterTests @bsc @mint" --network bsc_testnet
```

- Then, we have to approve the Adapter to be able to spend the NFT we want to send to another chain
```
npx hardhat test --grep "ONFTAdapterTests @hedera @approve" --network hedera_testnet
npx hardhat test --grep "ONFTAdapterTests @bsc @approve" --network bsc_testnet
```

- On these steps, we're sending already existing NFTs between chains
```
npx hardhat test --grep "ONFTAdapterTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "ONFTAdapterTests @bsc @send" --network bsc_testnet
```

- Wait a couple of minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

- Finally we're checking whether the NFTs are transferred successfully
```
npx hardhat test --grep "ONFTAdapterTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "ONFTAdapterTests @bsc @test" --network bsc_testnet
```

### HTS Connector

npx hardhat deploy-hts-connector --network hedera_testnet
npx hardhat deploy-oft --decimals 8 --mint 1000 --network bsc_testnet

npx hardhat set-peer --source <hedera_oft_address> --target <bsc_oft_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oft_address> --target <hedera_oft_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "HTSConnectorTests @hedera @approve" --network hedera_testnet

npx hardhat test --grep "HTSConnectorTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "HTSConnectorTests @bsc @send" --network bsc_testnet

Wait a couple of minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

npx hardhat test --grep "HTSConnectorTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "HTSConnectorTests @bsc @test" --network bsc_testnet

### HTS Adapter

npx hardhat create-hts-token --network hedera_testnet
npx hardhat deploy-erc20 --decimals 8 --mint 1000 --network bsc_testnet

npx hardhat deploy-oft-adapter --token <erc20_hedera_address> --network hedera_testnet
npx hardhat deploy-oft-adapter --token <erc20_bsc_address> --network bsc_testnet

npx hardhat set-peer --source <hedera_oft_adapter_address> --target <bsc_oft_adapter_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oft_adapter_address> --target <hedera_oft_adapter_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "HTSAdapterTests @hedera @fund-and-approve" --network hedera_testnet
npx hardhat test --grep "HTSAdapterTests @bsc @fund-and-approve" --network bsc_testnet

npx hardhat test --grep "HTSAdapterTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "HTSAdapterTests @bsc @send" --network bsc_testnet

Wait a couple of minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

npx hardhat test --grep "HTSAdapterTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "HTSAdapterTests @bsc @test" --network bsc_testnet

### WHBAR flow

npx hardhat deploy-whbar --network hedera_testnet
npx hardhat deploy-erc20 --decimals 8 --mint 100000000 --network bsc_testnet

npx hardhat deploy-oft-adapter --token <whbar_hedera_address> --network hedera_testnet
npx hardhat deploy-oft-adapter --token <erc20_bsc_address> --network bsc_testnet

npx hardhat set-peer --source <hedera_oft_adapter_address> --target <bsc_oft_adapter_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oft_adapter_address> --target <hedera_oft_adapter_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "WHBARTests @hedera @deposit" --network hedera_testnet

npx hardhat test --grep "WHBARTests @hedera @fund-and-approve" --network hedera_testnet
npx hardhat test --grep "WHBARTests @bsc @fund-and-approve" --network bsc_testnet

npx hardhat test --grep "WHBARTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "WHBARTests @bsc @send" --network bsc_testnet

npx hardhat test --grep "WHBARTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "WHBARTests @bsc @test" --network bsc_testnet