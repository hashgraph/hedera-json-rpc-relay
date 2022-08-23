/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

const ERC20_ABI = [
  {
    'constant': true,
    'inputs': [],
    'name': 'name',
    'outputs': [
      {
        'name': '',
        'type': 'string'
      }
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
  },
  {
    'inputs': [
      {
        'internalType': 'address',
        'name': 'toAssociateWith',
        'type': 'address'
      },
      {
        'internalType': 'address',
        'name': 'tokenAddress',
        'type': 'address'
      }
    ],
    'name': 'associateTokenTo',
    'outputs': [
      {
        'internalType': 'int256',
        'name': 'responseCode',
        'type': 'int256'
      }
    ],
    'stateMutability': 'nonpayable',
    'type': 'function'
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': '_spender',
        'type': 'address'
      },
      {
        'name': '_value',
        'type': 'uint256'
      }
    ],
    'name': 'approve',
    'outputs': [
      {
        'name': '',
        'type': 'bool'
      }
    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function'
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'totalSupply',
    'outputs': [
      {
        'name': '',
        'type': 'uint256'
      }
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': '_from',
        'type': 'address'
      },
      {
        'name': '_to',
        'type': 'address'
      },
      {
        'name': '_value',
        'type': 'uint256'
      }
    ],
    'name': 'transferFrom',
    'outputs': [
      {
        'name': '',
        'type': 'bool'
      }
    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function'
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'decimals',
    'outputs': [
      {
        'name': '',
        'type': 'uint8'
      }
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': '_owner',
        'type': 'address'
      }
    ],
    'name': 'balanceOf',
    'outputs': [
      {
        'name': 'balance',
        'type': 'uint256'
      }
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'symbol',
    'outputs': [
      {
        'name': '',
        'type': 'string'
      }
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': '_to',
        'type': 'address'
      },
      {
        'name': '_value',
        'type': 'uint256'
      }
    ],
    'name': 'transfer',
    'outputs': [
      {
        'name': '',
        'type': 'bool'
      }
    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function'
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': '_owner',
        'type': 'address'
      },
      {
        'name': '_spender',
        'type': 'address'
      }
    ],
    'name': 'allowance',
    'outputs': [
      {
        'name': '',
        'type': 'uint256'
      }
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
  },
  {
    'payable': true,
    'stateMutability': 'payable',
    'type': 'fallback'
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': true,
        'name': 'owner',
        'type': 'address'
      },
      {
        'indexed': true,
        'name': 'spender',
        'type': 'address'
      },
      {
        'indexed': false,
        'name': 'value',
        'type': 'uint256'
      }
    ],
    'name': 'Approval',
    'type': 'event'
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': true,
        'name': 'from',
        'type': 'address'
      },
      {
        'indexed': true,
        'name': 'to',
        'type': 'address'
      },
      {
        'indexed': false,
        'name': 'value',
        'type': 'uint256'
      }
    ],
    'name': 'Transfer',
    'type': 'event'
  }
];


const contractAddress = '0x00000000000000000000000000000000000003f9';
const tokenAddress = '0x00000000000000000000000000000000000003Fa';
const nftTokenAddress = '0x00000000000000000000000000000000000003Fa';

task('test-deploy-basehts', async (taskArgs) => {
  const hre = require('hardhat');
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

  const BaseHTS = await hre.ethers.getContractFactory('BaseHTS', wallet);
  const baseHTS = await BaseHTS.deploy();
  const { contractAddress } = await baseHTS.deployTransaction.wait();

  console.log(contractAddress);
});

task('test-deploy-hts-token', async (taskArgs) => {
  const hre = require('hardhat');
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

  const contract = await hre.ethers.getContractAt('BaseHTS', contractAddress, wallet);

  const tx = await contract.createFungibleTokenPublic(wallet.address, {
    value: hre.ethers.BigNumber.from('20000000000000000000'),
    gasLimit: 1000000
  });
  const { tokenAddress } = (await tx.wait()).events[0].args;
  console.log(tokenAddress);
});

task('test-deploy-hts-nft-token', async (taskArgs) => {
  const hre = require('hardhat');
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

  const contract = await hre.ethers.getContractAt('BaseHTS', contractAddress, wallet);

  const tx = await contract.createNonFungibleTokenPublic(wallet.address, {
    value: hre.ethers.BigNumber.from('20000000000000000000'),
    gasLimit: 10000000
  });
  const { tokenAddress } = (await tx.wait()).events[0].args;
  console.log(tokenAddress);
});

task('test-nft-setApprovalForAll', async (taskArgs) => {
  const hre = require('hardhat');
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const operator = new hre.ethers.Wallet(process.env.RECEIVER_PRIVATE_KEY, provider);

  const contractWallet = await hre.ethers.getContractAt('BaseHTS', contractAddress, wallet);

  const txBefore = (await contractWallet.isApprovedForAllPublic(nftTokenAddress, contractWallet.address, operator.address));
  console.log((await txBefore.wait()).events.map(e => console.log(e.args)));console.log('---------------');

  const tx = await contractWallet.setApprovalForAllPublic(nftTokenAddress, operator.address, true, { gasLimit: 5_000_000 });
  console.log((await tx.wait()).events.map(e => console.log(e.args)));console.log('---------------');

  const txAfter = (await contractWallet.isApprovedForAllPublic(nftTokenAddress, contractWallet.address, operator.address));
  console.log((await txAfter.wait()).events.map(e => console.log(e.args)));console.log('---------------');
});

