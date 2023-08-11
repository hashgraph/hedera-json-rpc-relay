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

import { ethers } from 'ethers';
import { expect } from 'chai';
import { Utils } from '../helpers/utils';
import EstimateGasContractJson from '../contracts/EstimateGasContract.json';
import { AliasAccount } from '../clients/servicesClient';
import constants from '../../../../packages/relay/src/lib/constants';

describe('EstimateGasContract tests', function() {
  const signers: AliasAccount[] = [];
  let contract: ethers.Contract;
  let randomAddress: string;
  const { servicesNode, relay }: any = global;

  before(async function() {
    signers[0] = await servicesNode.createAliasAccount(15, relay.provider, Utils.generateRequestId());

    const contractReceipt = await servicesNode.deployContract(EstimateGasContractJson, 500_000);
    contract = new ethers.Contract(Utils.add0xPrefix(contractReceipt.contractId.toSolidityAddress()), EstimateGasContractJson.abi, signers[0].wallet);

    randomAddress = (ethers.Wallet.createRandom()).address;
  });

  const baseGasCheck = (estimatedGasValue, expectedValue: number) => {
    // handle deviation of 20%
    expect(Number(estimatedGasValue)).to.be.lessThan(expectedValue * 1.4);
  };

  const basicTests = [
    {
      name: '#001 Pure function without arguments that multiplies two numbers',
      functionName: 'pureMultiply',
      expectedGas: 0x567d
    },
    {
      name: '#002 Function with msg.send (address)',
      functionName: 'msgSender',
      expectedGas: 0x56d2
    },
    {
      name: '#003 Function with tx.origin (address)',
      functionName: 'txOrigin',
      expectedGas: 0x56d1
    },
    {
      name: '#004 Function with msg.value (uint)',
      functionName: 'msgValue',
      expectedGas: 0x566d
    },
    {
      name: '#005 Function with msg.sig (bytes4)',
      functionName: 'msgSig',
      expectedGas: 0x56ac
    },
    {
      name: '#010 Function that makes a static call to a method from a different contract (test STATICCALL op code)',
      functionName: 'staticCallToContract',
      expectedGas: 0x6ad7
    },
    {
      name: '#011 Function that makes a delegate call to a method from a different contract (test DELEGATECALL op code)',
      functionName: 'delegateCallToContract',
      expectedGas: 0x6aab
    },
    {
      name: '#012 Function that makes a call code to a method from a different contract (test CALLCODE op code)',
      functionName: 'callCodeToContract',
      expectedGas: 0x6aaf
    },
    {
      name: '#013 Function that perfroms LOG0, LOG1, LOG2, LOG3, LOG4 operations (test those op code)',
      functionName: 'logs',
      expectedGas: 0x69cb
    },
    {
      name: '#014 Function that performs self destruct (test SELFDESCTRUCT op code)',
      functionName: 'destroy',
      expectedGas: 0x69cb
    }
  ];

  for (const test of basicTests) {
    it(test.name, async function() {
      baseGasCheck(await relay.call('eth_estimateGas', [
        await contract[test.functionName].populateTransaction()
      ]), test.expectedGas);
    });
  }

  it('#006 Function with .balance (uint256)', async function() {
    const tx = await contract.addressBalance.populateTransaction(signers[0].address);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x57ac);
  });
  it('#007 Function that accepts an argument and change contract slot information by updating global contract field with the passed argument', async function() {
    const tx = await contract.updateCounter.populateTransaction(5644);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x6a4e);
  });
  it('#008 Function that successfully deploys a new smart contract via CREATE op code', async function() {
    const tx = await contract.deployViaCreate.populateTransaction();
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0xd48b);
  });
  it('#009 Function that successfully deploys a new smart contract via CREATE2 op code', async function() {
    const tx = await contract.deployViaCreate2.populateTransaction();
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0xdcc4);
  });
  it('#015 "data" from request body with wrong method signature', async function() {
    const estimateGasResponse = await relay.call('eth_estimateGas', [{
      data: '0xffffffff',
      to: contract.target,
      from: signers[0].address
    }]);
    baseGasCheck(estimateGasResponse, 0x61A80);
  });
  it('#016 "data" from request body with wrong encoded parameter', async function() {
    const estimateGasResponse = await relay.call('eth_estimateGas', [{
      data: '0x3ec4de35',
      to: contract.target,
      from: signers[0].address
    }]);
    baseGasCheck(estimateGasResponse, 0x61A80);
  });
  it('#017 non existing "from" from request body', async function() {
    const estimateGasResponse = await relay.call('eth_estimateGas', [{
      data: '0x0ec1551d',
      to: Utils.add0xPrefix(contract.target),
      from: randomAddress
    }]);
    baseGasCheck(estimateGasResponse, 0x567d);
  });
  it('#018 non existing "to" from request body', async function() {
    const estimateGasResponse = await relay.call('eth_estimateGas', [{
      data: '0x0ec1551d',
      to: randomAddress,
      from: Utils.add0xPrefix(signers[0].address)
    }]);
    baseGasCheck(estimateGasResponse, 0x61A80);
  });
  it('#019 Function that makes a call to a method to invalid smart contract', async function() {
    const tx = await contract.callToInvalidContract.populateTransaction(randomAddress);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x62de);
  });
  it('#020 Function that makes a delegate call to a method to invalid smart contract', async function() {
    const tx = await contract.delegateCallToInvalidContract.populateTransaction(randomAddress);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x6299);
  });
  it('#021 Function that makes a static call to a method to invalid smart contract', async function() {
    const tx = await contract.staticCallToInvalidContract.populateTransaction(randomAddress);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x62dc);
  });
  it('#022 Function that makes a call code to a method to invalid smart contract', async function() {
    const tx = await contract.callCodeToInvalidContract.populateTransaction(randomAddress);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x6187);
  });
  it('#023 Execute .call to external contract', async function() {
    const tx = await contract.callExternalFunctionNTimes.populateTransaction(1, contract.target);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x6c46);
    const txN = await contract.callExternalFunctionNTimes.populateTransaction(100, contract.target);
    const estimateGasResponseN = await relay.call('eth_estimateGas', [txN]);
    baseGasCheck(estimateGasResponseN, 0x232d2);
    expect(Number(estimateGasResponseN)).to.be.greaterThan(Number(estimateGasResponse));
  });
  it('#024 Execute .delegatecall to external contract', async function() {
    const tx = await contract.delegatecallExternalFunctionNTimes.populateTransaction(1, contract.target);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x6c17);
    const txN = await contract.delegatecallExternalFunctionNTimes.populateTransaction(100, contract.target);
    const estimateGasResponseN = await relay.call('eth_estimateGas', [txN]);
    baseGasCheck(estimateGasResponseN, 0x2317a);
    expect(Number(estimateGasResponseN)).to.be.greaterThan(Number(estimateGasResponse));
  });
  it('#025 Execute state update method', async function() {
    const tx = await contract.updateStateNTimes.populateTransaction(1);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x681e);
    const txN = await contract.updateStateNTimes.populateTransaction(100);
    const estimateGasResponseN = await relay.call('eth_estimateGas', [txN]);
    baseGasCheck(estimateGasResponse, 0xd23b);
    expect(Number(estimateGasResponseN)).to.be.greaterThan(Number(estimateGasResponse));
  });
  it('#026 Execute view .call to external contract', async function() {
    const tx = await contract.callExternalViewFunctionNTimes.populateTransaction(1, contract.target);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x5a92);
    const txN = await contract.callExternalViewFunctionNTimes.populateTransaction(100, contract.target);
    const estimateGasResponseN = await relay.call('eth_estimateGas', [txN]);
    baseGasCheck(estimateGasResponseN, 0x194d0);
    expect(Number(estimateGasResponseN)).to.be.greaterThan(Number(estimateGasResponse));
  });
  it('#028 Execute reentrancy with transfer', async function() {
    const tx = await contract.reentrancyWithTransfer.populateTransaction(randomAddress, constants.TINYBAR_TO_WEIBAR_COEF);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x61a80);
  });
  it('#029 Execute reentrancy with call', async function() {
    const tx = await contract.reentrancyWithCall.populateTransaction(randomAddress, constants.TINYBAR_TO_WEIBAR_COEF);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0xe4ba);
  });
  it('#030 Execute and validate gasleft()', async function() {
    const tx = await contract.getGasLeft.populateTransaction();
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    expect(Number(estimateGasResponse)).to.be.lessThan(constants.TX_BASE_COST * 1.2);
  });
  it('#031 Execute positive nested calls)', async function() {
    const tx = await contract.nestedCalls.populateTransaction(1, 10, contract.target);
    const estimateGasResponse = await relay.call('eth_estimateGas', [tx]);
    baseGasCheck(estimateGasResponse, 0x90bc);
  });
  it('#032 Execute limited nested calls)', async function() {
    const tx500 = await contract.nestedCalls.populateTransaction(1, 500, contract.target);
    const estimateGasResponse500 = await relay.call('eth_estimateGas', [tx500]);
    const tx750 = await contract.nestedCalls.populateTransaction(1, 750, contract.target);
    const estimateGasResponse750 = await relay.call('eth_estimateGas', [tx750]);
    const tx1000 = await contract.nestedCalls.populateTransaction(1, 1000, contract.target);
    const estimateGasResponse1000 = await relay.call('eth_estimateGas', [tx1000]);
    expect(estimateGasResponse500).to.equals(estimateGasResponse750).to.equal(estimateGasResponse1000);
  });
});
