import { expect } from 'chai';
import { validateOpenRPCDocument, parseOpenRPCDocument } from "@open-rpc/schema-utils-js";

import openRpcSchema from "../../../../docs/openrpc.json";

describe("Open RPC Specification", () => {
    it(`validates the openrpc document`, async () => {
        const rpcDocument = await parseOpenRPCDocument(JSON.stringify(openRpcSchema));
        const isValid = validateOpenRPCDocument(rpcDocument);

        expect(isValid).to.be.true;
    });
});