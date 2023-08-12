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

import { expect } from 'chai';
import { Registry } from 'prom-client';
import { Hbar, HbarUnit } from '@hashgraph/sdk';
const registry = new Registry();

import pino from 'pino';
import { Precheck } from '../../src/lib/precheck';
import { expectedError, mockData, signTransaction } from '../helpers';
import { ClientCache, MirrorNodeClient } from '../../src/lib/clients';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ethers } from 'ethers';
import constants from '../../src/lib/constants';
import { predefined } from '../../src';
const logger = pino();

const limitOrderPostFix = '?order=desc&limit=1';

describe('Precheck', async function () {

    const txWithMatchingChainId = '0x02f87482012a0485a7a358200085a7a3582000832dc6c09400000000000000000000000000000000000003f78502540be40080c001a006f4cd8e6f84b76a05a5c1542a08682c928108ef7163d9c1bf1f3b636b1cd1fba032097cbf2dda17a2dcc40f62c97964d9d930cdce2e8a9df9a8ba023cda28e4ad';
    const parsedTxWithMatchingChainId = ethers.Transaction.from(txWithMatchingChainId);
    const parsedTxGasPrice = 1440000000000;
    const txWithNonMatchingChainId = '0xf86a0385a7a3582000832dc6c09400000000000000000000000000000000000003f78502540be400801ca06750e92db52fa708e27f94f27e0cfb7f5800f9b657180bb2e94c1520cfb1fb6da01bec6045068b6db38b55017bb8b50166699384bc1791fd8331febab0cf629a2a';
    const parsedTxWithNonMatchingChainId = ethers.Transaction.from(txWithNonMatchingChainId);
    const txWithValueMoreThanOneTinyBar = '0xf8628080809449858d4445908c12fcf70251d3f4682e8c9c381085174876e800801ba015ec73d3e329c7f5c0228be39bf30758f974d69468847dd507082c89ec453fe2a04124cc1dd6ac07417e7cdbe04cb99d698bddc6ce4d04054dd8978dec3493f3d2';
    const parsedTxWithValueMoreThanOneTinyBar = ethers.Transaction.from(txWithValueMoreThanOneTinyBar);
    const txWithValueLessThanOneTinybar = '0xf8618080809449858d4445908c12fcf70251d3f4682e8c9c38108405f5e100801ba08249a7664c9290e6896711059d2ab75b10675b8b2ef7da41f4dd94c99f16f587a00110bc057ae0837da17a6f31f5123977f820921e333cb75fbe342583d278327d';
    const parsedTxWithValueLessThanOneTinybar = ethers.Transaction.from(txWithValueLessThanOneTinybar);
    const txWithValueLessThanOneTinybarAndNotEmptyData = '0xf8638080809449858d4445908c12fcf70251d3f4682e8c9c3810830186a0831231231ba0d8d47f572b49be8da9866e1979ea8fb8060f885119aff9d457a77be088f03545a00c9c1266548930924f5f8c11854bcc369bda1449d203c86a15840759b61cdffe';
    const parsedTxWithValueLessThanOneTinybarAndNotEmptyData = ethers.Transaction.from(txWithValueLessThanOneTinybarAndNotEmptyData);
    const oneTinyBar = ethers.parseUnits('1', 10);
    const defaultGasPrice = 720_000_000_000;
    const defaultChainId = Number('0x12a');
    let precheck: Precheck;
    let mock: MockAdapter;

    this.beforeAll(() => {
        // mock axios
        const instance = axios.create({
            baseURL: 'https://localhost:5551/api/v1',
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10 * 1000
        });

        // @ts-ignore
        mock = new MockAdapter(instance, { onNoMatch: "throwException" });
        
        // @ts-ignore
        const mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry, new ClientCache(logger.child({ name: `cache` }), registry), instance);
        precheck = new Precheck(mirrorNodeInstance, logger, '0x12a');
    });

    // @ts-ignore
    mock = new MockAdapter(instance, { onNoMatch: 'throwException' });

    // @ts-ignore
    const mirrorNodeInstance = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL,
      logger.child({ name: `mirror-node` }),
      registry,
      new ClientCache(logger.child({ name: `cache` }), registry),
      instance,
    );
    precheck = new Precheck(mirrorNodeInstance, logger, '0x12a');
  });

  this.beforeEach(() => {
    // reset mock
    mock.reset();
  });

  describe('value', async function () {
    it('should throw an exception if value is less than 1 tinybar', async function () {
      let hasError = false;
      try {
        precheck.value(parsedTxWithValueLessThanOneTinybar);
      } catch (e) {
        expect(e).to.exist;
        expect(e.code).to.eq(-32602);
        expect(e.message).to.eq('Value below 10_000_000_000 wei which is 1 tinybar');
        hasError = true;
      }

      expect(hasError).to.be.true;
    });

    it('should pass if value is more than 1 tinybar', async function () {
      try {
        precheck.value(parsedTxWithValueMoreThanOneTinyBar);
      } catch (e) {
        expect(e).to.not.exist;
      }
    });

    it('should pass if value is less than 1 tinybar and data is not empty', async function () {
      try {
        precheck.value(parsedTxWithValueLessThanOneTinybarAndNotEmptyData);
      } catch (e: any) {
        expect(e).to.not.exist;
      }
    });
  });

  describe('chainId', async function () {
    it('should pass for matching chainId', async function () {
      try {
        precheck.chainId(parsedTxWithMatchingChainId);
      } catch (e: any) {
        expect(e).to.not.exist;
      }
    });

    describe('IntrinsicGasCost', function () {
        const contractCreate = '0x60806040523480156200001157600080fd5b5060405162000cd838038062000cd883398181016040528101906200003791906200021c565b8060009081620000489190620004b8565b507fad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f06816040516200007a9190620005f1565b60405180910390a15062000615565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620000f282620000a7565b810181811067ffffffffffffffff82111715620001145762000113620000b8565b5b80604052505050565b60006200012962000089565b9050620001378282620000e7565b919050565b600067ffffffffffffffff8211156200015a5762000159620000b8565b5b6200016582620000a7565b9050602081019050919050565b60005b838110156200019257808201518184015260208101905062000175565b60008484015250505050565b6000620001b5620001af846200013c565b6200011d565b905082815260208101848484011115620001d457620001d3620000a2565b5b620001e184828562000172565b509392505050565b600082601f8301126200020157620002006200009d565b5b8151620002138482602086016200019e565b91505092915050565b60006020828403121562000235576200023462000093565b5b600082015167ffffffffffffffff81111562000256576200025562000098565b5b6200026484828501620001e9565b91505092915050565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680620002c057607f821691505b602082108103620002d657620002d562000278565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b600060088302620003407fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8262000301565b6200034c868362000301565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b600062000399620003936200038d8462000364565b6200036e565b62000364565b9050919050565b6000819050919050565b620003b58362000378565b620003cd620003c482620003a0565b8484546200030e565b825550505050565b600090565b620003e4620003d5565b620003f1818484620003aa565b505050565b5b8181101562000419576200040d600082620003da565b600181019050620003f7565b5050565b601f82111562000468576200043281620002dc565b6200043d84620002f1565b810160208510156200044d578190505b620004656200045c85620002f1565b830182620003f6565b50505b505050565b600082821c905092915050565b60006200048d600019846008026200046d565b1980831691505092915050565b6000620004a883836200047a565b9150826002028217905092915050565b620004c3826200026d565b67ffffffffffffffff811115620004df57620004de620000b8565b5b620004eb8254620002a7565b620004f88282856200041d565b600060209050601f8311600181146200053057600084156200051b578287015190505b6200052785826200049a565b86555062000597565b601f1984166200054086620002dc565b60005b828110156200056a5784890151825560018201915060208501945060208101905062000543565b868310156200058a578489015162000586601f8916826200047a565b8355505b6001600288020188555050505b505050505050565b600082825260208201905092915050565b6000620005bd826200026d565b620005c981856200059f565b9350620005db81856020860162000172565b620005e681620000a7565b840191505092915050565b600060208201905081810360008301526200060d8184620005b0565b905092915050565b6106b380620006256000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063a41368621461003b578063cfae321714610057575b600080fd5b610055600480360381019061005091906102ab565b610075565b005b61005f6100bf565b60405161006c9190610373565b60405180910390f35b806000908161008491906105ab565b507fad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f06816040516100b49190610373565b60405180910390a150565b6060600080546100ce906103c4565b80601f01602080910402602001604051908101604052809291908181526020018280546100fa906103c4565b80156101475780601f1061011c57610100808354040283529160200191610147565b820191906000526020600020905b81548152906001019060200180831161012a57829003601f168201915b5050505050905090565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6101b88261016f565b810181811067ffffffffffffffff821117156101d7576101d6610180565b5b80604052505050565b60006101ea610151565b90506101f682826101af565b919050565b600067ffffffffffffffff82111561021657610215610180565b5b61021f8261016f565b9050602081019050919050565b82818337600083830152505050565b600061024e610249846101fb565b6101e0565b90508281526020810184848401111561026a5761026961016a565b5b61027584828561022c565b509392505050565b600082601f83011261029257610291610165565b5b81356102a284826020860161023b565b91505092915050565b6000602082840312156102c1576102c061015b565b5b600082013567ffffffffffffffff8111156102df576102de610160565b5b6102eb8482850161027d565b91505092915050565b600081519050919050565b600082825260208201905092915050565b60005b8381101561032e578082015181840152602081019050610313565b60008484015250505050565b6000610345826102f4565b61034f81856102ff565b935061035f818560208601610310565b6103688161016f565b840191505092915050565b6000602082019050818103600083015261038d818461033a565b905092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806103dc57607f821691505b6020821081036103ef576103ee610395565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026104577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8261041a565b610461868361041a565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b60006104a86104a361049e84610479565b610483565b610479565b9050919050565b6000819050919050565b6104c28361048d565b6104d66104ce826104af565b848454610427565b825550505050565b600090565b6104eb6104de565b6104f68184846104b9565b505050565b5b8181101561051a5761050f6000826104e3565b6001810190506104fc565b5050565b601f82111561055f57610530816103f5565b6105398461040a565b81016020851015610548578190505b61055c6105548561040a565b8301826104fb565b50505b505050565b600082821c905092915050565b600061058260001984600802610564565b1980831691505092915050565b600061059b8383610571565b9150826002028217905092915050565b6105b4826102f4565b67ffffffffffffffff8111156105cd576105cc610180565b5b6105d782546103c4565b6105e282828561051e565b600060209050601f8311600181146106155760008415610603578287015190505b61060d858261058f565b865550610675565b601f198416610623866103f5565b60005b8281101561064b57848901518255600182019150602085019450602081019050610626565b868310156106685784890151610664601f891682610571565b8355505b6001600288020188555050505b50505050505056fea26469706673582212202e4941b4eb5848aeea7ed678fca96e1f51e4544a7915f9a57407226029d5fba664736f6c63430008120033000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000016100000000000000000000000000000000000000000000000000000000000000';
        const contractCall = "0xcfae3217";
        const transfer = "0x";
        const invalidTx = "0x60806040523480156200001157600080fd5b";
        it('should be able to calculate contract create', function () {
            const intrinsicGasCost = Precheck.transactionIntrinsicGasCost(contractCreate);
            expect(intrinsicGasCost).to.be.greaterThan(constants.TX_BASE_COST);
        });

        it('should be able to calculate contract call', function () {
            const intrinsicGasCost = Precheck.transactionIntrinsicGasCost(contractCall);
            expect(intrinsicGasCost).to.be.greaterThan(constants.TX_BASE_COST);
        });

        it('should be able to calucate tx without starting 0x', function () {
            const contractCallTrimmed = contractCall.replace("0x","");
            const intrinsicGasCost = Precheck.transactionIntrinsicGasCost(contractCallTrimmed);
            expect(intrinsicGasCost).to.be.greaterThan(constants.TX_BASE_COST);
        });

        it('should be able to able to calculate transfer', function () {
            const intrinsicGasCost = Precheck.transactionIntrinsicGasCost(transfer);
            expect(intrinsicGasCost).to.be.equal(constants.TX_BASE_COST);
        });

        it('should be able to calculate for odd length tx', function () {
            const intrinsicGasCost = Precheck.transactionIntrinsicGasCost(invalidTx);
            expect(intrinsicGasCost).to.be.greaterThan(constants.TX_BASE_COST);
        });
    });

    describe('gasLimit', async function() {
        const defaultTx = {
            value: oneTinyBar,
            gasPrice: defaultGasPrice,
            chainId: defaultChainId
        };

        function testFailingGasLimitPrecheck(gasLimits, errorCode) {
            for (const gasLimit of gasLimits) {
                it(`should fail for gasLimit: ${gasLimit}`, async function () {
                    const tx = {
                        ...defaultTx,
                        gasLimit: gasLimit
                    };
                    const signed = await signTransaction(tx);
                    const parsedTx = ethers.Transaction.from(signed);
                    const message =  gasLimit > constants.BLOCK_GAS_LIMIT ? 
                        `Transaction gas limit '${gasLimit}' exceeds block gas limit '${constants.BLOCK_GAS_LIMIT}'` :
                        `Transaction gas limit provided '${gasLimit}' is insufficient of intrinsic gas required `;
                    try {
                        await precheck.gasLimit(parsedTx);
                        expectedError();
                    } catch (e: any) {
                        expect(e).to.exist;
                        expect(e.code).to.eq(errorCode);
                        expect(e.message).to.contain(message);
                    }
                });
            }
        }

        function testPassingGasLimitPrecheck(gasLimits) {
            for (const gasLimit of gasLimits) {
                it(`should pass for gasLimit: ${gasLimit}`, async function () {
                    const tx = {
                        ...defaultTx,
                        gasLimit: gasLimit
                    };
                    const signed = await signTransaction(tx);
                    const parsedTx = ethers.Transaction.from(signed);

    function testPassingGasLimitPrecheck(gasLimits) {
      for (const gasLimit of gasLimits) {
        it(`should pass for gasLimit: ${gasLimit}`, async function () {
          const tx = {
            ...defaultTx,
            gasLimit: gasLimit,
          };
          const signed = await signTransaction(tx);
          const parsedTx = ethers.utils.parseTransaction(signed);

          try {
            await precheck.gasLimit(parsedTx);
          } catch (e: any) {
            expect(e).to.not.exist;
          }
        });
      }
    }

    const validGasLimits = [60000, 100000, 500000, 1000000, 5000000, 10000000];
    const lowGasLimits = [1, 10, 100, 1000, 10000, 30000, 50000];
    const highGasLimits = [20000000, 100000000, 999999999999];

    testPassingGasLimitPrecheck(validGasLimits);
    testFailingGasLimitPrecheck(lowGasLimits, -32003);
    testFailingGasLimitPrecheck(highGasLimits, -32005);
  });

  describe('gas price', async function () {
    let initialMinGasPriceBuffer;
    before(async () => {
      initialMinGasPriceBuffer = constants.GAS_PRICE_TINY_BAR_BUFFER;
      process.env.GAS_PRICE_TINY_BAR_BUFFER = '10000000000'; // 1 tinybar
    });

    after(async () => {
      process.env.GAS_PRICE_TINY_BAR_BUFFER = initialMinGasPriceBuffer;
    });

    describe('balance', async function() {
        // sending 2 hbars
        const transaction = '0x02f876820128078459682f0086018a4c7747008252089443cb701defe8fc6ed04d7bddf949618e3c575fe1881bc16d674ec8000080c001a0b8c604e08c15a7acc8c898a1bbcc41befcd0d120b64041d1086381c7fc2a5339a062eabec286592a7283c90ce90d97f9f8cf9f6c0cef4998022660e7573c046a46';
        const parsedTransaction = ethers.Transaction.from(transaction);
        const accountId = '0.1.2';

        it('should not pass for 1 hbar', async function() {
            const account = {
                account: accountId,
                balance: {
                    balance: Hbar.from(1, HbarUnit.Hbar).to(HbarUnit.Tinybar)
                }
            };

            try {
                await precheck.balance(parsedTransaction, account);
                expectedError();
            } catch(e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32000);
                expect(e.message).to.eq('Insufficient funds for transfer');
            }
        });

        it('should not pass for no account found', async function() {
            const account = null;

            try {
                await precheck.balance(parsedTransaction, account);
                expectedError();
            } catch(e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32001);
                expect(e.message).to.contain('Requested resource not found');
            }
        });

        it('should pass for 10 hbar', async function() {
            const account = {
                account: accountId,
                balance: {
                    balance: Hbar.from(10, HbarUnit.Hbar).to(HbarUnit.Tinybar)
                }
            };

            const result = await precheck.balance(parsedTransaction, account);
            expect(result).to.not.exist;
        });

        it('should pass for 100 hbar', async function() {
            const account = {
                account: accountId,
                balance: {
                    balance: Hbar.from(100, HbarUnit.Hbar).to(HbarUnit.Tinybar)
                }
            };

            const result = await precheck.balance(parsedTransaction, account);
            expect(result).to.not.exist;
        });

        it('should pass for 10000 hbar', async function() {
            const account = {
                account: accountId,
                balance: {
                    balance: Hbar.from(10_000, HbarUnit.Hbar).to(HbarUnit.Tinybar)
                }
            };
            
            const result = await precheck.balance(parsedTransaction, account);
            expect(result).to.not.exist;
        });

        it('should pass for 100000 hbar', async function() {
            const account = {
                account: accountId,
                balance: {
                    balance: Hbar.from(100_000, HbarUnit.Hbar).to(HbarUnit.Tinybar)
                }
            };
            
            const result = await precheck.balance(parsedTransaction, account);
            expect(result).to.not.exist;
        });

        it('should pass for 50_000_000_000 hbar', async function() {
            const account = {
                account: accountId,
                balance: {
                    balance: Hbar.from(50_000_000_000, HbarUnit.Hbar).to(HbarUnit.Tinybar)
                }
            };
            
            const result = await precheck.balance(parsedTransaction, account);
            expect(result).to.not.exist;
        });
    });

    describe('nonce', async function() {
        const defaultNonce = 3;
        const defaultTx = {
            value: oneTinyBar,
            gasPrice: defaultGasPrice,
            chainId: defaultChainId,
            nonce: defaultNonce
        };

        const mirrorAccount = {
            ethereum_nonce: defaultNonce
        };

        it(`should fail for low nonce`, async function () {
            const tx = {
                ...defaultTx,
                nonce: 1
            };
            const signed = await signTransaction(tx);
            const parsedTx = ethers.Transaction.from(signed);

            mock.onGet(`accounts/${parsedTx.from}${limitOrderPostFix}`).reply(200, mirrorAccount);


            try {
                await precheck.nonce(parsedTx, mirrorAccount.ethereum_nonce);
                expectedError();
            } catch (e: any) {
                expect(e).to.eql(predefined.NONCE_TOO_LOW(parsedTx.nonce, mirrorAccount.ethereum_nonce));
            }
        });

        it(`should not fail for next nonce`, async function () {
            const tx = {
                ...defaultTx,
                nonce: 4
            };
            const signed = await signTransaction(tx);
            const parsedTx = ethers.Transaction.from(signed);

            mock.onGet(`accounts/${parsedTx.from}${limitOrderPostFix}`).reply(200, mirrorAccount);

            await precheck.nonce(parsedTx, mirrorAccount.ethereum_nonce);
        });
    });

    describe('account', async function() {
        const defaultNonce = 3;
        const defaultTx = {
            value: oneTinyBar,
            gasPrice: defaultGasPrice,
            chainId: defaultChainId,
            nonce: defaultNonce,
            from: mockData.accountEvmAddress
        };

        const signed = await signTransaction(defaultTx);
        const parsedTx = ethers.Transaction.from(signed);

        const mirrorAccount = {
            evm_address: mockData.accountEvmAddress,
            ethereum_nonce: defaultNonce
        };

        it(`should fail for missing account`, async function () {
            mock.onGet(`accounts/${mockData.accountEvmAddress}${limitOrderPostFix}`).reply(404, mockData.notFound);


            try {
                await precheck.verifyAccount(parsedTx);
                expectedError();
            } catch (e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32001);
                expect(e.name).to.eq('Resource not found');
                expect(e.message).to.contain(mockData.accountEvmAddress);
            }
        });

        it(`should not fail for matched account`, async function () {
            mock.onGet(`accounts/${mockData.accountEvmAddress}${limitOrderPostFix}`).reply(200, mirrorAccount);
            const account = await precheck.verifyAccount(parsedTx);


            expect(account.ethereum_nonce).to.eq(defaultNonce);
        });
    });

    it('should pass for gas price not enough but within buffer', async function () {
      const adjustedGasPrice = parsedTxGasPrice + Number(constants.GAS_PRICE_TINY_BAR_BUFFER);
      precheck.gasPrice(parsedTxWithMatchingChainId, adjustedGasPrice);
    });
  });

  describe('balance', async function () {
    // sending 2 hbars
    const transaction =
      '0x02f876820128078459682f0086018a4c7747008252089443cb701defe8fc6ed04d7bddf949618e3c575fe1881bc16d674ec8000080c001a0b8c604e08c15a7acc8c898a1bbcc41befcd0d120b64041d1086381c7fc2a5339a062eabec286592a7283c90ce90d97f9f8cf9f6c0cef4998022660e7573c046a46';
    const parsedTransaction = ethers.utils.parseTransaction(transaction);
    const accountId = '0.1.2';

    it('should not pass for 1 hbar', async function () {
      const account = {
        account: accountId,
        balance: {
          balance: Hbar.from(1, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      };

      try {
        await precheck.balance(parsedTransaction, account);
        expectedError();
      } catch (e: any) {
        expect(e).to.exist;
        expect(e.code).to.eq(-32000);
        expect(e.message).to.eq('Insufficient funds for transfer');
      }
    });

    it('should not pass for no account found', async function () {
      const account = null;

      try {
        await precheck.balance(parsedTransaction, account);
        expectedError();
      } catch (e: any) {
        expect(e).to.exist;
        expect(e.code).to.eq(-32001);
        expect(e.message).to.contain('Requested resource not found');
      }
    });

    it('should pass for 10 hbar', async function () {
      const account = {
        account: accountId,
        balance: {
          balance: Hbar.from(10, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      };

      const result = await precheck.balance(parsedTransaction, account);
      expect(result).to.not.exist;
    });

    it('should pass for 100 hbar', async function () {
      const account = {
        account: accountId,
        balance: {
          balance: Hbar.from(100, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      };

      const result = await precheck.balance(parsedTransaction, account);
      expect(result).to.not.exist;
    });

    it('should pass for 10000 hbar', async function () {
      const account = {
        account: accountId,
        balance: {
          balance: Hbar.from(10_000, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      };

      const result = await precheck.balance(parsedTransaction, account);
      expect(result).to.not.exist;
    });

    it('should pass for 100000 hbar', async function () {
      const account = {
        account: accountId,
        balance: {
          balance: Hbar.from(100_000, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      };

      const result = await precheck.balance(parsedTransaction, account);
      expect(result).to.not.exist;
    });

    it('should pass for 50_000_000_000 hbar', async function () {
      const account = {
        account: accountId,
        balance: {
          balance: Hbar.from(50_000_000_000, HbarUnit.Hbar).to(HbarUnit.Tinybar),
        },
      };

      const result = await precheck.balance(parsedTransaction, account);
      expect(result).to.not.exist;
    });
  });

  describe('nonce', async function () {
    const defaultNonce = 3;
    const defaultTx = {
      value: oneTinyBar,
      gasPrice: defaultGasPrice,
      chainId: defaultChainId,
      nonce: defaultNonce,
    };

    const mirrorAccount = {
      ethereum_nonce: defaultNonce,
    };

    it(`should fail for low nonce`, async function () {
      const tx = {
        ...defaultTx,
        nonce: 1,
      };
      const signed = await signTransaction(tx);
      const parsedTx = ethers.utils.parseTransaction(signed);

      mock.onGet(`accounts/${parsedTx.from}${limitOrderPostFix}`).reply(200, mirrorAccount);

      try {
        await precheck.nonce(parsedTx, mirrorAccount.ethereum_nonce);
        expectedError();
      } catch (e: any) {
        expect(e).to.eql(predefined.NONCE_TOO_LOW(parsedTx.nonce, mirrorAccount.ethereum_nonce));
      }
    });

    it(`should not fail for next nonce`, async function () {
      const tx = {
        ...defaultTx,
        nonce: 4,
      };
      const signed = await signTransaction(tx);
      const parsedTx = ethers.utils.parseTransaction(signed);

      mock.onGet(`accounts/${parsedTx.from}${limitOrderPostFix}`).reply(200, mirrorAccount);

      await precheck.nonce(parsedTx, mirrorAccount.ethereum_nonce);
    });
  });

  describe('account', async function () {
    const defaultNonce = 3;
    const defaultTx = {
      value: oneTinyBar,
      gasPrice: defaultGasPrice,
      chainId: defaultChainId,
      nonce: defaultNonce,
      from: mockData.accountEvmAddress,
    };

    const signed = await signTransaction(defaultTx);
    const parsedTx = ethers.utils.parseTransaction(signed);

    const mirrorAccount = {
      evm_address: mockData.accountEvmAddress,
      ethereum_nonce: defaultNonce,
    };

    it(`should fail for missing account`, async function () {
      mock.onGet(`accounts/${mockData.accountEvmAddress}${limitOrderPostFix}`).reply(404, mockData.notFound);

      try {
        await precheck.verifyAccount(parsedTx);
        expectedError();
      } catch (e: any) {
        expect(e).to.exist;
        expect(e.code).to.eq(-32001);
        expect(e.name).to.eq('Resource not found');
        expect(e.message).to.contain(mockData.accountEvmAddress);
      }
    });

    it(`should not fail for matched account`, async function () {
      mock.onGet(`accounts/${mockData.accountEvmAddress}${limitOrderPostFix}`).reply(200, mirrorAccount);
      const account = await precheck.verifyAccount(parsedTx);

      expect(account.ethereum_nonce).to.eq(defaultNonce);
    });
  });
});
