import { expect } from 'chai';
import { JsonRpcError } from '../../../src/lib/errors/JsonRpcError';

describe('Errors', () => {
    describe('JsonRpcError', () => {
        it('Constructs correctly without request ID', () => {
            const err = new JsonRpcError({
                name: 'TestError',
                code: -32999,
                message: 'test error: foo',
                data: 'some data'
            });
            expect(err.code).to.eq(-32999);
            expect(err.name).to.eq('TestError');
            expect(err.data).to.eq('some data');

            // Check that request ID is *not* prefixed
            expect(err.message).to.eq('test error: foo');
        });

        it('Constructs correctly with request ID', () => {
            const err = new JsonRpcError({
                name: 'TestError',
                code: -32999,
                message: 'test error: foo',
                data: 'some data'
            }, 'abcd-1234');
            expect(err.code).to.eq(-32999);
            expect(err.name).to.eq('TestError');
            expect(err.data).to.eq('some data');

            // Check that request ID is prefixed
            expect(err.message).to.eq('[Request ID: abcd-1234] test error: foo');
        });
    });
});
