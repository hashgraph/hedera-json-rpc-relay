import { Transfer as TransferEvent } from "../generated/ExampleERC721/ExampleERC721";
import { HTSNFT, Transfer } from "../generated/schema";

// Schema:
// id: ID! # String
// owner: Bytes! # Address
// transfers: [Transfer!]! @derivedFrom(field: "token") # One-to-many relationship with reverse lookup
// type: TokenType!
export function handleTransfer(event: TransferEvent): void {
  let token = HTSNFT.load(
    event.address.toHexString() + "-" + event.params.tokenId.toString()
  );

  if (!token) {
    token = new HTSNFT(
      event.address.toHexString() + "-" + event.params.tokenId.toString()
    );
    token.type = "HTSNFT";
    token.tokenId = event.params.tokenId;
    token.owner = event.params.to;
    token.save();
  }

  const transfer = new Transfer(
    event.address.toHexString() + "-" + event.transaction.hash.toHexString()
  );

  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.token = token.id;
  transfer.save();
}