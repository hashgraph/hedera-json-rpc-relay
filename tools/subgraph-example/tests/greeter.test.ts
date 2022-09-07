import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index";
import {} from "@graphprotocol/graph-ts";
import { Greeting } from "../generated/schema";
import { GreetingSet } from "../generated/Greeter/Greeter";
import { handleGreetingSet } from "../src/greeter";
import { createGreetingSetEvent } from "./greeter-utils";

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    const greeting = "Hello there!";
    const newGreetingSetEvent = createGreetingSetEvent(greeting);
    handleGreetingSet(newGreetingSetEvent);
  });

  afterAll(() => {
    clearStore();
  });

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("Greeting created and stored", () => {
    assert.entityCount("Greeting", 1);

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default value for all hashes used in newMockEvent() function
    assert.fieldEquals(
      "Greeting",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a",
      "greeting",
      "Hello there!"
    );

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  });
});
