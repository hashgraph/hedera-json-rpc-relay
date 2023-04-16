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

import AccountId from "@hashgraph/sdk/lib/account/AccountId";
import ContractId from "@hashgraph/sdk/lib/contract/ContractId";
import constants from "./lib/constants";

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

const formatTransactionId = (transactionId: string): string | null => {
    if (!constants.TRANSACTION_ID_REGEX.test(transactionId)) {
        return null;
    }
    
    var transactionSplit = transactionId.split("@");
    const payer = transactionSplit[0];
    const timestamp = transactionSplit[1].replace(".","-");
    return `${payer}-${timestamp}`;
}

const convertLongZeroAddressToHederaAccountId = (evmAddress: string): string | null => {
    if (!evmAddress.startsWith("0x00000000000")) {
        return null;
    }

    return AccountId.fromSolidityAddress(evmAddress).toString();
}

export { hashNumber, formatRequestIdMessage, hexToASCII, decodeErrorMessage, formatTransactionId, convertLongZeroAddressToHederaAccountId };
