/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import pino from "pino";
// @ts-ignore
import { SubscriptionController } from "../../src/lib/subscriptionController";
import { expect } from "chai";
import { Poller } from "../../src/lib/poller";
import { EthImpl } from "../../src/lib/eth";
import sinon from "sinon";
import dotenv from "dotenv";
import path from "path";
import { Registry } from "prom-client";
import ConnectionLimiter from "@hashgraph/json-rpc-ws-server/dist/ConnectionLimiter";

dotenv.config({ path: path.resolve(__dirname, "../test.env") });

const logger = pino();
const register = new Registry();
const limiter = new ConnectionLimiter(logger, register);
let ethImpl: EthImpl;
let poller: Poller;

class MockWsConnection {
  id: string;
  limiter: ConnectionLimiter;

  constructor(id: string) {
    this.id = id;
    this.limiter = limiter;
  }

  send(msg) {
    console.log(`Mocked ws-connection with id: ${this.id} used method: send(${msg}`);
  }
}

describe("subscriptionController", async function () {
  this.timeout(20000);
  let subscriptionController: SubscriptionController;
  let sandbox;

  this.beforeAll(() => {
    // @ts-ignore
    ethImpl = sinon.createStubInstance(EthImpl);
    const registry = new Registry();
    poller = new Poller(ethImpl, logger, registry);

    subscriptionController = new SubscriptionController(poller, logger, registry);
  });

  this.beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  this.afterEach(() => {
    sandbox.restore();
  });

  it("Should create sha256 hash out of a data object", async function () {
    const dataToHash = "This is a Test";

    const hash = subscriptionController.createHash(dataToHash);

    expect(hash).to.be.eq(`401b022b962452749726ba96d436921e39d6deb2b0f4a922cc3da5d7e99e6e46`);
  });

  it("generateId should create a random hex ID, with 34 length", async function () {
    const generatedId = subscriptionController.generateId();

    expect(generatedId).to.be.length(34);
    expect(generatedId.substring(0, 2)).to.be.eq("0x");
  });

  it("generatedId should be unique", async () => {
    const generatedId = subscriptionController.generateId();
    const generatedId2 = subscriptionController.generateId();

    expect(generatedId).not.to.be.eq(generatedId2);
    expect(generatedId.substring(0, 2)).to.be.eq("0x");
    expect(generatedId2.substring(0, 2)).to.be.eq("0x");
  });

  it("when subscribing should return subId and poller should add(tag)", async function () {
    const connectionId = "1";
    const wsConnection = new MockWsConnection(connectionId);
    const spy = sandbox.spy(poller, "add");

    const subId = subscriptionController.subscribe(wsConnection, "logs");

    expect(spy.getCall(0).args[0]).to.be.eq(`{"event":"logs"}`);
    expect(subId).to.be.length(34);
  });

  it("notifySubscribers should notify subscribers with data", async function () {
    const connectionId = "2";
    const wsConnection = new MockWsConnection(connectionId);
    const subId = subscriptionController.subscribe(wsConnection, "logs");
    const spy = sandbox.spy(wsConnection, "send");
    const testData = "test example data";

    subscriptionController.notifySubscribers(`{"event":"logs"}`, testData);

    expect(spy.getCall(0).args[0]).to.be.eq(
      `{"method":"eth_subscription","params":{"result":"${testData}","subscription":"${subId}"}}`,
    );
  });

  it("notifySubscribers should notify multiple subscribers with data", async function () {
    const connectionId1 = "12";
    const connectionId2 = "13";
    const wsConnection1 = new MockWsConnection(connectionId1);
    const subId1 = subscriptionController.subscribe(wsConnection1, "logs");
    const spy1 = sandbox.spy(wsConnection1, "send");
    const wsConnection2 = new MockWsConnection(connectionId2);
    const subId2 = subscriptionController.subscribe(wsConnection2, "logs");
    const spy2 = sandbox.spy(wsConnection2, "send");
    const testData = "test example data";

    subscriptionController.notifySubscribers(`{"event":"logs"}`, testData);

    expect(spy1.getCall(0).args[0]).to.be.eq(
      `{"method":"eth_subscription","params":{"result":"${testData}","subscription":"${subId1}"}}`,
    );
    expect(spy2.getCall(0).args[0]).to.be.eq(
      `{"method":"eth_subscription","params":{"result":"${testData}","subscription":"${subId2}"}}`,
    );
  });

  it("notifySubscribers should use cache to not send the data again", async function () {
    const connectionId = "4";
    const wsConnection = new MockWsConnection(connectionId);
    const subId = subscriptionController.subscribe(wsConnection, "logs");
    const spy = sandbox.spy(wsConnection, "send");
    const testData = "test example data cached";

    subscriptionController.notifySubscribers(`{"event":"logs"}`, testData);
    subscriptionController.notifySubscribers(`{"event":"logs"}`, testData); // should hit cache
    subscriptionController.notifySubscribers(`{"event":"logs"}`, testData); // should hit cache

    expect(spy.getCall(0).args[0]).to.be.eq(
      `{"method":"eth_subscription","params":{"result":"${testData}","subscription":"${subId}"}}`,
    );
    expect(spy.callCount).to.be.eq(1); // even after making 3 calls, only 1 time spy reports being called on send method
  });

  it("notifySubscribers using a Tag that has no subscribers should not send anything to connection", async function () {
    const connectionId = "5";
    const wsConnection = new MockWsConnection(connectionId);
    subscriptionController.subscribe(wsConnection, "logs");
    const spy = sandbox.spy(wsConnection, "send");
    const testData = "test example data cached";

    subscriptionController.notifySubscribers(
      `{"event":"logs" filters:{"topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]}}`,
      testData,
    );

    expect(spy.callCount).to.be.eq(0);
  });

  it("Unsubscribing all subscriptions from same connection", async function () {
    const connectionId = "6";
    const wsConnection = new MockWsConnection(connectionId);
    const tag1 = { event: "logs" };
    const tag2 = {
      event: "logs",
      filters: { topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"] },
    };
    const subId = subscriptionController.subscribe(wsConnection, tag1.event);
    const subId2 = subscriptionController.subscribe(wsConnection, tag2.event, tag2.filters);
    const loggerDebugSpy = sandbox.spy(logger, "debug");
    const loggerInfoSpy = sandbox.spy(logger, "info");

    const count = subscriptionController.unsubscribe(wsConnection);

    expect(count).to.be.eq(2);
    expect(loggerInfoSpy.calledWith(`Connection ${wsConnection.id}: Unsubscribing from all subscriptions`)).to.be.eq(
      true,
    );
    expect(
      loggerDebugSpy.calledWith(
        `Connection ${wsConnection.id}. Unsubscribing subId: ${subId}; tag: ${JSON.stringify(tag1)}`,
      ),
    ).to.be.eq(true);
    expect(
      loggerDebugSpy.calledWith(
        `Connection ${wsConnection.id}. Unsubscribing subId: ${subId2}; tag: ${JSON.stringify(tag2)}`,
      ),
    ).to.be.eq(true);
  });

  it("Unsubscribing single subscriptions from connection", async function () {
    const connectionId = "7";
    const wsConnection = new MockWsConnection(connectionId);
    const tag1 = { event: "logs" };
    const tag2 = {
      event: "logs",
      filters: { topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"] },
    };
    subscriptionController.subscribe(wsConnection, tag1.event);
    const subId2 = subscriptionController.subscribe(wsConnection, tag2.event, tag2.filters);
    const loggerDebugSpy = sandbox.spy(logger, "debug");
    const loggerInfoSpy = sandbox.spy(logger, "info");

    const count = subscriptionController.unsubscribe(wsConnection, subId2);

    expect(count).to.be.eq(1);
    expect(loggerInfoSpy.calledWith(`Connection ${wsConnection.id}: Unsubscribing from ${subId2}`)).to.be.eq(true);
    expect(
      loggerDebugSpy.calledWith(
        `Connection ${wsConnection.id}. Unsubscribing subId: ${subId2}; tag: ${JSON.stringify(tag2)}`,
      ),
    ).to.be.eq(true);
  });

  it("Unsubscribing without a valid subscription or ws conn should return true", async function () {
    const connectionId = "6";
    const wsConnection = new MockWsConnection(connectionId);
    const notRealSubId = "0x123456";

    const count = subscriptionController.unsubscribe(wsConnection, notRealSubId);

    expect(count).to.be.eq(0);
  });

  it("Subscribing to the same event and filters should return the same subscription id", async function () {
    const connectionId = "7";
    const wsConnection = new MockWsConnection(connectionId);
    const tag1 = {
      event: "logs",
      filters: { topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"] },
    };
    const subId = subscriptionController.subscribe(wsConnection, tag1.event);
    const subId2 = subscriptionController.subscribe(wsConnection, tag1.event);

    expect(subId).to.be.eq(subId2);
  });
});
