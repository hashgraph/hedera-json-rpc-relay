/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

const { ethers } = require('hardhat');
const { Options, addressToBytes32 } = require('@layerzerolabs/lz-v2-utilities');

const HEDERA_EID = 40285;
const BSC_EID = 40102;

xdescribe('test ', function() {
  it('@hedera cross send to bsc', async () => {
    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0);

    const contract = await ethers.getContractAt('ExampleOApp', '0xD8f4079c913e15CA0679666F89671aAd8E24B957');
    const tx = await contract.send(
      BSC_EID,
      '1111111111',
      _options.toHex(),
      { gasLimit: 10_000_000, value: '5000000000000000000' }
    );
    console.log(await tx.wait());
  });

  it('@bsc cross send to hedera', async () => {
    const _options = Options.newOptions().addExecutorLzReceiveOption(300000, 0);

    const contract = await ethers.getContractAt('ExampleOApp', '0x97A10e71bd5258075DCBCa40cbaB9E74129c303E');
    const tx = await contract.send(
      HEDERA_EID,
      '2222222222',
      _options.toHex(),
      { gasLimit: 12_000_000, value: '1000000000000000' }
    );
    console.log(await tx.wait());
  });

  it('@hedera data() hedera', async () => {
    const contract = await ethers.getContractAt('ExampleOApp', '0xD8f4079c913e15CA0679666F89671aAd8E24B957');
    console.log(await contract.data());
  });

  it('@bsc data() bsc', async () => {
    const contract = await ethers.getContractAt('ExampleOApp', '0x97A10e71bd5258075DCBCa40cbaB9E74129c303E');
    console.log(await contract.data());
  });
});

xdescribe('test oft', function() {
  const receiverAddress = '0xF51c7a9407217911d74e91642dbC58F18E51Deac';
  const HEDERA_OFT_CONTRACT = '0x25e727248DA63D88c7AeF6c01486Fd489E148950';
  const BSC_OFT_CONTRACT = '0xC3dd597Fe5cFffB5A5F5c252746d887284FA586D';
  xit('cross send to bsc', async () => {
    const signers = await ethers.getSigners();
    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes();
    const sendParam = {
      dstEid: BSC_EID,
      to: addressToBytes32(receiverAddress),
      amountLD: '100000000000000000',
      minAmountLD: '100000000000000000',
      extraOptions: _options,
      composeMsg: ethers.utils.arrayify('0x'), // Assuming no composed message
      oftCmd: ethers.utils.arrayify('0x') // Assuming no OFT command is needed
    };

    const contract = await ethers.getContractAt('ExampleOFT', HEDERA_OFT_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '500000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 10_000_000,
      value: '5000000000000000000'
    });
    console.log(await tx.wait());
  });

  xit('cross send to hedera', async () => {
    const signers = await ethers.getSigners();
    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes();
    const sendParam = {
      dstEid: HEDERA_EID,
      to: addressToBytes32(receiverAddress),
      amountLD: '100000000000000000',
      minAmountLD: '100000000000000000',
      extraOptions: _options,
      composeMsg: ethers.utils.arrayify('0x'), // Assuming no composed message
      oftCmd: ethers.utils.arrayify('0x') // Assuming no OFT command is needed
    };

    const contract = await ethers.getContractAt('ExampleOFT', BSC_OFT_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '1000000000000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 1_000_000,
      value: '1000000000000000'
    });
    console.log(await tx.wait());
  });

  it('get balance hedera', async () => {
    const signers = await ethers.getSigners();

    const contract = await ethers.getContractAt('ExampleOFT', HEDERA_OFT_CONTRACT);
    console.log(await contract.balanceOf(signers[0].address));
    console.log(await contract.balanceOf(receiverAddress));
  });

  it('get balance bsc', async () => {
    const signers = await ethers.getSigners();

    const contract = await ethers.getContractAt('ExampleOFT', BSC_OFT_CONTRACT);
    console.log(await contract.balanceOf(signers[0].address));
    console.log(await contract.balanceOf(receiverAddress));
  });
});

