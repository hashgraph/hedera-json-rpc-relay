import {expect} from "chai";

const expectUnsupportedMethod = (result) => {
    expect(result).to.have.property('code');
    expect(result.code).to.be.equal(-32601);
    expect(result).to.have.property('name');
    expect(result.name).to.be.equal('Method not found');
    expect(result).to.have.property('message');
    expect(result.message).to.be.equal('Unsupported JSON-RPC method');
};

export {expectUnsupportedMethod};