/*-
 *
 * Hedera JSON RPC Relay
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

// external resources
import { solidity } from 'ethereum-waffle';
import chai, { expect } from 'chai';
import { AccountId, Hbar } from '@hashgraph/sdk';
//Constants are imported with different definitions for better readability in the code.
import Constants from '../../helpers/constants';

chai.use(solidity);

import { AliasAccount } from '../../clients/servicesClient';
import { ethers } from 'ethers';
import IERC20MetadataJson from '../../contracts/openzeppelin/IERC20Metadata.json';
import IERC20Json from '../../contracts/openzeppelin/IERC20.json';
import IERC721MetadataJson from '../../contracts/openzeppelin/IERC721Metadata.json';
import IERC721EnumerableJson from '../../contracts/openzeppelin/IERC721Enumerable.json';
import IERC721Json from '../../contracts/openzeppelin/IERC721.json';
import IHederaTokenServiceJson from '../../contracts/IHederaTokenService.json';
import HederaTokenServiceImplJson from '../../contracts/HederaTokenServiceImpl.json';
import TokenManagementContractJson from '../../contracts/TokenManagementContract.json';

import { predefined } from '../../../../relay/src/lib/errors/JsonRpcError';
import { Utils } from '../../helpers/utils';
import { EthImpl } from "@hashgraph/json-rpc-relay/dist/lib/eth";

describe('@precompile-calls Tests for eth_call with HTS', async function () {
    this.timeout(240 * 1000); // 240 seconds
    const { servicesNode, mirrorNode, relay }: any = global;

    const TX_SUCCESS_CODE = 22;

    const TOKEN_NAME = Utils.randomString(10);
    const TOKEN_SYMBOL = Utils.randomString(5);
    const INITIAL_SUPPLY = 100000;

    const NFT_NAME = Utils.randomString(10);
    const NFT_SYMBOL = Utils.randomString(5);
    const NFT_MAX_SUPPLY = 100;
    const NFT_METADATA = 'ABCDE';

    const ZERO_HEX = '0x0000000000000000000000000000000000000000';
    const EMPTY_HEX = '0x';

    const accounts: AliasAccount[] = [];
    let requestId;

    let IERC20Metadata, IERC20, IERC721Metadata, IERC721Enumerable, IERC721, IHederaTokenService, TokenManager, TokenManagementSigner;
    let nftSerial, tokenAddress, nftAddress, htsImplAddress, htsImpl, adminAccountLongZero, account1LongZero, account2LongZero;

    let tokenAddressFixedHbarFees, tokenAddressFixedTokenFees, tokenAddressNoFees,
        tokenAddressFractionalFees, tokenAddressAllFees, nftAddressRoyaltyFees,
        tokenAddresses, nftAddresses;

    before(async () => {
        requestId = Utils.generateRequestId();

        // create accounts
        const contractDeployer = await servicesNode.createAliasAccount(100, relay.provider, requestId);

        // Deploy a contract implementing HederaTokenService
        const HederaTokenServiceImplFactory = new ethers.ContractFactory(HederaTokenServiceImplJson.abi, HederaTokenServiceImplJson.bytecode, contractDeployer.wallet);
        htsImpl = await HederaTokenServiceImplFactory.deploy(await Utils.gasOptions(requestId, 15_000_000));

        const rec0 = await htsImpl.deployTransaction.wait();
        htsImplAddress = rec0.contractAddress;

        // Deploy the Token Management contract
        const TokenManagementContractFactory = new ethers.ContractFactory(TokenManagementContractJson.abi, TokenManagementContractJson.bytecode, contractDeployer.wallet);
        TokenManager = await TokenManagementContractFactory.deploy(await Utils.gasOptions(requestId, 15_000_000));
        await htsImpl.deployTransaction.wait();

        const tokenManagementMirror = await mirrorNode.get(`/contracts/${TokenManager.address}`, requestId);

        // create accounts
        accounts[0] = await servicesNode.createAccountWithContractIdKey(tokenManagementMirror.contract_id, 400, relay.provider, requestId);
        accounts[1] = await servicesNode.createAliasAccount(200, relay.provider, requestId);
        accounts[2] = await servicesNode.createAliasAccount(200, relay.provider, requestId);

        TokenManagementSigner = TokenManager.connect(accounts[0].wallet);

        await new Promise(r => setTimeout(r, 5000));
        await mirrorNode.get(`/accounts/${accounts[0].accountId}`, requestId);
        await mirrorNode.get(`/accounts/${accounts[1].accountId}`, requestId);
        await mirrorNode.get(`/accounts/${accounts[2].accountId}`, requestId);

        // Create tokens
        const defaultTokenOptions = {
            tokenName: TOKEN_NAME,
            symbol: TOKEN_SYMBOL,
            treasuryAccountId: accounts[0].accountId.toString(),
            initialSupply: INITIAL_SUPPLY,
            adminPrivateKey: accounts[0].privateKey,
            kyc: true,
            freeze: true
        };

        const defaultNftOptions = {
            tokenName: NFT_NAME,
            symbol: NFT_SYMBOL,
            treasuryAccountId: accounts[0].accountId.toString(),
            maxSupply: NFT_MAX_SUPPLY,
            adminPrivateKey: accounts[0].privateKey
        };

        // HTS token with no custom fees
        const htsResult0 = await servicesNode.createHTS(defaultTokenOptions);

        // HTS token with custom fixed HBAR fee
        const htsResult1 = await servicesNode.createHTS({
            ...defaultTokenOptions,
            customHbarFees: 1
        });

        // HTS token with custom fixed token fee
        const htsResult2 = await servicesNode.createHTS({
            ...defaultTokenOptions,
            customTokenFees: 1
        });

        // HTS token with custom fixed fractional fee
        const htsResult3 = await servicesNode.createHTS({
            ...defaultTokenOptions,
            customFractionalFees: 1
        });

        // HTS token with all custom fees
        const htsResult4 = await servicesNode.createHTS({
            ...defaultTokenOptions,
            customFractionalFees: 1,
            customTokenFees: 1,
            customHbarFees: 1
        });

        // NFT with no custom fees
        const nftResult0 = await servicesNode.createNFT(defaultNftOptions);

        // NFT with no custom royalty fees
        const nftResult1 = await servicesNode.createNFT({
            ...defaultNftOptions,
            customRoyaltyFees: 1
        });

        const nftTokenId0 = nftResult0.receipt.tokenId.toString();
        const nftTokenId1 = nftResult1.receipt.tokenId.toString();

        const mintArgs = {
            metadata: NFT_METADATA,
            treasuryAccountId: accounts[0].accountId.toString(),
            adminPrivateKey: accounts[0].privateKey
        };
        const mintResult0 = await servicesNode.mintNFT({ ...mintArgs, tokenId: nftTokenId0 });
        const mintResult1 = await servicesNode.mintNFT({ ...mintArgs, tokenId: nftTokenId1 });

        // associate tokens, grant KYC
        for (let account of [accounts[1], accounts[2]]) {
            await servicesNode.associateHTSToken(account.accountId, htsResult1.receipt.tokenId, account.privateKey, htsResult1.client, requestId);
            await servicesNode.grantKyc({
                tokenId: htsResult1.receipt.tokenId,
                treasuryAccountId: accounts[0].accountId.toString(),
                adminPrivateKey: accounts[0].privateKey,
                accountId: account.accountId
            });

            await servicesNode.associateHTSToken(account.accountId, nftResult0.receipt.tokenId, account.privateKey, nftResult0.client, requestId);
        }

        // create contract instances
        tokenAddress = Utils.idToEvmAddress(htsResult1.receipt.tokenId.toString());
        tokenAddressFixedHbarFees = tokenAddress;
        tokenAddressFixedTokenFees = Utils.idToEvmAddress(htsResult2.receipt.tokenId.toString());
        tokenAddressNoFees = Utils.idToEvmAddress(htsResult0.receipt.tokenId.toString());
        tokenAddressFractionalFees = Utils.idToEvmAddress(htsResult3.receipt.tokenId.toString());
        tokenAddressAllFees = Utils.idToEvmAddress(htsResult4.receipt.tokenId.toString());

        nftAddress = Utils.idToEvmAddress(nftTokenId0);
        nftAddressRoyaltyFees = Utils.idToEvmAddress(nftTokenId1);

        IERC20Metadata = getContract(tokenAddress, IERC20MetadataJson.abi, accounts[0].wallet);
        IERC20 = getContract(tokenAddress, IERC20Json.abi, accounts[0].wallet);
        IHederaTokenService = getContract(tokenAddress, IHederaTokenServiceJson.abi, accounts[0].wallet);


        nftSerial = mintResult0.receipt.serials[0].low;
        IERC721Metadata = getContract(nftAddress, IERC721MetadataJson.abi, accounts[0].wallet);
        IERC721Enumerable = getContract(nftAddress, IERC721EnumerableJson.abi, accounts[0].wallet);
        IERC721 = getContract(nftAddress, IERC721Json.abi, accounts[0].wallet);

        adminAccountLongZero = Utils.idToEvmAddress(accounts[0].accountId.toString());
        account1LongZero = Utils.idToEvmAddress(accounts[1].accountId.toString());
        account2LongZero = Utils.idToEvmAddress(accounts[2].accountId.toString());

        // Transfer and approve token amounts
        const rec1 = await IERC20.transfer(accounts[1].address, 100, Constants.GAS.LIMIT_1_000_000);
        await rec1.wait();
        const rec2 = await IERC20.approve(accounts[2].address, 200, Constants.GAS.LIMIT_1_000_000);
        await rec2.wait();

        const rec3 = await IERC721.transferFrom(accounts[0].address, accounts[1].address, nftSerial, Constants.GAS.LIMIT_1_000_000);
        await rec3.wait();
        const rec4 = await IERC721.connect(accounts[1].wallet).approve(accounts[2].address, nftSerial, Constants.GAS.LIMIT_1_000_000);
        await rec4.wait();
        const rec5 = await IERC721.connect(accounts[1].wallet).setApprovalForAll(accounts[0].address, true, Constants.GAS.LIMIT_1_000_000);
        await rec5.wait();

        tokenAddresses = [tokenAddressNoFees, tokenAddressFixedHbarFees, tokenAddressFixedTokenFees, tokenAddressFractionalFees, tokenAddressAllFees];
        nftAddresses = [nftAddress, nftAddressRoyaltyFees];

    });

    this.beforeEach(async () => {
        requestId = Utils.generateRequestId();
    });

    function getContract(address, abi, wallet) {
        return new ethers.Contract(address, abi, wallet);
    }

    describe("Calling HTS token through IERC20", async () => {
        it("Function with IERC20(token).totalSupply()", async () => {
            const totalSupply = await IERC20Metadata.totalSupply();
            expect(totalSupply).to.eq(INITIAL_SUPPLY);
        });

        it("Function with IERC20(token).balanceOf(account) - using long zero address", async () => {
            const balance = await IERC20.balanceOf(account1LongZero);
            expect(balance).to.eq(100);
        });

        it("Function with IERC20(token).balanceOf(account) - using evm address", async () => {
            const balance = await IERC20.balanceOf(accounts[1].address);
            expect(balance).to.eq(100);
        });

        it("Function with IERC20(token).allowance(owner, spender) - using both evm addresses", async () => {
            const allowance = await IERC20.allowance(accounts[0].address, accounts[2].address);
            expect(allowance).to.eq(200);
        });
    });

    describe("Calling HTS token through IERC721Metadata", async () => {
        it("Function with IERC721Metadata(token).name()", async () => {
            const name = await IERC721Metadata.name();
            expect(name).to.eq(NFT_NAME);
        });

        it("Function with IERC721Metadata(token).symbol()", async () => {
            const symbol = await IERC721Metadata.symbol();
            expect(symbol).to.eq(NFT_SYMBOL);
        });

        it("Function with IERC721Metadata(token).tokenURI(tokenId)", async () => {
            const tokenURI = await IERC721Metadata.tokenURI(nftSerial);
            expect(tokenURI).to.eq(NFT_METADATA);
        });
    });

    describe("Calling HTS token through IERC721Enumerable", async () => {
        it("Function with IERC721Enumerable(token).totalSupply()", async () => {
            const supply = await IERC721Enumerable.totalSupply();
            expect(supply).to.eq(1);
        });
    });

    //According to this ticket the following describe should be deleted after adaptations are applied -> https://github.com/hashgraph/hedera-json-rpc-relay/issues/1131
    describe("Calling HTS token through HederaTokenService", async () => {
        //TODO remove this it when should be able to freeze and unfreeze token2 is implemented -> https://github.com/hashgraph/hedera-json-rpc-relay/issues/1131 
        it.only("Function with HederaTokenService.isFrozen(token, account) - using long zero address", async () => {
            // freeze token
            const freezeTx = await TokenManagementSigner.freezeTokenPublic(tokenAddress, accounts[1].wallet.address, Constants.GAS.LIMIT_1_000_000);
            const responseCodeFreeze = (await freezeTx.wait()).events.filter(e => e.event === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode;
            expect(responseCodeFreeze).to.equal(TX_SUCCESS_CODE);

            const isFrozen = await htsImpl.callStatic.isTokenFrozen(tokenAddress, account1LongZero);
            expect(isFrozen).to.eq(true);

            // unfreeze token
            const unfreezeTx = await TokenManagementSigner.unfreezeTokenPublic(tokenAddress, accounts[1].wallet.address, Constants.GAS.LIMIT_1_000_000);
            const responseCodeUnfreeze = (await unfreezeTx.wait()).events.filter(e => e.event === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode;
            expect(responseCodeUnfreeze).to.equal(TX_SUCCESS_CODE);
        });

        //Todo delete when should query isKyc2 is implemented -> https://github.com/hashgraph/hedera-json-rpc-relay/issues/1131
        it("Function with HederaTokenService.isKyc(token, account) - using long zero account address", async () => {
            const isKyc1 = await htsImpl.callStatic.isKycGranted(tokenAddress, account1LongZero);
            expect(isKyc1).to.eq(true);
        });

        describe("Function with HederaTokenService.getTokenCustomFees(token)", async () => {
            it("token with no custom fees", async () => {
                const customFees = await htsImpl.callStatic.getCustomFeesForToken(tokenAddressNoFees);
                expect(customFees).to.exist;
                expect(customFees.fixedFees).to.exist;
                expect(customFees.fixedFees.length).to.eq(0);
                expect(customFees.fractionalFees).to.exist;
                expect(customFees.fractionalFees.length).to.eq(0);
                expect(customFees.royaltyFees).to.exist;
                expect(customFees.royaltyFees.length).to.eq(0);
            });

            it("token with fixed hbar fees", async () => {
                const customFees = await htsImpl.callStatic.getCustomFeesForToken(tokenAddressFixedHbarFees);
                expect(customFees).to.exist;
                expect(customFees.fixedFees).to.exist;
                expect(customFees.fixedFees.length).to.eq(1);
                expect(customFees.fixedFees[0].amount).to.exist;
                expect(customFees.fixedFees[0].amount.toString()).to.eq(Hbar.from(1).toTinybars().toString());
                expect(customFees.fixedFees[0].tokenId).to.eq(ZERO_HEX);
                expect(customFees.fixedFees[0].feeCollector).to.exist;
                expect(customFees.fixedFees[0].feeCollector.toLowerCase()).to.eq(`0x${accounts[0].address.toLowerCase()}`);

                expect(customFees.fractionalFees).to.exist;
                expect(customFees.fractionalFees.length).to.eq(0);
                expect(customFees.royaltyFees).to.exist;
                expect(customFees.royaltyFees.length).to.eq(0);
            });

            it("token with fixed token fees", async () => {
                const customFees = await htsImpl.callStatic.getCustomFeesForToken(tokenAddressFixedTokenFees);
                expect(customFees).to.exist;
                expect(customFees.fixedFees).to.exist;
                expect(customFees.fixedFees.length).to.eq(1);
                expect(customFees.fixedFees[0].amount).to.exist;
                expect(customFees.fixedFees[0].amount.toString()).to.eq("1");
                expect(customFees.fixedFees[0].tokenId).to.eq(ZERO_HEX);
                expect(customFees.fixedFees[0].feeCollector).to.exist;
                expect(customFees.fixedFees[0].feeCollector.toLowerCase()).to.eq(`0x${accounts[0].address.toLowerCase()}`);

                expect(customFees.fractionalFees).to.exist;
                expect(customFees.fractionalFees.length).to.eq(0);
                expect(customFees.royaltyFees).to.exist;
                expect(customFees.royaltyFees.length).to.eq(0);
            });

            it("token with fractional fees", async () => {
                const customFees = await htsImpl.callStatic.getCustomFeesForToken(tokenAddressFractionalFees);
                expect(customFees).to.exist;
                expect(customFees.fractionalFees).to.exist;
                expect(customFees.fractionalFees.length).to.eq(1);
                expect(customFees.fractionalFees[0].numerator).to.exist;
                expect(customFees.fractionalFees[0].numerator.toString()).to.eq("1");

                expect(customFees.fractionalFees[0].denominator).to.exist;
                expect(customFees.fractionalFees[0].denominator.toString()).to.eq("10");

                expect(customFees.fractionalFees[0].minimumAmount).to.exist;
                expect(customFees.fractionalFees[0].minimumAmount.toString()).to.eq("0");

                expect(customFees.fractionalFees[0].maximumAmount).to.exist;
                expect(customFees.fractionalFees[0].maximumAmount.toString()).to.eq("0");

                expect(customFees.fractionalFees[0].netOfTransfers).to.eq(false);

                expect(customFees.fractionalFees[0].feeCollector).to.exist;
                expect(customFees.fractionalFees[0].feeCollector.toLowerCase()).to.eq(`0x${accounts[0].address}`);
                expect(customFees.fixedFees).to.exist;
                expect(customFees.fixedFees.length).to.eq(0);
                expect(customFees.royaltyFees).to.exist;
                expect(customFees.royaltyFees.length).to.eq(0);
            });

            it("token with all custom fees", async () => {
                const customFees = await htsImpl.callStatic.getCustomFeesForToken(tokenAddressAllFees);
                expect(customFees).to.exist;
                expect(customFees.fractionalFees).to.exist;
                expect(customFees.fractionalFees.length).to.eq(1);

                expect(customFees.fractionalFees[0].numerator).to.exist;
                expect(customFees.fractionalFees[0].numerator.toString()).to.eq("1");

                expect(customFees.fractionalFees[0].denominator).to.exist;
                expect(customFees.fractionalFees[0].denominator.toString()).to.eq("10");

                expect(customFees.fractionalFees[0].minimumAmount).to.exist;
                expect(customFees.fractionalFees[0].minimumAmount.toString()).to.eq("0");

                expect(customFees.fractionalFees[0].maximumAmount).to.exist;
                expect(customFees.fractionalFees[0].maximumAmount.toString()).to.eq("0");

                expect(customFees.fractionalFees[0].netOfTransfers).to.eq(false);

                expect(customFees.fractionalFees[0].feeCollector).to.exist;
                expect(customFees.fractionalFees[0].feeCollector.toLowerCase()).to.eq(`0x${accounts[0].address}`);

                expect(customFees.fixedFees).to.exist;
                expect(customFees.fixedFees.length).to.eq(2);

                expect(customFees.fixedFees[0].amount).to.exist;
                expect(customFees.fixedFees[0].amount.toString()).to.eq(Hbar.from(1).toTinybars().toString());
                expect(customFees.fixedFees[0].tokenId).to.eq(ZERO_HEX);
                expect(customFees.fixedFees[0].feeCollector).to.exist;
                expect(customFees.fixedFees[0].feeCollector.toLowerCase()).to.eq(`0x${accounts[0].address}`);

                expect(customFees.fixedFees[1].amount).to.exist;
                expect(customFees.fixedFees[1].amount.toString()).to.eq("1");
                expect(customFees.fixedFees[1].tokenId).to.eq(ZERO_HEX);
                expect(customFees.fixedFees[1].feeCollector).to.exist;
                expect(customFees.fixedFees[1].feeCollector.toLowerCase()).to.eq(`0x${accounts[0].address}`);

                expect(customFees.royaltyFees).to.exist;
                expect(customFees.royaltyFees.length).to.eq(0);
            });

            it("nft with no custom fees", async () => {
                const customFees = await htsImpl.callStatic.getCustomFeesForToken(nftAddress);
                expect(customFees).to.exist;
                expect(customFees.fixedFees).to.exist;
                expect(customFees.fixedFees.length).to.eq(0);
                expect(customFees.fractionalFees).to.exist;
                expect(customFees.fractionalFees.length).to.eq(0);
                expect(customFees.royaltyFees).to.exist;
                expect(customFees.royaltyFees.length).to.eq(0);
            });

            it("nft with royalty fees", async () => {
                const customFees = await htsImpl.callStatic.getCustomFeesForToken(nftAddressRoyaltyFees);
                expect(customFees).to.exist;
                expect(customFees.fixedFees).to.exist;
                expect(customFees.fixedFees.length).to.eq(0);
                expect(customFees.fractionalFees).to.exist;
                expect(customFees.fractionalFees.length).to.eq(0);
                expect(customFees.royaltyFees).to.exist;
                expect(customFees.royaltyFees.length).to.eq(1);
                expect(customFees.royaltyFees[0].numerator).exist;
                expect(customFees.royaltyFees[0].numerator.toString()).to.eq("1");
                expect(customFees.royaltyFees[0].denominator).exist;
                expect(customFees.royaltyFees[0].denominator.toString()).to.eq("10");
                expect(customFees.royaltyFees[0].tokenId).to.eq(ZERO_HEX);
                expect(customFees.royaltyFees[0].feeCollector).to.exist;
                expect(customFees.royaltyFees[0].feeCollector.toLowerCase()).to.eq(`0x${accounts[0].address.toLowerCase()}`);
            });

        });

        describe('Token Info', async () => {
            const tokenTests = [
                'token with no custom fees',
                'token with a fixed hbar fee',
                'token with a fixed token fee',
                'token with a fractional fee',
                'token with all custom fees',
            ]
            const nftTests = [
                'nft with no custom fees',
                'nft with a royalty fee',
            ];
        });

        //TODO After adding the additional expects after getTokenKeyPublic in tokenManagementContract, the whole describe can be deleted. -> https://github.com/hashgraph/hedera-json-rpc-relay/issues/1131
        describe('Function with HederaTokenService.getTokenKey(token, keyType)', async () => {
            const keyTypes = {
                ADMIN: 1,
                KYC: 2,
                FREEZE: 4,
                WIPE: 8,
                SUPPLY: 16,
                FEE: 32,
                PAUSE: 64
            };

            it(`keyType = ADMIN`, async () => {
                const res = await htsImpl.callStatic.getTokenKeyPublic(tokenAddress, keyTypes['ADMIN']);
                expect(res).to.exist;
                expect(res.inheritAccountKey).to.eq(false);
                expect(res.contractId).to.eq(ZERO_HEX);
                expect(res.ed25519).to.eq(EMPTY_HEX);
                expect(res.ECDSA_secp256k1).to.eq(EMPTY_HEX);
                expect(res.delegatableContractId).to.eq(ZERO_HEX);
            });

            it(`keyType = KYC`, async () => {
                const res = await htsImpl.callStatic.getTokenKeyPublic(tokenAddress, keyTypes['KYC']);
                expect(res).to.exist;
                expect(res.inheritAccountKey).to.eq(false);
                expect(res.contractId).to.eq(ZERO_HEX);
                expect(res.ed25519).to.eq(EMPTY_HEX);
                expect(res.ECDSA_secp256k1).to.not.eq(EMPTY_HEX);
                expect(res.delegatableContractId).to.eq(ZERO_HEX);
            });

            it(`keyType = FREEZE`, async () => {
                const res = await htsImpl.callStatic.getTokenKeyPublic(tokenAddress, keyTypes['FREEZE']);
                expect(res).to.exist;
                expect(res.inheritAccountKey).to.eq(false);
                expect(res.contractId).to.eq(ZERO_HEX);
                expect(res.ed25519).to.eq(EMPTY_HEX);
                expect(res.ECDSA_secp256k1).to.not.eq(EMPTY_HEX);
                expect(res.delegatableContractId).to.eq(ZERO_HEX);
            });

            it(`keyType = SUPPLY`, async () => {
                const res = await htsImpl.callStatic.getTokenKeyPublic(tokenAddress, keyTypes['SUPPLY']);
                expect(res).to.exist;
                expect(res.inheritAccountKey).to.eq(false);
                expect(res.contractId).to.eq(ZERO_HEX);
                expect(res.ed25519).to.eq(EMPTY_HEX);
                expect(res.ECDSA_secp256k1).to.eq(EMPTY_HEX);
                expect(res.delegatableContractId).to.eq(ZERO_HEX);
            });

            it(`keyType = FEE`, async () => {
                const res = await htsImpl.callStatic.getTokenKeyPublic(tokenAddress, keyTypes['FEE']);
                expect(res).to.exist;
                expect(res.inheritAccountKey).to.eq(false);
                expect(res.contractId).to.eq(ZERO_HEX);
                expect(res.ed25519).to.eq(EMPTY_HEX);
                expect(res.ECDSA_secp256k1).to.eq(EMPTY_HEX);
                expect(res.delegatableContractId).to.eq(ZERO_HEX);
            });

            it(`keyType = PAUSE`, async () => {
                const res = await htsImpl.callStatic.getTokenKeyPublic(tokenAddress, keyTypes['PAUSE']);
                expect(res).to.exist;
                expect(res.inheritAccountKey).to.eq(false);
                expect(res.contractId).to.eq(ZERO_HEX);
                expect(res.ed25519).to.eq(EMPTY_HEX);
                expect(res.ECDSA_secp256k1).to.eq(EMPTY_HEX);
                expect(res.delegatableContractId).to.eq(ZERO_HEX);
            });
        });
    });

    //Relay test, move to the acceptance tests. Check if there are existing similar tests.
    describe("Negative tests", async () => {
        const CALLDATA_BALANCE_OF = '0x70a08231';
        const CALLDATA_ALLOWANCE = '0xdd62ed3e';
        const NON_EXISTING_ACCOUNT = '123abc123abc123abc123abc123abc123abc123a';

        it("Call to non-existing HTS token returns error", async () => {
            const callData = {
                from: '0x' + accounts[0].address,
                to: '0x' + NON_EXISTING_ACCOUNT,
                gas: EthImpl.numberTo0x(30000),
                data: CALLDATA_BALANCE_OF + accounts[0].address
            };

            await relay.callFailing(
                Constants.ETH_ENDPOINTS.ETH_CALL,
                [callData, 'latest'],
                predefined.NON_EXISTING_CONTRACT('0x' + NON_EXISTING_ACCOUNT),
                requestId
            );
        });

        it("Call to HTS token from non-existing account returns error", async () => {
            const callData = {
                from: '0x' + NON_EXISTING_ACCOUNT,
                to: htsImplAddress,
                gas: EthImpl.numberTo0x(30000),
                data: CALLDATA_BALANCE_OF + NON_EXISTING_ACCOUNT.padStart(64, '0')
            };

            await relay.callFailing(
                Constants.ETH_ENDPOINTS.ETH_CALL,
                [callData, 'latest'],
                predefined.NON_EXISTING_ACCOUNT('0x' + NON_EXISTING_ACCOUNT),
                requestId
            );
        });

        it("Call to allowance method of an HTS token with non-existing owner account in call data returns error", async () => {
            const callData = {
                from: '0x' + accounts[0].address,
                to: htsImplAddress,
                gas: EthImpl.numberTo0x(30000),
                data: CALLDATA_ALLOWANCE + NON_EXISTING_ACCOUNT.padStart(64, '0') + account2LongZero.replace('0x', '').padStart(64, '0')
            };

            await relay.callFailing(
                Constants.ETH_ENDPOINTS.ETH_CALL,
                [callData, 'latest'],
                predefined.CONTRACT_REVERT(),
                requestId
            );
        });


        it("Call to allowance method of an HTS token with non-existing spender account in call data returns error", async () => {
            const callData = {
                from: '0x' + accounts[0].address,
                to: htsImplAddress,
                gas: EthImpl.numberTo0x(30000),
                data: CALLDATA_ALLOWANCE + adminAccountLongZero.replace('0x', '').padStart(64, '0') + NON_EXISTING_ACCOUNT.padStart(64, '0')
            };

            await relay.callFailing(
                Constants.ETH_ENDPOINTS.ETH_CALL,
                [callData, 'latest'],
                predefined.CONTRACT_REVERT(),
                requestId
            );
        });
    });
});
