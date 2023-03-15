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
const createHash = require('keccak');

const hashNumber = (num) => {
  return '0x' + num.toString(16);
};

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

function ASCIIToHex(str: string): string {
    let hex = '';
    for(let n = 0; n < str.length; n++) {
        hex += str.charCodeAt(n).toString(16);
    }
    return hex;
}

/**
 * Converts an EVM ErrorMessage to a readable form. For example this :
 * 0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d53657420746f2072657665727400000000000000000000000000000000000000
 * will be converted to "Set to revert"
 * @param message
 */
const decodeErrorMessage = (message?: string): string => {
    if (!message) return '';
    message = message.replace(/^0x/, "");   // Remove the starting 0x
    const strLen = parseInt(message.slice(8 + 64, 8 + 128), 16);  // Get the length of the readable text
    const resultCodeHex = message.slice(8 + 128, 8 + 128 + strLen * 2); // Extract the hex of the text
    return hexToASCII(resultCodeHex);
};


const encodeErrorMessage = (message?: string, signature?: string): string => {
    const offsetBites = 32;

    let dataOffset = '';
    let dataLength = '';
    let data = '';
    let sig = '';

    if (message?.length) {
        if (!signature) signature = 'Error(string)';

        sig = createHash('keccak256').update(signature).digest('hex').substring(0, 8);
        dataOffset = Number(offsetBites).toString(16).padStart(64, '0');
        dataLength = Number(message.length).toString(16).padStart(64, '0');

        data = ASCIIToHex(message).padEnd(64, '0');
    }


    return `0x${sig}${dataOffset}${dataLength}${data}`;
};


export { hashNumber, formatRequestIdMessage, hexToASCII, decodeErrorMessage, encodeErrorMessage };
