// SPDX-License-Identifier: Apache-2.0

export interface ITokenTransfer {
  from: string;
  to: string;
  amount?: string; // applicable only to IFungibleTokenEvents
}
