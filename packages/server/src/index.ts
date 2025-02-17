// SPDX-License-Identifier: Apache-2.0

import app from './server';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { setServerTimeout } from './koaJsonRpc/lib/utils'; // Import the 'setServerTimeout' function from the correct location

async function main() {
  const server = app.listen({ port: ConfigService.get('SERVER_PORT'), host: ConfigService.get('SERVER_HOST') });

  // set request timeout to ensure sockets are closed after specified time of inactivity
  setServerTimeout(server);
}

main();
