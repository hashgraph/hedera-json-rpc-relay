import { BigNumber } from 'bignumber.js';

export const stringToStringStorageHex = (input: string) => {
  let binaryString = Buffer.from(input).toString('hex');
  const stringLength = input.length;
  let lengthByte = (stringLength * 2 + 1).toString(16);

  if (stringLength > 31) {
    binaryString = '0';
  } else {
    lengthByte = (stringLength * 2).toString(16);
  }

  const paddedString = binaryString.padEnd(64 - 2, '0');

  return `${paddedString}${lengthByte.padStart(2, '0')}`;
};

export const stringToStringNextBytesHex = (input: string, offset: number) => {
  const binaryString = Buffer.from(input).toString('hex');
  const substring = binaryString.substring(offset * 64, (offset + 1) * 64);

  return substring.padEnd(64, '0');
};

export const stringToIntHex8 = (input: string) => parseInt(input, 10).toString(16).padStart(2, '0');

export const stringToIntHex256 = (input: string) => parseInt(input, 10).toString(16).padStart(64, '0');

export const hexToDecimal = (hex: string) => new BigNumber(hex.startsWith('0x') ? hex.slice(2) : hex, 16).toString(10);

export const calculateOffset = (z: string, y: string) => {
  const zDec = new BigNumber(hexToDecimal(z));
  const yDec = new BigNumber(hexToDecimal(y));
  return yDec.isLessThan(zDec) ? null : yDec.minus(zDec).toNumber();
};

export const toSnakeCase = (camelCase: string) => camelCase.replace(/([A-Z])/g, '_$1').toLowerCase();

export const converter = (type: string, offset?: number): ((input: string) => string) => {
  if (typeof offset !== 'undefined') {
    return (input) => stringToStringNextBytesHex(input, offset);
  }
  const map = {
    t_string_storage: stringToStringStorageHex,
    t_uint8: stringToIntHex8,
    t_uint256: stringToIntHex256,
  };
  return typeof map[type] === 'function' ? map[type] : null;
};