task('test-associate-hts', async (taskArgs) => {
  const hre = require('hardhat');
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const contractWallet = await hre.ethers.getContractAt('BaseHTS', contractAddress, wallet);
  const txContract = await contractWallet.associateTokenPublic(contractAddress, tokenAddress, { gasLimit: 1_000_000 });
  console.log((await txContract.wait()).events.map(e => console.log(e.args)));

  const walletReceiver = new hre.ethers.Wallet(process.env.RECEIVER_PRIVATE_KEY, provider);
  const contractWalletReceiver = await hre.ethers.getContractAt('BaseHTS', contractAddress, walletReceiver);
  const tx1 = await contractWalletReceiver.associateTokenPublic(walletReceiver.address, tokenAddress, { gasLimit: 1_000_000 });
  console.log((await tx1.wait()).events.map(e => console.log(e.args)));

  const walletReceiver2 = new hre.ethers.Wallet('0x45a5a7108a18dd5013cf2d5857a28144beadc9c70b3bdbd914e38df4e804b8d8', provider)
  const contractWalletReceiver2 = await hre.ethers.getContractAt('BaseHTS', contractAddress, walletReceiver2);
  const tx2 = await contractWalletReceiver2.associateTokenPublic(walletReceiver2.address, tokenAddress, { gasLimit: 1_000_000 });
  console.log((await tx2.wait()).events.map(e => console.log(e.args)));
});

task('test-transfer-hts', async (taskArgs) => {
  const hre = require('hardhat');
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const walletReceiver = new hre.ethers.Wallet(process.env.RECEIVER_PRIVATE_KEY, provider);

  const contractWallet = await hre.ethers.getContractAt(ERC20_ABI, tokenAddress, wallet);
  // const contractWalletReceiver = await hre.ethers.getContractAt(ERC20_ABI, tokenAddress, walletReceiver);

  console.log(await contractWallet.balanceOf(await wallet.address));
  console.log(await contractWallet.balanceOf(await walletReceiver.address));

  const contractWalletBase = await hre.ethers.getContractAt('BaseHTS', contractAddress, wallet);
  await contractWalletBase.transferTokenPublic(walletReceiver.address, tokenAddress, 50);

  console.log(await contractWallet.balanceOf(await wallet.address));
  console.log(await contractWallet.balanceOf(await walletReceiver.address));
});

task('test-approve-hts', async (taskArgs) => {
  const hre = require('hardhat');
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const walletReceiver2 = new hre.ethers.Wallet('0x45a5a7108a18dd5013cf2d5857a28144beadc9c70b3bdbd914e38df4e804b8d8', provider);

  const contractWalletBase = await hre.ethers.getContractAt('BaseHTS', contractAddress, wallet);

  const txBefore = await contractWalletBase.allowancePublic(tokenAddress, contractAddress, walletReceiver2.address);
  const beforeAmount = (await txBefore.wait()).events.filter(e => e.event === 'AllowanceValue')[0].args.amount.toNumber();
  console.log(beforeAmount);
  console.log('--------------------------');

  const txApprove = await contractWalletBase.approvePublic(tokenAddress, walletReceiver2.address, 13, { gasLimit: 1_000_000 });
  await txApprove.wait();
  console.log((await txApprove.wait()).events.map(e => console.log(e.args)));console.log('--------------------------');

  const txAfter = await contractWalletBase.allowancePublic(tokenAddress, contractAddress, walletReceiver2.address);
  const afterAmount = (await txAfter.wait()).events.filter(e => e.event === 'AllowanceValue')[0].args.amount.toNumber();
  console.log(afterAmount);
  console.log('--------------------------');
});


task('get-token-key', async (taskArgs) => {
  const hre = require('hardhat');
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

  const BaseHTS = await hre.ethers.getContractFactory('BaseHTS', wallet);
  const baseHTS = await BaseHTS.deploy({gasLimit: 5_000_000});
  const { contractAddress } = await baseHTS.deployTransaction.wait();

  console.log(contractAddress);

  const baseHTSContract = await hre.ethers.getContractAt('BaseHTS', contractAddress, wallet);

  const tx = await baseHTSContract.createFungibleTokenPublic(wallet.address, {
    value: hre.ethers.BigNumber.from('20000000000000000000'),
    gasLimit: 1000000
  });
  const { tokenAddress } = (await tx.wait()).events[0].args;

  // const tokenConract = await hre.ethers.getContractAt(ERC20_ABI, tokenAddress, wallet);

  {
    const tx = await baseHTSContract.getTokenKeyPublic(tokenAddress, 2);
    const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;

    console.log("responseCode: ");
    console.log(responseCode);

    const { key } = (await tx.wait()).events.filter(e => e.event === 'KeyValue')[0].args;

    key.inheritAccountKey
    key.contractId;
    key.ed25519;
    key.ECDSA_secp256k1;
    key.delegatableContractId;
  }

});

module.exports = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: 'relay',
  networks: {
    relay: {
      url: process.env.RELAY_ENDPOINT
    }
  }
};