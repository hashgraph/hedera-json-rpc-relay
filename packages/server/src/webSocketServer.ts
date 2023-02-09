import Koa from 'koa';
import jsonResp from './koaJsonRpc/lib/RpcResponse';
import websockify from 'koa-websocket';


// the magic happens right here
const app = websockify(new Koa(), {});

const SUBSCRIPTION_ID = '0x9ce59a13059e417087c02d3236a0b1cc';
const CHAIN_ID = '0x1234';

app.ws.use((ctx) => {
    ctx.websocket.on('message', function(msg) {
        const base64 = msg.toString('base64');
        const request = JSON.parse(Buffer.from(base64, 'base64').toString('ascii'));
        const {method, params} = request;

        if (method === 'eth_subscribe') {
            const event = params[0];
            const filter = params[1];

            ctx.websocket.send(JSON.stringify(jsonResp(request.id, null, SUBSCRIPTION_ID)));

            setInterval(() => {
                ctx.websocket.send(JSON.stringify({
                    method: 'eth_subscription',
                    params: {
                        result:
                            {
                                "address": "0x07865c6e87b9f70255377e024ace6630c1eaa37f",
                                "topics": [
                                    "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
                                    "0x000000000000000000000000700551055c4efd25a7ce9d9e6ce0b3ec126d3909",
                                    "0x0000000000000000000000007728ebf957c39e0ef55fb65bac49ef40c82422a3"
                                ],
                                "data": "0x00000000000000000000000000000000000000000000000000000000000f4240",
                                "blockNumber": "0x807fdc",
                                "transactionHash": "0xc79166c9d56f04e26562a0c479e9c0e46a0a7973993bcd22b94e6382b4c5b07f",
                                "transactionIndex": "0x17",
                                "blockHash": "0xac9655fba9d7288b9a3d42f772430c37b312418a4890cd6f6a88c8dc4d335feb",
                                "logIndex": "0x2b",
                                "removed": false
                            }
                        ,
                        subscription: SUBSCRIPTION_ID
                    }
                }));
            }, 3000);
        }

        else if(method === 'eth_chainId') {
            ctx.websocket.send(JSON.stringify(jsonResp(request.id, null, CHAIN_ID)));
        }
    });

    ctx.websocket.on('error', console.error);

    ctx.websocket.on('close', function () {
        console.log('stopping client interval');
    });

});

export default app;