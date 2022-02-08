import {Eth} from '../index';

export class EthImpl implements Eth {
    // TODO: We should have a legit block number, and we should get it from the mirror node
    blockNumber() {
        return Date.now();
    }

    // TODO Somehow compute the amount of gas for this request...
    estimateGas(): number {
        return 0x10000;
    }

    // TODO Somehow get the account balance... even for testing I need to fake this better
    getBalance(): number {
        return 0x10000000000000000;
    }

    // TODO Need to return contract code. For built in accounts we need some fake contract code...?
    getCode(): number {
        return 0x8239283283283823;
    }

    // TODO This needs to be customizable via env variables
    chainId(): number {
        return 0x127;
    }

    // TODO This is a totally fake implementation
    getBlockByHash(hash : string): any {
        const blockNum = "0x" + Date.now()
        return {
            "difficulty": "0x1",
            "extraData": "",
            "gasLimit": "0xe4e1c0",
            "gasUsed": "0x0",
            "hash": hash,
            "logsBloom": "0x0",
            "miner": "",
            "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "nonce": "0x0000000000000000",
            "number": blockNum,
            "parentHash": "0x0",
            "receiptsRoot": "0x0",
            "sha3Uncles": "0x0",
            "size": "0x0",
            "stateRoot": "0x0",
            "timestamp": blockNum,
            "totalDifficulty": blockNum,
            "transactions": [],
            "transactionsRoot": "0x00",
            "uncles": []
        }
    }

    // TODO This is a totally fake implementation
    getBlockByNumber(blockNum : number): any {
        return {
            "difficulty": "0x1",
            "extraData": "",
            "gasLimit": "0xe4e1c0",
            "gasUsed": "0x0",
            "hash": "0x1fb2230a6b5bf856bb4df3c80cbf95b84454169a5a133fffaf8505a05f960aeb",
            "logsBloom": "0x0",
            "miner": "",
            "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "nonce": "0x0000000000000000",
            "number": blockNum,
            "parentHash": "0x0",
            "receiptsRoot": "0x0",
            "sha3Uncles": "0x0",
            "size": "0x0",
            "stateRoot": "0x0",
            "timestamp": blockNum,
            "totalDifficulty": blockNum,
            "transactions": [],
            "transactionsRoot": "0x00",
            "uncles": []
        }
    }

    gasPrice(): number {
        return 0x2f;
    }

    getTransactionCount(): number {
        return 0x1;
    }
}