xdescribe('test oft adapter', function() {
  const receiverAddress = '0xF51c7a9407217911d74e91642dbC58F18E51Deac';

  const HEDERA_ERC20_CONTRACT = '0x3a04e0b89704AED113631AEB83FBb18e2a741EE2';
  const BSC_ERC20_CONTRACT = '0x3b77bA19F12a0629C29aC0f69903563EEf3fCb05';

  const HEDERA_OFT_ADAPTER_CONTRACT = '0xff78dc054c6858823c21FbB32E76bA7Ce83B4251';
  const BSC_OFT_ADAPTER_CONTRACT = '0xecB742E73eADb2a7a03086E38140aA8Ac1F3D8D8';

  it('fund bsc adapter', async () => {
    const contractERC20 = await ethers.getContractAt('ERC20Mock', BSC_ERC20_CONTRACT);
    const transferTx = await contractERC20.transfer(BSC_OFT_ADAPTER_CONTRACT, '100000000000000000');
    await transferTx.wait();
  });

  it('fund hedera adapter', async () => {
    const contractERC20 = await ethers.getContractAt('ERC20Mock', HEDERA_ERC20_CONTRACT);
    const transferTx = await contractERC20.transfer(HEDERA_OFT_ADAPTER_CONTRACT, '100000000000000000');
    await transferTx.wait();
  });

  it('approve bsc adapter', async () => {
    const contractERC20 = await ethers.getContractAt('ERC20Mock', BSC_ERC20_CONTRACT);
    const approveTx = await contractERC20.approve(BSC_OFT_ADAPTER_CONTRACT, '100000000000000000');
    await approveTx.wait();
  });

  it('approve hedera adapter', async () => {
    const contractERC20 = await ethers.getContractAt('ERC20Mock', HEDERA_ERC20_CONTRACT);
    const approveTx = await contractERC20.approve(HEDERA_OFT_ADAPTER_CONTRACT, '100000000000000000');
    await approveTx.wait();
  });

  it('cross send to bsc', async () => {
    const signers = await ethers.getSigners();

    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes();
    const sendParam = {
      dstEid: BSC_EID,
      to: addressToBytes32(receiverAddress),
      amountLD: '100000000000000000',
      minAmountLD: '100000000000000000',
      extraOptions: _options,
      composeMsg: ethers.utils.arrayify('0x'),
      oftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleOFTAdapter', HEDERA_OFT_ADAPTER_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '500000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 10_000_000,
      value: '5000000000000000000'
    });

    console.log(await tx.wait());
  });

  it('cross send to hedera', async () => {
    const signers = await ethers.getSigners();

    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes();
    const sendParam = {
      dstEid: HEDERA_EID,
      to: addressToBytes32(receiverAddress),
      amountLD: '100000000000000000',
      minAmountLD: '100000000000000000',
      extraOptions: _options,
      composeMsg: ethers.utils.arrayify('0x'),
      oftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleOFTAdapter', BSC_OFT_ADAPTER_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '1000000000000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 1_000_000,
      value: '1000000000000000'
    });
    console.log(await tx.wait());
  });

  it('get balance hedera', async () => {
    const signers = await ethers.getSigners();

    console.log('ERC20');
    const contractERC20 = await ethers.getContractAt('ERC20Mock', HEDERA_ERC20_CONTRACT);
    console.log('signer: ' + await contractERC20.balanceOf(signers[0].address));
    console.log('contract: ' + await contractERC20.balanceOf(HEDERA_OFT_ADAPTER_CONTRACT));
    console.log('receiver: ' + await contractERC20.balanceOf(receiverAddress));
  });

  it('get balance bsc', async () => {
    const signers = await ethers.getSigners();

    console.log('ERC20');
    const contractERC20 = await ethers.getContractAt('ERC20Mock', BSC_ERC20_CONTRACT);
    console.log('signer: ' + await contractERC20.balanceOf(signers[0].address));
    console.log('contract: ' + await contractERC20.balanceOf(BSC_OFT_ADAPTER_CONTRACT));
    console.log('receiver: ' + await contractERC20.balanceOf(receiverAddress));
  });
});

xdescribe('test onft', function() {
  const receiverAddress = '0xF51c7a9407217911d74e91642dbC58F18E51Deac';
  const HEDERA_ONFT_CONTRACT = '0x5E74F32347Be7c23f1396f904a97898a5E244B57';
  const BSC_ONFT_CONTRACT = '0x79535b9adE8235CB099979a945df9d2Df0093550';
  it('cross send to bsc', async () => {
    const signers = await ethers.getSigners();
    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes();
    const sendParam = {
      dstEid: BSC_EID,
      to: addressToBytes32(receiverAddress),
      tokenId: 1,
      extraOptions: _options,
      composeMsg: ethers.utils.arrayify('0x'), // Assuming no composed message
      onftCmd: ethers.utils.arrayify('0x') // Assuming no OFT command is needed
    };

    const contract = await ethers.getContractAt('ExampleONFT', HEDERA_ONFT_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '500000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 10_000_000,
      value: '5000000000000000000'
    });
    console.log(await tx.wait());
  });

  it('cross send to hedera', async () => {
    const signers = await ethers.getSigners();
    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes();
    const sendParam = {
      dstEid: HEDERA_EID,
      to: addressToBytes32(receiverAddress),
      tokenId: 2,
      extraOptions: _options,
      composeMsg: ethers.utils.arrayify('0x'), // Assuming no composed message
      onftCmd: ethers.utils.arrayify('0x') // Assuming no OFT command is needed
    };

    const contract = await ethers.getContractAt('ExampleONFT', BSC_ONFT_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '1000000000000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 1_000_000,
      value: '1000000000000000'
    });
    console.log(await tx.wait());
  });

  it('get owner hedera', async () => {
    const signers = await ethers.getSigners();

    const contract = await ethers.getContractAt('ExampleONFT', HEDERA_ONFT_CONTRACT);
    console.log('signer: ' + signers[0].address);
    console.log('receiver: ' + receiverAddress);
    // console.log('owner of 1: ' + await contract.ownerOf(1));
    // console.log('owner of 2: ' + await contract.ownerOf(2));
  });

  it('get owner bsc', async () => {
    const signers = await ethers.getSigners();

    const contract = await ethers.getContractAt('ExampleONFT', BSC_ONFT_CONTRACT);
    console.log('signer: ' + signers[0].address);
    console.log('receiver: ' + receiverAddress);
    // console.log('owner of 1: ' + await contract.ownerOf(1));
    // console.log('owner of 2: ' + await contract.ownerOf(2));
  });
});

