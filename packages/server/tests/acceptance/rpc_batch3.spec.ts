/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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
import { ethers } from 'ethers';
import { AliasAccount } from '../clients/servicesClient';
import { Utils } from '../helpers/utils';

// local resources
import reverterContractJson from '../contracts/Reverter.json';
import { EthImpl } from '../../../../packages/relay/src/lib/eth';
import { predefined } from '../../../../packages/relay';
import basicContractJson from '../contracts/Basic.json';
import callerContractJson from '../contracts/Caller.json';
import DeployerContractJson from '../contracts/Deployer.json';
import HederaTokenServiceImplJson from '../contracts/HederaTokenServiceImpl.json';
//Constants are imported with different definitions for better readability in the code.
import RelayCall from '../../tests/helpers/constants';
import Helper from '../../tests/helpers/constants';
import Address from '../../tests/helpers/constants';
import Assertions from '../helpers/assertions';
import RelayCalls from '../helpers/constants';
import RelayAssertions from '../../../../packages/relay/tests/assertions';
import { numberTo0x } from '../../../../packages/relay/src/formatters';
import EstimateGasContract from '../contracts/EstimateGasContract.json';
import Reverter from '../contracts/Reverter.json';
import { signTransaction } from '../../../relay/tests/helpers';
import { TracerType } from '../../../relay/src/lib/constants';
import parentContractJson from '../contracts/Parent.json';
import { DebugService } from '../../../relay/src/lib/services/debugService';
import { MirrorNodeClient } from '../../../relay/src/lib/clients';
import pino from 'pino';
import { Registry } from 'prom-client';
import { CacheService } from '../../../relay/src/lib/services/cacheService/cacheService';
import { CommonService } from '../../../relay/src/lib/services/ethService';

