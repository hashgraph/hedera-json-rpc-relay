import { BigInt } from "@graphprotocol/graph-ts";
import { Greeter, GreetingSet } from "../generated/Greeter/Greeter";
import { Greeting } from "../generated/schema";

export function handleGreetingSet(event: GreetingSet): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = Greeting.load(event.transaction.hash.toHexString());

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (!entity) {
    entity = new Greeting(event.transaction.hash.toHex());
  }

  // Entity fields can be set based on event parameters
  entity.greeting = event.params.greeting;

  // Entities can be written to the store with `.save()`
  entity.save();
}
