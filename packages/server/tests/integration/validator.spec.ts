import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Validator } from '../../src/validator';

describe('Validator', async () => {
  function expectInvalidParam(index: number | string, message: string, object?: string) {
    return object
      ? `Invalid parameter '${index}' for ${object}: ${message}`
      : `Invalid parameter ${index}: ${message}`;
  }

  describe('validates Address type correctly', async () => {
    const validation = { 0: { type: 'address' } };

    it('throws an error if address hash is smaller than 20bytes', async () => {
      expect(() => Validator.validateParams(['0x4422E9088662'], validation)).to.throw(
        expectInvalidParam(0, Validator.ADDRESS_ERROR)
      );
    });

    it('throws an error if address is larger than 20bytes', async () => {
      expect(() => Validator.validateParams(['0x4422E9088662c44604189B2aA3ae8eE282fceBB7b7b7'], validation)).to.throw(
        expectInvalidParam(0, Validator.ADDRESS_ERROR)
      );
    });

    it('throws an error if address is NOT 0x prefixed', async () => {
      expect(() => Validator.validateParams(['4422E9088662c44604189B2aA3ae8eE282fceBB7'], validation)).to.throw(
        expectInvalidParam(0, Validator.ADDRESS_ERROR)
      );
    });

    it('throws an error if address is other type', async () => {
      expect(() => Validator.validateParams(['random string'], validation)).to.throw(
        expectInvalidParam(0, Validator.ADDRESS_ERROR)
      );
      expect(() => Validator.validateParams(['123'], validation)).to.throw(
        expectInvalidParam(0, Validator.ADDRESS_ERROR)
      );
      expect(() => Validator.validateParams([[]], validation)).to.throw(
        expectInvalidParam(0, Validator.ADDRESS_ERROR)
      );
      expect(() => Validator.validateParams([{}], validation)).to.throw(
        expectInvalidParam(0, Validator.ADDRESS_ERROR)
      );
    });

    it('does not throw an error if address is valid', async () => {
      const result = Validator.validateParams(["0x4422E9088662c44604189B2aA3ae8eE282fceBB7"], validation);

      expect(result).to.eq(undefined);
    });

    it('does not throw an error if address is long-zero address', async () => {
      const result = Validator.validateParams(["0x0000000000000000000000000000000000000408"], validation);

      expect(result).to.eq(undefined);
    });
  });

  describe('validates Array type correctly', async () => {
    const validation = { 0: { type: ['array'] } };
    const error = Validator.TYPES['array'].error;

    it('throws an error if the param is not an array', async () => {
      expect(() => Validator.validateParams(["random string"], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([true], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([{}], validation)).to.throw(
        expectInvalidParam(0, error)
      );
    });

    it('does not throw an error if param is array', async () => {
      expect(Validator.validateParams([['0x1']], validation)).to.eq(undefined);
    });
  });

  describe('validates blockHash type correctly', async () => {
    const validation = { 0: { type: 'blockHash' } };

    it('throws an error if block hash is smaller than 32bytes', async () => {
      expect(() => Validator.validateParams(['0xdec54931fcfe'], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_HASH_ERROR)
      );
    });

    it('throws an error if block hash is larger than 32bytes', async () => {
      expect(() => Validator.validateParams(['0xdec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8a8a8'], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_HASH_ERROR)
      );
    });

    it('throws an error if block hash is NOT 0x prefixed', async () => {
      expect(() => Validator.validateParams(['dec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8a8a8'], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_HASH_ERROR)
      );
    });

    it('throws an error if block hash is other type', async () => {
      expect(() => Validator.validateParams(['string'], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_HASH_ERROR)
      );
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_HASH_ERROR)
      );
      expect(() => Validator.validateParams([[]], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_HASH_ERROR)
      );
      expect(() => Validator.validateParams([{}], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_HASH_ERROR)
      );
    });

    it('does not throw an error if block hash is valid', async () => {
      const result = Validator.validateParams(["0xdec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8"], validation);

      expect(result).to.eq(undefined);
    });
  });

  describe('validates blockNumber type correctly', async () => {
    const validation = { 0: { type: 'blockNumber' } };

    it('throws error if block number is decimal', async () => {
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
    });

    it('throws error if block number is NOT 0x prefixed hex', async () => {
      expect(() => Validator.validateParams(["000f"], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
    });

    it('throws error if block number is hex with leading zeros digits', async () => {
      expect(() => Validator.validateParams(["0x00000000000000a"], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
    });

    it('throws error if block number is greater than (2^53 – 1)', async () => {
      expect(() => Validator.validateParams(["0x20000000000007"], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
    });

    it('throws error if block number contains invalid hex characters', async () => {
      expect(() => Validator.validateParams(["0xg"], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
    });

    it('throws error if block number is not correct tag', async () => {
      expect(() => Validator.validateParams(["newest"], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
    });

    it('throws error if block number is random type', async () => {
      expect(() => Validator.validateParams(['string'], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
      expect(() => Validator.validateParams([[]], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
      expect(() => Validator.validateParams([{}], validation)).to.throw(
        expectInvalidParam(0, Validator.BLOCK_NUMBER_ERROR)
      );
    });

    it('does not throw error when block number is valid hex', async () => {
      const result = Validator.validateParams(['0xf'], validation);

      expect(result).to.eq(undefined);
    });

    it('does not throw error when block number is valid tag', async () => {
      const validation = { 0: { type: 'blockNumber' } };

      expect(Validator.validateParams(['earliest'], validation)).to.eq(undefined);
      expect(Validator.validateParams(['pending'], validation)).to.eq(undefined);
      expect(Validator.validateParams(['latest'], validation)).to.eq(undefined);
    });
  });

  describe('validates boolean type correctly', async () => {
    const validation = { 0: { type: 'boolean' } };
    const error = Validator.TYPES["boolean"].error;

    it('throws an error if param is string', async () => {
      expect(() => Validator.validateParams(["true"], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams(["false"], validation)).to.throw(
        expectInvalidParam(0, error)
      );
    });

    it('throws an error if param is other type of truthy or falsy value', async () => {
      expect(() => Validator.validateParams([1], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([2], validation)).to.throw(
        expectInvalidParam(0, error)
      );
    });

    it('throws an error if param is another type', async () => {
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams(["0x1"], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([[]], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([{}], validation)).to.throw(
        expectInvalidParam(0, error)
      );
    });
  });

  describe('validates Filter Object type correctly', async () => {
    const validation = { 0: { type: 'filter' } };
    const error = Validator.TYPES['filter'].error;
    const object = Validator.FilterObject.name;

    it('throws an error if the param is not an Object', async () => {
      expect(() => Validator.validateParams(["0x1"], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([[]], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([true], validation)).to.throw(
        expectInvalidParam(0, error)
      );
    });

    it('throws an error if both blockHash and fromBlock/toBlock are used', async () => {
      expect(() => Validator.validateParams([{"blockHash": "0xdec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8" , "fromBlock": "latest"}], validation)).to.throw(
        expectInvalidParam(0, "Can't use both blockHash and toBlock/fromBlock")
      );
    });

    it('throws an error if the Filter Object properties are the wrong type', async () => {
      expect(() => Validator.validateParams([{"blockHash": 123}], validation)).to.throw(
        expectInvalidParam("blockHash", Validator.BLOCK_HASH_ERROR, object)
      );
      expect(() => Validator.validateParams([{"toBlock": 123}], validation)).to.throw(
        expectInvalidParam("toBlock", Validator.BLOCK_NUMBER_ERROR, object)
      );
      expect(() => Validator.validateParams([{"fromBlock": 123}], validation)).to.throw(
        expectInvalidParam("fromBlock", Validator.BLOCK_NUMBER_ERROR, object)
      );
      expect(() => Validator.validateParams([{"address": "0x1"}], validation)).to.throw(
        expectInvalidParam("address", Validator.TYPES.addressFilter.error, object)
      );
      expect(() => Validator.validateParams([{"topics": {}}], validation)).to.throw(
        expectInvalidParam("topics", Validator.TYPES.topics.error, object)
      );
      expect(() => Validator.validateParams([{"topics": [123]}], validation)).to.throw(
        expectInvalidParam("topics", Validator.TYPES.topics.error, object)
      );
    });

    it('does not throw an error for correct values', async () => {
      expect(Validator.validateParams([{"blockHash": "0xdec54931fcfe053f3ffec90c1f7fd20158420b415054f15a4d16b63c528f70a8"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"toBlock": "0x2"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"toBlock": "latest"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"fromBlock": "0x1"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"fromBlock": "earliest"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"address": "0x4422E9088662c44604189B2aA3ae8eE282fceBB7"}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"address": ["0x4422E9088662c44604189B2aA3ae8eE282fceBB7", "0x4422E9088662c44604189B2aA3ae8eE282fceBB8"]}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]}], validation)).to.eq(undefined);
      expect(Validator.validateParams([{"topics": [["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0xea443924a9fba8d643a00daf0a7956ebc37fa4e9da82f07f80c34f0f5217edf9"]]}], validation)).to.eq(undefined);
    });
  });

  describe('validates topics type correctly', async () => {
    const validation = { 0: { type: 'topics' } };
    const topicsError = Validator.TYPES["topics"].error;
    it('throws an error if topics contains hash smaller than 32bytes', async () => {
      expect(() => Validator.validateParams([["0xddf252ad1be2c89", "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]], validation)).to.throw(
        expectInvalidParam(0, topicsError)
      );
    });

    it('throws an error if topics contains hash larger than 32bytes', async () => {
      expect(() => Validator.validateParams([["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3effffffffffff"]], validation)).to.throw(
        expectInvalidParam(0, topicsError)
      );
    });

    it('throws an error if topics contains hashes NOT 0x prefixed', async () => {
      expect(() => Validator.validateParams([["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" ,"ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]], validation)).to.throw(
        expectInvalidParam(0, topicsError)
      );
    });

    it('throws an error if topics is not array', async () => {
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, topicsError)
      );
      expect(() => Validator.validateParams(["0x1"], validation)).to.throw(
        expectInvalidParam(0, topicsError)
      );
      expect(() => Validator.validateParams([{}], validation)).to.throw(
        expectInvalidParam(0, topicsError)
      );
    });

    it('does not throw an error if topics param is valid', async () => {
      const result = Validator.validateParams([["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"]], validation);

      expect(result).to.eq(undefined);
    });

    it('does not throw an error if topics param is null', async () => {
      const result = Validator.validateParams([[null, "0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"]], validation);

      expect(result).to.eq(undefined);
    });

    it('should handle nested topic arrays', async () => {
      const result = Validator.validateParams([[["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], ["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb56"]]], validation);

      expect(result).to.eq(undefined);
    });

    it('should allow topic to be null in nested topic arrays', async () => {
      const result = Validator.validateParams([[[null, "0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], ["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb56"]]], validation);

      expect(result).to.eq(undefined);
    });

    it('should correctly validate nested topic arrays', async () => {
      expect(() => Validator.validateParams([[["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], ["0x790673a87ac19773537b2553e1dc7"]]], validation)).to.throw(
        expectInvalidParam(0, topicsError)
      );
    });
  });

  describe('validates topicHash type correctly', async () => {
    const validation = { 0: { type: 'topicHash' } };

    it('throws an error if topic hash is smaller than 32bytes', async () => {
      expect(() => Validator.validateParams(["0xddf252ad1be2c89"], validation)).to.throw(
        expectInvalidParam(0, Validator.TOPIC_HASH_ERROR)
      );
    });

    it('throws an error if topic hash is larger than 32bytes', async () => {
      expect(() => Validator.validateParams(["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3effffff"], validation)).to.throw(
        expectInvalidParam(0, Validator.TOPIC_HASH_ERROR)
      );
    });

    it('throws an error if topic hash is NOT 0x prefixed', async () => {
      expect(() => Validator.validateParams(["ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], validation)).to.throw(
        expectInvalidParam(0, Validator.TOPIC_HASH_ERROR)
      );
    });

    it('throws an error if topic hash is other type', async () => {
      expect(() => Validator.validateParams(["string"], validation)).to.throw(
        expectInvalidParam(0, Validator.TOPIC_HASH_ERROR)
      );
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, Validator.TOPIC_HASH_ERROR)
      );
      expect(() => Validator.validateParams([[]], validation)).to.throw(
        expectInvalidParam(0, Validator.TOPIC_HASH_ERROR)
      );
      expect(() => Validator.validateParams([{}], validation)).to.throw(
        expectInvalidParam(0, Validator.TOPIC_HASH_ERROR)
      );
    });

    it('does not throw an error if topic hash is valid', async () => {
      const result = Validator.validateParams(["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], validation);

      expect(result).to.eq(undefined);
    });
  });

  describe('validates Transaction Object type correctly', async () => {
    const validation = { 0: { type: 'transaction' } };
    const error = Validator.TYPES['transaction'].error;
    const object = Validator.TransactionObject.name;

    it('throws an error if the param is not an Object', async () => {
       expect(() => Validator.validateParams(["string"], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([[]], validation)).to.throw(
        expectInvalidParam(0, error)
      );
      expect(() => Validator.validateParams([true], validation)).to.throw(
        expectInvalidParam(0, error)
      );
    });

    it('throws an error if the Transaction Object properties are the wrong type', async () => {
      expect(() => Validator.validateParams([{"from": "0x1234"}], validation)).to.throw(
        expectInvalidParam("from", Validator.ADDRESS_ERROR, object)
      );
      expect(() => Validator.validateParams([{"to": "0x1234"}], validation)).to.throw(
        expectInvalidParam("to", Validator.ADDRESS_ERROR, object)
      );
      expect(() => Validator.validateParams([{"gas": 123}], validation)).to.throw(
        expectInvalidParam("gas", Validator.DEFAULT_HEX_ERROR, object)
      );
      expect(() => Validator.validateParams([{"gasPrice": 123}], validation)).to.throw(
        expectInvalidParam("gasPrice", Validator.DEFAULT_HEX_ERROR, object)
      );
      expect(() => Validator.validateParams([{"maxPriorityFeePerGas": 123}], validation)).to.throw(
        expectInvalidParam("maxPriorityFeePerGas", Validator.DEFAULT_HEX_ERROR, object)
      );
      expect(() => Validator.validateParams([{"maxFeePerGas": 123}], validation)).to.throw(
        expectInvalidParam("maxFeePerGas", Validator.DEFAULT_HEX_ERROR, object)
      );
      expect(() => Validator.validateParams([{"value": "123456"}], validation)).to.throw(
        expectInvalidParam("value", Validator.DEFAULT_HEX_ERROR, object)
      );
      expect(() => Validator.validateParams([{"data": "123456"}], validation)).to.throw(
        expectInvalidParam("data", Validator.DEFAULT_HEX_ERROR, object)
      );
    });
  });

  describe('validates transactionHash type correctly', async () => {
    const validation = { 0: { type: 'transactionHash' } };

    it('throws an error if transactionHash is smaller than 32bytes', async () => {
      expect(() => Validator.validateParams(["0xdec54931fcfe"], validation)).to.throw(
        expectInvalidParam(0, Validator.TRANSACTION_HASH_ERROR)
      );
    });

    it('throws an error if transactionHash is larger than 32bytes', async () => {
      expect(() => Validator.validateParams(["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb555555"], validation)).to.throw(
        expectInvalidParam(0, Validator.TRANSACTION_HASH_ERROR)
      );
    });

    it('throws an error if transactionHash is NOT 0x prefixed', async () => {
      expect(() => Validator.validateParams(["790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], validation)).to.throw(
        expectInvalidParam(0, Validator.TRANSACTION_HASH_ERROR)
      );
    });

    it('throws an error if transactionHash is other type', async () => {
      expect(() => Validator.validateParams(["string"], validation)).to.throw(
        expectInvalidParam(0, Validator.TRANSACTION_HASH_ERROR)
      );
      expect(() => Validator.validateParams([123], validation)).to.throw(
        expectInvalidParam(0, Validator.TRANSACTION_HASH_ERROR)
      );
      expect(() => Validator.validateParams([[]], validation)).to.throw(
        expectInvalidParam(0, Validator.TRANSACTION_HASH_ERROR)
      );
      expect(() => Validator.validateParams([{}], validation)).to.throw(
        expectInvalidParam(0, Validator.TRANSACTION_HASH_ERROR)
      );
    });

    it('does not throw an error if transactionHash is valid', async () => {
      const result = Validator.validateParams(["0x790673a87ac19773537b2553e1dc7c451f659e0f75d1b69a706ad42d25cbdb55"], validation);

      expect(result).to.eq(undefined);
    });
  });

  describe('Other error cases', async () => {
    it('throws an error if validation type is wrong', async () => {
      const validation = { 0: { type: 'wrongType' } };

      expect(() => Validator.validateParams(["0x4422E9088662"], validation)).to.throw(
        "Error invoking RPC: Missing or unsupported param type 'wrongType'"
      );
    });

    it('throws an error if validation type is wrong', async () => {
      const validation = { 0: { } };

      expect(() => Validator.validateParams(["0x4422E9088662"], validation)).to.throw(
        "Error invoking RPC: Missing or unsupported param type 'undefined'"
      );
    });

    it('throws an error if Filter Object param contains unexpected param', async () => {
      const validation = { 0: { type: 'filter' } };

      expect(() => Validator.validateParams([{"formBlock": "0x1"}], validation)).to.throw(
        expectInvalidParam("formBlock", "Unknown parameter", 'FilterObject')
      );
    });

    it('throws an error if Transaction Object param contains unexpected param', async () => {
      const validation = { 0: { type: 'transaction' } };

      expect(() => Validator.validateParams([{"form": "0x1"}], validation)).to.throw(
        expectInvalidParam("form", "Unknown parameter", 'TransactionObject')
      );
    });
  });

  describe('validates validateObject with transaction object', async () => {
    const transactionFilterObject = { data: null, name() { return 'transaction'; }}

    it('throws an error if Transaction Object data param is null and isnullable is false', async () => {
      expect(() => Validator.validateObject(transactionFilterObject, {
        data: {
          type: 'hex',
          nullable: false
        },
      })).to.throw(
        expectInvalidParam("data", "Expected 0x prefixed hexadecimal value", 'transaction, value: null')
      );
    });
  });

  describe('validates isValidAndNonNullableParam', async () => {
    it('returns false if transaction data is undefined and isnullable is true', async () => {
      expect(Validator.isValidAndNonNullableParam(undefined, true)).to.be.false;
    });

    it('returns false if transaction data is undefined and isnullable is false', async () => {
      expect(Validator.isValidAndNonNullableParam(undefined, false)).to.be.false;
    });

    it('returns false if transaction data is null and isnullable is true', async () => {
      expect(Validator.isValidAndNonNullableParam(null, true)).to.be.false;
    });

    it('returns false if transaction data is null and isnullable is false', async () => {
      expect(Validator.isValidAndNonNullableParam(null, false)).to.be.true;
    });

    it('returns false if transaction data is a valid 0x value and isnullable is false', async () => {
      expect(Validator.isValidAndNonNullableParam('0x', false)).to.be.true;
    });

    it('returns false if transaction data is a valid 0x value and isnullable is true', async () => {
      expect(Validator.isValidAndNonNullableParam('0x', true)).to.be.true;
    });
  });
});
