/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

import constants from "./lib/constants";
import crypto from "crypto";
import { Transaction } from './lib/model';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { BigNumber as BN } from "bignumber.js";

const EMPTY_HEX = '0x';

const hashNumber = (num) => {
  return EMPTY_HEX + num.toString(16);
};

const generateRandomHex = (bytesLength = 16) => {
    return "0x" + crypto.randomBytes(bytesLength).toString('hex');
}

/**
* Format message prefix for logger.
*/
const formatRequestIdMessage = (requestId?: string): string => {
    return requestId ? `[${constants.REQUEST_ID_STRING}${requestId}]` : '';
};

function hexToASCII(str: string): string {
    const hex  = str.toString();
    let ascii = '';
    for (let n = 0; n < hex.length; n += 2) {
        ascii += String.fromCharCode(parseInt(hex.substring(n, n + 2), 16));
    }
    return ascii;
}

/**
 * Converts an EVM ErrorMessage to a readable form. For example this :
 * 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d53657420746f2072657665727400000000000000000000000000000000000000
 * will be converted to "Set to revert"
 * @param message
 */
const decodeErrorMessage = (message?: string): string => {
    if (!message) return '';

    // If the message does not start with 0x, it is not an error message, return it as is
    if (!message.includes(EMPTY_HEX)) return message;

    message = message.replace(/^0x/, "");   // Remove the starting 0x
    const strLen = parseInt(message.slice(8 + 64, 8 + 128), 16);  // Get the length of the readable text
    const resultCodeHex = message.slice(8 + 128, 8 + 128 + strLen * 2); // Extract the hex of the text
    return hexToASCII(resultCodeHex);
};

const formatTransactionId = (transactionId: string): string | null => {
    if (!constants.TRANSACTION_ID_REGEX.test(transactionId)) {
        return null;
    }
    
    var transactionSplit = transactionId.split("@");
    const payer = transactionSplit[0];
    const timestamp = transactionSplit[1].replace(".","-");
    return `${payer}-${timestamp}`;
}

/**
 * Retrieve formated transactionID without query params
 * @param transactionId The string value of the transactionId
 * @returns string | null
 */
const formatTransactionIdWithoutQueryParams = (transactionId: string): string | null => {
    // get formatted transactionID
    const formattedTransactionIdWithQueryParams = formatTransactionId(transactionId);

    // handle formattedTransactionIdWithQueryParams is empty
    if (!formattedTransactionIdWithQueryParams) {
      return null;
    }

    // split the formattedTransactionIdWithQueryParams with `?` and return the formatedID without params
    return formattedTransactionIdWithQueryParams.split('?')[0];
};

/**
 * Reads a value loaded up from the `.env` file, and converts it to a number.
 * If it is not set in `.env` or set as an empty string or other non-numeric
 * value, it uses the default value specified in constants.
 * @param envVarName The name of the env var to read in from the `.env` file
 * @param constantName The name of the constant to use as a fallback when the
 *   specified env var is invalid
 * @throws An error if both the env var and constant are invalid
 */
const parseNumericEnvVar = (envVarName: string, fallbackConstantKey: string): number => {
    let value: number = Number.parseInt((process.env[envVarName] ?? ''), 10);
    if (!isNaN(value)) {
        return value;
    }
    value = Number.parseInt((constants[fallbackConstantKey] ?? '').toString());
    if (isNaN(value)) {
        throw new Error(`Unable to parse numeric env var: '${envVarName}', constant: '${fallbackConstantKey}'`);
    }
    return value;
}

/**
 * Parse value from hex string to number, if value lenght is bigger than tinybar to weibar coef, it means that it's in weibar, which needs conversion to weibar.
 * @param value 
 * @returns parsedValue
 */
const valueHexToInt = (value: string): number => {
    if (BigInt(value).toString().length > constants.TINYBAR_TO_WEIBAR_COEF.toString().length) {
        const tinybarValue = BigInt(value) / BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
        return Number(tinybarValue);
    }
    return parseInt(value);
}

/**
 * Parse gasPrice hex value to number.
 * @param gasPrice 
 * @returns parsedGasPrice
 */
const gasPriceHexToInt = (gasPrice: string): number => {
    return parseInt(gasPrice);
}

const formatContractResult = (cr: any) => {
    if (cr === null) {
        return null;
    }

    return new Transaction({
        accessList: undefined,
        blockHash: toHash32(cr.block_hash),
        blockNumber: nullableNumberTo0x(cr.block_number),
        chainId: cr.chain_id,
        from: cr.from.substring(0, 42),
        gas: nanOrNumberTo0x(cr.gas_used),
        gasPrice: toNullIfEmptyHex(cr.gas_price),
        hash: cr.hash.substring(0, 66),
        input: cr.function_parameters,
        maxPriorityFeePerGas: toNullIfEmptyHex(cr.max_priority_fee_per_gas),
        maxFeePerGas: toNullIfEmptyHex(cr.max_fee_per_gas),
        nonce: nanOrNumberTo0x(cr.nonce),
        r: cr.r === null ? null : cr.r.substring(0, 66),
        s: cr.s === null ? null : cr.s.substring(0, 66),
        to: cr.to?.substring(0, 42),
        transactionIndex: nullableNumberTo0x(cr.transaction_index),
        type: nullableNumberTo0x(cr.type),
        v: nanOrNumberTo0x(cr.v),
        value: nanOrNumberTo0x(cr.amount)
    });
}

const prepend0x = (input: string): string => {
    return input.startsWith(EMPTY_HEX) ? input : EMPTY_HEX + input;
};

const numberTo0x = (input: number | BigNumber | bigint): string => {
    return EMPTY_HEX + input.toString(16);
};

const nullableNumberTo0x = (input: number | BigNumber): string | null => {
    return input == null ? null : numberTo0x(input);
};

const nanOrNumberTo0x = (input: number | BigNumber): string => {
    return input == null || input !== input ? numberTo0x(0) : numberTo0x(input);
};

const toHash32 = (value: string): string => {
    return value.substring(0, 66);
};

const toNullableBigNumber = (value: string): string | null => {
    if (typeof value === 'string') {
        return (new BN(value)).toString();
    }

    return null;
};

const toNullIfEmptyHex = (value: string): string | null => {
    return value === EMPTY_HEX ? null : value;
};

export {
    hashNumber, formatRequestIdMessage, hexToASCII, decodeErrorMessage, formatTransactionId,
    formatTransactionIdWithoutQueryParams, parseNumericEnvVar, formatContractResult, prepend0x,
    numberTo0x, nullableNumberTo0x, nanOrNumberTo0x, toHash32, toNullableBigNumber, toNullIfEmptyHex,
    generateRandomHex, gasPriceHexToInt, valueHexToInt
};
