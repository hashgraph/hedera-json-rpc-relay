// SPDX-License-Identifier: Apache-2.0

import { app, httpApp } from './webSocketServer';
import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';

async function main() {
  const host = ConfigService.get('SERVER_HOST');
  app.listen({ port: constants.WEB_SOCKET_PORT, host });
  httpApp.listen({ port: constants.WEB_SOCKET_HTTP_PORT, host });
}

(async () => {
  await main();
})();
