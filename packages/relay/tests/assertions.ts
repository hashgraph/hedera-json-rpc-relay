
import { expect } from 'chai';
import { JsonRpcError } from '../src';
import { EthImpl } from "../src/lib/eth";
import { Block, Transaction} from "../src/lib/model";
import { numberTo0x } from '../src/formatters';

export default class RelayAssertions {
    static assertRejection = async (error: JsonRpcError, method, checkMessage: boolean, thisObj, args?: any[]): Promise<any> => {
        return await expect(method.apply(thisObj, args)).to.eventually.be.rejected.and.satisfy((err) => {
            if(!checkMessage) {
                return err.code === error.code && err.name === error.name;
            }
            return err.code === error.code && err.name === error.name && err.message === error.message;
        });
    };

    static assertTransactionReceipt = (receipt, expectedReceipt) => {
        expect(receipt).to.exist;
        if (receipt == null) return;
    
        expect(this.validateHash(receipt.transactionHash, 64)).to.eq(true);
        expect(this.validateHash(receipt.blockHash, 64)).to.eq(true);
        expect(this.validateHash(receipt.from, 40)).to.eq(true);
        if (receipt.contractAddress) {
            expect(this.validateHash(receipt.contractAddress, 40)).to.eq(true);
        }
        if (receipt.to) {
            expect(this.validateHash(receipt.to, 40)).to.eq(true);
        }
        expect(this.validateHash(receipt.logsBloom, 512)).to.eq(true);
        if (receipt.root) {
            expect(this.validateHash(receipt.root, 64)).to.eq(true);
        }
    
        expect(receipt.transactionHash).to.exist;
        expect(receipt.transactionHash).to.eq(expectedReceipt.transactionHash);
        expect(receipt.transactionIndex).to.exist;
        expect(receipt.blockHash).to.eq(expectedReceipt.blockHash);
        expect(receipt.blockNumber).to.eq(expectedReceipt.blockNumber);
        expect(receipt.from).to.eq(expectedReceipt.from);
        expect(receipt.to).to.eq(expectedReceipt.to);
        expect(receipt.cumulativeGasUsed).to.eq(expectedReceipt.cumulativeGasUsed);
        expect(receipt.gasUsed).to.eq(expectedReceipt.gasUsed);
        expect(receipt.contractAddress).to.eq(expectedReceipt.contractAddress);
        expect(receipt.logs).to.deep.eq(expectedReceipt.logs);
        expect(receipt.logsBloom).to.eq(expectedReceipt.logsBloom);
        expect(receipt.root).to.eq(expectedReceipt.root);
        expect(receipt.status).to.eq(expectedReceipt.status);
        expect(receipt.effectiveGasPrice).to.eq(expectedReceipt.effectiveGasPrice);
    };
    
    static assertTransaction = (tx, expectedTx) => {
    
        expect(tx).to.exist;
        if (tx == null) return;
    
        expect(tx.accessList).to.eq(expectedTx.accessList);
        expect(tx.blockHash).to.eq(expectedTx.blockHash);
        expect(tx.blockNumber).to.eq(expectedTx.blockNumber);
        expect(tx.chainId).to.eq(expectedTx.chainId);
        expect(tx.from).to.eq(expectedTx.from);
        expect(tx.gas).to.eq(expectedTx.gas);
        expect(tx.gasPrice).to.eq(expectedTx.gasPrice);
        expect(tx.hash).to.eq(expectedTx.hash);
        expect(tx.input).to.eq(expectedTx.input);
        expect(tx.maxFeePerGas).to.eq(expectedTx.maxFeePerGas);
        expect(tx.maxPriorityFeePerGas).to.eq(expectedTx.maxPriorityFeePerGas);
        expect(tx.nonce).to.eq(numberTo0x(expectedTx.nonce));
        expect(tx.r).to.eq(expectedTx.r);
        expect(tx.s).to.eq(expectedTx.s);
        expect(tx.to).to.eq(expectedTx.to);
        expect(tx.transactionIndex).to.eq(expectedTx.transactionIndex);
        expect(tx.type).to.eq(numberTo0x(expectedTx.type));
        expect(tx.v).to.eq(numberTo0x(expectedTx.v));
        expect(tx.value).to.eq(expectedTx.value);
    };
    
    static assertBlock = (block, expectedBlock, txDetails = false) => {
        expect(block).to.exist;
        expect(block).to.not.be.null;
    
        // verify aggregated info
        expect(block.hash).equal(expectedBlock.hash);
        expect(block.gasUsed).equal(expectedBlock.gasUsed);
        expect(block.number).equal(expectedBlock.number);
        expect(block.parentHash).equal(expectedBlock.parentHash);
        expect(block.timestamp).equal(expectedBlock.timestamp);
        expect(block.transactions.length).equal(expectedBlock.transactions.length);
        for (let i = 0; i < expectedBlock.transactions.length; i++) {
            if (!txDetails) {
                expect(block.transactions[i] as string).equal(expectedBlock.transactions[i]);
            }
            else {
                expect((block.transactions[i] as Transaction).hash).equal(expectedBlock.transactions[i]);
            }
        }
    
        // verify expected constants
        this.verifyBlockConstants(block);
    };

    static validateHash = (hash: string, len?: number) => {
        let regex;
        if (len && len > 0) {
            regex = new RegExp(`^0x[a-f0-9]{${len}}$`);
        } else {
            regex = /^0x[a-f0-9]*$/;
        }
    
        return !!regex.exec(hash);
    };

    
    static verifyBlockConstants = (block: Block) => {
        expect(block.gasLimit).equal(numberTo0x(15000000));
        expect(block.baseFeePerGas).equal('0x84b6a5c400');
        expect(block.difficulty).equal(EthImpl.zeroHex);
        expect(block.extraData).equal(EthImpl.emptyHex);
        expect(block.miner).equal(EthImpl.zeroAddressHex);
        expect(block.mixHash).equal(EthImpl.zeroHex32Byte);
        expect(block.nonce).equal(EthImpl.zeroHex8Byte);
        expect(block.receiptsRoot).equal(EthImpl.zeroHex32Byte);
        expect(block.sha3Uncles).equal(EthImpl.emptyArrayHex);
        expect(block.stateRoot).equal(EthImpl.zeroHex32Byte);
        expect(block.totalDifficulty).equal(EthImpl.zeroHex);
        expect(block.uncles).to.deep.equal([]);
    };
}

