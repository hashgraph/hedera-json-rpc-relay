/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
import chai, { expect } from 'chai';
import { ethers } from 'ethers';
import { JsonRpcError, predefined } from '@hashgraph/json-rpc-relay';
import { numberTo0x } from '../../../relay/src/formatters';
import RelayAssertions from '../../../relay/tests/assertions';
import chaiExclude from 'chai-exclude';

chai.use(chaiExclude);

export default class Assertions {
  static emptyHex = '0x';
  static zeroHex32Byte = '0x0000000000000000000000000000000000000000000000000000000000000000';
  static zeroHex8Byte = '0x0000000000000000';
  static emptyArrayHex = '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347';
  static emptyBloom =
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  static ethEmptyTrie = '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';
  static defaultGasPrice = 710_000_000_000;
  static datedGasPrice = 570_000_000_000;
  static updatedGasPrice = 640_000_000_000;
  static maxBlockGasLimit = 15_000_000;
  static defaultGasUsed = 0.5;

  static gasPriceDeviation = parseFloat(process.env.TEST_GAS_PRICE_DEVIATION ?? '0.2');

  static assertId = (id) => {
    const [shard, realm, num] = id.split('.');
    expect(shard, 'Id shard should not be null').to.not.be.null;
    expect(realm, 'Id realm should not be null').to.not.be.null;
    expect(num, 'Id num should not be null').to.not.be.null;
  };

  static unsupportedResponse = (resp: any) => {
    expect(resp.error.code, 'Unsupported response.error.code should equal -32601').to.eq(-32601);
    expect(
      resp.error.message.endsWith('Unsupported JSON-RPC method'),
      "Unsupported response.error.code should end with 'Unsupported JSON-RPC method'",
    ).to.be.true;
  };

  static expectedError = () => {
    expect(true).to.eq(false);
  };

