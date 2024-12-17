### WHBAR Hardhat Example

The WHBAR contract for Wrapped HBAR to help transactions that use native token payments.

##### Properties:
- name - ```string``` "Wrapped HBAR"
- symbol - ```string``` "WHBAR"decimals
- decimals - ```uint8``` 18 # denominated in weibars
- balanceOf - ``` mapping(address => uint256) balanceOf```
- allowance - ```mapping(address => mapping(address => uint256)) allowance```

##### Events:
- Approval - ```event Approval(address src, address guy, uint256 wad)```
- Transfer - ``` event Transfer(address src, address dst, uint256 wad)```
- Deposit - ``` event Deposit(address dst, uint256 wad)```
- Withdrawal - ``` event Withdrawal(address src, uint256 wad)```

##### Methods:
- receive - ```receive() external payable```
- fallback - ```fallback() external payable```
- deposit - ```function deposit() external payable```
- withdraw - ```function withdraw(uint256 wad) external```
- totalSupply - ```function totalSupply() public view returns (uint256)```
- approve - ```function approve(address guy, uint256 wad) public returns (bool)```
- transfer - ```function transfer(address dst, uint256 wad) public returns (bool)```
- transferFrom - ```function transferFrom(address src, address dst, uint256 wad) public returns (bool)```

#### Run the project locally
```
npm install
fill the .env
npx hardhat compile
npx hardhat deploy-whbar
```

#### Build a docker image and deploy the WHBAR within it
Build the docker image (optionaly you can push it to registry):
```
docker build . --tag whbar-hardhat-example-1.0
```

And deploy the whbar (local docker image tag):
- envs:
  - NETWORK='testnet' # available networks (mainnet, testnet, previewnet)
  - ECDSA_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000' # 32 bytes ECDSA private key
```
docker run
    -it
    -e NETWORK='testnet'
    -e ECDSA_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000'
    whbar-hardhat-example-1.0
    /bin/sh -c 'npx hardhat deploy-whbar'
```

Or you can use the already pushed image (natanasow/whbar-hardhat-example:1.5):
- envs:
  - NETWORK='testnet' # available networks (mainnet, testnet, previewnet)
  - ECDSA_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000' # 32 bytes ECDSA private key
```
docker run
    -it
    -e NETWORK='testnet'
    -e ECDSA_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000'
    natanasow/whbar-hardhat-example:1.5
    /bin/sh -c 'npx hardhat deploy-whbar'
```

#### Verification

You can use `verification_file.json` from the root directory to verify your contract in Hashscan. The process is pretty
simple, just upload the `verification_file.json` and click "Verify".

![Verification](https://i.ibb.co/Syjxw3B/verification.jpg)
