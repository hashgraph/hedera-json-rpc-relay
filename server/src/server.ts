import { Application, Router } from "https://deno.land/x/oak@v10.2.0/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { Request, Response, METHOD_NOT_FOUND } from "../../bridge/src/jsonrpc.ts"
import { Bridge, BridgeImpl } from "../../bridge/src/bridge.ts";

const bridge:Bridge = new BridgeImpl();

const router = new Router();
router.post("/", async (ctx) => {
    const req = await ctx.request.body().value as Request;
    if (req.jsonrpc == "2.0") {
        console.log(req)
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
            default:
                console.log(req)
                ctx.response.body = {
                    id: req.id,
                    jsonrpc: "2.0",
                    error: METHOD_NOT_FOUND
                }
        }
    }
})

const app = new Application();
app.use(
    oakCors({
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
        result: "0x" + new Date().getUTCSeconds()
    }
}

function eth_estimateGas(req:Request): Response<string> {
    // params of request will be like:
    // params: [
    //     {
    //         from: "0xdebef78a1071c4df95e1faddd1acd8c28b6e1840",
    //         value: "0x0",
    //         gasPrice: "0x123",
    //         data: null
    //     }
    // ]

    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x1000000" // TODO Somehow compute the amount of gas....
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
function eth_getCode(req:Request): Response<string> {
    // params: [ "0xee2e81c3b855b94807d6e75f01a7a16efe43bfeb", "0x123" ]
    return {
        id: req.id,
        jsonrpc: "2.0",
        result: "0x8239283283283823" // TODO Need to return contract code. For built in accounts we need some fake contract code...?
    }
}