  /**
   *
   * @param relayResponse
   * @param mirrorNodeResponse
   * @param mirrorTransactions
   * @param hydratedTransactions - aka showDetails flag
   */
  public static block(
    relayResponse,
    mirrorNodeResponse,
    mirrorTransactions,
    expectedGasPrice,
    hydratedTransactions = false,
  ) {
    // Assert static values
    expect(relayResponse.baseFeePerGas).to.exist;

    if (process.env.LOCAL_NODE && process.env.LOCAL_NODE !== 'false') {
      expect(relayResponse.baseFeePerGas).to.be.equal(expectedGasPrice);
    } else {
      expect(Number(relayResponse.baseFeePerGas)).to.be.gt(0);
    }

    expect(relayResponse.difficulty, "Assert block: 'difficulty' should equal zero in hex").to.be.equal(
      ethers.toQuantity(0),
    );
    expect(relayResponse.extraData, "Assert block: 'extraDta' should equal empty hex").to.be.equal(Assertions.emptyHex);
    expect(relayResponse.miner, "Assert block: 'miner' should equal zero address").to.be.equal(ethers.ZeroAddress);
    expect(relayResponse.mixHash, "Assert block: 'mixHash' should equal zero 32bytes hex").to.be.equal(
      Assertions.zeroHex32Byte,
    );
    expect(relayResponse.nonce, "Assert block: 'nonce' should equal zero 8byte hex").to.be.equal(
      Assertions.zeroHex8Byte,
    );
    expect(relayResponse.receiptsRoot, "Assert block: 'receiptsRoot' should equal zero 32bytes hex").to.be.equal(
      Assertions.zeroHex32Byte,
    );
    expect(relayResponse.sha3Uncles, "Assert block: 'sha3Uncles' should equal empty array hex").to.be.equal(
      Assertions.emptyArrayHex,
    );
    expect(relayResponse.stateRoot, "Assert block: 'stateRoot' should equal zero 32bytes hex").to.be.equal(
      Assertions.zeroHex32Byte,
    );
    expect(relayResponse.totalDifficulty, "Assert block: 'totalDifficulty' should equal zero in hex").to.be.equal(
      ethers.toQuantity(0),
    );
    expect(relayResponse.uncles, "Assert block: 'uncles' property exists").to.be.exist;
    expect(relayResponse.uncles.length, "Assert block: 'uncles' length should equal 0").to.eq(0);
    expect(relayResponse.logsBloom, "Assert block: 'logsBloom' should equal emptyBloom").to.eq(Assertions.emptyBloom);
    expect(relayResponse.gasLimit, "Assert block: 'gasLimit' should equal 'maxBlockGasLimit'").to.equal(
      ethers.toQuantity(Assertions.maxBlockGasLimit),
    );

    // Assert dynamic values
    expect(relayResponse.hash, "Assert block: 'hash' should equal mirrorNode response").to.be.equal(
      mirrorNodeResponse.hash.slice(0, 66),
    );
    expect(relayResponse.number, "Assert block: 'hash' should equal mirrorNode response").to.be.equal(
      ethers.toQuantity(mirrorNodeResponse.number),
    );
    expect(
      relayResponse.transactions.length,
      "Assert block: 'transactions' count should equal mirrorNode response",
    ).to.equal(mirrorTransactions.length);
    expect(relayResponse.parentHash, "Assert block: 'parentHash' should equal mirrorNode response").to.equal(
      mirrorNodeResponse.previous_hash.slice(0, 66),
    );
    expect(relayResponse.size, "Assert block: 'size' should equal mirrorNode response").to.equal(
      ethers.toQuantity(mirrorNodeResponse.size | 0),
    );
    expect(relayResponse.gasUsed, "Assert block: 'gasUsed' should equal mirrorNode response").to.equal(
      ethers.toQuantity(mirrorNodeResponse.gas_used),
    );
    expect(relayResponse.timestamp, "Assert block: 'timestamp' should equal mirrorNode response").to.equal(
      ethers.toQuantity(Number(mirrorNodeResponse.timestamp.from.split('.')[0])),
    );
    if (relayResponse.transactions.length) {
      expect(
        relayResponse.transactionsRoot,
        "Assert block: 'transactionsRoot' should equal mirrorNode response",
      ).to.equal(mirrorNodeResponse.hash.slice(0, 66));
    } else {
      expect(relayResponse.transactionsRoot, "Assert block: 'transactionsRoot' should equal 'ethEmptyTrie'").to.equal(
        Assertions.ethEmptyTrie,
      );
    }

    // Assert transactions
    for (const i in relayResponse.transactions) {
      const tx = relayResponse.transactions[i];
      if (hydratedTransactions) {
        const mirrorTx = mirrorTransactions.find((mTx) => mTx.hash.slice(0, 66) === tx.hash);
        Assertions.transaction(tx, mirrorTx);
      } else {
        const mirrorTx = mirrorTransactions.find((mTx) => mTx.hash.slice(0, 66) === tx);
        expect(tx).to.eq(mirrorTx.hash.slice(0, 66));
      }
    }
  }

  public static transaction(relayResponse, mirrorNodeResponse) {
    expect(relayResponse.blockHash, "Assert transaction: 'blockHash' should equal mirrorNode response").to.eq(
      mirrorNodeResponse.block_hash.slice(0, 66),
    );
    expect(relayResponse.blockNumber, "Assert transaction: 'blockNumber' should equal mirrorNode response").to.eq(
      ethers.toQuantity(mirrorNodeResponse.block_number),
    );
    // expect(relayResponse.chainId).to.eq(mirrorNodeResponse.chain_id); // FIXME must not be null!
    expect(relayResponse.from.toLowerCase(), "Assert transaction: 'from' should equal mirrorNode response").to.eq(
      mirrorNodeResponse.from.toLowerCase(),
    );
    expect(relayResponse.gas, "Assert transaction: 'gas' should equal mirrorNode response").to.eq(
      ethers.toQuantity(mirrorNodeResponse.gas_used),
    );
    // expect(relayResponse.gasPrice).to.eq(mirrorNodeResponse.gas_price); // FIXME must not be null!
    expect(relayResponse.hash, "Assert transaction: 'hash' should equal mirrorNode response").to.eq(
      mirrorNodeResponse.hash.slice(0, 66),
    );
    expect(relayResponse.input, "Assert transaction: 'input' should equal mirrorNode response").to.eq(
      mirrorNodeResponse.function_parameters,
    );
    if (relayResponse.to || mirrorNodeResponse.to) {
      expect(relayResponse.to.toLowerCase(), "Assert transaction: 'to' should equal mirrorNode response").to.eq(
        mirrorNodeResponse.to.toLowerCase(),
      );
    }
    expect(
      relayResponse.transactionIndex,
      "Assert transaction: 'transactionIndex' should equal mirrorNode response",
    ).to.eq(ethers.toQuantity(mirrorNodeResponse.transaction_index));
    expect(relayResponse.value, "Assert transaction: 'value' should equal mirrorNode response").to.eq(
      ethers.toQuantity(mirrorNodeResponse.amount),
    );
  }

