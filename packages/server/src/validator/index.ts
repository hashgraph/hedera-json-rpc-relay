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

import { validateParam } from './utils';
import { IMethodValidation } from './methods';

export function validateParams(params: any[], indexes: IMethodValidation) {
  for (const index of Object.keys(indexes)) {
    const validation = indexes[Number(index)];
    const param = params[Number(index)];

    validateParam(index, param, validation);
  }
}

export * from './constants';
export * from './types';
export * from './objectTypes';
export * from './utils';
export * from './methods';
export * as Validator from '.';
