import { newMockEvent } from "matchstick-as";
import { ethereum } from "@graphprotocol/graph-ts";
import { GreetingSet } from "../generated/Greeter/Greeter";

export function createGreetingSetEvent(greeting: string): GreetingSet {
  let greetingSetEvent = changetype<GreetingSet>(newMockEvent());

  greetingSetEvent.parameters = new Array();

  greetingSetEvent.parameters.push(
    new ethereum.EventParam("greeting", ethereum.Value.fromString(greeting))
  );

  return greetingSetEvent;
}
