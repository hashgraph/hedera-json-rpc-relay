/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023-2024 Hedera Hashgraph, LLC
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

// External resources
import { expect } from 'chai';
import { ethers } from 'ethers';
import { AliasAccount } from '../types/AliasAccount';
import { Utils } from '../helpers/utils';
import { ContractId, Hbar, HbarUnit } from '@hashgraph/sdk';

// Assertions from local resources
import Assertions from '../helpers/assertions';

// Contracts from local resources
import parentContractJson from '../contracts/Parent.json';
import basicContractJson from '../contracts/Basic.json';
import storageContractJson from '../contracts/Storage.json';
import TokenCreateJson from '../contracts/TokenCreateContract.json';
import ERC20MockJson from '../contracts/ERC20Mock.json';

// Errors from local resources
import { predefined } from '../../../relay/src/lib/errors/JsonRpcError';

// Helper functions/constants from local resources
import { EthImpl } from '../../../../packages/relay/src/lib/eth';
import RelayCalls from '../../tests/helpers/constants';
import Helper from '../../tests/helpers/constants';
import Address from '../../tests/helpers/constants';
import { numberTo0x } from '../../../../packages/relay/src/formatters';
import constants from '../../tests/helpers/constants';

describe('@api-batch-2 RPC Server Acceptance Tests', function () {
  this.timeout(240 * 1000); // 240 seconds

  const accounts: AliasAccount[] = [];

  // @ts-ignore
  const { servicesNode, mirrorNode, relay, logger, initialBalance } = global;

  // cached entities
  let tokenId;
  let requestId;
  let htsAddress;
  let basicContract: ethers.Contract;
  let basicContractAddress: string;
  let parentContractAddress: string;
  let parentContractLongZeroAddress: string;
  let createChildTx: ethers.ContractTransactionResponse;
  let accounts0StartBalance: bigint;

  const CHAIN_ID = process.env.CHAIN_ID || 0;
  const ONE_TINYBAR = Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 10)));
  const ONE_WEIBAR = Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 18)));

  const BASIC_CONTRACT_PING_CALL_DATA = '0x5c36b186';
  const PING_CALL_ESTIMATED_GAS = '0x6122';
  const EXCHANGE_RATE_FILE_ID = '0.0.112';
  const EXCHANGE_RATE_FILE_CONTENT_DEFAULT = '0a1008b0ea0110f9bb1b1a0608f0cccf9306121008b0ea0110e9c81a1a060880e9cf9306';
  const FEE_SCHEDULE_FILE_ID = '0.0.111';
  const FEE_SCHEDULE_FILE_CONTENT_DEFAULT =
    '0a280a0a08541a061a04408888340a0a08061a061a0440889d2d0a0a08071a061a0440b0b63c120208011200'; // Eth gas = 853000
  const FEE_SCHEDULE_FILE_CONTENT_UPDATED =
    '0a280a0a08541a061a0440a8953a0a0a08061a061a0440889d2d0a0a08071a061a0440b0b63c120208011200'; // Eth gas = 953000

  let blockNumberAtStartOfTests = 0;

  const signSendAndConfirmTransaction = async (transaction, accounts, requestId) => {
    const signedTx = await accounts.wallet.signTransaction(transaction);
    const txHash = await relay.sendRawTransaction(signedTx);
    await mirrorNode.get(`/contracts/results/${txHash}`, requestId);
    await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH, [txHash]);
    await new Promise((r) => setTimeout(r, 2000));
  };

  this.beforeAll(async () => {
    requestId = Utils.generateRequestId();
    const requestIdPrefix = Utils.formatRequestIdMessage(requestId);

    const initialAccount: AliasAccount = global.accounts[0];

    const neededAccounts: number = 4;
    accounts.push(
      ...(await Utils.createMultipleAliasAccounts(
        mirrorNode,
        initialAccount,
        neededAccounts,
        initialBalance,
        requestId,
      )),
    );
    global.accounts.push(...accounts);

    const parentContract = await Utils.deployContract(
      parentContractJson.abi,
      parentContractJson.bytecode,
      accounts[0].wallet,
    );
    parentContractAddress = parentContract.target as string;
    global.logger.trace(`${requestIdPrefix} Deploy parent contract on address ${parentContractAddress}`);

    const mirrorNodeContractRes = await mirrorNode.get(`/contracts/${parentContractAddress}`, requestId);
    const parentContractId = ContractId.fromString(mirrorNodeContractRes.contract_id);
    parentContractLongZeroAddress = `0x${parentContractId.toSolidityAddress()}`;

    await accounts[0].wallet.sendTransaction({
      to: parentContractAddress,
      value: ethers.parseEther('1'),
    });

    // @ts-ignore
    createChildTx = await parentContract.createChild(1);

    global.logger.trace(
      `${requestIdPrefix} Contract call createChild on parentContract results in tx hash: ${createChildTx.hash}`,
    );

    tokenId = await servicesNode.createToken(1000, requestId);
    htsAddress = Utils.idToEvmAddress(tokenId.toString());

    logger.info('Associate and transfer tokens');
    await accounts[0].client.associateToken(tokenId, requestId);
    await accounts[1].client.associateToken(tokenId, requestId);
    await servicesNode.transferToken(tokenId, accounts[0].accountId, 10, requestId);
    await servicesNode.transferToken(tokenId, accounts[1].accountId, 10, requestId);

    blockNumberAtStartOfTests = (await accounts[0].wallet.provider?.getBlockNumber()) as number;
    accounts0StartBalance = (await accounts[0].wallet.provider?.getBalance(accounts[0].address)) as bigint;

    basicContract = await Utils.deployContract(basicContractJson.abi, basicContractJson.bytecode, accounts[0].wallet);
    basicContractAddress = basicContract.target as string;
  });

  this.beforeEach(async () => {
    requestId = Utils.generateRequestId();
  });

  describe('eth_estimateGas', async function () {
    it('@release should execute "eth_estimateGas"', async function () {
      const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{}], requestId);
      expect(res).to.contain('0x');
      expect(res).to.not.be.equal('0x');
      expect(res).to.not.be.equal('0x0');
    });

    it('@release should execute "eth_estimateGas" for contract call', async function () {
      const currentPrice = await relay.gasPrice(requestId);
      const expectedGas = parseInt(PING_CALL_ESTIMATED_GAS, 16);

      const gasPriceDeviation = parseFloat(expectedGas.toString() ?? '0.2');

      const estimatedGas = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
        [
          {
            to: basicContractAddress,
            from: accounts[0].address,
            data: BASIC_CONTRACT_PING_CALL_DATA,
          },
        ],
        requestId,
      );
      expect(estimatedGas).to.contain('0x');
      // handle deviation in gas price
      expect(parseInt(estimatedGas)).to.be.lessThan(currentPrice * (1 + gasPriceDeviation));
      expect(parseInt(estimatedGas)).to.be.greaterThan(currentPrice * (1 - gasPriceDeviation));
    });

    it('@release should execute "eth_estimateGas" for existing account', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
        [
          {
            to: accounts[1].address,
            value: '0x1',
          },
        ],
        requestId,
      );
      const gasPriceDeviation = parseFloat((EthImpl.gasTxBaseCost * 0.2).toString());
      expect(res).to.contain('0x');
      expect(parseInt(res)).to.be.lessThan(Number(EthImpl.gasTxBaseCost) * (1 + gasPriceDeviation));
      expect(parseInt(res)).to.be.greaterThan(Number(EthImpl.gasTxBaseCost) * (1 - gasPriceDeviation));
    });

    it('@release should execute "eth_estimateGas" hollow account creation', async function () {
      const hollowAccount = ethers.Wallet.createRandom();
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
        [
          {
            to: hollowAccount.address,
            value: '0x1',
          },
        ],
        requestId,
      );
      expect(res).to.contain('0x');
      expect(res).to.equal(EthImpl.gasTxHollowAccountCreation);
    });

    it('should execute "eth_estimateGas" with to, from, value and gas filed', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
            to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
            value: '0xa688906bd8b00000',
            gas: '0xd97010',
          },
        ],
        requestId,
      );
      expect(res).to.contain('0x');
      expect(res).to.not.be.equal('0x');
      expect(res).to.not.be.equal('0x0');
    });

    it('should execute "eth_estimateGas" with to, from, value,accessList gas filed', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
            to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
            value: '0xa688906bd8b00000',
            gas: '0xd97010',
            accessList: [],
          },
        ],
        requestId,
      );
      expect(res).to.contain('0x');
      expect(res).to.not.be.equal('0x');
      expect(res).to.not.be.equal('0x0');
    });

    it('should execute "eth_estimateGas" with `to` filed set to null (deployment transaction)', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
            to: null,
            value: `0x${'00'.repeat(5121)}`,
          },
        ],
        requestId,
      );
      expect(res).to.contain('0x');
      expect(res).to.not.be.equal('0x');
      expect(res).to.not.be.equal('0x0');
    });

    it('should not be able to execute "eth_estimateGas" with no transaction object', async function () {
      await relay.callFailing('eth_estimateGas', [], predefined.MISSING_REQUIRED_PARAMETER(0), requestId);
    });

    it('should not be able to execute "eth_estimateGas" with wrong from field', async function () {
      await relay.callFailing(
        'eth_estimateGas',
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517b',
            to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
            value: '0xa688906bd8b00000',
            gas: '0xd97010',
            accessList: [],
          },
        ],
        predefined.INVALID_PARAMETER(
          `'from' for TransactionObject`,
          `Expected 0x prefixed string representing the address (20 bytes), value: 0x114f60009ee6b84861c0cdae8829751e517b`,
        ),
        requestId,
      );
    });

    it('should not be able to execute "eth_estimateGas" with wrong to field', async function () {
      await relay.callFailing(
        'eth_estimateGas',
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
            to: '0xae410f34f7487e2cd03396499cebb09b79f45',
            value: '0xa688906bd8b00000',
            gas: '0xd97010',
            accessList: [],
          },
        ],
        predefined.INVALID_PARAMETER(
          `'to' for TransactionObject`,
          `Expected 0x prefixed string representing the address (20 bytes), value: 0xae410f34f7487e2cd03396499cebb09b79f45`,
        ),
        requestId,
      );
    });

    it('should not be able to execute "eth_estimateGas" with wrong value field', async function () {
      await relay.callFailing(
        'eth_estimateGas',
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
            to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
            value: '123',
            gas: '0xd97010',
            accessList: [],
          },
        ],
        predefined.INVALID_PARAMETER(
          `'value' for TransactionObject`,
          `Expected 0x prefixed hexadecimal value, value: 123`,
        ),
        requestId,
      );
    });

    it('should not be able to execute "eth_estimateGas" with wrong gas field', async function () {
      await relay.callFailing(
        'eth_estimateGas',
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
            to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
            value: '0xa688906bd8b00000',
            gas: '123',
            accessList: [],
          },
        ],
        predefined.INVALID_PARAMETER(
          `'gas' for TransactionObject`,
          `Expected 0x prefixed hexadecimal value, value: 123`,
        ),
        requestId,
      );
    });

    it('should execute "eth_estimateGas" with data as 0x instead of null', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
            to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
            value: '0xa688906bd8b00000',
            gas: '0xd97010',
            data: '0x',
          },
        ],
        requestId,
      );
      expect(res).to.contain('0x');
      expect(res).to.not.be.equal('0x');
      expect(res).to.not.be.equal('0x0');
    });

    it('should execute "eth_estimateGas" with input as 0x instead of data', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
        [
          {
            from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
            to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
            value: '0xa688906bd8b00000',
            gas: '0xd97010',
            input: '0x',
          },
        ],
        requestId,
      );
      expect(res).to.contain('0x');
      expect(res).to.not.be.equal('0x');
      expect(res).to.not.be.equal('0x0');
    });

    it('should throw on "eth_estimateGas" with both input and data fields present in the txObject', async function () {
      try {
        await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
          [
            {
              from: '0x114f60009ee6b84861c0cdae8829751e517bc4d7',
              to: '0xae410f34f7487e2cd03396499cebb09b79f45d6e',
              value: '0xa688906bd8b00000',
              gas: '0xd97010',
              input: '0x',
              data: '0x',
            },
          ],
          requestId,
        );
      } catch (e) {
        expect(e).to.equal(predefined.INVALID_ARGUMENTS('Cannot accept both input and data fields. Use only one.'));
      }
    });
  });

  describe('eth_gasPrice', async function () {
    it('@release should call eth_gasPrice', async function () {
      const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GAS_PRICE, [], requestId);
      expect(res).to.exist;
      if (process.env.LOCAL_NODE && process.env.LOCAL_NODE !== 'false') {
        expect(res).be.equal(ethers.toQuantity(Assertions.defaultGasPrice));
      } else {
        expect(Number(res)).to.be.gt(0);
      }
    });
  });

  describe('eth_getBalance', async function () {
    let getBalanceContract: ethers.Contract;
    let getBalanceContractAddress: string;
    before(async function () {
      getBalanceContract = await Utils.deployContract(
        parentContractJson.abi,
        parentContractJson.bytecode,
        accounts[0].wallet,
      );

      getBalanceContractAddress = getBalanceContract.target as string;

      await accounts[0].wallet.sendTransaction({
        to: getBalanceContractAddress,
        value: ethers.parseEther('1'),
      });
    });

    it('@release should execute "eth_getBalance" for newly created account with 1 HBAR', async function () {
      let balance = Hbar.from(1, HbarUnit.Hbar).toTinybars().toString();
      const newAccount = await Utils.createAliasAccount(mirrorNode, accounts[0], requestId, balance);
      const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE, [newAccount.address, 'latest'], requestId);
      balance = `0x${(BigInt(balance) * BigInt(constants.TINYBAR_TO_WEIBAR_COEF)).toString(16)}`;
      expect(res).to.be.eq(balance);
    });

    it('should execute "eth_getBalance" for non-existing address', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [Address.NON_EXISTING_ADDRESS, 'latest'],
        requestId,
      );
      expect(res).to.eq('0x0');
    });

    it('@release should execute "eth_getBalance" for contract', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [getBalanceContractAddress, 'latest'],
        requestId,
      );
      expect(res).to.eq(ethers.toQuantity(ONE_WEIBAR));
    });

    it('@release should execute "eth_getBalance" for contract with id converted to evm_address', async function () {
      const mirrorNodeContractRes = await mirrorNode.get(`/contracts/${getBalanceContractAddress}`, requestId);
      const contractId = ContractId.fromString(mirrorNodeContractRes.contract_id);
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [`0x${contractId.toSolidityAddress()}`, 'latest'],
        requestId,
      );
      expect(res).to.eq(ethers.toQuantity(ONE_WEIBAR));
    });

    it('@release should execute "eth_getBalance" with latest block number', async function () {
      const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [getBalanceContractAddress, numberTo0x(latestBlock.number)],
        requestId,
      );
      expect(res).to.eq(ethers.toQuantity(ONE_WEIBAR));
    });

    it('@release should execute "eth_getBalance" with one block behind latest block number', async function () {
      const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [getBalanceContractAddress, numberTo0x(latestBlock.number - 1)],
        requestId,
      );
      expect(res).to.eq(ethers.toQuantity(ONE_WEIBAR));
    });

    it('@release should execute "eth_getBalance" with latest block hash', async function () {
      const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [getBalanceContractAddress, numberTo0x(latestBlock.number)],
        requestId,
      );
      expect(res).to.eq(ethers.toQuantity(ONE_WEIBAR));
    });

    it('@release should execute "eth_getBalance" with pending', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [getBalanceContractAddress, 'pending'],
        requestId,
      );
      expect(res).to.eq(ethers.toQuantity(ONE_WEIBAR));
    });

    it('@release should execute "eth_getBalance" with block number in the last 15 minutes', async function () {
      const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
      const earlierBlockNumber = latestBlock.number - 2;
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [getBalanceContractAddress, numberTo0x(earlierBlockNumber)],
        requestId,
      );
      expect(res).to.eq(ethers.toQuantity(ONE_WEIBAR));
    });

    it('@release should execute "eth_getBalance" with block number in the last 15 minutes for account that has performed contract deploys/calls', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [accounts[0].address, numberTo0x(blockNumberAtStartOfTests)],
        requestId,
      );
      const balanceAtBlock = BigInt(accounts0StartBalance);
      expect(res).to.eq(`0x${balanceAtBlock.toString(16)}`);
    });

    it('@release should correctly execute "eth_getBalance" with block number in the last 15 minutes with several txs around that time', async function () {
      const initialBalance = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [accounts[0].address, 'latest'],
        requestId,
      );
      const acc3Nonce = await relay.getAccountNonce(accounts[3].address);
      const gasPrice = await relay.gasPrice();

      const transaction = {
        value: ONE_TINYBAR,
        gasLimit: 50000,
        chainId: Number(CHAIN_ID),
        to: accounts[0].wallet.address,
        nonce: acc3Nonce,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
      };

      await signSendAndConfirmTransaction(transaction, accounts[3], requestId);

      const blockNumber = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_BLOCK_NUMBER, [], requestId);

      await signSendAndConfirmTransaction({ ...transaction, nonce: acc3Nonce + 1 }, accounts[3], requestId);

      const endBalance = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [accounts[0].address, 'latest'],
        requestId,
      );

      // initialBalance + sum of value of all transactions
      const manuallyCalculatedBalance = BigInt(initialBalance) + BigInt(ONE_TINYBAR) * BigInt(2);
      expect(BigInt(endBalance).toString()).to.eq(manuallyCalculatedBalance.toString());

      // Balance at the block number of tx1 should be initialBalance + the value of tx1
      const balanceAtTx1Block = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
        [accounts[0].address, blockNumber],
        requestId,
      );
      const manuallyCalculatedBalanceAtTx1Block = BigInt(initialBalance) + BigInt(ONE_TINYBAR);
      expect(BigInt(balanceAtTx1Block).toString()).to.eq(manuallyCalculatedBalanceAtTx1Block.toString());
    });
  });

  describe('@release Hardcoded RPC Endpoints', () => {
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
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_HASH_AND_INDEX,
        [createChildTx.hash, 0],
        requestId,
      );
      expect(res).to.be.null;
    });

    it('should execute "eth_getUncleByBlockHashAndIndex" for non-existing block hash and index=0', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_HASH_AND_INDEX,
        [Address.NON_EXISTING_BLOCK_HASH, 0],
        requestId,
      );
      expect(res).to.be.null;
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_NUMBER_AND_INDEX,
        [createChildTx.blockNumber, 0],
        requestId,
      );
      expect(res).to.be.null;
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex" for non-existing block number and index=0', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_NUMBER_AND_INDEX,
        [Address.NON_EXISTING_BLOCK_NUMBER, 0],
        requestId,
      );
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
    let mainContract: ethers.Contract;
    let mainContractAddress: string;
    let NftHTSTokenContractAddress: string;
    let redirectBytecode: string;

    async function createNftHTSToken(account) {
      const mainContract = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[0].wallet);
      const tx = await mainContract.createNonFungibleTokenPublic(account.wallet.address, {
        value: BigInt('10000000000000000000'),
        ...Helper.GAS.LIMIT_5_000_000,
      });
      const { tokenAddress } = (await tx.wait()).logs.filter(
        (e) => e.fragment.name === RelayCalls.HTS_CONTRACT_EVENTS.CreatedToken,
      )[0].args;

      return tokenAddress;
    }

    before(async () => {
      mainContract = await Utils.deployContract(TokenCreateJson.abi, TokenCreateJson.bytecode, accounts[3].wallet);
      mainContractAddress = mainContract.target as string;

      const accountWithContractIdKey = await servicesNode.createAccountWithContractIdKey(
        ContractId.fromEvmAddress(0, 0, mainContractAddress),
        60,
        relay.provider,
        requestId,
      );
      NftHTSTokenContractAddress = await createNftHTSToken(accountWithContractIdKey);
    });

    it('should execute "eth_getCode" for hts token', async function () {
      const tokenAddress = NftHTSTokenContractAddress.slice(2);
      redirectBytecode = `6080604052348015600f57600080fd5b506000610167905077618dc65e${tokenAddress}600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033`;
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
        [NftHTSTokenContractAddress, 'latest'],
        requestId,
      );
      expect(res).to.equal(redirectBytecode);
    });

    it('@release should execute "eth_getCode" for contract evm_address', async function () {
      const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE, [basicContractAddress, 'latest'], requestId);
      expect(res).to.eq(basicContractJson.deployedBytecode);
    });

    it('@release should execute "eth_getCode" for contract with id converted to evm_address', async function () {
      const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE, [basicContractAddress, 'latest'], requestId);
      expect(res).to.eq(basicContractJson.deployedBytecode);
    });

    it('should return 0x0 for non-existing contract on eth_getCode', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
        [Address.NON_EXISTING_ADDRESS, 'latest'],
        requestId,
      );
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

    it('should not return contract bytecode after sefldestruct', async function () {
      const bytecodeBefore = await relay.call('eth_getCode', [basicContractAddress, 'latest'], requestId);

      // @ts-ignore
      await basicContract.connect(accounts[0].wallet).destroy();

      const bytecodeAfter = await relay.call('eth_getCode', [basicContractAddress, 'latest'], requestId);
      expect(bytecodeAfter).to.not.eq(bytecodeBefore);
      expect(bytecodeAfter).to.eq('0x');
    });
  });

  // Test state changes with getStorageAt
  describe('eth_getStorageAt', () => {
    let storageContract: ethers.Contract;
    let storageContractAddress: string;
    const STORAGE_CONTRACT_UPDATE = '0x2de4e884';
    const NEXT_STORAGE_CONTRACT_UPDATE = '0x160D6484';

    this.beforeEach(async () => {
      storageContract = await Utils.deployContract(
        storageContractJson.abi,
        storageContractJson.bytecode,
        accounts[0].wallet,
      );
      storageContractAddress = storageContract.target as string;
    });

    it('should execute "eth_getStorageAt" request to get current state changes', async function () {
      const BEGIN_EXPECTED_STORAGE_VAL = '0x000000000000000000000000000000000000000000000000000000000000000f';
      const END_EXPECTED_STORAGE_VAL = '0x0000000000000000000000000000000000000000000000000000000000000008';

      const beginStorageVal = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [storageContractAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', 'latest'],
        requestId,
      );
      expect(beginStorageVal).to.eq(BEGIN_EXPECTED_STORAGE_VAL);

      const gasPrice = await relay.gasPrice();
      const transaction = {
        value: 0,
        gasLimit: 50000,
        chainId: Number(CHAIN_ID),
        to: storageContractAddress,
        nonce: await relay.getAccountNonce(accounts[1].address),
        gasPrice: gasPrice,
        data: STORAGE_CONTRACT_UPDATE,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        type: 2,
      };

      const signedTx = await accounts[1].wallet.signTransaction(transaction);
      await relay.sendRawTransaction(signedTx, requestId);

      // wait for the transaction to propogate to mirror node
      await new Promise((r) => setTimeout(r, 4000));

      const storageVal = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [storageContractAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', 'latest'],
        requestId,
      );
      expect(storageVal).to.eq(END_EXPECTED_STORAGE_VAL);
    });

    it('should execute "eth_getStorageAt" request to get old state with passing specific block', async function () {
      const END_EXPECTED_STORAGE_VAL = '0x0000000000000000000000000000000000000000000000000000000000000008';

      const beginStorageVal = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [storageContractAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', 'latest'],
        requestId,
      );

      const gasPrice = await relay.gasPrice();
      const transaction = {
        value: 0,
        gasLimit: 50000,
        chainId: Number(CHAIN_ID),
        to: storageContractAddress,
        nonce: await relay.getAccountNonce(accounts[1].address),
        gasPrice: gasPrice,
        data: STORAGE_CONTRACT_UPDATE,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        type: 2,
      };

      const signedTx = await accounts[1].wallet.signTransaction(transaction);
      const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
      const txReceipt = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
        [transactionHash],
        requestId,
      );
      const blockNumber = txReceipt.blockNumber;

      // wait for the transaction to propogate to mirror node
      await new Promise((r) => setTimeout(r, 4000));

      const latestStorageVal = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [storageContractAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', 'latest'],
        requestId,
      );
      const blockNumberBeforeChange = `0x${(blockNumber - 1).toString(16)}`;
      const storageValBeforeChange = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [
          storageContractAddress,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          blockNumberBeforeChange,
        ],
        requestId,
      );

      expect(latestStorageVal).to.eq(END_EXPECTED_STORAGE_VAL);
      expect(storageValBeforeChange).to.eq(beginStorageVal);
    });

    it('should execute "eth_getStorageAt" request to get current state changes without passing block', async function () {
      const BEGIN_EXPECTED_STORAGE_VAL = '0x000000000000000000000000000000000000000000000000000000000000000f';
      const END_EXPECTED_STORAGE_VAL = '0x0000000000000000000000000000000000000000000000000000000000000008';

      const beginStorageVal = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [storageContractAddress, '0x0000000000000000000000000000000000000000000000000000000000000000'],
        requestId,
      );
      expect(beginStorageVal).to.eq(BEGIN_EXPECTED_STORAGE_VAL);

      const gasPrice = await relay.gasPrice();
      const transaction = {
        value: 0,
        gasLimit: 50000,
        chainId: Number(CHAIN_ID),
        to: storageContractAddress,
        nonce: await relay.getAccountNonce(accounts[1].address),
        gasPrice: gasPrice,
        data: STORAGE_CONTRACT_UPDATE,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        type: 2,
      };

      const signedTx = await accounts[1].wallet.signTransaction(transaction);
      await relay.sendRawTransaction(signedTx, requestId);

      // wait for the transaction to propogate to mirror node
      await new Promise((r) => setTimeout(r, 4000));

      const storageVal = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [storageContractAddress, '0x0000000000000000000000000000000000000000000000000000000000000000'],
        requestId,
      );
      expect(storageVal).to.eq(END_EXPECTED_STORAGE_VAL);
    });

    it('should execute "eth_getStorageAt" request to get current state changes with passing specific block', async function () {
      const EXPECTED_STORAGE_VAL = '0x0000000000000000000000000000000000000000000000000000000000000008';

      const gasPrice = await relay.gasPrice();
      const transaction = {
        value: 0,
        gasLimit: 50000,
        chainId: Number(CHAIN_ID),
        to: storageContractAddress,
        nonce: await relay.getAccountNonce(accounts[1].address),
        gasPrice: gasPrice,
        data: STORAGE_CONTRACT_UPDATE,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        type: 2,
      };

      const signedTx = await accounts[1].wallet.signTransaction(transaction);
      const transactionHash = await relay.sendRawTransaction(signedTx, requestId);

      const blockNumber = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
        [transactionHash],
        requestId,
      ).blockNumber;

      const transaction1 = {
        ...transaction,
        nonce: await relay.getAccountNonce(accounts[1].address),
        data: NEXT_STORAGE_CONTRACT_UPDATE,
      };

      const signedTx1 = await accounts[1].wallet.signTransaction(transaction1);
      await relay.sendRawTransaction(signedTx1, requestId);
      await new Promise((r) => setTimeout(r, 2000));

      //Get previous state change with specific block number
      const storageVal = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [storageContractAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', blockNumber],
        requestId,
      );
      expect(storageVal).to.eq(EXPECTED_STORAGE_VAL);
    });

    it('should execute "eth_getStorageAt" request to get current state changes with passing specific block hash', async function () {
      const EXPECTED_STORAGE_VAL = '0x0000000000000000000000000000000000000000000000000000000000000008';

      const gasPrice = await relay.gasPrice();
      const transaction = {
        value: 0,
        gasLimit: 50000,
        chainId: Number(CHAIN_ID),
        to: storageContractAddress,
        nonce: await relay.getAccountNonce(accounts[1].address),
        gasPrice: gasPrice,
        data: STORAGE_CONTRACT_UPDATE,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        type: 2,
      };

      const signedTx = await accounts[1].wallet.signTransaction(transaction);
      const transactionHash = await relay.sendRawTransaction(signedTx, requestId);

      const blockHash = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
        [transactionHash],
        requestId,
      ).blockHash;

      const transaction1 = {
        ...transaction,
        nonce: await relay.getAccountNonce(accounts[1].address),
        data: NEXT_STORAGE_CONTRACT_UPDATE,
      };

      const signedTx1 = await accounts[1].wallet.signTransaction(transaction1);
      await relay.sendRawTransaction(signedTx1, requestId);
      await new Promise((r) => setTimeout(r, 2000));

      //Get previous state change with specific block number
      const storageVal = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        [storageContractAddress, '0x0000000000000000000000000000000000000000000000000000000000000000', blockHash],
        requestId,
      );
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
        await new Promise((resolve) => setTimeout(resolve, 4000));
        await servicesNode.updateFileContent(FEE_SCHEDULE_FILE_ID, FEE_SCHEDULE_FILE_CONTENT_UPDATED, requestId);
        await new Promise((resolve) => setTimeout(resolve, 4000));
        lastBlockAfterUpdate = (await mirrorNode.get(`/blocks?limit=1&order=desc`, requestId)).blocks[0];
      });

      after(async () => {
        await servicesNode.updateFileContent(
          FEE_SCHEDULE_FILE_ID,
          feeScheduleContentAtStart.toString('hex'),
          requestId,
        );
        await servicesNode.updateFileContent(
          EXCHANGE_RATE_FILE_ID,
          exchangeRateContentAtStart.toString('hex'),
          requestId,
        );
        await new Promise((resolve) => setTimeout(resolve, 4000));
      });

      it('should call eth_feeHistory with updated fees', async function () {
        const blockCountNumber = lastBlockAfterUpdate.number - lastBlockBeforeUpdate.number;
        const blockCountHex = ethers.toQuantity(blockCountNumber);
        const defaultGasPriceHex = ethers.toQuantity(Assertions.defaultGasPrice);
        const newestBlockNumberHex = ethers.toQuantity(lastBlockAfterUpdate.number);
        const oldestBlockNumberHex = ethers.toQuantity(lastBlockAfterUpdate.number - blockCountNumber + 1);

        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY,
          [blockCountHex, newestBlockNumberHex, [0]],
          requestId,
        );

        Assertions.feeHistory(res, {
          resultCount: blockCountNumber,
          oldestBlock: oldestBlockNumberHex,
          checkReward: true,
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
        const newestBlockNumberHex = ethers.toQuantity(latestBlock.number + blocksAhead);
        const args = [RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY, ['0x1', newestBlockNumberHex, null], requestId];

        await Assertions.assertPredefinedRpcError(errorType, relay.call, true, relay, args);
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

  describe('Formats of addresses in Transaction and Receipt results', () => {
    const getTxData = async (hash) => {
      const txByHash = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH, [hash], requestId);
      const receipt = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT, [hash], requestId);
      let mirrorResult = await mirrorNode.get(`/contracts/results/${hash}`, requestId);

      return { txByHash, receipt, mirrorResult };
    };

    it('from/to Addresses in transaction between accounts are in evm format', async function () {
      const tx = await accounts[0].wallet.sendTransaction({
        to: accounts[1].wallet,
        value: ethers.parseEther('1'),
      });

      await tx.wait();

      let { txByHash, receipt, mirrorResult } = await getTxData(tx.hash);

      mirrorResult.from = accounts[0].wallet.address;
      mirrorResult.to = accounts[1].wallet.address;
      const currentPrice = await relay.gasPrice(requestId);

      Assertions.transaction(txByHash, mirrorResult);
      Assertions.transactionReceipt(receipt, mirrorResult, currentPrice);

      Assertions.evmAddress(txByHash.from);
      Assertions.evmAddress(txByHash.to);
      Assertions.evmAddress(receipt.from);
      Assertions.evmAddress(receipt.to);
    });

    it('from/to Addresses in transaction to a contract (deployed through the relay) are in evm and long-zero format', async function () {
      const relayContract = await Utils.deployContractWithEthers([], basicContractJson, accounts[0].wallet, relay);

      const tx = await accounts[0].wallet.sendTransaction({
        to: relayContract.target,
        value: ethers.parseEther('1'),
      });

      await tx.wait();

      let { txByHash, receipt, mirrorResult } = await getTxData(tx.hash);

      mirrorResult.from = accounts[0].wallet.address;
      mirrorResult.to = relayContract.target;
      const currentPrice = await relay.gasPrice(requestId);

      Assertions.transaction(txByHash, mirrorResult);
      Assertions.transactionReceipt(receipt, mirrorResult, currentPrice);

      Assertions.evmAddress(txByHash.from);
      Assertions.evmAddress(txByHash.to);
      Assertions.evmAddress(receipt.from);
      Assertions.evmAddress(receipt.to);
    });

    // Should be revised or deleted https://github.com/hashgraph/hedera-json-rpc-relay/pull/1726/files#r1320363677
    xit('from/to Addresses in transaction to a contract (deployed through HAPI tx) are in evm and long-zero format', async function () {
      const tx = await accounts[0].wallet.sendTransaction({
        to: parentContractLongZeroAddress,
        value: ethers.parseEther('1'),
      });

      await tx.wait();

      let { txByHash, receipt, mirrorResult } = await getTxData(tx.hash);

      mirrorResult.from = accounts[0].wallet.address;
      mirrorResult.to = parentContractLongZeroAddress;
      const currentPrice = await relay.gasPrice(requestId);

      Assertions.transaction(txByHash, mirrorResult);
      Assertions.transactionReceipt(receipt, mirrorResult, currentPrice);

      Assertions.evmAddress(txByHash.from);
      Assertions.longZeroAddress(txByHash.to);
      Assertions.evmAddress(receipt.from);
      Assertions.longZeroAddress(receipt.to);
    });

    it('from/to Addresses when transferring HTS tokens to the tokenAddress are in evm and long-zero format', async function () {
      const tokenAsERC20 = new ethers.Contract(htsAddress, ERC20MockJson.abi, accounts[0].wallet);
      const tx = await tokenAsERC20.transfer(accounts[1].wallet.address, 1, await Utils.gasOptions(requestId));

      await tx.wait();

      let { txByHash, receipt, mirrorResult } = await getTxData(tx.hash);

      mirrorResult.from = accounts[0].wallet.address;

      // ignore assertion of logs to keep the test simple
      receipt.logs = [];
      mirrorResult.logs = [];
      const currentPrice = await relay.gasPrice(requestId);

      Assertions.transaction(txByHash, mirrorResult);
      Assertions.transactionReceipt(receipt, mirrorResult, currentPrice);

      Assertions.evmAddress(txByHash.from);
      Assertions.longZeroAddress(txByHash.to);
      Assertions.evmAddress(receipt.from);
      Assertions.longZeroAddress(receipt.to);
    });
  });
});
