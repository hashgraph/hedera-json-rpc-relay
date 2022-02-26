import { Eth } from '../index';
import {
  AccountId,
  Client,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractId,
  TransactionReceiptQuery,
} from '@hashgraph/sdk';

var cache = require('js-cache');

export class EthImpl implements Eth {
  // FIXME
  feeHistory() {
    const blockNum = '0x' + Date.now();
    return {
      baseFeePerGas: ['0x47'],
      gasUsedRatio: ['0.5'],
      oldestBlock: blockNum,
    };
  }

  // FIXME
  async getTransactionReceipt(hash: string) {
    var client;

    try {
      client = Client.fromConfig({
        network: {
          '34.70.108.154:50211': new AccountId(3),
        },
        operator: {
          accountId: '0.0.2',
          privateKey:
            '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137',
        },
      });
    } catch (error) {
      console.log(error);
      throw new Error(
        'Environment variables HEDERA_NETWORK, OPERATOR_ID, and OPERATOR_KEY are required.'
      );
    }

    const transactionId = cache.get(Buffer.from(hash, 'hex'));

    try {
      let receipt = await new TransactionReceiptQuery()
        .setTransactionId(transactionId)
        .execute(client);
    } catch (e) {
      console.log(e);
      throw e;
    }
    const blockNum = '0x' + Date.now();
    return {
      transactionHash: hash,
      transactionIndex: '0x0',
      blockNumber: blockNum,
      blockHash:
        '0xc6ef2fc5426d6ad6fd9e2a26abeab0aa2411b7ab17f30a99d3cb96aed1d1055b',
      cumulativeGasUsed: '0x33bc',
      gasUsed: '0x4dc',
      contractAddress: '0xb60e8dd61c5d32be8058bb8eb970870f07233155',
      logs: [],
      logsBloom: '0x0000',
      status: '0x1',
    };
  }

  // FIXME: We should have a legit block number, and we should get it from the mirror node
  blockNumber() {
    return Date.now();
  }

  // FIXME This needs to be customizable via env variables
  chainId(): number {
    return 0x12a;
  }

  // FIXME Somehow compute the amount of gas for this request...
  estimateGas(): number {
    return 0x10000;
  }

  // FIXME, fake.
  gasPrice(): number {
    return 0x2f;
  }

  // FIXME Somehow get the account balance... even for testing I need to fake this better
  getBalance(): number {
    return 0x10000000000000000;
  }

  // FIXME Need to return contract code. For built in accounts we need some fake contract code...?
  getCode(): number {
    return 0x8239283283283823;
  }

  // FIXME This is a totally fake implementation
  getBlockByHash(hash: string): any {
    const blockNum = '0x' + Date.now();
    return {
      difficulty: '0x1',
      extraData: '',
      gasLimit: '0xe4e1c0',
      baseFeePerGas: '0x1',
      gasUsed: '0x0',
      hash: hash,
      logsBloom: '0x0',
      miner: '',
      mixHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      nonce: '0x0000000000000000',
      number: blockNum,
      parentHash: '0x0',
      receiptsRoot: '0x0',
      sha3Uncles: '0x0',
      size: '0x0',
      stateRoot: '0x0',
      timestamp: blockNum,
      totalDifficulty: blockNum,
      transactions: [],
      transactionsRoot: '0x00',
      uncles: [],
    };
  }

  // FIXME This is a totally fake implementation
  getBlockByNumber(blockNum: number): any {
    return {
      difficulty: '0x1',
      extraData: '',
      gasLimit: '0xe4e1c0',
      baseFeePerGas: '0x1',
      gasUsed: '0x0',
      hash: '0x1fb2230a6b5bf856bb4df3c80cbf95b84454169a5a133fffaf8505a05f960aeb',
      logsBloom: '0x0',
      miner: '',
      mixHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      nonce: '0x0000000000000000',
      number: blockNum,
      parentHash: '0x0',
      receiptsRoot: '0x0',
      sha3Uncles: '0x0',
      size: '0x0',
      stateRoot: '0x0',
      timestamp: blockNum,
      totalDifficulty: blockNum,
      transactions: [],
      transactionsRoot: '0x00',
      uncles: [],
    };
  }

  // FIXME
  getTransactionCount(): number {
    return 0x1;
  }

  async sendRawTransaction(transaction: string): Promise<string> {
    let client;

    try {
      client = Client.fromConfig({
        network: {
          '34.70.108.154:50211': new AccountId(3),
        },
        operator: {
          accountId: '0.0.2',
          privateKey:
            '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137',
        },
      });
    } catch (error) {
      console.log(error);
      throw new Error(
        'Environment variables HEDERA_NETWORK, OPERATOR_ID, and OPERATOR_KEY are required.'
      );
    }

    var txRequest: ContractExecuteTransaction | null = null;

    txRequest = new ContractExecuteTransaction();

    txRequest = txRequest.populateFromForeignTransaction(transaction);

    var contractExecuteResponse = null;

    if (client instanceof Client) {
      try {
        contractExecuteResponse = await txRequest.execute(client);
      } catch (e) {
        console.log(e);
        throw e;
      }
    } else {
      throw new Error(
        'txRequest was not a ContractExecute Transaction or the Client was invalid'
      );
    }
    cache.set(
      contractExecuteResponse.transactionHash,
      contractExecuteResponse.transactionId
    );

    // try {
    //     const contractRecord = await contractExecuteResponse.getRecord(client);
    //
    //     console.log(contractRecord);
    //
    //     const contractReceipt = await contractExecuteResponse.getReceipt(client);
    //
    //     console.log(contractReceipt);
    // } catch (e) {
    //     console.log(e);
    // }

    // console.log(contractExecuteResponse.transactionHash);
    // const transactionId = cache.get(contractExecuteResponse.transactionHash);

    const txnHash = contractExecuteResponse.transactionHash;

    const hashString = Buffer.from(txnHash).toString('hex');

    var receipt = await this.getTransactionReceipt(hashString);

    return Buffer.from(contractExecuteResponse.transactionHash).toString('hex');
  }

  async call(call: any, blockParam: string) {
    //TODO: ensure block param is latest
    var client;

    try {
      client = Client.fromConfig({
        network: {
          '34.70.108.154:50211': new AccountId(3),
        },
        operator: {
          accountId: '0.0.2',
          privateKey:
            '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137',
        },
      });
    } catch (error) {
      console.log(error);
      throw new Error(
        'Environment variables HEDERA_NETWORK, OPERATOR_ID, and OPERATOR_KEY are required.'
      );
    }

    try {
      var gas: number;
      if (call.gas == null) {
        gas = 400_000;
      } else {
        gas = typeof call.gas === 'string' ? Number(call.gas) : call.gas;
      }

      var data: string = call.data.startsWith('0x')
        ? call.data.substring(2)
        : call.data;

      const contractCallQuery = new ContractCallQuery()
        .setContractId(ContractId.fromSolidityAddress(call.to))
        .setFunctionParameters(Buffer.from(data, 'hex'))
        .setGas(gas);

      if (call.from != null) {
        var lookup = call.from;
        if (lookup.startsWith('0x')) {
          lookup = lookup.substring(2);
        }
        var senderId = AccountId.fromSolidityAddress(lookup);
        contractCallQuery.setSenderId(senderId);
      }

      const contractCallResponse = await contractCallQuery.execute(client);
      return Buffer.from(contractCallResponse.asBytes())
        .toString('hex')
        .replace('^(0x)?0+', '');
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}
