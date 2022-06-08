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

import dotenv from 'dotenv';
import findConfig from 'find-config';

import app from './server';

dotenv.config({ path: findConfig('.env') || '' });
const jrpcPath: string = process.env.SERVER_PATH || 'v1';
const jrpcPort: string = process.env.SERVER_PORT || '7546';

async function main() {
  app.listen({
    path: jrpcPath,
    port: Number(jrpcPort)
  });
}

main();
