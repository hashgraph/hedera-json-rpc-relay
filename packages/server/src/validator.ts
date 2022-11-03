import { predefined } from '@hashgraph/json-rpc-relay';

export default class Validator {
    DEFAULT_HEX_ERROR = 'Expected 0x prefixed hexadecimal value';
    HASH_ERROR = 'Expected 0x prefixed string representing the hash (32 bytes)';
    ADDRESS_ERROR = 'Expected 0x prefixed string representing the address (20 bytes)';
    BLOCK_NUMBER_ERROR = 'Expected 0x prefixed hexadecimal block number, or the string "latest", "earliest" or "pending"';
    BLOCK_HASH_ERROR = `${this.HASH_ERROR} of a block`;
    TRANSACTION_HASH_ERROR = `${this.HASH_ERROR} of a transaction`;
    TYPES = {
      "address": {
        test: (trigger: string) => new RegExp('^0x[a-fA-F0-9]{40}$').test(trigger),
        error: this.ADDRESS_ERROR
      },
      'blockNumber': {
        test: (trigger: string) => new RegExp('^0x[a-fA-F0-9]').test(trigger) || [ "earliest", "latests", "pending"].includes(trigger),
        error: this.BLOCK_NUMBER_ERROR
      },
      'blockHash': {
        test: (trigger: string) =>  new RegExp('^0x[0-9A-Fa-f]{64}$').test(trigger),
        error: this.BLOCK_HASH_ERROR
      },
      'transactionHash': {
        test: (trigger: string) =>  new RegExp('^0x[A-Fa-f0-9]{64}$').test(trigger),
        error: this.TRANSACTION_HASH_ERROR
      },
      'hex': {
        test: (trigger: string) => new RegExp('^0x[a-fA-F0-9]').test(trigger),
        error: this.DEFAULT_HEX_ERROR
      },
      'bool': {
        test: (trigger: string) => trigger === 'true' || trigger === 'false',
        error: 'Expected boolean'
      },
      "object": {
        test: (trigger: any) => typeof trigger === 'object' && trigger !== null,
        error: 'Expected Object'
      },
      "array": {
        test: (trigger: any) => Array.isArray(trigger),
        error: 'Expected Array'
      }
  };

  validateParams(params: any, indexes: any) {
    for (const index of Object.keys(indexes)) {
      const validation = indexes[Number(index)];
      const param = params[Number(index)];
      if (validation.required && param === undefined) {
        return predefined.MISSING_REQUIRED_PARAMETER(index);
      }

      if (validation.type && typeof validation.type === 'string') {
        if (param !== undefined && !this.TYPES[validation.type].test(param)) {
          return predefined.INVALID_PARAMETER(index, this.TYPES[validation.type].error);
        }
      }
    }
  }
}
