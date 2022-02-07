export interface Bridge {
    parity() : Parity;
    web3() : Web3;
    net() : Net;
    eth() : Eth;
}

export interface Parity {
    // nextNonce();
}

export interface Web3 {
    // clientVersion();
    // sha();
}

export interface Net {
    listening() : boolean;
    peerCount() : number;
    version() : number;
}

export interface Eth {
    // getProof();
    // accounts();
    // blockNumber();
    // call();
    // coinbase();
    // estimateGas();
    // gasPrice();
    // getBalance();
    // getBlockByHash();
    // getBlockByNumber();
    // getBlockTransactionCountByHash();
    // getBlockTransactionCountByNumber();
    // getCode();
    // getLogs();
    // getStorageAt();
    // getTransactionByBlockHashAndIndex();
    // getTransactionByBLockNumberAndIndex();
    // getTransactionByHash();
    // getTransactionCount();
    // getTransactionReceipt();
    // getUncleByBlockHashAndIndex();
    // getUncleByBlockNumberAndIndex();
    // getUncleCountByBlockHash();
    // getUncleCountByBlockNumber();
    // getWork();
    // feeHistory();
    // hashrate();
    // mining();
    // protocolVersion();
    // sendRawTransaction();
    // sendTransaction();
    // sign();
    // signTransaction();
    // signTypedData();
    // submitHashrate();
    // submitWork();
    // syncing();
}

export class BridgeImpl implements Bridge {
    private parityImpl:Parity = new ParityImpl();
    private web3Impl:Web3 = new Web3Impl();
    private netImpl:Net = new NetImpl();
    private ethImpl:Eth = new EthImpl();

    parity(): Parity {
        return this.parityImpl;
    }

    web3(): Web3 {
        return this.web3Impl;
    }

    net(): Net {
        return this.netImpl;
    }

    eth(): Eth {
        return this.ethImpl;
    }
}

class ParityImpl implements Parity {
    nextNonce() {
    }

}

class Web3Impl implements Web3 {

}

class NetImpl implements Net {
    listening(): boolean {
        return false;
    }

    peerCount(): number {
        return 0;
    }

    version(): number {
        return 0x123;
    }
}

class EthImpl implements Eth {

}
