import { JsonRpcError } from '@hashgraph/json-rpc-relay';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { P } from 'pino';
import { Validator } from '../../src/validator';

describe('Validator', async () => {
  function expectInvalidParam(result: any, index: number | string, message: string, object?: string) {
    expect(result instanceof JsonRpcError).to.eq(true);
    expect(result.name).to.eq("Invalid parameter");
    if (object) {
      expect(result.message).to.eq(`Invalid parameter '${index}' for ${object}: ${message}`);
    } else {
      expect(result.message).to.eq(`Invalid parameter ${index}: ${message}`);
    }
  }

  function expectMissingParam(result: any, index: number | string, object?: string) {
    expect(result instanceof JsonRpcError).to.eq(true);
    expect(result.name).to.eq("Missing required parameters");
    if (object) {
      expect(result.message).to.eq(`Missing value for required parameter '${index}' for ${object}`);
    } else {
      expect(result.message).to.eq(`Missing value for required parameter ${index}`);
    }
  }

  describe('validates Address type correctly', async () => {
    const validation = { 0: { type: 'address' } };

    it('returns an error if address hash is smaller than 20bytes', async () => {
      const result = Validator.validateParams(["0x4422E9088662"], validation);

      expectInvalidParam(result, 0, Validator.ADDRESS_ERROR);
    });

    it('returns an error if address is larger than 20bytes', async () => {
      const result = Validator.validateParams(["0x4422E9088662c44604189B2aA3ae8eE282fceBB7b7b7"], validation);

      expectInvalidParam(result, 0, Validator.ADDRESS_ERROR);
    });

    it('returns an error if address is NOT 0x prefixed', async () => {
      const result = Validator.validateParams(["4422E9088662c44604189B2aA3ae8eE282fceBB7"], validation);

      expectInvalidParam(result, 0, Validator.ADDRESS_ERROR);
    });

    it('returns an error if address is other type', async () => {
      expectInvalidParam(Validator.validateParams(["random string"], validation), 0, Validator.ADDRESS_ERROR);
      expectInvalidParam(Validator.validateParams([123], validation), 0, Validator.ADDRESS_ERROR);
      expectInvalidParam(Validator.validateParams([[]], validation), 0, Validator.ADDRESS_ERROR);
      expectInvalidParam(Validator.validateParams([{}], validation), 0, Validator.ADDRESS_ERROR);
    });

    it('does not return an error if address is valid', async () => {
      const result = Validator.validateParams(["0x4422E9088662c44604189B2aA3ae8eE282fceBB7"], validation);

      expect(result).to.eq(undefined);
    });

    it('does not return an error if address is long-zero address', async () => {
      const result = Validator.validateParams(["0x0000000000000000000000000000000000000408"], validation);

      expect(result).to.eq(undefined);
    });
  });

  describe('validates Array type correctly', async () => {
    const validation = { 0: { type: ['array'] } };
    const error = Validator.TYPES['array'].error;

    it('returns an error if the param is not an array', async () => {
      expectInvalidParam(Validator.validateParams(["random string"], validation), 0, error);
      expectInvalidParam(Validator.validateParams([123], validation), 0, error);
      expectInvalidParam(Validator.validateParams([true], validation), 0, error);
      expectInvalidParam(Validator.validateParams([{}], validation), 0, error);
    });

    it('does not return an error if param is array', async () => {
      expect(Validator.validateParams([['0x1']], validation)).to.eq(undefined);
    });
  });

  describe('validates blockHash type correctly', async () => {
    const validation = { 0: { type: 'blockHash' } };

    it('returns an error if block hash is smaller than 32bytes', async () => {
      const result = Validator.validateParams(["0xdec54931fcfe"], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_HASH_ERROR);
    });

    it('returns an error if block hash is larger than 32bytes', async () => {
      const result = Validator.validateParams(["0xdec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8a8a8"], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_HASH_ERROR);
    });

    it('returns an error if block hash is NOT 0x prefixed', async () => {
      const result = Validator.validateParams(["dec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8a8a8"], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_HASH_ERROR);
    });

    it('returns an error if block hash is other type', async () => {
      expectInvalidParam(Validator.validateParams(["random string"], validation), 0, Validator.BLOCK_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([123], validation), 0, Validator.BLOCK_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([[]], validation), 0, Validator.BLOCK_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([{}], validation), 0, Validator.BLOCK_HASH_ERROR);
    });

    it('does not return an error if block hash is valid', async () => {
      const result = Validator.validateParams(["0xdec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8"], validation);

      expect(result).to.eq(undefined);
    });
  });

  describe('validates blockNumber type correctly', async () => {
    const validation = { 0: { type: 'blockNumber' } };

    it('returns error if block number is decimal', async () => {
      const result = Validator.validateParams([123], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_NUMBER_ERROR);
    });

    it('returns error if block number is NOT 0x prefixed hex', async () => {
      const result = Validator.validateParams(["000f"], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_NUMBER_ERROR);
    });

    it('returns error if block number is hex with leading zeros digits', async () => {
      const result = Validator.validateParams(["0x00000000000000a"], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_NUMBER_ERROR);
    });

    it('returns error if block number is greater than (2^53 – 1)', async () => {
      const result = Validator.validateParams(["0x20000000000007"], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_NUMBER_ERROR);
    });

    it('returns error if block number contains invalid hex characters', async () => {
      const result = Validator.validateParams(["0xG"], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_NUMBER_ERROR);
    });

    it('returns error if block number is not correct tag', async () => {
      const result = Validator.validateParams(['newest'], validation);

      expectInvalidParam(result, 0, Validator.BLOCK_NUMBER_ERROR);
    });

    it('returns error if block number is random type', async () => {

      expectInvalidParam(Validator.validateParams([{}], validation), 0, Validator.BLOCK_NUMBER_ERROR);
      expectInvalidParam(Validator.validateParams([[]], validation), 0, Validator.BLOCK_NUMBER_ERROR);
      expectInvalidParam(Validator.validateParams(["random string"], validation), 0, Validator.BLOCK_NUMBER_ERROR);
    });

    it('does not return error when block number is valid hex', async () => {
      const result = Validator.validateParams(['0xf'], validation);

      expect(result).to.eq(undefined);
    });

    it('does not return error when block number is valid tag', async () => {
      const validation = { 0: { type: 'blockNumber' } };

      expect(Validator.validateParams(['earliest'], validation)).to.eq(undefined);
      expect(Validator.validateParams(['pending'], validation)).to.eq(undefined);
      expect(Validator.validateParams(['latest'], validation)).to.eq(undefined);
    });
  });

  describe('validates boolean type correctly', async () => {
    const validation = { 0: { type: 'boolean' } };
    const error = Validator.TYPES["boolean"].error;

    it('returns an error if param is string', async () => {
      expectInvalidParam(Validator.validateParams(["true"], validation), 0, error);
      expectInvalidParam(Validator.validateParams(["false"], validation), 0, error);
    });

    it('returns an error if param is other type of truthy or falsy value', async () => {
      expectInvalidParam(Validator.validateParams([1], validation), 0, error);
      expectInvalidParam(Validator.validateParams([0], validation), 0, error);
    });

    it('returns an error if param is another type', async () => {
      expectInvalidParam(Validator.validateParams([123], validation), 0, error);
      expectInvalidParam(Validator.validateParams(["0x1"], validation), 0, error);
      expectInvalidParam(Validator.validateParams([{}], validation), 0, error);
      expectInvalidParam(Validator.validateParams([[]], validation), 0, error);
    });
  });

  describe('validates Filter Object type correctly', async () => {
    const validation = { 0: { type: 'filter' } };
    const error = Validator.TYPES['filter'].error;
    const object = Validator.FilterObject.name;

    it('returns an error if the param is not an Object', async () => {
      expectInvalidParam(Validator.validateParams(["0x1"], validation), 0, error);
      expectInvalidParam(Validator.validateParams([123], validation), 0, error);
      expectInvalidParam(Validator.validateParams([[]], validation), 0, error);
      expectInvalidParam(Validator.validateParams([true], validation), 0, error);
    });

    it('returns an error if both blockHash and fromBlock/toBlock are used', async () => {
      const result = Validator.validateParams([{"blockHash": "0xdec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8" , "fromBlock": "latest"}], validation);
      expectInvalidParam(result, 0, "Can't use both blockHash and toBlock/fromBlock");
    });

    it('returns an error if the Filter Object properties are the wrong type', async () => {
      expectInvalidParam(Validator.validateParams([{"blockHash": 123}], validation), 'blockHash', Validator.BLOCK_HASH_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"toBlock": 123}], validation), 'toBlock', Validator.BLOCK_NUMBER_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"fromBlock": 123}], validation), 'fromBlock', Validator.BLOCK_NUMBER_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"address": "0x1"}], validation), 'address', Validator.ADDRESS_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"topics": {}}], validation), 'topics', Validator.TYPES.topics.error, object);
      expectInvalidParam(Validator.validateParams([{"topics": [123]}], validation), 'topics', Validator.TYPES.topics.error, object);
    });

    it('should not return error for correct values', async () => {
      expect(Validator.validateParams([{"blockHash": "0xdec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"toBlock": "0x2"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"toBlock": "latest"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"fromBlock": "0x1"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"fromBlock": "earliest"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"address": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation)).to.eq(undefined);
      // TODO: Add test case with array of addresses when support is added
      expect(Validator.validateParams([{"topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"topics": [["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0xea443924a9fba8d643a00daf0a7956ebc37fa4e9da82f07f80c34f0f5217edf9"]]}], validation)).to.eq(undefined);
    });
  });

  describe('validates topics type correctly', async () => {
    const validation = { 0: { type: 'topics' } };
    const topicsError = Validator.TYPES["topics"].error;
    it('returns an error if topics contains hash smaller than 32bytes', async () => {
      const result = Validator.validateParams([["0xddf252ad1be2c89", "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]], validation);

      expectInvalidParam(result, "topics", Validator.TOPIC_HASH_ERROR);
    });

    it('returns an error if topics contains hash larger than 32bytes', async () => {
      const result = Validator.validateParams([["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3effffffffffff"]], validation);

      expectInvalidParam(result, "topics", Validator.TOPIC_HASH_ERROR);
    });

    it('returns an error if topics contains hashes NOT 0x prefixed', async () => {
      const result = Validator.validateParams([["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" ,"ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]], validation);

      expectInvalidParam(result, "topics", Validator.TOPIC_HASH_ERROR);
    });

    it('returns an error if topics is not array', async () => {
      expectInvalidParam(Validator.validateParams(["random string"], validation), 0, topicsError);
      expectInvalidParam(Validator.validateParams([123], validation), 0, topicsError);
      expectInvalidParam(Validator.validateParams(["0x1"], validation), 0, topicsError);
      expectInvalidParam(Validator.validateParams([{}], validation), 0, topicsError);
    });

    it('does not return an error if topics param is valid', async () => {
      const result = Validator.validateParams([["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"]], validation);

      expect(result).to.eq(undefined);
    });

    it('should handle nested topic arrays', async () => {
      const result = Validator.validateParams([[["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], ["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb56"]]], validation);

      expect(result).to.eq(undefined);
    });

    it('should correctly validate nested topic arrays', async () => {
      const result = Validator.validateParams([[["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], ["0x790673a87ac19773537b2553e1dc7"]]], validation);

      expectInvalidParam(result, "topics", Validator.TOPIC_HASH_ERROR);
    });
  });

  describe('validates topicHash type correctly', async () => {
    const validation = { 0: { type: 'topicHash' } };

    it('returns an error if topic hash is smaller than 32bytes', async () => {
      const result = Validator.validateParams(["0xddf252ad1be2c89"], validation);

      expectInvalidParam(result, 0, Validator.TOPIC_HASH_ERROR);
    });

    it('returns an error if topic hash is larger than 32bytes', async () => {
      const result = Validator.validateParams(["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3effffff"], validation);

      expectInvalidParam(result, 0, Validator.TOPIC_HASH_ERROR);
    });

    it('returns an error if topic hash is NOT 0x prefixed', async () => {
      const result = Validator.validateParams(["ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], validation);

      expectInvalidParam(result, 0, Validator.TOPIC_HASH_ERROR);
    });

    it('returns an error if topic hash is other type', async () => {
      expectInvalidParam(Validator.validateParams(["random string"], validation), 0, Validator.TOPIC_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([123], validation), 0, Validator.TOPIC_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([[]], validation), 0, Validator.TOPIC_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([{}], validation), 0, Validator.TOPIC_HASH_ERROR);
    });

    it('does not return an error if topic hash is valid', async () => {
      const result = Validator.validateParams(["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], validation);

      expect(result).to.eq(undefined);
    });
  });

  describe('validates Transaction Object type correctly', async () => {
    const validation = { 0: { type: 'transaction' } };
    const error = Validator.TYPES['transaction'].error;
    const object = Validator.TransactionObject.name;

    it('returns an error if the param is not an Object', async () => {
      expectInvalidParam(Validator.validateParams(["0x1"], validation), 0, error);
      expectInvalidParam(Validator.validateParams([123], validation), 0, error);
      expectInvalidParam(Validator.validateParams([[]], validation), 0, error);
      expectInvalidParam(Validator.validateParams([true], validation), 0, error);
    });

    it('returns an error if the Transaction Object properties are the wrong type', async () => {
      expectInvalidParam(Validator.validateParams([{"from": "0x1234", "to": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation), 'from', Validator.ADDRESS_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"to": "0x1234"}], validation), 'to', Validator.ADDRESS_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"gas": 123, "to": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation), 'gas', Validator.DEFAULT_HEX_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"gasPrice": 123, "to": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation), 'gasPrice', Validator.DEFAULT_HEX_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"maxPriorityFeePerGas": 123, "to": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation), 'maxPriorityFeePerGas', Validator.DEFAULT_HEX_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"maxFeePerGas": 123, "to": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation), 'maxFeePerGas', Validator.DEFAULT_HEX_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"value": "123456", "to": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation), 'value', Validator.DEFAULT_HEX_ERROR, object);
      expectInvalidParam(Validator.validateParams([{"data": "123456", "to": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation), 'data', Validator.DEFAULT_HEX_ERROR, object);
    });
  });

  describe('validates transactionHash type correctly', async () => {
    const validation = { 0: { type: 'transactionHash' } };

    it('returns an error if transaction is smaller than 32bytes', async () => {
      const result = Validator.validateParams(["0xdec54931fcfe"], validation);

      expectInvalidParam(result, 0, Validator.TRANSACTION_HASH_ERROR);
    });

    it('returns an error if transaction is larger than 32bytes', async () => {
      const result = Validator.validateParams(["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb555555"], validation);

      expectInvalidParam(result, 0, Validator.TRANSACTION_HASH_ERROR);
    });

    it('returns an error if transaction is NOT 0x prefixed', async () => {
      const result = Validator.validateParams(["790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], validation);

      expectInvalidParam(result, 0, Validator.TRANSACTION_HASH_ERROR);
    });

    it('returns an error if transaction is other type', async () => {
      expectInvalidParam(Validator.validateParams(["random string"], validation), 0, Validator.TRANSACTION_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([123], validation), 0, Validator.TRANSACTION_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([[]], validation), 0, Validator.TRANSACTION_HASH_ERROR);
      expectInvalidParam(Validator.validateParams([{}], validation), 0, Validator.TRANSACTION_HASH_ERROR);
    });

    it('does not return an error if transaction is valid', async () => {
      const result = Validator.validateParams(["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], validation);

      expect(result).to.eq(undefined);
    });
  });

  describe('Other error cases', async () => {
    it('returns an error if validation type is wrong', async () => {
      const validation = { 0: { type: 'wrongType' } };
      const result = Validator.validateParams(["0x4422E9088662"], validation);

      expect(result instanceof JsonRpcError).to.eq(true);
      expect(result!.name).to.eq("Internal error");
      expect(result!.message).to.eq("Error invoking RPC: Missing or unsupported param type 'wrongType'");
    });

    it('returns an error if validation type is wrong', async () => {
      const validation = { 0: { } };
      const result = Validator.validateParams(["0x4422E9088662"], validation);

      expect(result instanceof JsonRpcError).to.eq(true);
      expect(result!.name).to.eq("Internal error");
      expect(result!.message).to.eq("Error invoking RPC: Missing or unsupported param type 'undefined'");
    });

    it('returns an error if Object param contains unexpected param', async () => {
      const validation = { 0: { type: 'filter' } };
      const result = Validator.validateParams([{"formBlock": "0x1"}], validation);

      expect(result instanceof JsonRpcError).to.eq(true);
      expect(result!.name).to.eq("Internal error");
      expect(result!.message).to.eq("Error invoking RPC: Unexpected parameter 'formBlock'");
    });
  });
});
