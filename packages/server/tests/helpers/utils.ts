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

import { ethers, BigNumber } from 'ethers';
import Assertions from './assertions';
import crypto from 'crypto';

export class Utils {

    static toHex = (num) => {
        return parseInt(num).toString(16);
    };

    static idToEvmAddress = (id): string => {
        Assertions.assertId(id);
        const [shard, realm, num] = id.split('.');

        return [
            '0x',
            this.toHex(shard).padStart(8, '0'),
            this.toHex(realm).padStart(16, '0'),
            this.toHex(num).padStart(16, '0')
        ].join('');
    };

    static subtractBigNumberHexes = (hex1, hex2) => {
        return BigNumber.from(hex1).sub(BigNumber.from(hex2));
    };

    static tinyBarsToWeibars = (value) => {
        return ethers.utils.parseUnits(Number(value).toString(), 10);
    };

    static randomString(length) {
        let result = '';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        for ( let i = 0; i < length; i++ ) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Generates random trace id for requests.
     *
     * returns: string
     */
    static generateRequestId = () : string => {
        return crypto.randomUUID();
    };
    
    /**
    * Format message prefix for logger.
    */
    static formatRequestIdMessage = (requestId?: string): string => {
        return requestId ? `[Request ID: ${requestId}]` : '';
    };
}
