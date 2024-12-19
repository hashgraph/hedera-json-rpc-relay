# Layer Zero examples

### OApp

npx hardhat deploy-oapp --network hedera_testnet
npx hardhat deploy-oapp --network bsc_testnet

npx hardhat set-peer --source <hedera_oapp_address> --target <bsc_oapp_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oapp_address> --target <hedera_oapp_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "OAppTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "OAppTests @bsc @send" --network bsc_testnet

wait a couple minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

npx hardhat test --grep "OAppTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "OAppTests @bsc @test" --network bsc_testnet


### OFT

npx hardhat deploy-oft --decimals 18 --mint 1000000000000000000 --network hedera_testnet
npx hardhat deploy-oft --decimals 18 --mint 1000000000000000000 --network bsc_testnet

npx hardhat set-peer --source <hedera_oft_address> --target <bsc_oft_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oft_address> --target <hedera_oft_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "OFTTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "OFTTests @bsc @send" --network bsc_testnet

wait a couple minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

npx hardhat test --grep "OFTTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "OFTTests @bsc @test" --network bsc_testnet

### OFT Adapter

npx hardhat deploy-erc20 --network hedera_testnet
npx hardhat deploy-erc20 --network bsc_testnet

npx hardhat deploy-oft-adapter --token <erc20_hedera_address> --network hedera_testnet
npx hardhat deploy-oft-adapter --token <erc20_bsc_address> --network bsc_testnet

npx hardhat set-peer --source <hedera_oft_adapter_address> --target <bsc_oft_adapter_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oft_adapter_address> --target <hedera_oft_adapter_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "OFTAdapterTests @hedera @fund-and-approve" --network hedera_testnet
npx hardhat test --grep "OFTAdapterTests @bsc @fund-and-approve" --network bsc_testnet

npx hardhat test --grep "OFTAdapterTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "OFTAdapterTests @bsc @send" --network bsc_testnet

wait a couple minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

npx hardhat test --grep "OFTAdapterTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "OFTAdapterTests @bsc @test" --network bsc_testnet

### ONFT

npx hardhat deploy-onft --network hedera_testnet
npx hardhat deploy-onft --network bsc_testnet

npx hardhat set-peer --source <hedera_onft_address> --target <bsc_onft_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_onft_address> --target <hedera_onft_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "ONFTTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "ONFTTests @bsc @send" --network bsc_testnet

wait a couple minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

npx hardhat test --grep "ONFTTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "ONFTTests @bsc @send" --network bsc_testnet

### ONFT Adapter

npx hardhat deploy-erc721 --network hedera_testnet
npx hardhat deploy-erc721 --network bsc_testnet

npx hardhat deploy-onft-adapter --token <erc721_hedera_address> --network hedera_testnet
npx hardhat deploy-onft-adapter --token <erc721_bsc_address> --network bsc_testnet

npx hardhat set-peer --source <hedera_onft_adapter_address> --target <bsc_onft_adapter_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_onft_adapter_address> --target <hedera_onft_adapter_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "ONFTAdapterTests @hedera @mint" --network hedera_testnet
npx hardhat test --grep "ONFTAdapterTests @bsc @mint" --network bsc_testnet

npx hardhat test --grep "ONFTAdapterTests @hedera @approve" --network hedera_testnet
npx hardhat test --grep "ONFTAdapterTests @bsc @approve" --network bsc_testnet

npx hardhat test --grep "ONFTAdapterTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "ONFTAdapterTests @bsc @send" --network bsc_testnet

wait a couple minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

npx hardhat test --grep "ONFTAdapterTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "ONFTAdapterTests @bsc @test" --network bsc_testnet

### HTS Connector

npx hardhat deploy-hts-connector --network hedera_testnet
npx hardhat deploy-oft --decimals 8 --mint 1000 --network bsc_testnet

npx hardhat set-peer --source <hedera_oft_address> --target <bsc_oft_address> --network hedera_testnet
npx hardhat set-peer --source <bsc_oft_address> --target <hedera_oft_address> --network bsc_testnet

fill the .env

npx hardhat test --grep "HTSConnectorTests @hedera @approve" --network hedera_testnet

npx hardhat test --grep "HTSConnectorTests @hedera @send" --network hedera_testnet
npx hardhat test --grep "HTSConnectorTests @bsc @send" --network bsc_testnet

wait a couple minutes, the LZ progress can be tracked on https://testnet.layerzeroscan.com/tx/<tx_hash>

npx hardhat test --grep "HTSConnectorTests @hedera @test" --network hedera_testnet
npx hardhat test --grep "HTSConnectorTests @bsc @test" --network bsc_testnet
