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

import app from './server';

async function main() {
  const server = await app.listen({ port: process.env.SERVER_PORT || 7546 });

  // set request timeout to ensure sockets are closed after specified time
  const requestTimeoutMs = parseInt(process.env.SERVER_REQUEST_TIMEOUT_MS!) || 30000;
  server.setTimeout(requestTimeoutMs);
}

main();
