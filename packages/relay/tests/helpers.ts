/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import {expect} from "chai";

const expectUnsupportedMethod = (result) => {
    expect(result).to.have.property('code');
    expect(result.code).to.be.equal(-32601);
    expect(result).to.have.property('name');
    expect(result.name).to.be.equal('Method not found');
    expect(result).to.have.property('message');
    expect(result.message).to.be.equal('Unsupported JSON-RPC method');
};

const mockData = {
    accountEvmAddress: '0x00000000000000000000000000000000000003f6',
    account: {
        "account": "0.0.1014",
        "alias": null,
        "auto_renew_period": 7776000,
        "balance": {
            "balance": 0,
            "timestamp": "1654168500.007651338",
            "tokens": []
        },
        "deleted": false,
        "ethereum_nonce": null,
        "evm_address": "0x00000000000000000000000000000000000003f6",
        "expiry_timestamp": null,
        "key": {
            "_type": "ED25519",
            "key": "0aa8e21064c61eab86e2a9c164565b4e7a9a4146106e0a6cd03a8c395a110e92"
        },
        "max_automatic_token_associations": 0,
        "memo": "",
        "receiver_sig_required": null,
        "transactions": [],
        "links": {
            "next": null
        }
    },

    contractEvmAddress: '0000000000000000000000000000000000001f41',
    contract: {
        'contract_id': '0.0.2000',
        'evm_address': '0000000000000000000000000000000000001f41',
        'file_id': '0.0.1000',
        'obtainer_id': '0.0.3000',
        'timestamp': {
            'from': '1651560386.060890949',
            'to': null
        }
    },

    notFound: {
        "_status": {
            "messages": [
                {
                    "message": "Not found"
                }
            ]
        }
    }
};

export {expectUnsupportedMethod, mockData};
