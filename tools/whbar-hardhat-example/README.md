### WHBAR Hardhat Example

The WHBAR contract for Wrapped HBAR to help transactions that use native token payments.

##### Properties:
- name - ```string``` "Wrapped HBAR"
- symbol - ```string``` "WHBAR"decimals
- decimals - ```uint8``` 8
- balanceOf - ``` mapping(address => uint256) balanceOf```
- allowance - ```mapping(address => mapping(address => uint256)) allowance```

##### Events:
- Approval - ```event Approval(address src, address guy, uint256 wad)```
- Transfer - ``` event Transfer(address src, address dst, uint256 wad)```
- Deposit - ``` event Deposit(address dst, uint256 wad)```
- Withdrawal - ``` event Withdrawal(address src, uint256 wad)```

##### Errors:
- InsufficientFunds - ```error InsufficientFunds()```
- InsufficientAllowance - ```error InsufficientAllowance()```
- SendFailed - ```error SendFailed()```

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
```bash
docker build . --tag whbar-hardhat-example-1.0
```

And deploy the whbar (local docker image tag):
- envs:
  - NETWORK='testnet' # available networks (mainnet, testnet, previewnet)
  - ECDSA_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000' # 32 bytes ECDSA private key
  - ED25519_ACCOUNT_ID=0.0.0 # Account ID of ED25519 in format <realm>.<shard>.<num>
  - ED25519_HEX_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000 # 32 bytes ED25519 private key
  - INITIAL_BALANCE='1000' # denominated in HBARs

**If you're using ECDSA pk:**
```bash
docker run
    -it
    -e NETWORK='testnet'
    -e ECDSA_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000'
    -e INITIAL_BALANCE='1000'
    whbar-hardhat-example-1.0
    /bin/sh -c 'npx hardhat deploy-whbar'
```

Or you can use the already pushed image (natanasow/whbar-hardhat-example:3.2):
```bash
docker run
    -it
    -e NETWORK='testnet'
    -e ECDSA_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000'
    -e INITIAL_BALANCE='1000'
    natanasow/whbar-hardhat-example:3.2
    /bin/sh -c 'npx hardhat deploy-whbar'
```

**Or if you're using ED25519 pk:**
```bash
docker run
    -it
    -e NETWORK='testnet'
    -e ED25519_ACCOUNT_ID='0.0.<num>'
    -e ED25519_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000'
    -e INITIAL_BALANCE='1000'
    whbar-hardhat-example-1.0
    /bin/sh -c 'npx hardhat deploy-whbar-using-ed25519-signer-key'
```

Or you can use the already pushed image (natanasow/whbar-hardhat-example:3.2):
```bash
docker run
    -it
    -e NETWORK='testnet'
    -e ED25519_ACCOUNT_ID='0.0.<num>'
    -e ED25519_HEX_PRIVATE_KEY='0x0000000000000000000000000000000000000000000000000000000000000000'
    -e INITIAL_BALANCE='1000'
    natanasow/whbar-hardhat-example:3.2
    /bin/sh -c 'npx hardhat deploy-whbar-using-ed25519-signer-key'
```

#### Verification

You can use `verification_file.json` from the root directory to verify your contract in Hashscan. The process is pretty
simple, just upload the `verification_file.json` and click "Verify".

![Verification](https://i.ibb.co/Syjxw3B/verification.jpg)
