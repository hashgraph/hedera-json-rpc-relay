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

import { expect } from 'chai';
import { hexToASCII, decodeErrorMessage, formatTransactionId } from '../../src/formatters';

describe('Formatters', () => {
    describe('hexToASCII', () => {
        const inputs = [
            '4C6F72656D20497073756D',
            '466F6F',
            '426172'
        ];

        const outputs = [
            'Lorem Ipsum',
            'Foo',
            'Bar'
        ];

        it('Decodes correctly', () => {
            for (let i = 0; i < inputs.length; i++) {
                expect(hexToASCII(inputs[i])).to.eq(outputs[i]);
            }
        });
    });

    describe('decodeErrorMessage', () => {
        const inputs = [
            '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d53657420746f2072657665727400000000000000000000000000000000000000',
            '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013526576657274526561736f6e50617961626c6500000000000000000000000000',
            '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5075726500000000000000000000000000000000',
            '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5669657700000000000000000000000000000000'
        ];

        const outputs = [
            'Set to revert',
            'RevertReasonPayable',
            'RevertReasonPure',
            'RevertReasonView',
        ];

        it('Decodes correctly', () => {
            for (let i = 0; i < inputs.length; i++) {
                expect(decodeErrorMessage(inputs[i])).to.eq(outputs[i]);
            }
        });
    });

    describe('formatTransactionId', () => {
        const validInputTimestamp = '0.0.2@1234567890.123456789';
        const validOutputTimestamp = '0.0.2-1234567890-123456789';
        const invalidInputTimestamp = '0.0.2@12345678222.123456789';

        it('should return correct formated transaction id', () => {
            expect(formatTransactionId(validInputTimestamp)).to.eq(validOutputTimestamp);
        });

        it('should return null', () => {
            expect(formatTransactionId(invalidInputTimestamp)).to.eq(null);
        })
    })
});