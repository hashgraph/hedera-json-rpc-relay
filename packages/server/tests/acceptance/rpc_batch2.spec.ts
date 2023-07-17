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
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { AliasAccount } from '../clients/servicesClient';
import Assertions from '../helpers/assertions';
import { Utils } from '../helpers/utils';
import { ContractFunctionParameters } from '@hashgraph/sdk';
import TokenCreateJson from '../contracts/TokenCreateContract.json';

// local resources
import parentContractJson from '../contracts/Parent.json';
import basicContractJson from '../contracts/Basic.json';
import storageContractJson from '../contracts/Storage.json';
import { predefined } from '../../../relay/src/lib/errors/JsonRpcError';
import { EthImpl } from '../../../../packages/relay/src/lib/eth';
//Constants are imported with different definitions for better readability in the code.
import Constants from '../../../../packages/relay/src/lib/constants';
import RelayCalls from '../../tests/helpers/constants';
import Helper from '../../tests/helpers/constants';
import Address from '../../tests/helpers/constants';

describe('@api-batch-2 RPC Server Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    const accounts: AliasAccount[] = [];

    // @ts-ignore
    const { servicesNode, mirrorNode, relay, logger } = global;

    // cached entities
    let tokenId;
    let contractId;
    let contractExecuteTimestamp;
    let mirrorContract;
    let mirrorContractDetails;
    let mirrorSecondaryAccount;
    let requestId;

    const CHAIN_ID = process.env.CHAIN_ID || 0;
    const ONE_TINYBAR = ethers.utils.parseUnits('1', 10).toHexString();
    const ONE_WEIBAR = ethers.utils.parseUnits('1', 18).toHexString();

    const BASIC_CONTRACT_PING_CALL_DATA = '0x5c36b186';
    const EXCHANGE_RATE_FILE_ID = "0.0.112";
    const EXCHANGE_RATE_FILE_CONTENT_DEFAULT = "0a1008b0ea0110f9bb1b1a0608f0cccf9306121008b0ea0110e9c81a1a060880e9cf9306";
    const FEE_SCHEDULE_FILE_ID = "0.0.111";
    const FEE_SCHEDULE_FILE_CONTENT_DEFAULT = "0a280a0a08541a061a04408888340a0a08061a061a0440889d2d0a0a08071a061a0440b0b63c120208011200"; // Eth gas = 853000
    const FEE_SCHEDULE_FILE_CONTENT_UPDATED = "0a280a0a08541a061a0440a8953a0a0a08061a061a0440889d2d0a0a08071a061a0440b0b63c120208011200"; // Eth gas = 953000

    let blockNumberAtStartOfTests = 0;
    let mirrorAccount0AtStartOfTests;

    const signSendAndConfirmTransaction = async (transaction, accounts, requestId) => {
        const signedTx = await accounts.wallet.signTransaction(transaction);
        const txHash = await relay.sendRawTransaction(signedTx);
        await mirrorNode.get(`/contracts/results/${txHash}`, requestId);
        await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH, [txHash]);
        await new Promise(r => setTimeout(r, 2000));
      };

    this.beforeAll(async () => {
        requestId = Utils.generateRequestId();

        accounts[0] = await servicesNode.createAliasAccount(40, null, requestId);
        accounts[1] = await servicesNode.createAliasAccount(10, null, requestId);
        accounts[2] = await servicesNode.createAliasAccount(10, null, requestId);
        accounts[3] = await servicesNode.createAliasAccount(50, relay.provider, requestId);
        contractId = await accounts[0].client.createParentContract(parentContractJson, requestId);

        const params = new ContractFunctionParameters().addUint256(1);
        contractExecuteTimestamp = (await accounts[0].client
            .executeContractCall(contractId, 'createChild', params, 75000, requestId)).contractExecuteTimestamp;
        tokenId = await servicesNode.createToken(1000, requestId);
        logger.info('Associate and transfer tokens');
        await accounts[0].client.associateToken(tokenId, requestId);
        await accounts[1].client.associateToken(tokenId, requestId);
        await servicesNode.transferToken(tokenId, accounts[0].accountId, 10, requestId);
        await servicesNode.transferToken(tokenId, accounts[1].accountId, 10, requestId);

        // allow mirror node a 5 full record stream write windows (5 sec) and a buffer to persist setup details
        await new Promise(r => setTimeout(r, 5000));

        // get contract details
        mirrorContract = await mirrorNode.get(`/contracts/${contractId}`, requestId);

        // get contract result details
        mirrorContractDetails = await mirrorNode.get(`/contracts/${contractId}/results/${contractExecuteTimestamp}`, requestId);
        mirrorSecondaryAccount = (await mirrorNode.get(`accounts?account.id=${accounts[1].accountId}`, requestId)).accounts[0];

        const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
        blockNumberAtStartOfTests = latestBlock.number;
        mirrorAccount0AtStartOfTests = await mirrorNode.get(`/accounts/${accounts[0].accountId}`, requestId);
    });

    this.beforeEach(async () => {
        requestId = Utils.generateRequestId();
    });

    describe('eth_estimateGas', async function () {
        let basicContract;

        this.beforeAll(async () => {
            basicContract = await servicesNode.deployContract(basicContractJson);
        });


        it('@release should execute "eth_estimateGas"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{}], requestId);
            expect(res).to.contain('0x');
            expect(res).to.not.be.equal('0x');
            expect(res).to.not.be.equal('0x0');
        });

        it('@release should execute "eth_estimateGas" for contract call', async function() {
            const expectedRes = `0x${(400000).toString(16)}`;
            const estimatedGas = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                to: basicContract.evm_address,
                data: BASIC_CONTRACT_PING_CALL_DATA
            }], requestId);
            expect(estimatedGas).to.contain('0x');
            expect(estimatedGas).to.equal(expectedRes);
        });

        it('@release should execute "eth_estimateGas" for existing account', async function() {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                to: mirrorSecondaryAccount.evm_address,
                value: '0x1',
            }], requestId);
            expect(res).to.contain('0x');
            expect(res).to.equal(EthImpl.gasTxBaseCost);
        });

        it('@release should execute "eth_estimateGas" hollow account creation', async function() {
            const hollowAccount = ethers.Wallet.createRandom();
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                to: hollowAccount.address,
                value: '0x1',
            }], requestId);
            expect(res).to.contain('0x');
            expect(res).to.equal(EthImpl.gasTxHollowAccountCreation);
        });

        it('should execute "eth_estimateGas" with to, from, value and gas filed', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
                to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
                value: '0xa688906bd8b00000',
                gas: '0xd97010'
            }], requestId);
            expect(res).to.contain('0x');
            expect(res).to.not.be.equal('0x');
            expect(res).to.not.be.equal('0x0');
        });

        it('should execute "eth_estimateGas" with to, from, value,accessList gas filed', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
                to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
                value: '0xa688906bd8b00000',
                gas: '0xd97010',
                accessList: []
            }], requestId);
            expect(res).to.contain('0x');
            expect(res).to.not.be.equal('0x');
            expect(res).to.not.be.equal('0x0');
        });

        it('should not be able to execute "eth_estimateGas" with no transaction object', async function () {
            const errorMessage = 'Missing value for required parameter 0';
            await expect(relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [], requestId)).to.be.rejectedWith('Missing required parameters').and.eventually.have.property('message').that.include(errorMessage);
        });

        it('should not be able to execute "eth_estimateGas" with wrong from field', async function () {
            const from = '0x114f60009ee6b84861c0cdae8829751e517b';
            const errorMessage = `Invalid parameter 'from' for TransactionObject: Expected 0x prefixed string representing the address (20 bytes), value: ${from}`;
            await expect(relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                    from: from,
                    to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
                    value: '0xa688906bd8b00000',
                    gas: '0xd97010',
                    accessList: []
                }], requestId)).to.be.rejectedWith('Invalid parameter').and.eventually.have.property('message').that.include(errorMessage);
        });

        it('should not be able to execute "eth_estimateGas" with wrong to field', async function () {
            const to = '0xae410f34f7487e2cd03396499cebb09b79f45';
            const errorMessage = `Invalid parameter 'to' for TransactionObject: Expected 0x prefixed string representing the address (20 bytes), value: ${to}`;
            await expect(relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
                to: to,
                value: '0xa688906bd8b00000',
                gas: '0xd97010',
                accessList: []
            }], requestId)).to.be.rejectedWith('Invalid parameter').and.eventually.have.property('message').that.include(errorMessage);
        });

        it('should not be able to execute "eth_estimateGas" with wrong value field', async function () {
            const value = '123';
            const errorMessage = `Invalid parameter 'value' for TransactionObject: Expected 0x prefixed hexadecimal value, value: ${value}`;
            await expect(relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
                to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
                value: value,
                gas: '0xd97010',
                accessList: []
            }], requestId)).to.be.rejectedWith('Invalid parameter').and.eventually.have.property('message').that.include(errorMessage);
        });

        it('should not be able to execute "eth_estimateGas" with wrong gas field', async function () {
            const gas = '123';
            const errorMessage = `Invalid parameter 'gas' for TransactionObject: Expected 0x prefixed hexadecimal value, value: ${gas}`;
            await expect(relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
                from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
                to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
                value: '0xa688906bd8b00000',
                gas: gas,
                accessList: []
            }], requestId)).to.be.rejectedWith('Invalid parameter').and.eventually.have.property('message').that.include(errorMessage);
        });
    });

    describe('eth_gasPrice', async function () {
        it('@release should call eth_gasPrice', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GAS_PRICE, [], requestId);
            expect(res).to.exist;
            if (process.env.LOCAL_NODE && process.env.LOCAL_NODE !== 'false') {
                expect(res).be.equal(ethers.utils.hexValue(Assertions.defaultGasPrice));
            } else {
                expect(Number(res)).to.be.gt(0);
            }
        });
    });

    describe('eth_getBalance', async function () {
        let getBalanceContractId;
        before(async function () {
            getBalanceContractId = await accounts[0].client.createParentContract(parentContractJson, requestId);
        });

        it('@release should execute "eth_getBalance" for newly created account with 10 HBAR', async function () {
            const account = await servicesNode.createAliasAccount(10, null, requestId);
            const mirrorAccount = await mirrorNode.get(`/accounts/${account.accountId}`, requestId);

            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, ['0x' + account.address, 'latest'], requestId);
            const balanceInWeiBars = BigNumber.from(mirrorAccount.balance.balance.toString()).mul(Constants.TINYBAR_TO_WEIBAR_COEF);
            // balance for tests changes as accounts are in use. Ensure non zero value
            expect(res).to.not.be.eq(EthImpl.zeroHex);
        });

        it('should execute "eth_getBalance" for non-existing address', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, [Address.NON_EXISTING_ADDRESS, 'latest'], requestId);
            expect(res).to.eq('0x0');
        });

        it('@release should execute "eth_getBalance" for contract', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, [Utils.idToEvmAddress(getBalanceContractId.toString()), 'latest'], requestId);
            expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
        });

        it('@release should execute "eth_getBalance" for contract with id converted to evm_address', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, [Utils.idToEvmAddress(getBalanceContractId.toString()), 'latest'], requestId);
            expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
        });

        it('@release should execute "eth_getBalance" with latest block number', async function () {
            const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, [Utils.idToEvmAddress(getBalanceContractId.toString()), EthImpl.numberTo0x(latestBlock.number)], requestId);
            expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
        });

        it('@release should execute "eth_getBalance" with one block behind latest block number', async function () {
            const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, [Utils.idToEvmAddress(getBalanceContractId.toString()), EthImpl.numberTo0x(latestBlock.number - 1)], requestId);
            expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
        });

        it('@release should execute "eth_getBalance" with pending', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, [Utils.idToEvmAddress(getBalanceContractId.toString()), 'pending'], requestId);
            expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
        });

        it('@release should execute "eth_getBalance" with block number in the last 15 minutes', async function () {
            const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
            const earlierBlockNumber = latestBlock.number - 2;
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, [Utils.idToEvmAddress(getBalanceContractId.toString()), EthImpl.numberTo0x(earlierBlockNumber)], requestId);
            expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
        });

        it('@release should execute "eth_getBalance" with block number in the last 15 minutes for account that has performed contract deploys/calls"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, ['0x' + accounts[0].address, EthImpl.numberTo0x(blockNumberAtStartOfTests)], requestId);
            const balanceAtBlock = BigInt(mirrorAccount0AtStartOfTests.balance.balance) * BigInt(Constants.TINYBAR_TO_WEIBAR_COEF);
            expect(res).to.eq(`0x${balanceAtBlock.toString(16)}`);
        });

        it('@release should correctly execute "eth_getBalance" with block number in the last 15 minutes with several txs around that time', async function () {
            const initialBalance = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, ['0x' + accounts[0].address, 'latest'], requestId);

            const acc3Nonce = await relay.getAccountNonce('0x' + accounts[3].address);
            const gasPrice = await relay.gasPrice();

            const transaction = {
                value: ONE_TINYBAR,
                gasLimit: 50000,
                chainId: Number(CHAIN_ID),
                to: accounts[0].wallet.address,
                nonce: acc3Nonce,
                gasPrice: gasPrice,
            };

            await signSendAndConfirmTransaction(transaction, accounts[3], requestId);
            
            const blockNumber = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_BLOCK_NUMBER, [], requestId);

            await signSendAndConfirmTransaction({ ...transaction, nonce: acc3Nonce + 1 }, accounts[3], requestId);

            const endBalance = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, ['0x' + accounts[0].address, 'latest'], requestId);

            // initialBalance + sum of value of all transactions
            const manuallyCalculatedBalance = BigNumber.from(initialBalance).add(BigNumber.from(ONE_TINYBAR).mul(2));
            expect(BigNumber.from(endBalance).toString()).to.eq(manuallyCalculatedBalance.toString());

            // Balance at the block number of tx1 should be initialBalance + the value of tx1
            const balanceAtTx1Block = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, ['0x' + accounts[0].address, blockNumber], requestId);
            const manuallyCalculatedBalanceAtTx1Block = BigNumber.from(initialBalance).add(BigNumber.from(ONE_TINYBAR));
            expect(BigNumber.from(balanceAtTx1Block).toString()).to.eq(manuallyCalculatedBalanceAtTx1Block.toString());
        });

    });

    describe('@release Hardcoded RPC Endpoints', () => {
        let mirrorBlock;

        before(async () => {
            mirrorBlock = (await mirrorNode.get(`/blocks?block.number=${mirrorContractDetails.block_number}`, requestId)).blocks[0];
        });

        it('should execute "eth_chainId"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], requestId);
            expect(res).to.be.equal(CHAIN_ID);
        });

        it('should execute "net_listening"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.NET_LISTENING, [], requestId);
            expect(res).to.be.equal('false');
        });

        it('should execute "net_version"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.NET_VERSION, [], requestId);
            expect(res).to.be.equal(CHAIN_ID);
        });

        it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_HASH_AND_INDEX, [mirrorBlock.hash, 0], requestId);
            expect(res).to.be.null;
        });

        it('should execute "eth_getUncleByBlockHashAndIndex" for non-existing block hash and index=0', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_HASH_AND_INDEX, [Address.NON_EXISTING_BLOCK_HASH, 0], requestId);
            expect(res).to.be.null;
        });

        it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_NUMBER_AND_INDEX, [mirrorBlock.number, 0], requestId);
            expect(res).to.be.null;
        });

        it('should execute "eth_getUncleByBlockNumberAndIndex" for non-existing block number and index=0', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_NUMBER_AND_INDEX, [Address.NON_EXISTING_BLOCK_NUMBER, 0], requestId);
            expect(res).to.be.null;
        });

        it('should execute "eth_getUncleCountByBlockHash"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_COUNT_BY_BLOCK_HASH, [], requestId);
            expect(res).to.be.equal('0x0');
        });

        it('should execute "eth_getUncleCountByBlockNumber"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_COUNT_BY_BLOCK_NUMBER, [], requestId);
            expect(res).to.be.equal('0x0');
        });

        it('should return empty on "eth_accounts"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ACCOUNTS, [], requestId);
            expect(res).to.deep.equal([]);
        });

        it('should execute "eth_hashrate"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_HASH_RATE, [], requestId);
            expect(res).to.be.equal('0x0');
        });

        it('should execute "eth_mining"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_MINING, [], requestId);
            expect(res).to.be.equal(false);
        });

        it('should execute "eth_submitWork"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_SUBMIT_WORK, [], requestId);
            expect(res).to.be.equal(false);
        });

        it('should execute "eth_syncing"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_SYNCING, [], requestId);
            expect(res).to.be.equal(false);
        });

        it('should execute "web3_client_version"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.WEB3_CLIENT_VERSION, [], requestId);
            expect(res).to.contain('relay/');
        });

        it('should execute "eth_maxPriorityFeePerGas"', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_MAX_PRIORITY_FEE_PER_GAS, [], requestId);
            expect(res).to.be.equal('0x0');
        });
    });

    describe('@release Unsupported RPC Endpoints', () => {

        it('should not support "eth_submitHashrate"', async function () {
            await relay.callUnsupported(RelayCalls.ETH_ENDPOINTS.ETH_SUBMIT_HASH_RATE, [], requestId);
        });

        it('should not support "eth_getWork"', async function () {
            await relay.callUnsupported(RelayCalls.ETH_ENDPOINTS.ETH_GET_WORK, [], requestId);
        });

        it('should not support "eth_coinbase"', async function () {
            await relay.callUnsupported(RelayCalls.ETH_ENDPOINTS.ETH_COINBASE, [], requestId);
        });

        it('should not support "eth_sendTransaction"', async function () {
            await relay.callUnsupported(RelayCalls.ETH_ENDPOINTS.ETH_SEND_TRANSACTION, [], requestId);
        });

        it('should not support "eth_protocolVersion"', async function () {
            await relay.callUnsupported(RelayCalls.ETH_ENDPOINTS.ETH_PROTOCOL_VERSION, [], requestId);
        });

        it('should not support "eth_sign"', async function () {
            await relay.callUnsupported(RelayCalls.ETH_ENDPOINTS.ETH_SIGN, [], requestId);
        });

        it('should not support "eth_signTransaction"', async function () {
            await relay.callUnsupported(RelayCalls.ETH_ENDPOINTS.ETH_SIGN_TRANSACTION, [], requestId);
        });
    });

    describe('eth_getCode', () => {

        let basicContract;
        let mainContractAddress: string;
        let NftHTSTokenContractAddress: string;
        let redirectBytecode: string;

        async function deploymainContract() {
            const mainFactory = new ethers.ContractFactory(TokenCreateJson.abi, TokenCreateJson.bytecode, accounts[3].wallet);
            const mainContract = await mainFactory.deploy(Helper.GAS.LIMIT_15_000_000);
            const { contractAddress } = await mainContract.deployTransaction.wait();

            return contractAddress;
        }

        async function createNftHTSToken(account) {
            const mainContract = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, account.wallet);
            const gasPrice = await relay.gasPrice();
            const tx = await mainContract.createNonFungibleTokenPublic(account.wallet.address, {
                value: ethers.BigNumber.from('50000000000000000000'),    // 50 Hbars
                gasLimit: 1000000,
                gasPrice: gasPrice
            });
            const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = RelayCalls.HTS_CONTRACT_EVENTS.CreatedToken)[0].args;

            return tokenAddress;
        }

        before(async () => {
            basicContract = await servicesNode.deployContract(basicContractJson);
            mainContractAddress = await deploymainContract();

            // Wait for creation to propagate
            const basicMirror = await mirrorNode.get(`/contracts/${basicContract.contractId}`, requestId);
            const mainContractMirror = await mirrorNode.get(`/contracts/${mainContractAddress}`, requestId);

            const accountWithContractIdKey = await servicesNode.createAccountWithContractIdKey(mainContractMirror.contract_id, 60, relay.provider, requestId);
            NftHTSTokenContractAddress = await createNftHTSToken(accountWithContractIdKey);
        });

        it('should execute "eth_getCode" for hts token', async function () {
            const tokenAddress = NftHTSTokenContractAddress.slice(2);
            redirectBytecode = `6080604052348015600f57600080fd5b506000610167905077618dc65e${tokenAddress}600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033`;
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE, [NftHTSTokenContractAddress, 'latest'], requestId);
            expect(res).to.equal(redirectBytecode);
        });

        it('@release should execute "eth_getCode" for contract evm_address', async function () {
            const evmAddress = basicContract.contractId.toSolidityAddress();
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE, ['0x' + evmAddress, 'latest'], requestId);
            expect(res).to.eq(basicContractJson.deployedBytecode);
        });

        it('@release should execute "eth_getCode" for contract with id converted to evm_address', async function () {
            const evmAddress = Utils.idToEvmAddress(basicContract.contractId.toString());
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE, [evmAddress, 'latest'], requestId);
            expect(res).to.eq(basicContractJson.deployedBytecode);
        });

        it('should return 0x0 for non-existing contract on eth_getCode', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE, [Address.NON_EXISTING_ADDRESS, 'latest'], requestId);
            expect(res).to.eq(EthImpl.emptyHex);
        });

        it('should return 0x0 for account evm_address on eth_getCode', async function () {
            const evmAddress = Utils.idToEvmAddress(accounts[2].accountId.toString());
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE, [evmAddress, 'latest'], requestId);
            expect(res).to.eq(EthImpl.emptyHex);
        });

        it('should return 0x0 for account alias on eth_getCode', async function () {
            const alias = Utils.idToEvmAddress(accounts[2].accountId.toString());
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE, [alias, 'latest'], requestId);
            expect(res).to.eq(EthImpl.emptyHex);
        });

        it('should not return contract bytecode after sefldestruct', async function() {
            const evmAddress = basicContract.contractId.toSolidityAddress();
            const bytecodeBefore = await relay.call('eth_getCode', [`0x${evmAddress}`, 'latest'], requestId);

            (await accounts[0].client
              .executeContractCall(basicContract.contractId, 'destroy', new ContractFunctionParameters(), 1_000_000));

            const bytecodeAfter = await relay.call('eth_getCode', [`0x${evmAddress}`, 'latest'], requestId);
            expect(bytecodeAfter).to.not.eq(bytecodeBefore);
            expect(bytecodeAfter).to.eq('0x');
        });
    });

    // Test state changes with getStorageAt
    describe('eth_getStorageAt', () => {
        let storageContract, evmAddress;
        const STORAGE_CONTRACT_UPDATE = "0x2de4e884";
        const NEXT_STORAGE_CONTRACT_UPDATE = "0x160D6484";

        this.beforeEach(async () => {
            storageContract = await servicesNode.deployContract(storageContractJson);
            // Wait for creation to propagate
            await mirrorNode.get(`/contracts/${storageContract.contractId}`);

            evmAddress = `0x${storageContract.contractId.toSolidityAddress()}`;
        });

        it('should execute "eth_getStorageAt" request to get current state changes', async function () {
            const BEGIN_EXPECTED_STORAGE_VAL = "0x000000000000000000000000000000000000000000000000000000000000000f";
            const END_EXPECTED_STORAGE_VAL = "0x0000000000000000000000000000000000000000000000000000000000000008";

            const beginStorageVal = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT, [evmAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', 'latest'], requestId);
            expect(beginStorageVal).to.eq(BEGIN_EXPECTED_STORAGE_VAL);

            const gasPrice = await relay.gasPrice();
            const transaction = {
                value: 0,
                gasLimit: 50000,
                chainId: Number(CHAIN_ID),
                to: evmAddress,
                nonce: await relay.getAccountNonce('0x' + accounts[1].address),
                gasPrice: gasPrice,
                data: STORAGE_CONTRACT_UPDATE,
                maxPriorityFeePerGas: gasPrice,
                maxFeePerGas: gasPrice,
                type: 2
            };

            const signedTx = await accounts[1].wallet.signTransaction(transaction);
            await relay.sendRawTransaction(signedTx, requestId);

            // wait for the transaction to propogate to mirror node
            await new Promise(r => setTimeout(r, 4000));

            const storageVal = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT, [evmAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', 'latest'], requestId);
            expect(storageVal).to.eq(END_EXPECTED_STORAGE_VAL);
        });

        it('should execute "eth_getStorageAt" request to get old state with passing specific block', async function () {
            const END_EXPECTED_STORAGE_VAL = "0x0000000000000000000000000000000000000000000000000000000000000008";

            const beginStorageVal = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT, [evmAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', 'latest'], requestId);

            const gasPrice = await relay.gasPrice();
            const transaction = {
                value: 0,
                gasLimit: 50000,
                chainId: Number(CHAIN_ID),
                to: evmAddress,
                nonce: await relay.getAccountNonce('0x' + accounts[1].address),
                gasPrice: gasPrice,
                data: STORAGE_CONTRACT_UPDATE,
                maxPriorityFeePerGas: gasPrice,
                maxFeePerGas: gasPrice,
                type: 2
            };

            const signedTx = await accounts[1].wallet.signTransaction(transaction);
            const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
            const txReceipt = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT, [transactionHash], requestId);
            const blockNumber = txReceipt.blockNumber;

            // wait for the transaction to propogate to mirror node
            await new Promise(r => setTimeout(r, 4000));

            const latestStorageVal = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT, [evmAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', 'latest'], requestId);
            const blockNumberBeforeChange = `0x${(blockNumber - 1).toString(16)}`;
            const storageValBeforeChange = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT, [evmAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', blockNumberBeforeChange], requestId);

            expect(latestStorageVal).to.eq(END_EXPECTED_STORAGE_VAL);
            expect(storageValBeforeChange).to.eq(beginStorageVal);
        });

        it('should execute "eth_getStorageAt" request to get current state changes without passing block', async function () {
            const BEGIN_EXPECTED_STORAGE_VAL = "0x000000000000000000000000000000000000000000000000000000000000000f";
            const END_EXPECTED_STORAGE_VAL = "0x0000000000000000000000000000000000000000000000000000000000000008";

            const beginStorageVal = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT, [evmAddress, '0x0000000000000000000000000000000000000000000000000000000000000000'], requestId);
            expect(beginStorageVal).to.eq(BEGIN_EXPECTED_STORAGE_VAL);

            const gasPrice = await relay.gasPrice();
            const transaction = {
                value: 0,
                gasLimit: 50000,
                chainId: Number(CHAIN_ID),
                to: evmAddress,
                nonce: await relay.getAccountNonce('0x' + accounts[1].address),
                gasPrice: gasPrice,
                data: STORAGE_CONTRACT_UPDATE,
                maxPriorityFeePerGas: gasPrice,
                maxFeePerGas: gasPrice,
                type: 2
            };

            const signedTx = await accounts[1].wallet.signTransaction(transaction);
            await relay.sendRawTransaction(signedTx, requestId);

            // wait for the transaction to propogate to mirror node
            await new Promise(r => setTimeout(r, 4000));

            const storageVal = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT, [evmAddress, '0x0000000000000000000000000000000000000000000000000000000000000000'], requestId);
            expect(storageVal).to.eq(END_EXPECTED_STORAGE_VAL);
        });

        it('should execute "eth_getStorageAt" request to get current state changes with passing specific block', async function () {
            const EXPECTED_STORAGE_VAL = "0x0000000000000000000000000000000000000000000000000000000000000008";

            const gasPrice = await relay.gasPrice();
            const transaction = {
                value: 0,
                gasLimit: 50000,
                chainId: Number(CHAIN_ID),
                to: evmAddress,
                nonce: await relay.getAccountNonce('0x' + accounts[1].address),
                gasPrice: gasPrice,
                data: STORAGE_CONTRACT_UPDATE,
                maxPriorityFeePerGas: gasPrice,
                maxFeePerGas: gasPrice,
                type: 2
            };

            const signedTx = await accounts[1].wallet.signTransaction(transaction);
            const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
            
            const blockNumber = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT, [transactionHash], requestId).blockNumber;

            const transaction1 = {
                ...transaction,
                nonce: await relay.getAccountNonce('0x' + accounts[1].address),
                data: NEXT_STORAGE_CONTRACT_UPDATE,
            };

            const signedTx1 = await accounts[1].wallet.signTransaction(transaction1);
            await relay.sendRawTransaction(signedTx1, requestId);
            await new Promise(r => setTimeout(r, 2000));

            //Get previous state change with specific block number
            const storageVal = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT, [evmAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', blockNumber], requestId);
            expect(storageVal).to.eq(EXPECTED_STORAGE_VAL);
        });
    });

    // Only run the following tests against a local node since they only work with the genesis account
    if (process.env.LOCAL_NODE && process.env.LOCAL_NODE !== 'false') {
        describe('Gas Price related RPC endpoints', () => {
            let lastBlockBeforeUpdate;
            let lastBlockAfterUpdate;
            let feeScheduleContentAtStart;
            let exchangeRateContentAtStart;

            before(async () => {
                feeScheduleContentAtStart = await servicesNode.getFileContent(FEE_SCHEDULE_FILE_ID);
                exchangeRateContentAtStart = await servicesNode.getFileContent(EXCHANGE_RATE_FILE_ID);

                await servicesNode.updateFileContent(FEE_SCHEDULE_FILE_ID, FEE_SCHEDULE_FILE_CONTENT_DEFAULT, requestId);
                await servicesNode.updateFileContent(EXCHANGE_RATE_FILE_ID, EXCHANGE_RATE_FILE_CONTENT_DEFAULT, requestId);
                lastBlockBeforeUpdate = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
                await new Promise(resolve => setTimeout(resolve, 4000));
                await servicesNode.updateFileContent(FEE_SCHEDULE_FILE_ID, FEE_SCHEDULE_FILE_CONTENT_UPDATED, requestId);
                await new Promise(resolve => setTimeout(resolve, 4000));
                lastBlockAfterUpdate = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
            });

            after(async () => {
                await servicesNode.updateFileContent(FEE_SCHEDULE_FILE_ID, feeScheduleContentAtStart.toString('hex'), requestId);
                await servicesNode.updateFileContent(EXCHANGE_RATE_FILE_ID, exchangeRateContentAtStart.toString('hex'), requestId);
                await new Promise(resolve => setTimeout(resolve, 4000));
            });

            it('should call eth_feeHistory with updated fees', async function () {
                const blockCountNumber = lastBlockAfterUpdate.number - lastBlockBeforeUpdate.number;
                const blockCountHex = ethers.utils.hexValue(blockCountNumber);
                const defaultGasPriceHex = ethers.utils.hexValue(Assertions.defaultGasPrice);
                const newestBlockNumberHex = ethers.utils.hexValue(lastBlockAfterUpdate.number);
                const oldestBlockNumberHex = ethers.utils.hexValue(lastBlockAfterUpdate.number - blockCountNumber + 1);

                const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY, [blockCountHex, newestBlockNumberHex, [0]], requestId);

                Assertions.feeHistory(res, {
                    resultCount: blockCountNumber,
                    oldestBlock: oldestBlockNumberHex,
                    checkReward: true
                });
                // We expect all values in the array to be from the mirror node. If there is discrepancy in the blocks, the first value is from the consensus node and it's different from expected.
                expect(res.baseFeePerGas[1]).to.equal(defaultGasPriceHex); // should return defaultGasPriceHex
                expect(res.baseFeePerGas[res.baseFeePerGas.length - 2]).to.equal(defaultGasPriceHex);
                expect(res.baseFeePerGas[res.baseFeePerGas.length - 1]).to.equal(defaultGasPriceHex);
            });

            it('should call eth_feeHistory with newest block > latest', async function () {
                const blocksAhead = 10;

                const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
                const errorType = predefined.REQUEST_BEYOND_HEAD_BLOCK(latestBlock.number + blocksAhead, latestBlock.number);
                const newestBlockNumberHex = ethers.utils.hexValue(latestBlock.number + blocksAhead);
                const args = [RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY, ['0x1', newestBlockNumberHex, null], requestId];

                await Assertions.assertRejection(errorType, relay.call, args, true);
            });

            it('should call eth_feeHistory with zero block count', async function () {
                const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY, ['0x0', 'latest', null], requestId);

                expect(res.reward).to.not.exist;
                expect(res.baseFeePerGas).to.not.exist;
                expect(res.gasUsedRatio).to.equal(null);
                expect(res.oldestBlock).to.equal('0x0');
            });
        });
    }

    describe('eth_feeHistory', () => {
        it('should call eth_feeHistory', async function () {
            const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY, ['0x1', 'latest', null], requestId);
            expect(res.baseFeePerGas).to.exist.to.be.an('Array');
            expect(res.baseFeePerGas.length).to.be.gt(0);
            expect(res.gasUsedRatio).to.exist.to.be.an('Array');
            expect(res.gasUsedRatio.length).to.be.gt(0);
            expect(res.oldestBlock).to.exist;
            expect(Number(res.oldestBlock)).to.be.gt(0);
        });
    });
});
