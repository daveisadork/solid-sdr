import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { createControlChannelFactory } from "../../src/flex/control-channel.js";
import { FlexClientClosedError } from "../../src/flex/errors.js";
import { MockWireTransportFactory } from "../helpers.js";

const descriptor: FlexRadioDescriptor = {
  serial: "1234-0001",
  model: "FLEX-6400",
  availableSlices: 2,
  availablePanadapters: 2,
  version: "3.10.10",
  host: "192.0.2.42",
  port: 4992,
  protocol: "tcp",
  nickname: "",
  callsign: "",
};

describe("createControlChannelFactory", () => {
  let factory: MockWireTransportFactory;

  beforeEach(() => {
    factory = new MockWireTransportFactory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends commands and parses responses", async () => {
    const controlFactory = createControlChannelFactory({
      transportFactory: factory,
      clock: { now: () => 1700 },
    });
    const channel = await controlFactory.connect(descriptor);
    const transport = factory.transports.at(-1);
    if (!transport) throw new Error("transport not created");

    const messages: string[] = [];
    channel.onMessage((message) => {
      messages.push(message.kind);
    });

    transport.emit("S1|slice 0 in_use=1\n");
    expect(messages).toEqual(["status"]);

    const command = channel.send("slice list");
    expect(transport.sent[0]).toBe("C1|slice list\n");

    transport.emit("R1|0|\n");
    const response = await command;
    expect(response.accepted).toBe(true);
    expect(response.sequence).toBe(1);
    expect(response.raw).toBe("R1|0|");

    await channel.close();
  });

  it("handles command rejection codes", async () => {
    const controlFactory = createControlChannelFactory({
      transportFactory: factory,
      clock: { now: () => 4242 },
    });
    const channel = await controlFactory.connect(descriptor);
    const transport = factory.transports.at(-1);
    if (!transport) throw new Error("transport not created");

    const promise = channel.send("slice list");
    expect(transport.sent[0]).toBe("C1|slice list\n");

    transport.emit("R1|50000001|Unable to assign slice\n");
    const response = await promise;
    expect(response.accepted).toBe(false);
    expect(response.code).toBe(0x50000001);
    expect(response.message).toBe("Unable to assign slice");

    await channel.close();
  });

  it("times out commands", async () => {
    vi.useFakeTimers();
    const controlFactory = createControlChannelFactory({
      transportFactory: factory,
      clock: { now: () => 1000 },
    });
    const channel = await controlFactory.connect(descriptor);

    const transport = factory.transports.at(-1);
    if (!transport) throw new Error("transport not created");

    const promise = channel.send("foo", { timeoutMs: 10 });
    expect(transport.sent[0]).toBe("C1|foo\n");

    const expectation = expect(promise).rejects.toThrow(
      "Command timed out after 10ms",
    );
    await vi.advanceTimersByTimeAsync(11);
    await expectation;

    await channel.close();
  });

  it("rejects in-flight commands when the transport closes", async () => {
    const controlFactory = createControlChannelFactory({
      transportFactory: factory,
      clock: { now: () => 2048 },
    });
    const channel = await controlFactory.connect(descriptor);
    const transport = factory.transports.at(-1);
    if (!transport) throw new Error("transport not created");

    const promise = channel.send("foo");
    transport.emitClose();

    await expect(promise).rejects.toBeInstanceOf(FlexClientClosedError);
    await channel.close();
  });
});
