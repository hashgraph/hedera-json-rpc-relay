// SPDX-License-Identifier: Apache-2.0

import { ITokenEvent } from "./ITokenEvent";

export interface INonFungibleTokenEvent extends ITokenEvent {
  owner: string;
  tokenId: string;
}