xdescribe('test onft-adapter', function() {
  const receiverAddress = '0xF51c7a9407217911d74e91642dbC58F18E51Deac';
  const HEDERA_ERC721_CONTRACT = '0xC0D9235f8e2a87a24ab09E6FE49fe611fD0c426B';
  const BSC_ERC721_CONTRACT = '0x730450E6cd8aE6CBa521b7155e808788cf9e7C6E';
  const HEDERA_ONFT_ADAPTER_CONTRACT = '0x4f48995Bd2AE982044DC519C76E708c117b63FE5';
  const BSC_ONFT_ADAPTER_CONTRACT = '0xbf0108515F7379eE7392cDFD75a27c328222A544';

  it('cross send to bsc', async () => {
    const signers = await ethers.getSigners();
    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes();
    const sendParam = {
      dstEid: BSC_EID,
      to: addressToBytes32(receiverAddress),
      tokenId: 1,
      extraOptions: _options,
      composeMsg: ethers.utils.arrayify('0x'), // Assuming no composed message
      onftCmd: ethers.utils.arrayify('0x') // Assuming no OFT command is needed
    };

    const contract = await ethers.getContractAt('ExampleONFTAdapter', HEDERA_ONFT_ADAPTER_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '500000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 10_000_000,
      value: '5000000000000000000'
    });
    console.log(await tx.wait());
  });

  it('cross send to hedera', async () => {
    const signers = await ethers.getSigners();
    const _options = Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes();
    const sendParam = {
      dstEid: HEDERA_EID,
      to: addressToBytes32(receiverAddress),
      tokenId: 2,
      extraOptions: _options,
      composeMsg: ethers.utils.arrayify('0x'), // Assuming no composed message
      onftCmd: ethers.utils.arrayify('0x') // Assuming no OFT command is needed
    };

    const contract = await ethers.getContractAt('ExampleONFTAdapter', BSC_ONFT_ADAPTER_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '1000000000000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 1_000_000,
      value: '1000000000000000'
    });
    console.log(await tx.wait());
  });

  it('approve hedera', async () => {
    const contract = await ethers.getContractAt('ERC721Mock', HEDERA_ERC721_CONTRACT);
    const tx = await contract.approve(HEDERA_ONFT_ADAPTER_CONTRACT, 1);
    await tx.wait();
  });

  it('approve bsc', async () => {
    const contract = await ethers.getContractAt('ERC721Mock', BSC_ERC721_CONTRACT);
    const tx = await contract.approve(BSC_ONFT_ADAPTER_CONTRACT, 2);
    await tx.wait();
  });

  it('mint hedera', async () => {
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt('ERC721Mock', HEDERA_ERC721_CONTRACT);
    const tx = await contract.mint(signers[0].address, 1);
    await tx.wait();
  });

  it('mint bsc', async () => {
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt('ERC721Mock', BSC_ERC721_CONTRACT);
    const tx = await contract.mint(signers[0].address, 2);
    await tx.wait();
  });

  it('get owner hedera', async () => {
    const signers = await ethers.getSigners();

    const contract = await ethers.getContractAt('ERC721Mock', HEDERA_ERC721_CONTRACT);
    console.log('signer: ' + signers[0].address);
    console.log('receiver: ' + receiverAddress);
    console.log('owner of 1: ' + await contract.ownerOf(1));
    console.log('owner of 2: ' + await contract.ownerOf(2));
  });

  it('get owner bsc', async () => {
    const signers = await ethers.getSigners();

    const contract = await ethers.getContractAt('ERC721Mock', BSC_ERC721_CONTRACT);
    console.log('signer: ' + signers[0].address);
    console.log('receiver: ' + receiverAddress);
    console.log('owner of 1: ' + await contract.ownerOf(1));
    console.log('owner of 2: ' + await contract.ownerOf(2));
  });
});
