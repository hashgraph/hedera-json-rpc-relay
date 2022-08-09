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

import constants from "./lib/constants";

const hashNumber = (num) => {
  return '0x' + num.toString(16);
};

  /**
   * Format message prefix for logger.
   */
const formatRequestIdMessage = (requestId?: string): string => {
    return requestId ? `[${constants.REQUEST_ID_STRING}${requestId}]` : '';
}

export { hashNumber, formatRequestIdMessage };
