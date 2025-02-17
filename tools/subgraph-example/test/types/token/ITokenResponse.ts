// SPDX-License-Identifier: Apache-2.0

import { ITokenEvent } from "./ITokenEvent";

export interface ITokenResponse {
  [key: string]: Array<ITokenEvent>;
}