  static transactionReceipt = (transactionReceipt, mirrorResult, effectiveGas) => {
    expect(transactionReceipt.blockHash, "Assert transactionReceipt: 'blockHash' should exists").to.exist;
    expect(transactionReceipt.blockHash, "Assert transactionReceipt: 'blockHash' should not be 0x0").to.not.eq('0x0');
    expect(
      transactionReceipt.blockHash,
      "Assert transactionReceipt: 'vablockHashlue' should equal mirrorNode response",
    ).to.eq(mirrorResult.block_hash.slice(0, 66));

    expect(transactionReceipt.blockNumber, "Assert transactionReceipt: 'blockNumber' should exist").to.exist;
    expect(Number(transactionReceipt.blockNumber), "Assert transactionReceipt: 'blockNumber' should be > 0").to.gt(0);
    expect(
      transactionReceipt.blockNumber,
      "Assert transactionReceipt: 'blockNumber' should equal mirrorNode response",
    ).to.eq(ethers.toQuantity(mirrorResult.block_number));

    expect(transactionReceipt.cumulativeGasUsed, "Assert transactionReceipt: 'cumulativeGasUsed' should exist").to
      .exist;
    expect(
      Number(transactionReceipt.cumulativeGasUsed),
      "Assert transactionReceipt: 'cumulativeGasUsed' should be > 0",
    ).to.gt(0);
    expect(
      Number(transactionReceipt.cumulativeGasUsed),
      "Assert transactionReceipt: 'cumulativeGasUsed' should equal mirrorNode response",
    ).to.eq(mirrorResult.block_gas_used);

    expect(transactionReceipt.gasUsed, "Assert transactionReceipt: 'gasUsed' should exist").to.exist;
    expect(Number(transactionReceipt.gasUsed), "Assert transactionReceipt: 'gasUsed' should be > 0").to.gt(0);
    expect(
      Number(transactionReceipt.gasUsed),
      "Assert transactionReceipt: 'gasUsed' should equal mirrorNode response",
    ).to.eq(mirrorResult.gas_used);

    expect(transactionReceipt.logsBloom, "Assert transactionReceipt: 'logsBloom' should exist").to.exist;
    expect(transactionReceipt.logsBloom, "Assert transactionReceipt: 'logsBloom' should not be 0x0").to.not.eq('0x0');
    expect(
      transactionReceipt.logsBloom,
      "Assert transactionReceipt: 'logsBloom' should equal mirrorNode response",
    ).to.eq(mirrorResult.bloom);

    expect(transactionReceipt.transactionHash, "Assert transactionReceipt: 'transactionHash' should exist").to.exist;
    expect(
      transactionReceipt.transactionHash,
      "Assert transactionReceipt: 'transactionHash' should equal mirrorNode response",
    ).to.not.eq('0x0');
    expect(
      transactionReceipt.transactionHash,
      "Assert transactionReceipt: 'transactionHash' should equal mirrorNode response",
    ).to.eq(mirrorResult.hash);

    expect(transactionReceipt.transactionIndex, "Assert transactionReceipt: 'transactionIndex' should exist").to.exist;
    expect(
      Number(transactionReceipt.transactionIndex),
      "Assert transactionReceipt: 'transactionIndex' should equal mirrorNode response",
    ).to.eq(mirrorResult.transaction_index);

    expect(transactionReceipt.effectiveGasPrice, "Assert transactionReceipt: 'effectiveGasPrice' should exist").to
      .exist;
    expect(
      Number(transactionReceipt.effectiveGasPrice),
      "Assert transactionReceipt: 'effectiveGasPrice' should be > 0",
    ).to.gt(0);
    const mirrorEffectiveGasPrice = effectiveGas;
    // handle deviation in gas price
    expect(
      Number(transactionReceipt.effectiveGasPrice),
      `Assert transactionReceipt: 'effectiveGasPrice' should be less than a ${
        1 + this.gasPriceDeviation
      } deviation from the mirrorNode response`,
    ).to.be.lessThan(mirrorEffectiveGasPrice * (1 + this.gasPriceDeviation));

    expect(
      Number(transactionReceipt.effectiveGasPrice),
      `Assert transactionReceipt: 'effectiveGasPrice' should be more than a ${
        1 - this.gasPriceDeviation
      } deviation from the mirrorNode response`,
    ).to.be.greaterThan(mirrorEffectiveGasPrice * (1 - this.gasPriceDeviation));

    expect(transactionReceipt.status, "Assert transactionReceipt: 'status' should exist").to.exist;
    expect(transactionReceipt.status, "Assert transactionReceipt: 'status' should equal mirrorNode response").to.eq(
      mirrorResult.status,
    );

    expect(transactionReceipt.logs, "Assert transactionReceipt: 'logs' should exist").to.exist;
    expect(
      transactionReceipt.logs.length,
      "Assert transactionReceipt: 'logs' count should equal to mirrorNode response",
    ).to.eq(mirrorResult.logs.length);
    expect(transactionReceipt.logs, "Assert transactionReceipt: 'logs' should equal mirrorNode response").to.deep.eq(
      mirrorResult.logs,
    );

    expect(
      transactionReceipt.from.toLowerCase(),
      "Assert transactionReceipt: 'from' should equal mirrorNode response",
    ).to.eq(mirrorResult.from.toLowerCase());

    expect(
      transactionReceipt.to.toLowerCase(),
      "Assert transactionReceipt: 'to' should equal mirrorNode response",
    ).to.eq(mirrorResult.to.toLowerCase());

    expect(transactionReceipt.type, "Assert transactionReceipt: 'type' should exist").to.exist;
    expect(transactionReceipt.type, "Assert transactionReceipt: 'type' should equal 0x mirrorNode response").to.eq(
      numberTo0x(mirrorResult.type),
    );
  };

