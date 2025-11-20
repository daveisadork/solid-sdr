import { describe, expect, it, vi } from "vitest";
import type {
  DiscoveryAdapter,
  DiscoveryCallbacks,
  DiscoverySession,
  FlexControlChannel,
  FlexControlFactory,
  FlexRadioDescriptor,
} from "../../src/flex/adapters.js";
import { createRadioClient } from "../../src/flex/client.js";

function createStubDiscovery() {
  let handlers: DiscoveryCallbacks | undefined;
  const adapter: DiscoveryAdapter = {
    async start(startHandlers) {
      handlers = startHandlers;
      const session: DiscoverySession = {
        async stop() {
          handlers = undefined;
        },
      };
      return session;
    },
  };

  function emitOnline(descriptor: FlexRadioDescriptor) {
    handlers?.onOnline(descriptor);
  }

  function emitOffline(serial: string) {
    handlers?.onOffline?.(serial);
  }

  return { adapter, emitOnline, emitOffline };
}

const noopControlFactory: FlexControlFactory = {
  async connect() {
    const channel: FlexControlChannel = {
      async send() {
        throw new Error("not implemented");
      },
      onMessage() {
        return { unsubscribe() {} };
      },
      onRawLine() {
        return { unsubscribe() {} };
      },
      async close() {},
    };
    return channel;
  },
};

const baseDescriptor: FlexRadioDescriptor = {
  serial: "1234-5678-ABCD-EF01",
  model: "FLEX-6700",
  nickname: "Test Radio",
  callsign: "KTEST",
  availableSlices: 4,
  availablePanadapters: 2,
  version: "3.4.21",
  host: "10.0.0.5",
  port: 4992,
  protocol: "tcp",
};

describe("createRadioClient", () => {
  it("emits discovery events and seeds snapshot data", async () => {
    const discovery = createStubDiscovery();
    const client = createRadioClient(
      {
        discovery: discovery.adapter,
        control: noopControlFactory,
      },
      {},
    );

    const discovered = vi.fn();
    client.on("radioDiscovered", discovered);

    await client.startDiscovery();
    discovery.emitOnline(baseDescriptor);

    expect(discovered).toHaveBeenCalledTimes(1);
    const radios = client.getRadios();
    expect(radios).toHaveLength(1);
    const radio = radios[0];
    expect(radio.serial).toBe(baseDescriptor.serial);
    expect(radio.nickname).toBe(baseDescriptor.nickname);
    expect(radio.callsign).toBe(baseDescriptor.callsign);
    expect(radio.endpoint).toEqual({
      host: baseDescriptor.host,
      port: baseDescriptor.port,
    });

    const byEndpoint = client.radioByEndpoint({
      host: baseDescriptor.host,
      port: baseDescriptor.port,
    });
    expect(byEndpoint).toBe(radio);
  });

  it("forwards descriptor updates as radioChange events", async () => {
    const discovery = createStubDiscovery();
    const client = createRadioClient(
      {
        discovery: discovery.adapter,
        control: noopControlFactory,
      },
      {},
    );
    await client.startDiscovery();
    discovery.emitOnline(baseDescriptor);

    const radio = client.radio(baseDescriptor.serial);
    expect(radio).toBeDefined();
    const changeListener = vi.fn();
    radio?.on("radioChange", changeListener);

    discovery.emitOnline({
      ...baseDescriptor,
      nickname: "Updated Nick",
    });

    expect(changeListener).toHaveBeenCalled();
    const change = changeListener.mock.calls[0][0];
    expect(change.radioSerial).toBe(baseDescriptor.serial);
    expect(change.diff?.nickname).toBe("Updated Nick");
    expect(change.endpoint.host).toBe(baseDescriptor.host);
  });

  it("emits radioLost with endpoint info", async () => {
    const discovery = createStubDiscovery();
    const client = createRadioClient(
      {
        discovery: discovery.adapter,
        control: noopControlFactory,
      },
      {},
    );
    const lost = vi.fn();
    client.on("radioLost", lost);
    await client.startDiscovery();
    discovery.emitOnline(baseDescriptor);
    discovery.emitOffline(baseDescriptor.serial);
    expect(lost).toHaveBeenCalledWith({
      serial: baseDescriptor.serial,
      endpoint: expect.objectContaining({
        host: baseDescriptor.host,
        port: baseDescriptor.port,
      }),
    });
  });
});
