import {
  Transfer as TransferEvent
} from "../generated/ExampleHTS/ExampleHTS"
import { HTS, Transfer } from "../generated/schema"

// SCHEMA:
// id: ID! # String
// supply: BigInt!
// transfers: [Transfer!]! @derivedFrom(field: "token") # One-to-many relationship with reverse lookup
// type: TokenType!
export function handleTransfer(event: TransferEvent): void {
  let token = HTS.load(event.address.toHexString());

  if (!token) {
    token = new HTS(event.address.toHexString());
    token.type = "HTS";
    token.supply = event.params.value;
    token.save();
  }

  const transfer = new Transfer(
    event.address.toHexString() + "-" + event.transaction.hash.toHexString()
  );

  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.amount = event.params.value;
  transfer.token = token.id;
  transfer.save();
}