  public static feeHistory(res: any, expected: any) {
    expect(res.baseFeePerGas, "Assert feeHistory: 'baseFeePerGas' should exist and be an Array").to.exist.to.be.an(
      'Array',
    );
    expect(res.gasUsedRatio, "Assert feeHistory: 'gasUsedRatio' should exist and be an Array").to.exist.to.be.an(
      'Array',
    );
    expect(res.oldestBlock, "Assert feeHistory: 'oldestBlock' should exist").to.exist;
    expect(
      res.baseFeePerGas.length,
      "Assert feeHistory: 'baseFeePerGas' length should equal passed expected value",
    ).to.equal(expected.resultCount + 1);
    expect(
      res.gasUsedRatio.length,
      "Assert feeHistory: 'gasUsedRatio' length should equal passed expected value",
    ).to.equal(expected.resultCount);

    expect(res.oldestBlock, "Assert feeHistory: 'oldestBlock' should equal passed expected value").to.equal(
      expected.oldestBlock,
    );

    res.gasUsedRatio.map((gasRatio: string) =>
      expect(gasRatio, "Assert feeHistory: 'gasRatio' should equal 'defaultGasUsed'").to.equal(
        Assertions.defaultGasUsed,
      ),
    );

    if (expected.checkReward) {
      expect(res.reward, "Assert feeHistory: 'reward' should exist and be an Array").to.exist.to.be.an('Array');
      expect(res.reward.length, "Assert feeHistory: 'reward' length should equal passed expected value").to.equal(
        expected.resultCount,
      );
    }
  }

