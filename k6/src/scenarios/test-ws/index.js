/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

import { getSequentialTestScenarios } from '../../lib/common.js';

// import test modules
import * as eth_chainId from './eth_chainId.js';
import * as eth_subscribe_logs from './eth_subscribe_logs.js';
import * as eth_subscribe_newHeads from './eth_subscribe_newHeads.js';
import * as eth_subscribe_newPendingTransactions from './eth_subscribe_newPendingTransactions.js';

// add test modules here
const tests = {
  eth_chainId,
  eth_subscribe_logs,
  eth_subscribe_newHeads,
  eth_subscribe_newPendingTransactions,
};

const { funcs, options, scenarioDurationGauge } = getSequentialTestScenarios(tests);

export { funcs, options, scenarioDurationGauge };
