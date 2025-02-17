// SPDX-License-Identifier: Apache-2.0

import { ITokenEvent } from "./ITokenEvent";

export interface IFungibleTokenEvent extends ITokenEvent {
  supply: string;
}
