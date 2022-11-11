import { JsonRpcError } from '@hashgraph/json-rpc-relay';
import { expect } from 'chai';
import { Validator } from '../../src/validator';

describe('Validator', async () => {
  function expectInvalidParam(result: any, index: number | string, message: string) {
    expect(result instanceof JsonRpcError).to.eq(true);
    expect(result.name).to.eq("Invalid parameter");
    expect(result.message).to.eq(`Invalid parameter ${index}: ${message}`);
  }

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

  describe('validates topics type correctly', async () => {
    const validation = { 0: { type: 'topics' } };

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
      expectInvalidParam(Validator.validateParams(["random string"], validation), 0, Validator.TYPES["topics"].error);
      expectInvalidParam(Validator.validateParams([123], validation), 0, Validator.TYPES["topics"].error);
      expectInvalidParam(Validator.validateParams(["0x1"], validation), 0, Validator.TYPES["topics"].error);
      expectInvalidParam(Validator.validateParams([{}], validation), 0, Validator.TYPES["topics"].error);
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
});
