/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

import { app, httpApp } from "./webSocketServer";
import constants from "@hashgraph/json-rpc-relay/dist/lib/constants";

async function main() {
  app.listen({ port: constants.WEB_SOCKET_PORT });
  httpApp.listen({ port: constants.WEB_SOCKET_HTTP_PORT });
}

(async () => {
  await main();
})();
