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
import * as chai from 'chai';
import chaiExclude from 'chai-exclude';

chai.use(chaiExclude);

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

    it('eth_call contract revert returns 200 http status', async function () {
      // preparing the contract data needed for a REVERT
      let callerContract, callerAddress, defaultCallData, activeAccount;
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
      const callData = {
        ...defaultCallData,
        data: '0x3ec4de3800000000000000000000000067d8d32e9bf1a9968a5ff53b87d777aa8ebbee69',
      };
      const data = {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
        params: [callData, 'latest'],
      };

      // Since we want the http status code, we need to perform the call using a client http request instead of using the relay instance directly
      const testClientPort = process.env.E2E_SERVER_PORT || '7546';
      const testClient = Axios.create({
        baseURL: 'http://localhost:' + testClientPort,
        responseType: 'json' as const,
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        timeout: 30 * 1000,
      });

      // Performing the call
      const response = await testClient.post('/', data);

      // Asserting the response
      expect(response).to.exist;
      expect(response.status).to.be.equal(200);
      expect(response.data).to.exist;
      expect(response.data.error).to.exist;
      expect(response.data.error.code).to.be.equal(-32008);
      expect(response.data.error.message).to.contain('execution reverted: CONTRACT_REVERT_EXECUTED');
      expect(response.data.error.name).to.be.equal('Contract revert executed');
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
    let estimateGasContractAddress;
    let transactionTypeLegacy;
    let transactionType2930;
    let reverterContract;
    let transactionType2;
    const defaultGasLimit = numberTo0x(3_000_000);
    const gasPrice = '0x2C68AF0BB14000';
    const bytecode = EstimateGasContract.bytecode;
    const tracerConfigTrue = { onlyTopCall: true };
    const tracerConfigFalse = { onlyTopCall: false };
    const callTracer: TracerType = TracerType.CallTracer;

    before(async () => {
      const defaultGasPrice = '0xA54F4C3C00';
      requestId = Utils.generateRequestId();
      reverterContract = await servicesNode.deployContract(reverterContractJson);
      // Wait for creation to propagate
      await mirrorNode.get(`/contracts/${reverterContract.contractId}`, requestId);
      reverterEvmAddress = `0x${reverterContract.contractId.toSolidityAddress()}`;

      const defaultTransactionFields = {
        to: null,
        from: accounts[0].address,
        gasPrice: defaultGasPrice,
        chainId: Number(CHAIN_ID),
        gasLimit: defaultGasLimit,
      };

      transactionTypeLegacy = {
        ...defaultTransactionFields,
        type: 0,
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

      //deploy estimate gas contract
      const transaction = {
        ...transactionTypeLegacy,
        chainId: 0x12a,
        data: bytecode,
        nonce: await relay.getAccountNonce(accounts[0].address, requestId),
        gasPrice: await relay.gasPrice(requestId),
      };

      let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
      let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);
      estimateGasContractAddress = await mirrorNode.get(`/contracts/results/${transactionHash}`);
    });

    describe('Positive scenarios', async function () {
      const defaultResponseFields = {
        type: 'CREATE',
        from: '0x0000000000000000000000000000000000000948',
        to: '0x000000000000000000000000000000000000094f',
        value: '0x0',
        gas: '0x2dc6c0',
        gasUsed: '0x249f00',
        input: '',
        output: '',
      };
      const successResultCreateWithDepth = {
        ...defaultResponseFields,
        calls: [
          {
            type: 'CREATE',
            from: '0xb3b6559bb61da201659b0c6be96ad6826ca0ad80',
            to: '0x40d5306d1a607292ceec43965ef053224db76129',
            gas: '0x2b7339',
            gasUsed: '0x4b',
            input: '0x',
            output: '0x',
            value: '0x0',
          },
        ],
      };
      const successResultCall = {
        ...defaultResponseFields,
        type: 'CALL',
      };
      const successResultCallWithDepth = {
        ...successResultCall,
        calls: [
          {
            type: 'STATICCALL',
            from: '0xd2a8204468e18bb242e6dcbf1700b09e95400b3b',
            to: '0x5c33384ca47ccc712231c3ea271d334eeafc36a3',
            gas: '0xc350',
            gasUsed: '0x94',
            input: '0x38cc4831',
            output: '0x0000000000000000000000005c33384ca47ccc712231c3ea271d334eeafc36a3',
            value: '0x0',
          },
        ],
      };
      const failingResultCreate = {
        ...defaultResponseFields,
        error: 'CONTRACT_EXECUTION_EXCEPTION',
        revertReason: 'INSUFFICIENT_STACK_ITEMS',
        gasUsed: '0x2dc6c0',
      };
      const failingResultCall = {
        ...defaultResponseFields,
        type: 'CALL',
        error: 'CONTRACT_REVERT_EXECUTED',
        revertReason: 'Some revert message',
      };

      describe('Test transactions of type 0', async function () {
        //onlyTopCall:false
        it('should be able to debug a successful CREATE transaction of type Legacy with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionTypeLegacy,
            chainId: 0x12a,
            data: bytecode,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
          };
          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          successResultCreateWithDepth.from = accounts[0].address;

          Assertions.validateResultDebugValues(
            resultDebug,
            ['to', 'output', 'input', 'calls'],
            ['from', 'to', 'input', 'output'],
            successResultCreateWithDepth,
          );
          expect(resultDebug.calls).to.have.lengthOf(1);
        });

        it('should be able to debug a successful CALL transaction of type Legacy with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionTypeLegacy,
            from: accounts[0].address,
            to: estimateGasContractAddress.address,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0xbbbfb986',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          successResultCallWithDepth.input = '0xbbbfb986';
          successResultCallWithDepth.from = accounts[0].address;

          Assertions.validateResultDebugValues(
            resultDebug,
            ['to', 'output', 'calls'],
            ['to', 'from', 'output', 'input'],
            successResultCallWithDepth,
          );
          expect(resultDebug.calls).to.have.lengthOf(1);
        });

        it('should be able to debug a failing CREATE transaction of type Legacy with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionTypeLegacy,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            chainId: 0x12a,
            from: accounts[0].address,
            gasPrice: await relay.gasPrice(requestId),
            data: '0x01121212',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          failingResultCreate.from = accounts[0].address;
          failingResultCreate.input = '0x01121212';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], failingResultCreate);
        });

        it('should be able to debug a failing CALL transaction with revert reason of type Legacy with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionTypeLegacy,
            from: accounts[0].address,
            to: reverterEvmAddress,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0x0323d234',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          failingResultCall.from = accounts[0].address;
          failingResultCall.input = '0x0323d234';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], failingResultCall);
        });

        //onlyTopCall:true
        it('should be able to debug a successful CREATE transaction of type Legacy with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionTypeLegacy,
            chainId: 0x12a,
            data: bytecode,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);
          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          defaultResponseFields.from = accounts[0].address;
          defaultResponseFields.input = bytecode;

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], defaultResponseFields);
        });

        it('should be able to debug a successful CALL transaction of type Legacy with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionTypeLegacy,
            from: accounts[0].address,
            to: estimateGasContractAddress.address,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0xc648049d0000000000000000000000000000000000000000000000000000000000000001',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          successResultCall.input = '0xc648049d0000000000000000000000000000000000000000000000000000000000000001';
          successResultCall.from = accounts[0].address;

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], successResultCall);
        });

        it('should be able to debug a failing CREATE transaction of type Legacy with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionTypeLegacy,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            chainId: 0x12a,
            from: accounts[0].address,
            gasPrice: await relay.gasPrice(requestId),
            data: '0x01121212',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          failingResultCreate.from = accounts[0].address;
          failingResultCreate.input = '0x01121212';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], failingResultCreate);
        });

        it('should be able to debug a failing CALL transaction of type Legacy with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionTypeLegacy,
            from: accounts[0].address,
            to: reverterEvmAddress,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0x0323d234',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          failingResultCall.from = accounts[0].address;
          failingResultCall.input = '0x0323d234';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], failingResultCall);
        });
      });

      describe('Test transaction of type 1', async function () {
        //onlyTopCall:false
        it('should be able to debug a successful CREATE transaction of type 2930 with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionType2930,
            chainId: 0x12a,
            data: bytecode,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          successResultCreateWithDepth.from = accounts[0].address;

          Assertions.validateResultDebugValues(
            resultDebug,
            ['to', 'output', 'input', 'calls'],
            ['from', 'to', 'input', 'output'],
            successResultCreateWithDepth,
          );
          expect(resultDebug.calls).to.have.lengthOf(1);
        });

        it('should be able to debug a successful CALL transaction of type 2930 with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionType2930,
            from: accounts[0].address,
            to: estimateGasContractAddress.address,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0xc648049d0000000000000000000000000000000000000000000000000000000000000001',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          defaultResponseFields.type = 'CALL';
          defaultResponseFields.input = '0xc648049d0000000000000000000000000000000000000000000000000000000000000001';
          defaultResponseFields.from = accounts[0].address;

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], defaultResponseFields);
        });

        it('should be able to debug a failing CREATE transaction of type 2930 with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionType2930,
            nonce: await relay.getAccountNonce(accounts[2].address, requestId),
            chainId: 0x12a,
            from: accounts[2].address,
            gasPrice: await relay.gasPrice(requestId),
            data: '0x01121212',
          };

          let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          failingResultCreate.from = accounts[2].address;
          failingResultCreate.input = '0x01121212';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], failingResultCreate);
        });

        it('should be able to debug a failing CALL transaction of type 2930 with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionType2930,
            from: accounts[0].address,
            to: reverterEvmAddress,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0x0323d234',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          failingResultCall.from = accounts[0].address;
          failingResultCall.input = '0x0323d234';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], failingResultCall);
        });

        //onlyTopCall:true
        it('should be able to debug a successful CREATE transaction of type 2930 with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionType2930,
            chainId: 0x12a,
            data: bytecode,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          defaultResponseFields.from = accounts[0].address;
          defaultResponseFields.input = bytecode;

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], defaultResponseFields);
        });

        it('should be able to debug a successful CALL transaction of type 2930 with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionType2930,
            from: accounts[0].address,
            to: estimateGasContractAddress.address,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0xc648049d0000000000000000000000000000000000000000000000000000000000000001',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          successResultCall.input = '0xc648049d0000000000000000000000000000000000000000000000000000000000000001';
          successResultCall.from = accounts[0].address;

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], successResultCall);
        });

        it('should be able to debug a failing CREATE transaction of type 2930 with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionType2930,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            chainId: 0x12a,
            from: accounts[0].address,
            gasPrice: await relay.gasPrice(requestId),
            data: '0x01121212',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          failingResultCreate.from = accounts[0].address;
          failingResultCreate.input = '0x01121212';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], failingResultCreate);
        });

        it('should be able to debug a failing CALL transaction of type 2930 with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionType2930,
            from: accounts[1].address,
            to: reverterEvmAddress,
            nonce: await relay.getAccountNonce(accounts[1].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0x0323d234',
          };

          let signedTransaction = await accounts[1].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          failingResultCall.from = accounts[1].address;
          failingResultCall.input = '0x0323d234';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], failingResultCall);
        });
      });

      describe('Test transactions of type: 2', async function () {
        //onlyTopCall:false
        it('should be able to debug a successful CREATE transaction of type 1559 with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionType2,
            chainId: 0x12a,
            data: bytecode,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          successResultCreateWithDepth.from = accounts[0].address;

          Assertions.validateResultDebugValues(
            resultDebug,
            ['to', 'output', 'input', 'calls'],
            ['from', 'to', 'input', 'output'],
            successResultCreateWithDepth,
          );
          expect(resultDebug.calls).to.have.lengthOf(1);
        });

        it('should be able to debug a successful CALL transaction of type 1559 with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionType2,
            from: accounts[0].address,
            to: estimateGasContractAddress.address,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0xc648049d0000000000000000000000000000000000000000000000000000000000000001',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );
          defaultResponseFields.type = 'CALL';
          defaultResponseFields.input = '0xc648049d0000000000000000000000000000000000000000000000000000000000000001';
          defaultResponseFields.from = accounts[0].address;

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], defaultResponseFields);
        });

        it('should be able to debug a failing CREATE transaction of type 1559 with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionType2,
            nonce: await relay.getAccountNonce(accounts[2].address, requestId),
            chainId: 0x12a,
            from: accounts[2].address,
            gasPrice: await relay.gasPrice(requestId),
            data: '0x01121212',
          };

          let signedTransaction = await accounts[2].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          failingResultCreate.from = accounts[2].address;
          failingResultCreate.input = '0x01121212';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], failingResultCreate);
        });

        it('should be able to debug a failing CALL transaction of type 1559 with call depth and onlyTopCall false', async function () {
          const transaction = {
            ...transactionType2,
            from: accounts[0].address,
            to: reverterEvmAddress,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0x0323d234',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigFalse }],
            requestId,
          );

          failingResultCall.from = accounts[0].address;
          failingResultCall.input = '0x0323d234';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], failingResultCall);
        });

        //onlyTopCall:true
        it('should be able to debug a successful CREATE transaction of type 1559 with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionType2,
            chainId: 0x12a,
            data: bytecode,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          defaultResponseFields.from = accounts[0].address;
          defaultResponseFields.input = bytecode;

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], defaultResponseFields);
        });

        it('should be able to debug a successful CALL transaction of type 1559 with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionType2,
            from: accounts[0].address,
            to: estimateGasContractAddress.address,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0xc648049d0000000000000000000000000000000000000000000000000000000000000001',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          successResultCall.input = '0xc648049d0000000000000000000000000000000000000000000000000000000000000001';
          successResultCall.from = accounts[0].address;

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], successResultCall);
        });

        it('should be able to debug a failing CREATE transaction of type 1559 with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionType2,
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            chainId: 0x12a,
            from: accounts[0].address,
            gasPrice: await relay.gasPrice(requestId),
            data: '0x01121212',
          };

          let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          failingResultCreate.from = accounts[0].address;
          failingResultCreate.input = '0x01121212';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output'], [], failingResultCreate);
        });

        it('should be able to debug a failing CALL transaction of type 1559 with call depth and onlyTopCall true', async function () {
          const transaction = {
            ...transactionType2,
            from: accounts[1].address,
            to: reverterEvmAddress,
            nonce: await relay.getAccountNonce(accounts[1].address, requestId),
            gasPrice: await relay.gasPrice(requestId),
            data: '0x0323d234',
          };

          let signedTransaction = await accounts[1].wallet.signTransaction(transaction);
          let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

          const resultDebug = await relay.call(
            RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
            [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigTrue }],
            requestId,
          );

          failingResultCall.from = accounts[1].address;
          failingResultCall.input = '0x0323d234';

          Assertions.validateResultDebugValues(resultDebug, ['to', 'output', 'calls'], [], failingResultCall);
        });
      });
    });

    describe('Negative scenarios', async function () {
      const tracerConfigInvalid = '{ onlyTopCall: "invalid" }';

      it('should fail to debug a transaction with invalid onlyTopCall value type', async function () {
        const transaction = {
          ...transactionTypeLegacy,
          chainId: 0x12a,
          data: bytecode,
          nonce: await relay.getAccountNonce(accounts[0].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };

        let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const expectedError = predefined.INVALID_PARAMETER(
          2,
          'Invalid tracerConfig, value: { onlyTopCall: "invalid" }',
        );
        const args = [
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { tracer: callTracer, tracerConfig: tracerConfigInvalid }],
          requestId,
        ];

        await Assertions.assertPredefinedRpcError(expectedError, relay.call, false, relay, args);
      });

      it('should fail to debug a transaction with invalid tracer type', async function () {
        const transaction = {
          ...transactionTypeLegacy,
          chainId: 0x12a,
          data: bytecode,
          nonce: await relay.getAccountNonce(accounts[0].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };

        let signedTransaction = await accounts[0].wallet.signTransaction(transaction);
        let transactionHash = await relay.sendRawTransaction(signedTransaction, requestId);

        const expectedError = predefined.MISSING_REQUIRED_PARAMETER(1);
        const args = [
          RelayCalls.ETH_ENDPOINTS.DEBUG_TRACE_TRANSACTION,
          [transactionHash, { invalidTracer: 'invalidTracer', tracerConfig: tracerConfigTrue }],
          requestId,
        ];

        await Assertions.assertPredefinedRpcError(expectedError, relay.call, false, relay, args);
      });
    });
  });
});
