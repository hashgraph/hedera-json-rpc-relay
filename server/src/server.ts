import Application from 'koa';
import Router from 'koa-router';
import {METHOD_NOT_FOUND, Request, Response} from "../../bridge"
import {Bridge, BridgeImpl} from "../../bridge";

const bridge: Bridge = new BridgeImpl();
const cors = require('@koa/cors');

const router = new Router();
router.post("/", async (ctx) => {
    const req = await ctx.request.body().value as Request;
    if (req.jsonrpc == "2.0") {
        // console.log(" >>> ", req)
        switch (req.method) {
            case "net_version":
                ctx.response.body = net_version(req);
                break;
            case "eth_blockNumber":
                ctx.response.body = eth_blockNumber(req);
                break;
            case "eth_estimateGas":
                ctx.response.body = eth_estimateGas(req);
                break;
            case "eth_getBalance":
                ctx.response.body = eth_getBalance(req);
                break;
            case "eth_getCode":
                ctx.response.body = eth_getCode(req);
                break;
            case "eth_chainId":
                ctx.response.body = eth_chainID(req);
                break;
            case "eth_getBlockByNumber":
                ctx.response.body = eth_getBlockByNumber(req);
                break;
            case "eth_getBlockByHash":
                ctx.response.body = eth_getBlockByHash(req);
                break;
            case "eth_gasPrice":
                ctx.response.body = eth_gasPrice(req);
                break;
            case "eth_getTransactionCount":
                ctx.response.body = eth_getTransactionCount(req);
                break;
            case "eth_sendRawTransaction":
                ctx.response.body = eth_sendRawTransaction(req);
                break;
            case "eth_getTransactionReceipt":
                ctx.response.body = eth_getTransactionReceipt(req);
                break;
            default:
                console.log(" >>> ", req)
                console.log(" <<< ", ctx.response.body)
                ctx.response.body = {
                    id: req.id,
                    jsonrpc: "2.0",
                    error: METHOD_NOT_FOUND
                }
        }
        // console.log(" <<< ", ctx.response.body)
    }
})

const app:Application = new Application();
app.use(
    cors({
        origin: "*",
        methods: ["POST"]
    }),
);
app.use(router.routes());
app.use(router.allowedMethods());
export default app;

function net_version(req:Request): Response<string> {
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x" + bridge.net().version().toString(16)
    }
}

function eth_blockNumber(req:Request): Response<string> {
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x" + Date.now()
    }
}

function eth_estimateGas(req:Request): Response<string> {
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x10000" // TODO Somehow compute the amount of gas....
    }
}

// Eventually consistent is fine. Go to mirror node.
function eth_getBalance(req:Request): Response<string> {
    // params: [ "0xee2e81c3b855b94807d6e75f01a7a16efe43bfeb", "0x123" ]
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x10000000000000000" // TODO Somehow get the account balance... even for testing I need to fake this better
    }
}

// We should go to mirror node for this one
function eth_getCode(req: Request): Response<string> {
    // params: [ "0xee2e81c3b855b94807d6e75f01a7a16efe43bfeb", "0x123" ]
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x8239283283283823" // TODO Need to return contract code. For built in accounts we need some fake contract code...?
    }
}

// We should go to mirror node for this one
function eth_chainID(req: Request): Response<string> {
    // params: [ "0xee2e81c3b855b94807d6e75f01a7a16efe43bfeb", "0x123" ]
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x127"
    }
}

function eth_getBlockByNumber(req: Request): Response<any> {
    const blockNum = req.params?.[0]
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: {
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
}

function eth_getBlockByHash(req: Request): Response<any> {
    const hash = req.params?.[0]
    const blockNum = "0x" + Date.now()
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: {
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
}

function eth_gasPrice(req: Request): Response<any> {
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x2f"
    }
}

function eth_getTransactionCount(req: Request): Response<any> {
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x1"
    }
}


function eth_sendRawTransaction(req: Request): Response<any> {
    console.log(req.params[0])
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331" // bogus
    }
}

function eth_getTransactionReceipt(req: Request): Response<any> {
    return {
        id: req.id,
        jsonrpc: "2.0",
        "result": {
            transactionHash: req.params?.[0],
            transactionIndex: '0x1', // 1
            blockNumber: '0xb', // 11
            blockHash: '0xc6ef2fc5426d6ad6fd9e2a26abeab0aa2411b7ab17f30a99d3cb96aed1d1055b',
            cumulativeGasUsed: '0x33bc', // 13244
            gasUsed: '0x4dc', // 1244
            contractAddress: '0xb60e8dd61c5d32be8058bb8eb970870f07233155', // or null, if none was created
            logs: [
                // logs as returned by getFilterLogs, etc.
            ],
            logsBloom: "0x00...0", // 256 byte bloom filter
            status: '0x1'
        }
    }
}

