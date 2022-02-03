import { assertEquals } from "https://deno.land/std@0.123.0/testing/asserts.ts";
import { superoak, IResponse } from "https://deno.land/x/superoak/mod.ts";
import app from "./server.ts";


Deno.test('net_version gets 0x123', async () => {
    const request = await superoak(app, false);
    await request.post('/')
        .set('Content-Type', 'application/json')
        .send('{"id":"123", "jsonrpc":"2.0", "method":"net_version", "params": [ null ]}')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect((res:any) => {
            assertEquals(res.body.result, '0x123')
        });
});
