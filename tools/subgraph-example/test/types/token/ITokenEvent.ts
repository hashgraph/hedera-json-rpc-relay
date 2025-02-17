// SPDX-License-Identifier: Apache-2.0

import { ITokenTransfer } from "./ITokenTransfer";

export interface ITokenEvent {
  id: string;
  type: string;
  transfers: Array<ITokenTransfer>;
}