describe('@api-batch-3 RPC Server Acceptance Tests', function () {
  this.timeout(240 * 1000); // 240 seconds

  const accounts: AliasAccount[] = [];

  // @ts-ignore
  const { servicesNode, mirrorNode, relay } = global;
  let mirrorPrimaryAccount, mirrorSecondaryAccount;
  const sendRawTransaction = relay.sendRawTransaction;

  const CHAIN_ID = process.env.CHAIN_ID || 0;
  const ONE_TINYBAR = Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 10)));

  let reverterContract, reverterEvmAddress, requestId;
  const BASIC_CONTRACT_PING_CALL_DATA = '0x5c36b186';
  const BASIC_CONTRACT_PING_RESULT = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const RESULT_TRUE = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const PURE_METHOD_CALL_DATA = '0xb2e0100c';
  const VIEW_METHOD_CALL_DATA = '0x90e9b875';
  const PAYABLE_METHOD_CALL_DATA = '0xd0efd7ef';
  const PURE_METHOD_ERROR_DATA =
    '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5075726500000000000000000000000000000000';
  const VIEW_METHOD_ERROR_DATA =
    '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5669657700000000000000000000000000000000';
  const PAYABLE_METHOD_ERROR_DATA =
    '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013526576657274526561736f6e50617961626c6500000000000000000000000000';
  const PURE_METHOD_ERROR_MESSAGE = 'RevertReasonPure';
  const VIEW_METHOD_ERROR_MESSAGE = 'RevertReasonView';
  const errorMessagePrefixedStr =
    'Expected 0x prefixed string representing the hash (32 bytes) in object, 0x prefixed hexadecimal block number, or the string "latest", "earliest" or "pending"';
  const TOPICS = [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000000000000000000000000000042d',
  ];

  beforeEach(async () => {
    requestId = Utils.generateRequestId();
  });

  before(async () => {
    requestId = Utils.generateRequestId();

    accounts[0] = await servicesNode.createAliasAccount(80, relay.provider, requestId);
    accounts[1] = await servicesNode.createAliasAccount(80, relay.provider, requestId);
    accounts[2] = await servicesNode.createAliasAccount(100, relay.provider, requestId);

    reverterContract = await servicesNode.deployContract(reverterContractJson);
    // Wait for creation to propagate
    await mirrorNode.get(`/contracts/${reverterContract.contractId}`, requestId);
    reverterEvmAddress = `0x${reverterContract.contractId.toSolidityAddress()}`;

    mirrorPrimaryAccount = (await mirrorNode.get(`accounts?account.id=${accounts[0].accountId}`, requestId))
      .accounts[0];
    mirrorSecondaryAccount = (await mirrorNode.get(`accounts?account.id=${accounts[1].accountId}`, requestId))
      .accounts[0];
  });

  describe('eth_call', () => {
    let basicContract, evmAddress;

    before(async () => {
      basicContract = await servicesNode.deployContract(basicContractJson);
      // Wait for creation to propagate
      await mirrorNode.get(`/contracts/${basicContract.contractId}`, requestId);

      evmAddress = `0x${basicContract.contractId.toSolidityAddress()}`;
    });

    it('@release should execute "eth_call" request to Basic contract', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        gas: numberTo0x(30000),
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };

      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
      expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
    });

    it('should fail "eth_call" request without data field', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        gas: numberTo0x(30000),
      };

      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
      expect(res).to.eq('0x'); // confirm no error
    });

    it('"eth_call" for non-existing contract address returns 0x', async function () {
      const callData = {
        from: accounts[0].address,
        to: Address.NON_EXISTING_ADDRESS,
        gas: numberTo0x(30000),
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };

      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
      expect(res).to.eq('0x'); // confirm no error
    });

    it('should execute "eth_call" without from field', async function () {
      const callData = {
        to: evmAddress,
        gas: numberTo0x(30000),
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };

      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
      expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
    });

    it('should execute "eth_call" without gas field', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };

      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
      expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
    });

    it('should execute "eth_call" with correct block number', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };

      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, '0x10'], requestId);
      expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
    });

    it('should execute "eth_call" with correct block hash object', async function () {
      const blockHash = '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3';
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };

      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, { blockHash: blockHash }], requestId);
      expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
    });

    it('should execute "eth_call" with correct block number object', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };

      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, { blockNumber: '0x1' }], requestId);
      expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
    });

    it('should fail to execute "eth_call" with wrong block tag', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };
      const errorType = predefined.INVALID_PARAMETER(1, `${errorMessagePrefixedStr}, value: newest`);
      const args = [RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'newest'], requestId];

      await Assertions.assertPredefinedRpcError(errorType, relay.call, false, relay, args);
    });

    it('should fail to execute "eth_call" with wrong block number', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };
      const errorType = predefined.INVALID_PARAMETER(1, `${errorMessagePrefixedStr}, value: 123`);
      const args = [RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, '123'], requestId];

      await Assertions.assertPredefinedRpcError(errorType, relay.call, false, relay, args);
    });

    it('should fail to execute "eth_call" with wrong block hash object', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };
      const errorType = predefined.INVALID_PARAMETER(
        `'blockHash' for BlockHashObject`,
        'Expected 0x prefixed string representing the hash (32 bytes) of a block, value: 0x123',
      );
      const args = [RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, { blockHash: '0x123' }], requestId];

      await Assertions.assertPredefinedRpcError(errorType, relay.call, false, relay, args);
    });

    it('should fail to execute "eth_call" with wrong block number object', async function () {
      const callData = {
        from: accounts[0].address,
        to: evmAddress,
        data: BASIC_CONTRACT_PING_CALL_DATA,
      };
      const errorType = predefined.INVALID_PARAMETER(
        `'blockNumber' for BlockNumberObject`,
        `Expected 0x prefixed hexadecimal block number, or the string "latest", "earliest" or "pending", value: invalid_block_number`,
      );
      const args = [RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, { blockNumber: 'invalid_block_number' }], requestId];

      await Assertions.assertPredefinedRpcError(errorType, relay.call, false, relay, args);
    });

    describe('Caller contract', () => {
      let callerContract, callerAddress, defaultCallData, activeAccount;

      const describes = [
        {
          title: 'With long-zero address',
          beforeFunc: async function () {
            activeAccount = accounts[0];
            callerContract = await servicesNode.deployContract(callerContractJson);
            // Wait for creation to propagate
            await mirrorNode.get(`/contracts/${callerContract.contractId}`, requestId);
            callerAddress = `0x${callerContract.contractId.toSolidityAddress()}`;
            defaultCallData = {
              from: activeAccount.address,
              to: callerAddress,
              gas: `0x7530`,
            };
          },
        },
        {
          title: 'With evm address',
          beforeFunc: async function () {
            activeAccount = accounts[1];
            callerContract = await Utils.deployContractWithEthers([], callerContractJson, activeAccount.wallet, relay);
            // Wait for creation to propagate
            const callerMirror = await mirrorNode.get(`/contracts/${callerContract.target}`, requestId);
            callerAddress = callerMirror.evm_address;
            defaultCallData = {
              from: activeAccount.address,
              to: callerAddress,
              gas: `0x7530`,
            };
          },
        },
      ];

      for (const desc of describes) {
        describe(desc.title, () => {
          before(desc.beforeFunc);

          it('001 Should call pureMultiply', async function () {
            const callData = {
              ...defaultCallData,
              data: '0x0ec1551d',
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000004');
          });

          it('002 Should call msgSender', async function () {
            const callData = {
              ...defaultCallData,
              data: '0xd737d0c7',
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq(`0x${activeAccount.address.replace('0x', '').padStart(64, '0')}`);
          });

          it('003 Should call txOrigin', async function () {
            const callData = {
              ...defaultCallData,
              data: '0xf96757d1',
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq(`0x${activeAccount.address.replace('0x', '').padStart(64, '0')}`);
          });

          it('004 Should call msgSig', async function () {
            const callData = {
              ...defaultCallData,
              data: '0xec3e88cf',
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq('0xec3e88cf00000000000000000000000000000000000000000000000000000000');
          });

          it('005 Should call addressBalance', async function () {
            const callData = {
              ...defaultCallData,
              data: '0x0ec1551d',
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000004');
          });

          it("006 'data' from request body with wrong method signature", async function () {
            const callData = {
              ...defaultCallData,
              data: '0x3ec4de3800000000000000000000000067d8d32e9bf1a9968a5ff53b87d777aa8ebbee69',
            };

            await relay.callFailing(
              RelayCall.ETH_ENDPOINTS.ETH_CALL,
              [callData, 'latest'],
              predefined.CONTRACT_REVERT(),
              requestId,
            );
          });

          it("007 'data' from request body with wrong encoded parameter", async function () {
            const callData = {
              ...defaultCallData,
              data: '0x3ec4de350000000000000000000000000000000000000000000000000000000000000000',
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
          });

          it("008 should work for missing 'from' field", async function () {
            const callData = {
              to: callerAddress,
              data: '0x0ec1551d',
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000004');
          });

          it("009 should fail for missing 'to' field", async function () {
            const callData = {
              from: accounts[0].address,
              data: '0x0ec1551d',
            };

            await relay.callFailing(
              RelayCall.ETH_ENDPOINTS.ETH_CALL,
              [callData, 'latest'],
              predefined.INVALID_CONTRACT_ADDRESS(undefined),
              requestId,
            );
          });

          // value is processed only when eth_call goes through the mirror node
          if (
            process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE &&
            process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE === 'false'
          ) {
            it('010 Should call msgValue', async function () {
              const callData = {
                ...defaultCallData,
                data: '0xddf363d7',
                value: '0x3e8',
              };

              const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
              expect(res).to.eq('0x00000000000000000000000000000000000000000000000000000000000003e8');
            });

            // test is pending until fallback workflow to consensus node is removed, because this flow works when calling to consensus
            xit('011 Should fail when calling msgValue with more value than available balance', async function () {
              const callData = {
                ...defaultCallData,
                data: '0xddf363d7',
                value: '0x3e80000000',
              };
              const errorType = predefined.CONTRACT_REVERT();
              const args = [RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId];

              await Assertions.assertPredefinedRpcError(errorType, relay.call, true, relay, args);
            });

            it("012 should work for wrong 'from' field", async function () {
              const callData = {
                from: '0x0000000000000000000000000000000000000000',
                to: callerAddress,
                data: '0x0ec1551d',
              };

              const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
              expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000004');
            });
          }
        });
      }
    });
  });

  describe('Contract call reverts', async () => {
    it('Returns revert message for pure methods', async () => {
      const callData = {
        from: accounts[0].address,
        to: reverterEvmAddress,
        gas: numberTo0x(30000),
        data: PURE_METHOD_CALL_DATA,
      };

      await relay.callFailing(
        RelayCall.ETH_ENDPOINTS.ETH_CALL,
        [callData, 'latest'],
        predefined.CONTRACT_REVERT(PURE_METHOD_ERROR_MESSAGE, PURE_METHOD_ERROR_DATA),
        requestId,
      );
    });

    it('Returns revert message for view methods', async () => {
      const callData = {
        from: accounts[0].address,
        to: reverterEvmAddress,
        gas: numberTo0x(30000),
        data: VIEW_METHOD_CALL_DATA,
      };

      await relay.callFailing(
        RelayCall.ETH_ENDPOINTS.ETH_CALL,
        [callData, 'latest'],
        predefined.CONTRACT_REVERT(VIEW_METHOD_ERROR_MESSAGE, VIEW_METHOD_ERROR_DATA),
        requestId,
      );
    });

    it('Returns revert reason in receipt for payable methods', async () => {
      const transaction = {
        value: ONE_TINYBAR,
        gasLimit: numberTo0x(30000),
        chainId: Number(CHAIN_ID),
        to: reverterEvmAddress,
        nonce: await relay.getAccountNonce(accounts[0].address, requestId),
        maxFeePerGas: await relay.gasPrice(requestId),
        data: PAYABLE_METHOD_CALL_DATA,
      };
      const signedTx = await accounts[0].wallet.signTransaction(transaction);
      const transactionHash = await relay.sendRawTransaction(signedTx, requestId);

      // Wait until receipt is available in mirror node
      await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);

      const receipt = await relay.call(
        RelayCall.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
        [transactionHash],
        requestId,
      );
      expect(receipt?.revertReason).to.exist;
      expect(receipt.revertReason).to.eq(PAYABLE_METHOD_ERROR_DATA);
    });

    describe('eth_getTransactionByHash for reverted payable contract calls', async function () {
      const payableMethodsData = [
        {
          data: '0xfe0a3dd7',
          method: 'revertWithNothing',
          message: '',
          errorData: '0x',
        },
        {
          data: '0x0323d234',
          method: 'revertWithString',
          message: 'Some revert message',
          errorData:
            '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d6520726576657274206d65737361676500000000000000000000000000',
        },
        {
          data: '0x46fc4bb1',
          method: 'revertWithCustomError',
          message: '',
          errorData: '0x0bd3d39c',
        },
        {
          data: '0x33fe3fbd',
          method: 'revertWithPanic',
          message: '',
          errorData: '0x4e487b710000000000000000000000000000000000000000000000000000000000000012',
        },
      ];
      const hashes: any = [];

      beforeEach(async () => {
        requestId = Utils.generateRequestId();
      });

      before(async function () {
        for (const element of payableMethodsData) {
          const transaction = {
            // value: ONE_TINYBAR,
            gasLimit: numberTo0x(30000),
            chainId: Number(CHAIN_ID),
            to: reverterEvmAddress,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            maxFeePerGas: await relay.gasPrice(requestId),
            data: element.data,
          };
          const signedTx = await accounts[0].wallet.signTransaction(transaction);
          const hash = await relay.sendRawTransaction(signedTx, requestId);
          hashes.push(hash);

          // Wait until receipt is available in mirror node
          await mirrorNode.get(`/contracts/results/${hash}`, requestId);
        }
      });

      for (let i = 0; i < payableMethodsData.length; i++) {
        it(`Payable method ${payableMethodsData[i].method} returns tx object`, async function () {
          const tx = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH, [hashes[i]], requestId);
          expect(tx).to.exist;
          expect(tx.hash).to.exist;
          expect(tx.hash).to.eq(hashes[i]);
        });
      }

      // skip this test if using a remote relay since updating the env vars would not affect it
      if (global.relayIsLocal) {
        describe('DEV_MODE = true', async function () {
          before(async () => {
            process.env.DEV_MODE = 'true';
          });

          after(async () => {
            process.env.DEV_MODE = 'false';
          });

          for (let i = 0; i < payableMethodsData.length; i++) {
            it(`Payable method ${payableMethodsData[i].method} throws an error`, async function () {
              await relay.callFailing(
                RelayCall.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
                [hashes[i]],
                predefined.CONTRACT_REVERT(payableMethodsData[i].message, payableMethodsData[i].errorData),
                requestId,
              );
            });
          }
        });
      }
    });

    describe('eth_call for reverted pure contract calls', async function () {
      beforeEach(async () => {
        requestId = Utils.generateRequestId();
      });

      const pureMethodsData = [
        {
          data: '0x2dac842f',
          method: 'revertWithNothingPure',
          message: '',
          errorData: '0x',
        },
        {
          data: '0x8b153371',
          method: 'revertWithStringPure',
          message: 'Some revert message',
          errorData:
            '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d6520726576657274206d65737361676500000000000000000000000000',
        },
        {
          data: '0x35314694',
          method: 'revertWithCustomErrorPure',
          message: '',
          errorData: '0x0bd3d39c',
        },
        {
          data: '0x83889056',
          method: 'revertWithPanicPure',
          message: '',
          errorData: '0x4e487b710000000000000000000000000000000000000000000000000000000000000012',
        },
      ];

      for (const element of pureMethodsData) {
        it(`Pure method ${element.method} returns tx receipt`, async function () {
          const callData = {
            from: accounts[0].address,
            to: reverterEvmAddress,
            gas: numberTo0x(30000),
            data: element.data,
          };

          await relay.callFailing(
            RelayCall.ETH_ENDPOINTS.ETH_CALL,
            [callData, 'latest'],
            predefined.CONTRACT_REVERT(element.message, element.errorData),
            requestId,
          );
        });
      }
    });
  });

  describe('eth_call with contract that calls precompiles', async () => {
    const TOKEN_NAME = Utils.randomString(10);
    const TOKEN_SYMBOL = Utils.randomString(5);
    const INITIAL_SUPPLY = 100000;
    const IS_TOKEN_ADDRESS_SIGNATURE = '0xbff9834f000000000000000000000000';

    let htsImpl, tokenAddress;

    before(async () => {
      const htsResult = await servicesNode.createHTS({
        tokenName: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        treasuryAccountId: accounts[1].accountId.toString(),
        initialSupply: INITIAL_SUPPLY,
        adminPrivateKey: accounts[1].privateKey,
      });

      tokenAddress = Utils.idToEvmAddress(htsResult.receipt.tokenId.toString());

      // Deploy a contract implementing HederaTokenService
      const HederaTokenServiceImplFactory = new ethers.ContractFactory(
        HederaTokenServiceImplJson.abi,
        HederaTokenServiceImplJson.bytecode,
        accounts[1].wallet,
      );
      htsImpl = await HederaTokenServiceImplFactory.deploy(Helper.GAS.LIMIT_15_000_000);
    });

    it('Function calling HederaTokenService.isToken(token)', async () => {
      const callData = {
        from: accounts[1].address,
        to: htsImpl.target,
        gas: numberTo0x(30000),
        data: IS_TOKEN_ADDRESS_SIGNATURE + tokenAddress.replace('0x', ''),
      };

      relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest']);
      const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);

      expect(res).to.eq(RESULT_TRUE);
    });
  });

  describe('eth_getTransactionCount', async function () {
    let deployerContract, mirrorContract, mirrorContractDetails, contractId, primaryAccountNonce, secondaryAccountNonce;

    const defaultGasPrice = numberTo0x(Assertions.defaultGasPrice);
    const defaultGasLimit = numberTo0x(3_000_000);
    const defaultTransaction = {
      value: ONE_TINYBAR,
      chainId: Number(CHAIN_ID),
      maxPriorityFeePerGas: defaultGasPrice,
      maxFeePerGas: defaultGasPrice,
      gasLimit: defaultGasLimit,
      type: 2,
    };

    before(async () => {
      const factory = new ethers.ContractFactory(
        DeployerContractJson.abi,
        DeployerContractJson.bytecode,
        accounts[0].wallet,
      );
      deployerContract = await factory.deploy();
      await deployerContract.waitForDeployment();

      // get contract details
      mirrorContract = await mirrorNode.get(`/contracts/${deployerContract.target}`, requestId);

      // get contract result details
      mirrorContractDetails = await mirrorNode.get(
        `/contracts/results/${deployerContract.deploymentTransaction()?.hash}`,
        requestId,
      );

      contractId = mirrorContract.contract_id;

      primaryAccountNonce = await servicesNode.getAccountNonce(accounts[0].accountId);
      secondaryAccountNonce = await servicesNode.getAccountNonce(accounts[1].accountId);
    });

    it('@release should execute "eth_getTransactionCount" primary', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [mirrorPrimaryAccount.evm_address, numberTo0x(mirrorContractDetails.block_number)],
        requestId,
      );
      expect(res).to.be.equal(Utils.add0xPrefix(Utils.toHex(primaryAccountNonce.toInt())));
    });

    it('should execute "eth_getTransactionCount" secondary', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [mirrorSecondaryAccount.evm_address, numberTo0x(mirrorContractDetails.block_number)],
        requestId,
      );
      expect(res).to.be.equal(Utils.add0xPrefix(Utils.toHex(secondaryAccountNonce.toInt())));
    });

    it('@release should execute "eth_getTransactionCount" historic', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [mirrorContract.evm_address, numberTo0x(mirrorContractDetails.block_number)],
        requestId,
      );
      expect(res).to.be.equal('0x2');
    });

    it('@release should execute "eth_getTransactionCount" contract latest', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [mirrorContract.evm_address, EthImpl.blockLatest],
        requestId,
      );
      expect(res).to.be.equal('0x2');
    });

    it('@release should execute "eth_getTransactionCount" for account with id converted to evm_address', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [Utils.idToEvmAddress(mirrorPrimaryAccount.account), numberTo0x(mirrorContractDetails.block_number)],
        requestId,
      );
      expect(res).to.be.equal(Utils.add0xPrefix(Utils.toHex(primaryAccountNonce.toInt())));
    });

    it('@release should execute "eth_getTransactionCount" contract with id converted to evm_address historic', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [Utils.idToEvmAddress(contractId.toString()), numberTo0x(mirrorContractDetails.block_number)],
        requestId,
      );
      expect(res).to.be.equal('0x2');
    });

    it('@release should execute "eth_getTransactionCount" contract with id converted to evm_address latest', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [Utils.idToEvmAddress(contractId.toString()), EthImpl.blockLatest],
        requestId,
      );
      expect(res).to.be.equal('0x2');
    });

    it('should execute "eth_getTransactionCount" for non-existing address', async function () {
      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [Address.NON_EXISTING_ADDRESS, numberTo0x(mirrorContractDetails.block_number)],
        requestId,
      );
      expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" from hollow account', async function () {
      const hollowAccount = ethers.Wallet.createRandom();
      const resBeforeCreation = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [hollowAccount.address, 'latest'],
        requestId,
      );
      expect(resBeforeCreation).to.be.equal('0x0');

      const gasPrice = await relay.gasPrice(requestId);
      const signedTxHollowAccountCreation = await accounts[1].wallet.signTransaction({
        ...defaultTransaction,
        value: '10000000000000000000', // 10 HBARs
        to: hollowAccount.address,
        nonce: await relay.getAccountNonce(accounts[1].address, requestId),
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
      });
      const txHashHAC = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_SEND_RAW_TRANSACTION,
        [signedTxHollowAccountCreation],
        requestId,
      );
      await mirrorNode.get(`/contracts/results/${txHashHAC}`, requestId);

      const signTxFromHollowAccount = await hollowAccount.signTransaction({
        ...defaultTransaction,
        to: mirrorContract.evm_address,
        nonce: await relay.getAccountNonce(hollowAccount.address, requestId),
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
      });
      const txHashHA = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_SEND_RAW_TRANSACTION,
        [signTxFromHollowAccount],
        requestId,
      );
      await mirrorNode.get(`/contracts/results/${txHashHA}`, requestId);

      const resAfterCreation = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [hollowAccount.address, 'latest'],
        requestId,
      );
      expect(resAfterCreation).to.be.equal('0x1');
    });

    it('should execute "eth_getTransactionCount" for account with non-zero nonce', async function () {
      const account = await servicesNode.createAliasAccount(10, null, requestId);

      // Wait for account creation to propagate
      await mirrorNode.get(`/accounts/${account.accountId}`, requestId);

      const gasPrice = await relay.gasPrice(requestId);
      const transaction = {
        ...defaultTransaction,
        to: mirrorContract.evm_address,
        nonce: await relay.getAccountNonce(account.address, requestId),
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
      };

      const signedTx = await account.wallet.signTransaction(transaction);
      const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
      // Since the transactionId is not available in this context
      // Wait for the transaction to be processed and imported in the mirror node with axios-retry
      await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);

      const res = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [account.address, 'latest'],
        requestId,
      );
      expect(res).to.be.equal('0x1');
    });

    it('nonce for contract correctly increments', async function () {
      const nonceBefore = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [deployerContract.target, 'latest'],
        requestId,
      );
      expect(nonceBefore).to.be.equal('0x2');

      const newContractReceipt = await deployerContract.deployViaCreate();
      await newContractReceipt.wait();

      const nonceAfter = await relay.call(
        RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
        [deployerContract.target, 'latest'],
        requestId,
      );
      expect(nonceAfter).to.be.equal('0x3');
    });
  });

  describe('Filter API Test Suite', () => {
    const nonExstingFilter = '0x111222331';

    describe('Positive', async function () {
      it('should be able to create a log filter', async function () {
        const currentBlock = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_BLOCK_NUMBER, [], requestId);
        expect(
          RelayAssertions.validateHash(await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_NEW_FILTER, [], requestId), 32),
        ).to.eq(true, 'without params');
        expect(
          RelayAssertions.validateHash(
            await relay.call(
              RelayCalls.ETH_ENDPOINTS.ETH_NEW_FILTER,
              [
                {
                  fromBlock: currentBlock,
                  toBlock: 'latest',
                },
              ],
              requestId,
            ),
            32,
          ),
        ).to.eq(true, 'from current block to latest');

        expect(
          RelayAssertions.validateHash(
            await relay.call(
              RelayCalls.ETH_ENDPOINTS.ETH_NEW_FILTER,
              [
                {
                  fromBlock: currentBlock,
                  toBlock: 'latest',
                  address: reverterEvmAddress,
                },
              ],
              requestId,
            ),
            32,
          ),
        ).to.eq(true, 'from current block to latest and specified address');

        expect(
          RelayAssertions.validateHash(
            await relay.call(
              RelayCalls.ETH_ENDPOINTS.ETH_NEW_FILTER,
              [
                {
                  fromBlock: currentBlock,
                  toBlock: 'latest',
                  address: reverterEvmAddress,
                  topics: TOPICS,
                },
              ],
              requestId,
            ),
            32,
          ),
        ).to.eq(true, 'with all params');
      });

      it('should be able to create a newBlock filter', async function () {
        expect(
          RelayAssertions.validateHash(
            await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_NEW_BLOCK_FILTER, [], requestId),
            32,
          ),
        ).to.eq(true);
      });

      it('should be able to uninstall existing log filter', async function () {
        const filterId = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_NEW_FILTER, [], requestId);
        const result = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_UNINSTALL_FILTER, [filterId], requestId);
        expect(result).to.eq(true);
      });

      it('should be able to uninstall existing newBlock filter', async function () {
        const filterId = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_NEW_BLOCK_FILTER, [], requestId);
        const result = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_UNINSTALL_FILTER, [filterId], requestId);
        expect(result).to.eq(true);
      });

      it('should be able to call eth_getFilterChanges for NEW_BLOCK filter', async function () {
        const filterId = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_NEW_BLOCK_FILTER, [], requestId);

        await new Promise((r) => setTimeout(r, 4000));
        const result = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_FILTER_CHANGES, [filterId], requestId);
        expect(result).to.exist;
        expect(result.length).to.gt(0, 'returns the latest block hashes');

        result.forEach((hash) => {
          expect(RelayAssertions.validateHash(hash, 96)).to.eq(true);
        });

        await new Promise((r) => setTimeout(r, 2000));
        const result2 = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_FILTER_CHANGES, [filterId], requestId);
        expect(result2).to.exist;
        expect(result2.length).to.be.greaterThanOrEqual(1);
        expect(RelayAssertions.validateHash(result2[0], 96)).to.eq(true);
      });
    });

    describe('Negative', async function () {
      it('should not be able to uninstall not existing filter', async function () {
        const result = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_UNINSTALL_FILTER, [nonExstingFilter], requestId);
        expect(result).to.eq(false);
      });

      it('should not be able to call eth_getFilterChanges for not existing filter', async function () {
        await relay.callFailing(
          RelayCall.ETH_ENDPOINTS.ETH_GET_FILTER_CHANGES,
          [nonExstingFilter],
          predefined.FILTER_NOT_FOUND,
          requestId,
        );
      });

      it('should not support "eth_newPendingTransactionFilter"', async function () {
        await relay.callUnsupported(RelayCalls.ETH_ENDPOINTS.ETH_NEW_PENDING_TRANSACTION_FILTER, [], requestId);
      });
    });
  });

  describe('Debug API Test Suite', async function () {
    let requestId;
    let successfulTransactionHash;
    let estimateGasContractCreationTransaction;
    let failingTransactionTypeLegacy;
    let failingTransactionType2;

    let transactionTypeLegacy;
    let transactionType2930;
    let mirrorContract;
    let contractId;
    let transactionType2;
    const GAS_PRICE_TOO_LOW = '0x1';
    const GAS_PRICE_REF = '0x123456';
    const defaultGasLimit = numberTo0x(3_000_000);
    const gasPrice = '0x2C68AF0BB14000';
    const bytecode = EstimateGasContract.bytecode;
    const reverterContractBytecode = Reverter.bytecode;

    const successfulResultCreateType2OnlyTopCallFalse = {
      from: '0x00000000000000000000000000000000000003f7',
      to: '0x0000000000000000000000000000000000000414',
      value: '0x0',
      gas: '0x493e0',
      gasUsed: '0x3a980',
      input:
        '0x6080604052600160005534801561001557600080fd5b5060405161002290610064565b604051809103906000f08015801561003e573d6000803e3d6000fd5b50600180546001600160a01b0319166001600160a01b0392909216919091179055610070565b60938061105583390190565b610fd68061007f6000396000f3fe6080604052600436106101bb5760003560e01c806380f009b6116100ec578063ddf363d71161008a578063ec3e88cf11610064578063ec3e88cf14610461578063f96757d1146104a0578063fa5e414e146104b3578063ffaf0890146104d357600080fd5b8063ddf363d71461041b578063e080b4aa14610421578063e7df080e1461044157600080fd5b8063bbbfb986116100c6578063bbbfb986146103be578063c648049d146103d3578063d737d0c7146103f3578063dbb6f04a1461040657600080fd5b806380f009b61461036b57806383197ef01461038b578063bb376a961461039e57600080fd5b80635256b99d116101595780636e6662b9116101335780636e6662b914610301578063700799631461031657806374259795146103365780637df6ee271461034b57600080fd5b80635256b99d146102b65780635c929889146102d657806361bc221a146102eb57600080fd5b80633ec4de35116101955780633ec4de351461023957806341f32f0c146102615780634929af371461028157806351be4eaa146102a157600080fd5b80630c772ca5146101c75780630ec1551d146101f957806319a6e3d51461021757600080fd5b366101c257005b600080fd5b3480156101d357600080fd5b506101dc6104f3565b6040516001600160a01b0390911681526020015b60405180910390f35b34801561020557600080fd5b5060045b6040519081526020016101f0565b34801561022357600080fd5b50610237610232366004610d7a565b610565565b005b34801561024557600080fd5b50610209610254366004610daa565b6001600160a01b03163190565b34801561026d57600080fd5b5061023761027c366004610daa565b610609565b34801561028d57600080fd5b5061023761029c366004610d7a565b61068d565b3480156102ad57600080fd5b50610209610742565b3480156102c257600080fd5b506102376102d1366004610dc7565b61074a565b3480156102e257600080fd5b506101dc610770565b3480156102f757600080fd5b5061020960005481565b34801561030d57600080fd5b506101dc6107d8565b34801561032257600080fd5b50610237610331366004610daa565b61080a565b34801561034257600080fd5b50610237610885565b34801561035757600080fd5b50610237610366366004610daa565b610939565b34801561037757600080fd5b50610237610386366004610d7a565b6109b2565b34801561039757600080fd5b5061023733ff5b3480156103aa57600080fd5b506102096103b9366004610de0565b610a65565b3480156103ca57600080fd5b506101dc610b42565b3480156103df57600080fd5b506102376103ee366004610dc7565b600055565b3480156103ff57600080fd5b50336101dc565b34801561041257600080fd5b506101dc610baa565b34610209565b34801561042d57600080fd5b5061023761043c366004610daa565b610bdf565b34801561044d57600080fd5b5061023761045c366004610e19565b610c2a565b34801561046d57600080fd5b506040517fffffffff000000000000000000000000000000000000000000000000000000006000351681526020016101f0565b3480156104ac57600080fd5b50326101dc565b3480156104bf57600080fd5b506102376104ce366004610d7a565b610c7f565b3480156104df57600080fd5b506102376104ee366004610e19565b610d20565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b039092169190602081600481878761c350f2602082810160405282875290945061055c9186018101908601610e45565b94505050505090565b60005b828110156106045760408051600481526024810182526020810180516001600160e01b03166338cc483160e01b17905290516001600160a01b038416916105ae91610e62565b600060405180830381855af49150503d80600081146105e9576040519150601f19603f3d011682016040523d82523d6000602084013e6105ee565b606091505b50505080806105fc90610eb3565b915050610568565b505050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161064791610e62565b600060405180830381855afa9150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b606091505b50505050565b60005b8281101561060457816001600160a01b0316816040516024016106b591815260200190565b60408051601f198184030181529181526020820180516001600160e01b031663c648049d60e01b179052516106ea9190610e62565b6000604051808303816000865af19150503d8060008114610727576040519150601f19603f3d011682016040523d82523d6000602084013e61072c565b606091505b505050808061073a90610eb3565b915050610690565b60005a905090565b60005b8181101561076c5760008190558061076481610eb3565b91505061074d565b5050565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b0390921691906020816004818661c350f4602082810160405282875290945061055c9186018101908601610e45565b6000806040516107e790610d56565b604051809103906000f080158015610803573d6000803e3d6000fd5b5092915050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161084891610e62565b6000604051808303816000865af19150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b608061160c8152602081a07fac3e966f295f2d5312f973dc6d42f30a6dc1c1f76ab8ee91cc8ca5dad1fa60fd80602083a17fae85c7887d510d629d8eb59ca412c0bf604c72c550fb0eec2734b12c76f2760b8082602085a261055160a0527ff4cd3854cb47c6b2f68a3a796635d026b9b412a93dfb80dd411c544cbc3c1817808284604087a37fe32ef46652011110f84325a4871007ee80018c1b6728ee04ffae74eb557e3fbf818385604088a450505050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161097791610e62565b600060405180830381855af49150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b60005b8281101561060457816001600160a01b0316816040516024016109da91815260200190565b60408051601f198184030181529181526020820180516001600160e01b031663c648049d60e01b17905251610a0f9190610e62565b600060405180830381855af49150503d8060008114610a4a576040519150601f19603f3d011682016040523d82523d6000602084013e610a4f565b606091505b5050508080610a5d90610eb3565b9150506109b5565b600082841015610b385760006001600160a01b038316610a86866001610ece565b6040516024810191909152604481018690526001600160a01b038516606482015260840160408051601f198184030181529181526020820180516001600160e01b0316635d9bb54b60e11b17905251610adf9190610e62565b6000604051808303816000865af19150503d8060008114610b1c576040519150601f19603f3d011682016040523d82523d6000602084013e610b21565b606091505b5091505080610b2f90610ee6565b9150610b3b9050565b50825b9392505050565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b0390921691906020816004818661c350fa602082810160405282875290945061055c9186018101908601610e45565b60008060005460001b604051610bbf90610d56565b8190604051809103906000f5905080158015610803573d6000803e3d6000fd5b60606000807f5a790dba3c23b59f4183a2d8e5d0ceae10b15e337a4dcaeae2d5897a5f68a3d4905060405181815260208160048360008961c350f25060208101604052909252505050565b6040516001600160a01b038316908290600081818185875af1925050503d8060008114610c73576040519150601f19603f3d011682016040523d82523d6000602084013e610c78565b606091505b5050505050565b60005b828110156106045760408051600481526024810182526020810180516001600160e01b03166338cc483160e01b17905290516001600160a01b03841691610cc891610e62565b6000604051808303816000865af19150503d8060008114610d05576040519150601f19603f3d011682016040523d82523d6000602084013e610d0a565b606091505b5050508080610d1890610eb3565b915050610c82565b6040516001600160a01b0383169082156108fc029083906000818181858888f19350505050158015610604573d6000803e3d6000fd5b609380610f0e83390190565b6001600160a01b0381168114610d7757600080fd5b50565b60008060408385031215610d8d57600080fd5b823591506020830135610d9f81610d62565b809150509250929050565b600060208284031215610dbc57600080fd5b8135610b3b81610d62565b600060208284031215610dd957600080fd5b5035919050565b600080600060608486031215610df557600080fd5b83359250602084013591506040840135610e0e81610d62565b809150509250925092565b60008060408385031215610e2c57600080fd5b8235610e3781610d62565b946020939093013593505050565b600060208284031215610e5757600080fd5b8151610b3b81610d62565b6000825160005b81811015610e835760208186018101518583015201610e69565b81811115610e92576000828501525b509190910192915050565b634e487b7160e01b600052601160045260246000fd5b6000600019821415610ec757610ec7610e9d565b5060010190565b60008219821115610ee157610ee1610e9d565b500190565b80516020808301519190811015610f07576000198160200360031b1b821691505b5091905056fe6080604052348015600f57600080fd5b50607680601d6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c806338cc483114602d575b600080fd5b6040805130815290519081900360200190f3fea26469706673582212206581057925cb8c91b475dfd65cb1bc362e8198d1260dee32cec18103302c548464736f6c63430008090033a264697066735822122095333591d755aa725f8a8b489c8c528213ca55abc2d8981f073d5242f3b989f164736f6c634300080900336080604052348015600f57600080fd5b50607680601d6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c806338cc483114602d575b600080fd5b6040805130815290519081900360200190f3fea26469706673582212206581057925cb8c91b475dfd65cb1bc362e8198d1260dee32cec18103302c548464736f6c63430008090033',
      output:
        '0x6080604052600436106101bb5760003560e01c806380f009b6116100ec578063ddf363d71161008a578063ec3e88cf11610064578063ec3e88cf14610461578063f96757d1146104a0578063fa5e414e146104b3578063ffaf0890146104d357600080fd5b8063ddf363d71461041b578063e080b4aa14610421578063e7df080e1461044157600080fd5b8063bbbfb986116100c6578063bbbfb986146103be578063c648049d146103d3578063d737d0c7146103f3578063dbb6f04a1461040657600080fd5b806380f009b61461036b57806383197ef01461038b578063bb376a961461039e57600080fd5b80635256b99d116101595780636e6662b9116101335780636e6662b914610301578063700799631461031657806374259795146103365780637df6ee271461034b57600080fd5b80635256b99d146102b65780635c929889146102d657806361bc221a146102eb57600080fd5b80633ec4de35116101955780633ec4de351461023957806341f32f0c146102615780634929af371461028157806351be4eaa146102a157600080fd5b80630c772ca5146101c75780630ec1551d146101f957806319a6e3d51461021757600080fd5b366101c257005b600080fd5b3480156101d357600080fd5b506101dc6104f3565b6040516001600160a01b0390911681526020015b60405180910390f35b34801561020557600080fd5b5060045b6040519081526020016101f0565b34801561022357600080fd5b50610237610232366004610d7a565b610565565b005b34801561024557600080fd5b50610209610254366004610daa565b6001600160a01b03163190565b34801561026d57600080fd5b5061023761027c366004610daa565b610609565b34801561028d57600080fd5b5061023761029c366004610d7a565b61068d565b3480156102ad57600080fd5b50610209610742565b3480156102c257600080fd5b506102376102d1366004610dc7565b61074a565b3480156102e257600080fd5b506101dc610770565b3480156102f757600080fd5b5061020960005481565b34801561030d57600080fd5b506101dc6107d8565b34801561032257600080fd5b50610237610331366004610daa565b61080a565b34801561034257600080fd5b50610237610885565b34801561035757600080fd5b50610237610366366004610daa565b610939565b34801561037757600080fd5b50610237610386366004610d7a565b6109b2565b34801561039757600080fd5b5061023733ff5b3480156103aa57600080fd5b506102096103b9366004610de0565b610a65565b3480156103ca57600080fd5b506101dc610b42565b3480156103df57600080fd5b506102376103ee366004610dc7565b600055565b3480156103ff57600080fd5b50336101dc565b34801561041257600080fd5b506101dc610baa565b34610209565b34801561042d57600080fd5b5061023761043c366004610daa565b610bdf565b34801561044d57600080fd5b5061023761045c366004610e19565b610c2a565b34801561046d57600080fd5b506040517fffffffff000000000000000000000000000000000000000000000000000000006000351681526020016101f0565b3480156104ac57600080fd5b50326101dc565b3480156104bf57600080fd5b506102376104ce366004610d7a565b610c7f565b3480156104df57600080fd5b506102376104ee366004610e19565b610d20565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b039092169190602081600481878761c350f2602082810160405282875290945061055c9186018101908601610e45565b94505050505090565b60005b828110156106045760408051600481526024810182526020810180516001600160e01b03166338cc483160e01b17905290516001600160a01b038416916105ae91610e62565b600060405180830381855af49150503d80600081146105e9576040519150601f19603f3d011682016040523d82523d6000602084013e6105ee565b606091505b50505080806105fc90610eb3565b915050610568565b505050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161064791610e62565b600060405180830381855afa9150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b606091505b50505050565b60005b8281101561060457816001600160a01b0316816040516024016106b591815260200190565b60408051601f198184030181529181526020820180516001600160e01b031663c648049d60e01b179052516106ea9190610e62565b6000604051808303816000865af19150503d8060008114610727576040519150601f19603f3d011682016040523d82523d6000602084013e61072c565b606091505b505050808061073a90610eb3565b915050610690565b60005a905090565b60005b8181101561076c5760008190558061076481610eb3565b91505061074d565b5050565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b0390921691906020816004818661c350f4602082810160405282875290945061055c9186018101908601610e45565b6000806040516107e790610d56565b604051809103906000f080158015610803573d6000803e3d6000fd5b5092915050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161084891610e62565b6000604051808303816000865af19150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b608061160c8152602081a07fac3e966f295f2d5312f973dc6d42f30a6dc1c1f76ab8ee91cc8ca5dad1fa60fd80602083a17fae85c7887d510d629d8eb59ca412c0bf604c72c550fb0eec2734b12c76f2760b8082602085a261055160a0527ff4cd3854cb47c6b2f68a3a796635d026b9b412a93dfb80dd411c544cbc3c1817808284604087a37fe32ef46652011110f84325a4871007ee80018c1b6728ee04ffae74eb557e3fbf818385604088a450505050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161097791610e62565b600060405180830381855af49150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b60005b8281101561060457816001600160a01b0316816040516024016109da91815260200190565b60408051601f198184030181529181526020820180516001600160e01b031663c648049d60e01b17905251610a0f9190610e62565b600060405180830381855af49150503d8060008114610a4a576040519150601f19603f3d011682016040523d82523d6000602084013e610a4f565b606091505b5050508080610a5d90610eb3565b9150506109b5565b600082841015610b385760006001600160a01b038316610a86866001610ece565b6040516024810191909152604481018690526001600160a01b038516606482015260840160408051601f198184030181529181526020820180516001600160e01b0316635d9bb54b60e11b17905251610adf9190610e62565b6000604051808303816000865af19150503d8060008114610b1c576040519150601f19603f3d011682016040523d82523d6000602084013e610b21565b606091505b5091505080610b2f90610ee6565b9150610b3b9050565b50825b9392505050565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b0390921691906020816004818661c350fa602082810160405282875290945061055c9186018101908601610e45565b60008060005460001b604051610bbf90610d56565b8190604051809103906000f5905080158015610803573d6000803e3d6000fd5b60606000807f5a790dba3c23b59f4183a2d8e5d0ceae10b15e337a4dcaeae2d5897a5f68a3d4905060405181815260208160048360008961c350f25060208101604052909252505050565b6040516001600160a01b038316908290600081818185875af1925050503d8060008114610c73576040519150601f19603f3d011682016040523d82523d6000602084013e610c78565b606091505b5050505050565b60005b828110156106045760408051600481526024810182526020810180516001600160e01b03166338cc483160e01b17905290516001600160a01b03841691610cc891610e62565b6000604051808303816000865af19150503d8060008114610d05576040519150601f19603f3d011682016040523d82523d6000602084013e610d0a565b606091505b5050508080610d1890610eb3565b915050610c82565b6040516001600160a01b0383169082156108fc029083906000818181858888f19350505050158015610604573d6000803e3d6000fd5b609380610f0e83390190565b6001600160a01b0381168114610d7757600080fd5b50565b60008060408385031215610d8d57600080fd5b823591506020830135610d9f81610d62565b809150509250929050565b600060208284031215610dbc57600080fd5b8135610b3b81610d62565b600060208284031215610dd957600080fd5b5035919050565b600080600060608486031215610df557600080fd5b83359250602084013591506040840135610e0e81610d62565b809150509250925092565b60008060408385031215610e2c57600080fd5b8235610e3781610d62565b946020939093013593505050565b600060208284031215610e5757600080fd5b8151610b3b81610d62565b6000825160005b81811015610e835760208186018101518583015201610e69565b81811115610e92576000828501525b509190910192915050565b634e487b7160e01b600052601160045260246000fd5b6000600019821415610ec757610ec7610e9d565b5060010190565b60008219821115610ee157610ee1610e9d565b500190565b80516020808301519190811015610f07576000198160200360031b1b821691505b5091905056fe6080604052348015600f57600080fd5b50607680601d6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c806338cc483114602d575b600080fd5b6040805130815290519081900360200190f3fea26469706673582212206581057925cb8c91b475dfd65cb1bc362e8198d1260dee32cec18103302c548464736f6c63430008090033a264697066735822122095333591d755aa725f8a8b489c8c528213ca55abc2d8981f073d5242f3b989f164736f6c63430008090033',
      error: null,
      revertReason: null,
      calls: [
        {
          type: 'CREATE',
          from: '0x00000000000000000000000000000000000003f7',
          to: '0x0000000000000000000000000000000000000414',
          gas: 247000,
          gasUsed: 77324,
          input: '0x',
          output: '0x',
        },
        {
          type: 'CREATE',
          from: '0x0000000000000000000000000000000000000414',
          to: '0x0000000000000000000000000000000000000415',
          gas: 189733,
          gasUsed: 75,
          input: '0x',
          output: '0x',
        },
      ],
    };

    const expectedResultLegacyTransaction = {
      from: '0x0000000000000000000000000000000000000002',
      to: null,
      value: '0x1',
      gas: '0x2dc6c0',
      gasUsed: '0x0',
      input: '0x',
      output: '0x',
      error: 'INVALID_ETHEREUM_TRANSACTION',
      revertReason: 'INVALID_ETHEREUM_TRANSACTION',
      calls: [],
    };

    const SuccessResultCallTypeLegacyOnlyTopCallFalse = {
      from: '0x00000000000000000000000000000000000007c7',
      to: '0x00000000000000000000000000000000000007cd',
      value: '0x1',
      gas: '0x2dc6c0',
      gasUsed: '0x249f00',
      input: '0x',
      output: '0x',
      error: null,
      revertReason: null,
      calls: [
        {
          type: 'CALL',
          from: '0x00000000000000000000000000000000000007c7',
          to: '0x00000000000000000000000000000000000007cd',
          gas: 2979000,
          gasUsed: 0,
          input: '0x',
          output: '0x',
        },
      ],
    };

    const SuccessResultCreateTypeLegacyOnlyTopCallFalse = {
      from: '0x0000000000000000000000000000000000000948',
      to: '0x000000000000000000000000000000000000094f',
      value: '0x0',
      gas: '0x2dc6c0',
      gasUsed: '0x249f00',
      input:
        '0x6080604052600160005534801561001557600080fd5b5060405161002290610064565b604051809103906000f08015801561003e573d6000803e3d6000fd5b50600180546001600160a01b0319166001600160a01b0392909216919091179055610070565b60938061105583390190565b610fd68061007f6000396000f3fe6080604052600436106101bb5760003560e01c806380f009b6116100ec578063ddf363d71161008a578063ec3e88cf11610064578063ec3e88cf14610461578063f96757d1146104a0578063fa5e414e146104b3578063ffaf0890146104d357600080fd5b8063ddf363d71461041b578063e080b4aa14610421578063e7df080e1461044157600080fd5b8063bbbfb986116100c6578063bbbfb986146103be578063c648049d146103d3578063d737d0c7146103f3578063dbb6f04a1461040657600080fd5b806380f009b61461036b57806383197ef01461038b578063bb376a961461039e57600080fd5b80635256b99d116101595780636e6662b9116101335780636e6662b914610301578063700799631461031657806374259795146103365780637df6ee271461034b57600080fd5b80635256b99d146102b65780635c929889146102d657806361bc221a146102eb57600080fd5b80633ec4de35116101955780633ec4de351461023957806341f32f0c146102615780634929af371461028157806351be4eaa146102a157600080fd5b80630c772ca5146101c75780630ec1551d146101f957806319a6e3d51461021757600080fd5b366101c257005b600080fd5b3480156101d357600080fd5b506101dc6104f3565b6040516001600160a01b0390911681526020015b60405180910390f35b34801561020557600080fd5b5060045b6040519081526020016101f0565b34801561022357600080fd5b50610237610232366004610d7a565b610565565b005b34801561024557600080fd5b50610209610254366004610daa565b6001600160a01b03163190565b34801561026d57600080fd5b5061023761027c366004610daa565b610609565b34801561028d57600080fd5b5061023761029c366004610d7a565b61068d565b3480156102ad57600080fd5b50610209610742565b3480156102c257600080fd5b506102376102d1366004610dc7565b61074a565b3480156102e257600080fd5b506101dc610770565b3480156102f757600080fd5b5061020960005481565b34801561030d57600080fd5b506101dc6107d8565b34801561032257600080fd5b50610237610331366004610daa565b61080a565b34801561034257600080fd5b50610237610885565b34801561035757600080fd5b50610237610366366004610daa565b610939565b34801561037757600080fd5b50610237610386366004610d7a565b6109b2565b34801561039757600080fd5b5061023733ff5b3480156103aa57600080fd5b506102096103b9366004610de0565b610a65565b3480156103ca57600080fd5b506101dc610b42565b3480156103df57600080fd5b506102376103ee366004610dc7565b600055565b3480156103ff57600080fd5b50336101dc565b34801561041257600080fd5b506101dc610baa565b34610209565b34801561042d57600080fd5b5061023761043c366004610daa565b610bdf565b34801561044d57600080fd5b5061023761045c366004610e19565b610c2a565b34801561046d57600080fd5b506040517fffffffff000000000000000000000000000000000000000000000000000000006000351681526020016101f0565b3480156104ac57600080fd5b50326101dc565b3480156104bf57600080fd5b506102376104ce366004610d7a565b610c7f565b3480156104df57600080fd5b506102376104ee366004610e19565b610d20565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b039092169190602081600481878761c350f2602082810160405282875290945061055c9186018101908601610e45565b94505050505090565b60005b828110156106045760408051600481526024810182526020810180516001600160e01b03166338cc483160e01b17905290516001600160a01b038416916105ae91610e62565b600060405180830381855af49150503d80600081146105e9576040519150601f19603f3d011682016040523d82523d6000602084013e6105ee565b606091505b50505080806105fc90610eb3565b915050610568565b505050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161064791610e62565b600060405180830381855afa9150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b606091505b50505050565b60005b8281101561060457816001600160a01b0316816040516024016106b591815260200190565b60408051601f198184030181529181526020820180516001600160e01b031663c648049d60e01b179052516106ea9190610e62565b6000604051808303816000865af19150503d8060008114610727576040519150601f19603f3d011682016040523d82523d6000602084013e61072c565b606091505b505050808061073a90610eb3565b915050610690565b60005a905090565b60005b8181101561076c5760008190558061076481610eb3565b91505061074d565b5050565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b0390921691906020816004818661c350f4602082810160405282875290945061055c9186018101908601610e45565b6000806040516107e790610d56565b604051809103906000f080158015610803573d6000803e3d6000fd5b5092915050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161084891610e62565b6000604051808303816000865af19150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b608061160c8152602081a07fac3e966f295f2d5312f973dc6d42f30a6dc1c1f76ab8ee91cc8ca5dad1fa60fd80602083a17fae85c7887d510d629d8eb59ca412c0bf604c72c550fb0eec2734b12c76f2760b8082602085a261055160a0527ff4cd3854cb47c6b2f68a3a796635d026b9b412a93dfb80dd411c544cbc3c1817808284604087a37fe32ef46652011110f84325a4871007ee80018c1b6728ee04ffae74eb557e3fbf818385604088a450505050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161097791610e62565b600060405180830381855af49150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b60005b8281101561060457816001600160a01b0316816040516024016109da91815260200190565b60408051601f198184030181529181526020820180516001600160e01b031663c648049d60e01b17905251610a0f9190610e62565b600060405180830381855af49150503d8060008114610a4a576040519150601f19603f3d011682016040523d82523d6000602084013e610a4f565b606091505b5050508080610a5d90610eb3565b9150506109b5565b600082841015610b385760006001600160a01b038316610a86866001610ece565b6040516024810191909152604481018690526001600160a01b038516606482015260840160408051601f198184030181529181526020820180516001600160e01b0316635d9bb54b60e11b17905251610adf9190610e62565b6000604051808303816000865af19150503d8060008114610b1c576040519150601f19603f3d011682016040523d82523d6000602084013e610b21565b606091505b5091505080610b2f90610ee6565b9150610b3b9050565b50825b9392505050565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b0390921691906020816004818661c350fa602082810160405282875290945061055c9186018101908601610e45565b60008060005460001b604051610bbf90610d56565b8190604051809103906000f5905080158015610803573d6000803e3d6000fd5b60606000807f5a790dba3c23b59f4183a2d8e5d0ceae10b15e337a4dcaeae2d5897a5f68a3d4905060405181815260208160048360008961c350f25060208101604052909252505050565b6040516001600160a01b038316908290600081818185875af1925050503d8060008114610c73576040519150601f19603f3d011682016040523d82523d6000602084013e610c78565b606091505b5050505050565b60005b828110156106045760408051600481526024810182526020810180516001600160e01b03166338cc483160e01b17905290516001600160a01b03841691610cc891610e62565b6000604051808303816000865af19150503d8060008114610d05576040519150601f19603f3d011682016040523d82523d6000602084013e610d0a565b606091505b5050508080610d1890610eb3565b915050610c82565b6040516001600160a01b0383169082156108fc029083906000818181858888f19350505050158015610604573d6000803e3d6000fd5b609380610f0e83390190565b6001600160a01b0381168114610d7757600080fd5b50565b60008060408385031215610d8d57600080fd5b823591506020830135610d9f81610d62565b809150509250929050565b600060208284031215610dbc57600080fd5b8135610b3b81610d62565b600060208284031215610dd957600080fd5b5035919050565b600080600060608486031215610df557600080fd5b83359250602084013591506040840135610e0e81610d62565b809150509250925092565b60008060408385031215610e2c57600080fd5b8235610e3781610d62565b946020939093013593505050565b600060208284031215610e5757600080fd5b8151610b3b81610d62565b6000825160005b81811015610e835760208186018101518583015201610e69565b81811115610e92576000828501525b509190910192915050565b634e487b7160e01b600052601160045260246000fd5b6000600019821415610ec757610ec7610e9d565b5060010190565b60008219821115610ee157610ee1610e9d565b500190565b80516020808301519190811015610f07576000198160200360031b1b821691505b5091905056fe6080604052348015600f57600080fd5b50607680601d6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c806338cc483114602d575b600080fd5b6040805130815290519081900360200190f3fea26469706673582212206581057925cb8c91b475dfd65cb1bc362e8198d1260dee32cec18103302c548464736f6c63430008090033a264697066735822122095333591d755aa725f8a8b489c8c528213ca55abc2d8981f073d5242f3b989f164736f6c634300080900336080604052348015600f57600080fd5b50607680601d6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c806338cc483114602d575b600080fd5b6040805130815290519081900360200190f3fea26469706673582212206581057925cb8c91b475dfd65cb1bc362e8198d1260dee32cec18103302c548464736f6c63430008090033',
      output:
        '0x6080604052600436106101bb5760003560e01c806380f009b6116100ec578063ddf363d71161008a578063ec3e88cf11610064578063ec3e88cf14610461578063f96757d1146104a0578063fa5e414e146104b3578063ffaf0890146104d357600080fd5b8063ddf363d71461041b578063e080b4aa14610421578063e7df080e1461044157600080fd5b8063bbbfb986116100c6578063bbbfb986146103be578063c648049d146103d3578063d737d0c7146103f3578063dbb6f04a1461040657600080fd5b806380f009b61461036b57806383197ef01461038b578063bb376a961461039e57600080fd5b80635256b99d116101595780636e6662b9116101335780636e6662b914610301578063700799631461031657806374259795146103365780637df6ee271461034b57600080fd5b80635256b99d146102b65780635c929889146102d657806361bc221a146102eb57600080fd5b80633ec4de35116101955780633ec4de351461023957806341f32f0c146102615780634929af371461028157806351be4eaa146102a157600080fd5b80630c772ca5146101c75780630ec1551d146101f957806319a6e3d51461021757600080fd5b366101c257005b600080fd5b3480156101d357600080fd5b506101dc6104f3565b6040516001600160a01b0390911681526020015b60405180910390f35b34801561020557600080fd5b5060045b6040519081526020016101f0565b34801561022357600080fd5b50610237610232366004610d7a565b610565565b005b34801561024557600080fd5b50610209610254366004610daa565b6001600160a01b03163190565b34801561026d57600080fd5b5061023761027c366004610daa565b610609565b34801561028d57600080fd5b5061023761029c366004610d7a565b61068d565b3480156102ad57600080fd5b50610209610742565b3480156102c257600080fd5b506102376102d1366004610dc7565b61074a565b3480156102e257600080fd5b506101dc610770565b3480156102f757600080fd5b5061020960005481565b34801561030d57600080fd5b506101dc6107d8565b34801561032257600080fd5b50610237610331366004610daa565b61080a565b34801561034257600080fd5b50610237610885565b34801561035757600080fd5b50610237610366366004610daa565b610939565b34801561037757600080fd5b50610237610386366004610d7a565b6109b2565b34801561039757600080fd5b5061023733ff5b3480156103aa57600080fd5b506102096103b9366004610de0565b610a65565b3480156103ca57600080fd5b506101dc610b42565b3480156103df57600080fd5b506102376103ee366004610dc7565b600055565b3480156103ff57600080fd5b50336101dc565b34801561041257600080fd5b506101dc610baa565b34610209565b34801561042d57600080fd5b5061023761043c366004610daa565b610bdf565b34801561044d57600080fd5b5061023761045c366004610e19565b610c2a565b34801561046d57600080fd5b506040517fffffffff000000000000000000000000000000000000000000000000000000006000351681526020016101f0565b3480156104ac57600080fd5b50326101dc565b3480156104bf57600080fd5b506102376104ce366004610d7a565b610c7f565b3480156104df57600080fd5b506102376104ee366004610e19565b610d20565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b039092169190602081600481878761c350f2602082810160405282875290945061055c9186018101908601610e45565b94505050505090565b60005b828110156106045760408051600481526024810182526020810180516001600160e01b03166338cc483160e01b17905290516001600160a01b038416916105ae91610e62565b600060405180830381855af49150503d80600081146105e9576040519150601f19603f3d011682016040523d82523d6000602084013e6105ee565b606091505b50505080806105fc90610eb3565b915050610568565b505050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161064791610e62565b600060405180830381855afa9150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b606091505b50505050565b60005b8281101561060457816001600160a01b0316816040516024016106b591815260200190565b60408051601f198184030181529181526020820180516001600160e01b031663c648049d60e01b179052516106ea9190610e62565b6000604051808303816000865af19150503d8060008114610727576040519150601f19603f3d011682016040523d82523d6000602084013e61072c565b606091505b505050808061073a90610eb3565b915050610690565b60005a905090565b60005b8181101561076c5760008190558061076481610eb3565b91505061074d565b5050565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b0390921691906020816004818661c350f4602082810160405282875290945061055c9186018101908601610e45565b6000806040516107e790610d56565b604051809103906000f080158015610803573d6000803e3d6000fd5b5092915050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161084891610e62565b6000604051808303816000865af19150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b608061160c8152602081a07fac3e966f295f2d5312f973dc6d42f30a6dc1c1f76ab8ee91cc8ca5dad1fa60fd80602083a17fae85c7887d510d629d8eb59ca412c0bf604c72c550fb0eec2734b12c76f2760b8082602085a261055160a0527ff4cd3854cb47c6b2f68a3a796635d026b9b412a93dfb80dd411c544cbc3c1817808284604087a37fe32ef46652011110f84325a4871007ee80018c1b6728ee04ffae74eb557e3fbf818385604088a450505050565b60408051600481526024810182526020810180516001600160e01b0316632d3c86dd60e11b17905290516001600160a01b0383169161097791610e62565b600060405180830381855af49150503d8060008114610682576040519150601f19603f3d011682016040523d82523d6000602084013e610687565b60005b8281101561060457816001600160a01b0316816040516024016109da91815260200190565b60408051601f198184030181529181526020820180516001600160e01b031663c648049d60e01b17905251610a0f9190610e62565b600060405180830381855af49150503d8060008114610a4a576040519150601f19603f3d011682016040523d82523d6000602084013e610a4f565b606091505b5050508080610a5d90610eb3565b9150506109b5565b600082841015610b385760006001600160a01b038316610a86866001610ece565b6040516024810191909152604481018690526001600160a01b038516606482015260840160408051601f198184030181529181526020820180516001600160e01b0316635d9bb54b60e11b17905251610adf9190610e62565b6000604051808303816000865af19150503d8060008114610b1c576040519150601f19603f3d011682016040523d82523d6000602084013e610b21565b606091505b5091505080610b2f90610ee6565b9150610b3b9050565b50825b9392505050565b6001546040517f38cc48316aea9070a6b9a07b3cefc3f4db049e914955401a9d60fc9eb4c698d180825260009260609284926001600160a01b0390921691906020816004818661c350fa602082810160405282875290945061055c9186018101908601610e45565b60008060005460001b604051610bbf90610d56565b8190604051809103906000f5905080158015610803573d6000803e3d6000fd5b60606000807f5a790dba3c23b59f4183a2d8e5d0ceae10b15e337a4dcaeae2d5897a5f68a3d4905060405181815260208160048360008961c350f25060208101604052909252505050565b6040516001600160a01b038316908290600081818185875af1925050503d8060008114610c73576040519150601f19603f3d011682016040523d82523d6000602084013e610c78565b606091505b5050505050565b60005b828110156106045760408051600481526024810182526020810180516001600160e01b03166338cc483160e01b17905290516001600160a01b03841691610cc891610e62565b6000604051808303816000865af19150503d8060008114610d05576040519150601f19603f3d011682016040523d82523d6000602084013e610d0a565b606091505b5050508080610d1890610eb3565b915050610c82565b6040516001600160a01b0383169082156108fc029083906000818181858888f19350505050158015610604573d6000803e3d6000fd5b609380610f0e83390190565b6001600160a01b0381168114610d7757600080fd5b50565b60008060408385031215610d8d57600080fd5b823591506020830135610d9f81610d62565b809150509250929050565b600060208284031215610dbc57600080fd5b8135610b3b81610d62565b600060208284031215610dd957600080fd5b5035919050565b600080600060608486031215610df557600080fd5b83359250602084013591506040840135610e0e81610d62565b809150509250925092565b60008060408385031215610e2c57600080fd5b8235610e3781610d62565b946020939093013593505050565b600060208284031215610e5757600080fd5b8151610b3b81610d62565b6000825160005b81811015610e835760208186018101518583015201610e69565b81811115610e92576000828501525b509190910192915050565b634e487b7160e01b600052601160045260246000fd5b6000600019821415610ec757610ec7610e9d565b5060010190565b60008219821115610ee157610ee1610e9d565b500190565b80516020808301519190811015610f07576000198160200360031b1b821691505b5091905056fe6080604052348015600f57600080fd5b50607680601d6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c806338cc483114602d575b600080fd5b6040805130815290519081900360200190f3fea26469706673582212206581057925cb8c91b475dfd65cb1bc362e8198d1260dee32cec18103302c548464736f6c63430008090033a264697066735822122095333591d755aa725f8a8b489c8c528213ca55abc2d8981f073d5242f3b989f164736f6c63430008090033',
      error: null,
      revertReason: null,
      calls: [
        {
          type: 'CREATE',
          from: '0x0000000000000000000000000000000000000948',
          to: '0x000000000000000000000000000000000000094f',
          gas: 2947000,
          gasUsed: 77324,
          input: '0x',
          output: '0x',
        },
        {
          type: 'CREATE',
          from: '0x000000000000000000000000000000000000094f',
          to: '0x0000000000000000000000000000000000000950',
          gas: 2847545,
          gasUsed: 75,
          input: '0x',
          output: '0x',
        },
      ],
    };

    const successfulResultCallType2930OnlyTopCallFalse = {
      from: '0x0000000000000000000000000000000000000655',
      to: '0x000000000000000000000000000000000000065b',
      value: '0x1',
      gas: '0x2dc6c0',
      gasUsed: '0x249f00',
      input: '0x6e6662b9',
      output: '0x',
      error: null,
      revertReason: null,
      calls: [
        {
          type: 'CALL',
          from: '0x0000000000000000000000000000000000000655',
          to: '0x000000000000000000000000000000000000065b',
          gas: 2979000,
          gasUsed: 0,
          input: '0x6e6662b9',
          output: '0x',
        },
      ],
    };

    //failing
    const failingResultTypeLegacyOnlyTopCallFalse = {
      from: '0x000000000000000000000000000000000000053f',
      to: null,
      value: '0x1',
      gas: '0x2dc6c0',
      gasUsed: '0x2dc6c0',
      input: '0x151618',
      output: '0x',
      error: 'INSUFFICIENT_STACK_ITEMS',
      revertReason: 'INSUFFICIENT_STACK_ITEMS',
      calls: [
        {
          type: 'CREATE',
          from: '0x000000000000000000000000000000000000053f',
          to: null,
          gas: 2947000,
          gasUsed: 2947000,
          input: '0x',
          output: '0x494e53554646494349454e545f535441434b5f4954454d53',
        },
      ],
    };

    const failingResultCreateType2930OnlyTopCallFalse = {
      from: '0x0000000000000000000000000000000000000002',
      to: null,
      value: '0x1',
      gas: '0x2dc6c0',
      gasUsed: '0x0',
      input: '0x',
      output: '0x',
      error: 'INVALID_ETHEREUM_TRANSACTION',
      revertReason: 'INVALID_ETHEREUM_TRANSACTION',
      calls: [],
    };

    const failingResultCallType2930OnlyTopCallFalse = {
      from: '0x00000000000000000000000000000000000005bb',
      to: '0x000000000000000000000000000000000000067f',
      value: '0x1',
      gas: '0x2dc6c0',
      gasUsed: '0x249f00',
      input: '0x46fc4bb1',
      output: '0x',
      error: null,
      revertReason: null,
      calls: [
        {
          type: 'CALL',
          from: '0x00000000000000000000000000000000000005bb',
          to: '0x00000000000000000000000000000000000005c1',
          gas: 2979000,
          gasUsed: 0,
          input: '0x',
          output: '0x',
        },
      ],
    };

    const failingResultCallTypeLegacyOnlyTopCallFalse = {};

    const failingResultCallTypeLegacyWithRevertReasonOnlyTopCallFalse = {
      ...failingResultCallTypeLegacyOnlyTopCallFalse,
    };

    before(async () => {
      const gasLimit = '0x493E0';
      const defaultGasPrice = '0xA54F4C3C00';
      requestId = Utils.generateRequestId();
      contractId = await accounts[0].client.createParentContract(parentContractJson, requestId);
      mirrorContract = await mirrorNode.get(`/contracts/${contractId}`, requestId);

      const defaultTransactionFields = {
        to: null,
        from: accounts[0].address,
        gasPrice: defaultGasPrice,
        chainId: Number(CHAIN_ID),
        gasLimit: defaultGasLimit,
        value: ONE_TINYBAR,
      };

      estimateGasContractCreationTransaction = {
        ...defaultTransactionFields,
        nonce: await accounts[0].wallet.getNonce(),
        chainId: 0x12a,
        type: 2,
        data: bytecode,
        gasLimit: gasLimit,
        maxPriorityFeePerGas: defaultGasPrice,
        maxFeePerGas: defaultGasPrice,
        //value: null
      };

      transactionTypeLegacy = {
        ...defaultTransactionFields,
        type: 0,
      };

      failingTransactionTypeLegacy = {
        ...transactionTypeLegacy,
        gasPrice: GAS_PRICE_TOO_LOW,
        to: mirrorContract.evm_address,
        nonce: await relay.getAccountNonce(accounts[2].address, requestId),
      };

      transactionType2930 = {
        ...defaultTransactionFields,
        type: 1,
      };

      transactionType2 = {
        to: null,
        from: accounts[0].address,
        chainId: Number(CHAIN_ID),
        gasLimit: defaultGasLimit,
        type: 2,
        maxFeePerGas: defaultGasPrice,
        maxPriorityFeePerGas: defaultGasPrice,
      };

      failingTransactionType2 = {
        ...estimateGasContractCreationTransaction,
        to: mirrorContract.evm_address,
        //value: ONE_TINYBAR,
        //chainId: Number(CHAIN_ID),
        //gasLimit: defaultGasLimit,
        //nonce: await relay.getAccountNonce(accounts[2].address, requestId),
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: gasPrice,
      };
    });

    describe('Positive scenarios', async function () {
      reverterContractBytecode;
      const tracerConfigTrue = { onlyTopCall: true };
      const tracerConfigFalse = { onlyTopCall: false };
      const callTracer: TracerType = TracerType.CallTracer;

      //tests with onlyTopCall:false
      it.only('should be able to debug a successful CREATE transaction of type Legacy with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionTypeLegacy,
          chainId: 0x12a,
          data: bytecode,
          nonce: await relay.getAccountNonce(accounts[0].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
          value: '0x0',
        };

        let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        expect(resultDebug).to.deep.eq(SuccessResultCreateTypeLegacyOnlyTopCallFalse);
        //await Assertions.assertTransactionDebugResponse(resultDebug, SuccessResultCreateTypeLegacyOnlyTopCallFalse, tracerConfigFalse);
      });

      it('should be able to debug a successful CALL transaction of type Legacy with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionTypeLegacy,
          from: accounts[2].address,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };

        let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        //expect(resultDebug).to.deep.eq(SuccessResultCallTypeLegacyOnlyTopCallFalse)
      });

      it.skip('should be able to debug a failing CREATE transaction of type Legacy with call depth and onlyTopCall false', async function () {
        const accountAddress = '0xc37f417fA09933335240FCA72DD257BFBdE9C275';
        const transaction = {
          ...transactionTypeLegacy,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          chainId: 0x12a,
          from: accounts[2].address,
          gasPrice: await relay.gasPrice(requestId),
          data: reverterContractBytecode,
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTx, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );
        console.log(resultDebug);

        //expect(resultDebug).to.deep.eq(failingResultTypeLegacyOnlyTopCallFalse);
        //await Assertions.assertTransactionDebugResponse(resultDebug, expectedResultLegacyTransaction, tracerConfigFalse);
      });

      it('should be able to debug a failing CALL transaction with revert reason of type Legacy with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionTypeLegacy,
          from: accounts[1].address,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[1].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
          data: '0x0323d234',
        };

        let signedTransaction = await accounts[1].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        //expect(resultDebug).to.deep.eq(failingResultCallTypeLegacyOnlyTopCallFalse);
      });

      it('should be able to debug a failing CALL transaction without revert reason of type Legacy with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionTypeLegacy,
          from: accounts[1].address,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[1].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
          data: '0x46fc4bb1',
        };

        let signedTransaction = await accounts[1].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        //expect(resultDebug).to.deep.eq(failingResultCallTypeLegacyOnlyTopCallFalse);
      });

      //uncaught exception!
      it.skip('should be able to debug a successful CREATE transaction of type 2930 with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionType2930,
          from: accounts[1].address,
          value: '0x0',
          data: bytecode,
          gasPrice: await relay.gasPrice(requestId),
          nonce: await relay.getAccountNonce(accounts[1].address, requestId),
        };

        let signedTransaction = await accounts[1].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );
        console.log(resultDebug);

        // await Assertions.assertTransactionDebugResponse(resultDebug, successfulResultType2930, tracerConfigFalse);
      });

      it('should be able to debug a successful CALL transaction of type 2930 with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionType2930,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[0].address, requestId),
          data: '0x6e6662b9',
        };

        let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );
        console.log(resultDebug);

        //expect(resultDebug).to.deep.eq(successfulResultCallType2930OnlyTopCallFalse);
      });

      it('should be able to debug a failing CREATE transaction of type 2930 with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionType2930,
          from: accounts[2].address,
          bytecode: '0x151618',
        };

        let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );
        console.log(resultDebug);
        //expect(resultDebug).to.deep.eq(failingResultCreateType2930OnlyTopCallFalse);
      });

      it('should be able to debug a failing CALL transaction of type 2930 with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionType2930,
          from: accounts[2].address,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
          data: '0x46fc4bb1',
        };

        let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        //expect(resultDebug).to.deep.eq(failingResultCallType2930OnlyTopCallFalse);
      });

      it('should be able to debug a successful CREATE transaction of type 2 with call depth and onlyTopCall false', async function () {
        let signedTransaction = await accounts[0].wallet.signTransaction(estimateGasContractCreationTransaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );
        console.log(resultDebug);

        //expect(resultDebug).to.deep.eq(successfulResultCreateType2OnlyTopCallFalse);
      });
      //Invalid Argument
      it('should be able to debug a successful CALL transaction of type 2 with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionType2,
          from: accounts[1].address,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[1].address, requestId),
          //value: '0x1',
        };

        let signedTransaction = await accounts[1].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );
        console.log(resultDebug);
      });

      it.skip('should be able to debug a failing CREATE transaction of type 2 with call depth and onlyTopCall false', async function () {
        let transaction = {
          ...estimateGasContractCreationTransaction,
          from: accounts[2].address,
          bytecode: '     ',
        };

        let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        console.log(resultDebug);

        //await Assertions.assertTransactionDebugResponse(resultDebug, expectedResultLegacyTransaction, tracerConfigFalse);
      });

      it.skip('should be able to debug a failing CALL transaction of type 2 with call depth and onlyTopCall false', async function () {
        const transaction = {
          ...transactionType2,
          from: accounts[2].address,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          data: '0x46fc4bb1',
        };

        let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        console.log(resultDebug);

        //await Assertions.assertTransactionDebugResponse(resultDebug, expectedResultLegacyTransaction, tracerConfigFalse);
      });

      //tests with onlyTopCall:true
      //bad request
      it('should be able to debug a successful CREATE transaction of type 2 with call depth and onlyTopCall true', async function () {
        let signedTransaction = await accounts[0].wallet.signTransaction(estimateGasContractCreationTransaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        //await Assertions.assertTransactionDebugResponse(resultDebug, expectedResult.result, tracerConfigTrue);
      });

      it.skip('should be able to debug a successful CALL transaction of type 2 with call depth and onlyTopCall true', async function () {
        let signedTransaction = await accounts[0].wallet.signTransaction(estimateGasContractCreationTransaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
          requestId,
        );

        await Assertions.assertTransactionDebugResponse(resultDebug, expectedResult.result, tracerConfigTrue);
      });

      it.skip('should be able to debug a failing CREATE transaction of type 2 with call depth and onlyTopCall true', async function () {
        let signedTransaction = await accounts[2].wallet.signTransaction(failingTransactionType2);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );

        const error = predefined.INTERNAL_ERROR();
        await Assertions.assertPredefinedRpcError(error, transactionHash, false, relay, [
          signedTransaction + '11',
          requestId,
        ]);

        //await Assertions.assertTransactionDebugResponse(resultDebug, expectedResultLegacyTransaction, tracerConfigFalse);
      });

      it('should be able to debug a failing CALL transaction of type 2 with call depth and onlyTopCall true', async function () {
        let signedTransaction = await accounts[2].wallet.signTransaction(failingTransactionType2);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );

        const error = predefined.INTERNAL_ERROR();
        await Assertions.assertPredefinedRpcError(error, transactionHash, false, relay, [
          signedTransaction + '11',
          requestId,
        ]);

        //await Assertions.assertTransactionDebugResponse(resultDebug, expectedResultLegacyTransaction, tracerConfigFalse);
      });

      it.skip('should be able to debug a successful CREATE transaction of type Legacy with call depth and onlyTopCall true', async function () {
        const transaction = {
          ...transactionTypeLegacy,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
          gasLimit: defaultGasLimit,
        };

        let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);
        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );

        //await Assertions.assertTransactionDebugResponse(resultDebug, SuccessResultCallTypeLegacy, tracerConfigFalse);
      });

      it('should be able to debug a successful CALL transaction of type Legacy with call depth and onlyTopCall true', async function () {
        const transaction = {
          ...transactionTypeLegacy,
          to: mirrorContract.evm_address,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
          gasLimit: defaultGasLimit,
        };

        let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );

        //await Assertions.assertTransactionDebugResponse(resultDebug, SuccessResultCallTypeLegacy, tracerConfigFalse);
      });

      it.skip('should be able to debug a failing CREATE transaction of type Legacy with call depth and onlyTopCall true', async function () {
        let signedTransaction = await accounts[0].wallet.signTransaction(transactionTypeLegacy);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );

        await Assertions.assertTransactionDebugResponse(
          resultDebug,
          expectedResultLegacyTransaction,
          tracerConfigFalse,
        );
      });

      it.skip('should be able to debug a failing CALL transaction of type Legacy with call depth and onlyTopCall true', async function () {
        let signedTransaction = await accounts[0].wallet.signTransaction(transactionTypeLegacy);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );

        await Assertions.assertTransactionDebugResponse(
          resultDebug,
          expectedResultLegacyTransaction,
          tracerConfigFalse,
        );
      });

      it.skip('should be able to debug a successful CREATE transaction of type 2930 with call depth and onlyTopCall true', async function () {
        const transaction = {
          ...transactionType2930,
          to: mirrorContract.evm_address,
          gasPrice: await relay.gasPrice(requestId),
        };

        let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );

        await Assertions.assertTransactionDebugResponse(resultDebug, successfulResultType2930, tracerConfigFalse);
      });

      it('should be able to debug a successful CALL transaction of type 2930 with call depth and onlyTopCall true', async function () {
        const transaction = {
          ...transactionType2930,
          to: mirrorContract.evm_address,
          gasPrice: await relay.gasPrice(requestId),
        };

        let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );

        await Assertions.assertTransactionDebugResponse(resultDebug, successfulResultType2930, tracerConfigFalse);
      });

      it.skip('should be able to debug a failing CREATE transaction of type 2930 with call depth and onlyTopCall true', async function () {
        let signedTransaction = await accounts[2].wallet.signTransaction(transactionType2930);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );
        //need to probably try catch the error
        const error = predefined.GAS_PRICE_TOO_LOW(GAS_PRICE_TOO_LOW, GAS_PRICE_REF);
        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [
          signedTransaction,
          requestId,
        ]);

        console.log('Result: ', resultDebug);

        //await Assertions.assertTransactionDebugResponse(resultDebug, expectedResultLegacyTransaction, tracerConfigFalse);
      });

      it.skip('should be able to debug a failing CALL transaction of type 2930 with call depth and onlyTopCall true', async function () {
        let signedTransaction = await accounts[2].wallet.signTransaction(transactionType2930);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
          requestId,
        );
        //need to probably try catch the error
        const error = predefined.GAS_PRICE_TOO_LOW(GAS_PRICE_TOO_LOW, GAS_PRICE_REF);
        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [
          signedTransaction,
          requestId,
        ]);

        console.log('Result: ', resultDebug);

        //await Assertions.assertTransactionDebugResponse(resultDebug, expectedResultLegacyTransaction, tracerConfigFalse);
      });
    });

    describe('Negative scenarios', async function () {
      const tracerConfigTrue = { onlyTopCall: true };
      const tracerConfigFalse = { onlyTopCall: false };
      const tracerConfigInvalid = { onlyTopCall: 'invalid' };
      const callTracer: TracerType = TracerType.CallTracer;
      const opcodeLogger: TracerType = TracerType.OpcodeLogger;
      let debugService: DebugService;
      let mirrorNodeInstance;
      let cacheService: CacheService;
      const logger = pino();
      const registry = new Registry();

      cacheService = new CacheService(logger.child({ name: `cache` }), registry);

      mirrorNodeInstance = new MirrorNodeClient(
        process.env.MIRROR_NODE_URL,
        logger.child({ name: `mirror-node` }),
        registry,
        cacheService,
      );

      const common = new CommonService(mirrorNodeInstance, logger, cacheService);
      debugService = new DebugService(mirrorNodeInstance, logger, cacheService, common);

      it.skip('should fail to debug a transaction with invalid onlyTopCall value type', async function () {
        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [successfulTransactionHash, { tracer: callTracer, tracerConfig: tracerConfigInvalid }],
          requestId,
        );

        console.log('Result debug: ', resultDebug);
        const expectedError = predefined.INVALID_PARAMETER(2, 'Invalid tracerConfig, value: [object Object]');
        //await Assertions.assertPredefinedRpcError(expectedError, relay.call, false, relay, resultDebug);

        // await RelayAssertions.assertRejection(
        //     expectedError,
        //     debugService,
        //     true,
        //     debugService, []
        //     );

        expect(resultDebug.message).to.equal(`Invalid parameter 2: Invalid tracerConfig, value: [object Object]`);

        // try {
        //   await this.testClient.post('/', {
        //     id: '2',
        //     jsonrpc: '2.0',
        //     method: RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
        //     params: ['0x0000000000000000000000000000000000000001', '0x1', 123],
        //   });

        //   Assertions.expectedError();
        // } catch (error) {
        //   BaseTest.invalidParamError(
        //     error.response,
        //     Validator.ERROR_CODE,
        //     `Invalid parameter 2: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`,
        //   );
        // }

        console.log('Result: ', resultDebug);
      });

      it.skip('should fail to debug a transaction with invalid tracer type', async function () {
        const signedTransaction = await accounts[0].wallet.signTransaction(successfulTransactionHash);
        const transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const resultDebug = await relay.call(
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { invalidTracer: 'invalidValue', tracerConfig: tracerConfigInvalid }],
          requestId,
        );

        //how to verify the error here?

        console.log('Result: ', resultDebug);
      });
    });
  });
});