  static unknownResponse(err: any) {
    Assertions.jsonRpcError(err, predefined.INTERNAL_ERROR());
  }

  static jsonRpcError(err: any, expectedError: JsonRpcError) {
    expect(err).to.exist;
    expect(err.code).to.equal(expectedError.code);
    expect(err.name).to.equal(expectedError.name);
    expect(err.message).to.include(expectedError.message);
  }

  static assertPredefinedRpcError = async (
    expectedError: JsonRpcError,
    method: () => Promise<any>,
    checkMessage: boolean,
    thisObj: any,
    args?: any,
  ): Promise<any> => {
    try {
      await method.apply(thisObj, args);
      Assertions.expectedError();
    } catch (e: any) {
      expect(e).to.have.any.keys('response', 'error');

      const { error } = e?.response ? e.response.bodyJson : e;
      expect(error.code).to.equal(expectedError.code);
      if (checkMessage) {
        expect(error.message).to.include(expectedError.message);
      }
    }
  };

  static expectRevert = async (promise, code) => {
    try {
      const tx = await promise;
      const receipt = await tx.wait();
      expect(receipt.to).to.equal(null);
    } catch (e: any) {
      expect(e).to.exist;
    }
  };

  static expectLogArgs = (log, contract, args: any[] = []) => {
    expect(log.address.toLowerCase()).to.equal(contract.target.toLowerCase());
    const decodedLog1 = contract.interface.parseLog(log);
    expect(decodedLog1.args).to.exist;
    expect(decodedLog1.args.length).to.eq(args.length);
    for (let i = 0; i < args.length; i++) {
      expect(decodedLog1.args[i]).to.be.eq(args[i]);
    }
  };

  static expectAnonymousLog = (log, contract, data) => {
    expect(log.data).to.equal(data);
    expect(log.address.toLowerCase()).to.equal(contract.target.toLowerCase());
  };

  static assertRejection = async (
    error: JsonRpcError,
    method: () => Promise<any>,
    args: any,
    checkMessage: boolean,
  ): Promise<any> => {
    return expect(method.apply(global.relay, args)).to.eventually.be.rejected.and.satisfy((err) => {
      if (!checkMessage) {
        return [error.code, error.name].every((substring) => err.body.includes(substring));
      }
      return [error.code, error.name, error.message].every((substring) => err.body.includes(substring));
    });
  };

  static evmAddress = (address) => {
    expect(address).to.match(/(\b0x[a-f0-9]{40}\b)/g, 'matches evm address format');
    expect(address).to.not.match(/(\b0x(0){15})/g, 'does not contain 15 consecutive zeros');
  };

  static longZeroAddress = (address) => {
    expect(address).to.match(/(\b0x[a-f0-9]{40}\b)/g, 'matches evm address format');
    expect(address).to.match(/(\b0x(0){15})/g, 'contains 15 consecutive zeros');
  };

  static validateResultDebugValues = (
    result: { from: string; calls: any[] },
    excludedValues: string[],
    nestedExcludedValues: string[],
    expectedResult: { from?: any; calls?: any[] },
  ) => {
    const hasValidHash = (currentValue: string) => RelayAssertions.validateHash(currentValue);

    // Validate result schema
    expect(result).to.have.keys(Object.keys(expectedResult));

    if (result.from) {
      result.from = result.from.toLowerCase();
    }

    if (expectedResult.from) {
      expectedResult.from = expectedResult.from.toLowerCase();
    }

    // Validate result values
    expect(result).excluding(excludedValues).to.deep.eq(expectedResult);
    if (nestedExcludedValues.length) {
      expect(result.calls).excluding(nestedExcludedValues).to.deep.eq(expectedResult.calls);
    }

    // Validate excluded values are encoded
    expect(excludedValues.every(hasValidHash));
    if (result.calls) {
      result.calls.forEach((call) => {
        expect(nestedExcludedValues.every(hasValidHash));
      });
    }
  };
}
