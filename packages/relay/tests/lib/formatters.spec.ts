import { expect } from 'chai';
import { hexToASCII, decodeErrorMessage } from '../../src/formatters';

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
});