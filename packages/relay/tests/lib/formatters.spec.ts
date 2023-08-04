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
import {
    hexToASCII, decodeErrorMessage, formatTransactionId, parseNumericEnvVar, formatTransactionIdWithoutQueryParams,
    numberTo0x, formatContractResult, prepend0x, nullableNumberTo0x, nanOrNumberTo0x, toHash32, toNullableBigNumber, toNullIfEmptyHex
} from '../../src/formatters';
import constants from '../../src/lib/constants';
import { BigNumber as BN } from "bignumber.js";

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
        });

        it('should return null on empty', () => {
          expect(formatTransactionId('')).to.eq(null);
        });
      });
    
    describe('formatTransactionIdWithoutQueryParams', () => {
        const validInputTimestamp = '0.0.2@1234567890.123456789?nonce=1';
        const validOutputTimestamp = '0.0.2-1234567890-123456789';
        const invalidInputTimestamp = '0.0.2@12345678222.123456789?nonce=1';
    
        it('should return correct formated transaction id', () => {
          expect(formatTransactionIdWithoutQueryParams(validInputTimestamp)).to.eq(validOutputTimestamp);
        });
    
        it('should return null', () => {
          expect(formatTransactionIdWithoutQueryParams(invalidInputTimestamp)).to.eq(null);
        });
    
        it('should return null on empty', () => {
          expect(formatTransactionIdWithoutQueryParams('')).to.eq(null);
        });
    });
    

    describe('parseNumericEnvVar', () => {
        before(() => {
            process.env.TEST_ONLY_ENV_VAR_EMPTYSTRING = '';
            process.env.TEST_ONLY_ENV_VAR_NONNUMERICSTRING = 'foobar';
            process.env.TEST_ONLY_ENV_VAR_NUMERICSTRING = '12345';
        });

        after(() => {
            process.env.TEST_ONLY_ENV_VAR_EMPTYSTRING = undefined;
            process.env.TEST_ONLY_ENV_VAR_NONNUMERICSTRING = undefined;
            process.env.TEST_ONLY_ENV_VAR_NUMERICSTRING = undefined;
        });

        it('should use default value when env var is undefined', () => {
            const value =
                parseNumericEnvVar('TEST_ONLY_ENV_VAR_UNDEFINED', 'ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT');
            expect(isNaN(value)).to.equal(false, 'should not be NaN');
            expect(value).to.equal(constants.ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT);
        });

        it('should use default value when env var is empty string', () => {
            const value =
                parseNumericEnvVar('TEST_ONLY_ENV_VAR_EMPTYSTRING', 'ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT');
            expect(isNaN(value)).to.equal(false, 'should not be NaN');
            expect(value).to.equal(constants.ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT);
        });

        it('should use default value when env var is non-numeric string', () => {
            const value =
                parseNumericEnvVar('TEST_ONLY_ENV_VAR_NONNUMERICSTRING', 'ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT');
            expect(isNaN(value)).to.equal(false, 'should not be NaN');
            expect(value).to.equal(constants.ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT);
        });

        it('should throw when env var is any non-parseable value and constant is any non-parseable value', () => {
            let value: any = undefined;
            expect(function () {
                value = parseNumericEnvVar('TEST_ONLY_ENV_VAR_NONNUMERICSTRING', 'TYPE_ACCOUNT');
            }).to.throw(
                Error,
                "Unable to parse numeric env var: 'TEST_ONLY_ENV_VAR_NONNUMERICSTRING', constant: 'TYPE_ACCOUNT'",
                'throws when unable to parse both',
            );
            expect(value).to.be.undefined;
        });

        it('should throw when env var is any non-parseable value and constant does not exist', () => {
            let value: any = undefined;
            expect(function () {
                value = parseNumericEnvVar('TEST_ONLY_ENV_VAR_NONNUMERICSTRING', 'FOO_BAR');
            }).to.throw(
                Error,
                "Unable to parse numeric env var: 'TEST_ONLY_ENV_VAR_NONNUMERICSTRING', constant: 'FOO_BAR'",
                'throws when unable to parse both',
            );
            expect(value).to.be.undefined;
        });

        it('should use specified value when env var is numeric string', () => {
            const value =
                parseNumericEnvVar('TEST_ONLY_ENV_VAR_NUMERICSTRING', 'ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT');
            expect(isNaN(value)).to.equal(false, 'should not be NaN');
            expect(value).to.equal(12345);
        });
    });

    describe('formatContractResult', () => {
        const contractResult = {
            amount: 0,
            from: '0x05fba803be258049a27b820088bab1cad2058871',
            function_parameters: '0x08090033',
            gas_used: 400000,
            to: '0x0000000000000000000000000000000000000409',
            hash: '0xfc4ab7133197016293d2e14e8cf9c5227b07357e6385184f1cd1cb40d783cfbd',
            block_hash: '0xb0f10139fa0bf9e66402c8c0e5ed364e07cf83b3726c8045fabf86a07f4887130e4650cb5cf48a9f6139a805b78f0312',
            block_number: 528,
            transaction_index: 9,
            chain_id: '0x12a',
            gas_price: '0x',
            max_fee_per_gas: '0x59',
            max_priority_fee_per_gas: '0x',
            r: '0x2af9d41244c702764ed86c5b9f1a734b075b91c4d9c65e78bc584b0e35181e42',
            s: '0x3f0a6baa347876e08c53ffc70619ba75881841885b2bd114dbb1905cd57112a5',
            type: 2,
            v: 1,
            nonce: 2
        };

        it('should return null if null is passed', () => {
            expect(formatContractResult(null)).to.equal(null);
        });

        it('should return a valid match', () => {
            const formattedResult: any = formatContractResult(contractResult);
            expect(formattedResult.accessList).to.equal(undefined);
            expect(formattedResult.blockHash).to.equal('0xb0f10139fa0bf9e66402c8c0e5ed364e07cf83b3726c8045fabf86a07f488713');
            expect(formattedResult.blockNumber).to.equal('0x210');
            expect(formattedResult.chainId).to.equal('0x12a');
            expect(formattedResult.from).to.equal('0x05fba803be258049a27b820088bab1cad2058871');
            expect(formattedResult.gas).to.equal('0x61a80');
            expect(formattedResult.gasPrice).to.equal(null);
            expect(formattedResult.hash).to.equal('0xfc4ab7133197016293d2e14e8cf9c5227b07357e6385184f1cd1cb40d783cfbd');
            expect(formattedResult.input).to.equal('0x08090033');
            expect(formattedResult.maxPriorityFeePerGas).to.equal(null);
            expect(formattedResult.maxFeePerGas).to.equal('0x59');
            expect(formattedResult.nonce).to.equal('0x2');
            expect(formattedResult.r).to.equal('0x2af9d41244c702764ed86c5b9f1a734b075b91c4d9c65e78bc584b0e35181e42');
            expect(formattedResult.s).to.equal('0x3f0a6baa347876e08c53ffc70619ba75881841885b2bd114dbb1905cd57112a5');
            expect(formattedResult.to).to.equal('0x0000000000000000000000000000000000000409');
            expect(formattedResult.transactionIndex).to.equal('0x9');
            expect(formattedResult.type).to.equal('0x2');
            expect(formattedResult.v).to.equal('0x1');
            expect(formattedResult.value).to.equal('0x0');
        });

        it('should return nullable fields', () => {
            const formattedResult: any = formatContractResult({
                ...contractResult,
                block_number: null,
                gas_used: null,
                gas_price: '0x',
                max_priority_fee_per_gas: '0x',
                max_fee_per_gas: '0x',
                nonce: null,
                r: null,
                s: null,
                transaction_index: null,
                type: null,
                v: null,
                value: null
            });
            expect(formattedResult.accessList).to.equal(undefined);
            expect(formattedResult.blockHash).to.equal('0xb0f10139fa0bf9e66402c8c0e5ed364e07cf83b3726c8045fabf86a07f488713');
            expect(formattedResult.blockNumber).to.equal(null);
            expect(formattedResult.chainId).to.equal('0x12a');
            expect(formattedResult.from).to.equal('0x05fba803be258049a27b820088bab1cad2058871');
            expect(formattedResult.gas).to.equal('0x0');
            expect(formattedResult.gasPrice).to.equal(null);
            expect(formattedResult.hash).to.equal('0xfc4ab7133197016293d2e14e8cf9c5227b07357e6385184f1cd1cb40d783cfbd');
            expect(formattedResult.input).to.equal('0x08090033');
            expect(formattedResult.maxPriorityFeePerGas).to.equal(null);
            expect(formattedResult.maxFeePerGas).to.equal(null);
            expect(formattedResult.nonce).to.equal('0x0');
            expect(formattedResult.r).to.equal(null);
            expect(formattedResult.s).to.equal(null);
            expect(formattedResult.to).to.equal('0x0000000000000000000000000000000000000409');
            expect(formattedResult.transactionIndex).to.equal(null);
            expect(formattedResult.type).to.equal(null);
            expect(formattedResult.v).to.equal('0x0');
            expect(formattedResult.value).to.equal('0x0');
        });
    });

    describe('prepend0x', () => {
        it('should add a prefix if there is no one', () => {
            expect(prepend0x('5644')).to.equal('0x5644');
        });
        it('should not add prefix if the string is already prefixed', () => {
            expect(prepend0x('0x5644')).to.equal('0x5644');
        });
    });

    describe('numberTo0x', () => {
        it('should convert to hex a number type', () => {
            expect(numberTo0x(1009)).to.equal('0x3f1');
        });
        it('should convert to hex a BigInt type', () => {
            expect(numberTo0x(BigInt(6234))).to.equal('0x185a');
        });
    });

    describe('nullableNumberTo0x', () => {
        it('should be able to accept null', () => {
            expect(nullableNumberTo0x(null)).to.equal(null);
        });
        it('should convert a valid number to hex', () => {
            expect(nullableNumberTo0x(3867)).to.equal('0xf1b');
        });
    });

    describe('nanOrNumberTo0x', () => {
        it('should return null for nullable input', () => {
            expect(nanOrNumberTo0x(null)).to.equal('0x0');
        });
        it('should return 0x0 for Nan input', () => {
            expect(nanOrNumberTo0x(NaN)).to.equal('0x0');
        });
        it('should convert a number', () => {
            expect(nanOrNumberTo0x(593)).to.equal('0x251');
        });
    });

    describe('toHash32', () => {
        it('should format more than 32 bytes hash to 32 bytes', () => {
            expect(toHash32('0x9af1252ea00af08c2ebc78f35a6071a3736795dc53027ea746d710c46b0ef011dc4460630cf109972dafa76c4a56f530'))
              .to.equal('0x9af1252ea00af08c2ebc78f35a6071a3736795dc53027ea746d710c46b0ef011');
        });
        it('should format exactly 32 bytes hash to 32 bytes', () => {
            const hash32bytes = '0x92b761fa12ed062122c962dd84fce75ed6659e5bca328b6bb08077ff249682a';
            expect(toHash32(hash32bytes))
              .to.equal(hash32bytes);
        });
    });

    describe('toNullableBigNumber', () => {
        it('should return null for null input', () => {
            expect(toNullableBigNumber(null)).to.equal(null);
        });
        it('should convert a valid hex to BigNumber', () => {
            const bigNumberString = '0x9af1252ea00af08c2ebc78f35a6071a3736795dc53027ea746d710c46b0ef011dc4460630cf109972dafa76c4a56f530';
            expect(toNullableBigNumber(bigNumberString))
              .to.equal(new BN(bigNumberString).toString());
        });
    });

    describe('toNullIfEmptyHex', () => {
        it('should return null for empty hex', () => {
            expect(toNullIfEmptyHex('0x')).to.equal(null);
        });
        it('should return value for non-nullable input', () => {
            const value = '2911';
            expect(toNullIfEmptyHex(value)).to.equal(value);
        });
    });
});
