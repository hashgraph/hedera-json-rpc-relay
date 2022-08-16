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

import { Trace } from '../index';
import { Logger } from 'pino';
import { MirrorNodeClient, SDKClient } from './clients';
import { formatRequestIdMessage } from '../formatters';

/**
 * Implementation of the "trace_" methods from the Ethereum JSON-RPC API.
 * Methods are implemented by delegating to the mirror node or to a
 * consensus node in the main network.
 *
 * FIXME: This class is a work in progress because everything we need is
 * not currently supported by the mirror nodes. As such, we have a lot
 * of fake stuff in this class for now for the purpose of demos and POC.
 */
export class TraceImpl implements Trace {
    /**
     * The sdk client use for connecting to both the consensus nodes and mirror node. The account
     * associated with this client will pay for all operations on the main network.
     *
     * @private
     */
    private readonly sdkClient: SDKClient;

    /**
     * The interface through which we interact with the mirror node
     * @private
     */
    private readonly mirrorNodeClient: MirrorNodeClient;

    /**
     * The logger used for logging all output from this class.
     * @private
     */
    private readonly logger: Logger;

    /**
     * Create a new Eth implementation.
     * @param nodeClient
     * @param mirrorNodeClient
     * @param logger
    */
    constructor(
        nodeClient: SDKClient,
        mirrorNodeClient: MirrorNodeClient,
        logger: Logger
    ) {
        this.sdkClient = nodeClient;
        this.mirrorNodeClient = mirrorNodeClient;
        this.logger = logger;
    }

    async filter(fromBlock: string, toBlock: string, fromAddress: string[] | null, toAddress: string[] | null, after: number | null, count: number | null, requestId?: string): Promise<any[]> {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        this.logger.trace(`${requestIdPrefix} filter(fromBlock=${fromBlock}, toBlock=${toBlock}, fromAddress=${fromAddress}, toAddress=${toAddress}, after=${after}, count=${count})`);
        
        console.log({fromBlock, toBlock, fromAddress, toAddress, after, count})

        return [];
    }
}
