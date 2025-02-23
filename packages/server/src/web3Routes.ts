/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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
const defineWeb3Routes = function (app, relay, logAndHandleResponse) {
  app.useRpc('web3_clientVersion', async () => {
    return logAndHandleResponse('web3_clientVersion', [], () => relay.web3().clientVersion());
  });

  app.useRpc('web3_sha3', async (params: any) => {
    return logAndHandleResponse('web3_sha3', params, () => relay.web3().sha3(params?.[0]));
  });
};

export { defineWeb3Routes };
