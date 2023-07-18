
import { expect } from 'chai';
import { JsonRpcError } from '../src';

export default class Assertions {
    static assertRejection = async (error: JsonRpcError, method, checkMessage: boolean, thisObj, args?: any[]): Promise<any> => {
        return await expect(method.apply(thisObj, args)).to.eventually.be.rejected.and.satisfy((err) => {
            if(!checkMessage) {
                return err.code === error.code && err.name === error.name;
            }
            return err.code === error.code && err.name === error.name && err.message === error.message;
        });
    };
}

