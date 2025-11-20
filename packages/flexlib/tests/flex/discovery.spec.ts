import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createVitaDiscoveryAdapter,
  type DiscoveryTransport,
  type DiscoveryTransportFactory,
  type DiscoveryTransportHandlers,
} from "../../src/flex/discovery.js";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { VitaDiscoveryPacket } from "../../src/vita/discovery.js";

function loadPacket(filename: string): Uint8Array {
  return new Uint8Array(
    readFileSync(
      new URL(`../fixtures/vita/discovery/${filename}`, import.meta.url),
    ),
  );
}

const SAMPLE_PACKET = loadPacket("flex-8600-available.bin");
const SAMPLE_PACKET_IN_USE = loadPacket(
  "flex-8600-in-use-multi-client.bin",
);
const SAMPLE_PACKET_ONE_CLIENT = loadPacket(
  "flex-8600-available-single-client.bin",
);

class MockTransportFactory implements DiscoveryTransportFactory {
  handlers?: DiscoveryTransportHandlers;
  closed = false;

  async start(handlers: DiscoveryTransportHandlers): Promise<DiscoveryTransport> {
    this.handlers = handlers;
    return {
      close: async () => {
        this.closed = true;
      },
    };
  }

  emit(data: Uint8Array) {
    this.handlers?.onMessage(data);
  }

  emitError(error: unknown) {
    this.handlers?.onError?.(error);
  }
}

function buildPacket(payload: string): Uint8Array {
  const pkt = new VitaDiscoveryPacket();
  pkt.classId = {
    oui: 0x00001c2d,
    informationClassCode: 0x534c,
    packetClassCode: 0xffff,
  };
  pkt.payload = payload;
  return pkt.toBytes();
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createVitaDiscoveryAdapter", () => {
  it("emits descriptors for discovery packets", async () => {
    const factory = new MockTransportFactory();
    const adapter = createVitaDiscoveryAdapter({
      transportFactory: factory,
      offlineTimeoutMs: 0,
    });

    const onOnline = vi.fn<(descriptor: FlexRadioDescriptor) => void>();
    const onError = vi.fn();

    const session = await adapter.start({
      onOnline,
      onError,
    });

    factory.emit(SAMPLE_PACKET.slice());

    expect(onOnline).toHaveBeenCalledTimes(1);
    const descriptor = onOnline.mock.calls[0][0];
    expect(descriptor.serial).toBe("1225-1213-8600-7918");
    expect(descriptor.model).toBe("FLEX-8600");
    expect(descriptor.availableSlices).toBe(4);
    expect(descriptor.availablePanadapters).toBe(4);
    expect(descriptor.firmware).toBe("3.10.15.38923");
    expect(descriptor.host).toBe("10.16.83.234");
    expect(descriptor.port).toBe(4992);
    expect(descriptor.protocol).toBe("tcp");
    expect(descriptor.discoveryMeta?.wanConnected).toBe(true);
    expect(typeof descriptor.discoveryMeta?.lastSeen).toBe("number");
    expect(descriptor.discoveryMeta?.externalPortLink).toBe(true);
    expect(descriptor.discoveryMeta?.availableClients).toBe(2);
    expect(descriptor.discoveryMeta?.inUseHosts).toBeUndefined();
    expect(descriptor.guiClients).toBeUndefined();

    expect(onError).not.toHaveBeenCalled();

    await session.stop();
    expect(factory.closed).toBe(true);
  });

  it("emits offline when a radio stops reporting", async () => {
    vi.useFakeTimers();
    const factory = new MockTransportFactory();
    const adapter = createVitaDiscoveryAdapter({
      transportFactory: factory,
      offlineTimeoutMs: 1_000,
    });

    const onOnline = vi.fn<(descriptor: FlexRadioDescriptor) => void>();
    const onOffline = vi.fn<(serial: string) => void>();

    const session = await adapter.start({
      onOnline,
      onOffline,
    });

    factory.emit(SAMPLE_PACKET_ONE_CLIENT.slice());
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(onOnline.mock.calls[0][0].guiClients).toHaveLength(1);
    expect(onOffline).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(onOffline).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onOffline).toHaveBeenCalledWith("1225-1213-8600-7918");

    await session.stop();
  });

  it("reports malformed discovery payloads via onError", async () => {
    const factory = new MockTransportFactory();
    const adapter = createVitaDiscoveryAdapter({
      transportFactory: factory,
      offlineTimeoutMs: 0,
    });

    const onOnline = vi.fn();
    const onError = vi.fn();

    const session = await adapter.start({
      onOnline,
      onError,
    });

    factory.emit(
      buildPacket(
        "serial=9999-0000 model=FLEX-6400 version=3.9.10 ip=198.51.100.10 available_slices=2 available_panadapters=2",
      ),
    );

    expect(onOnline).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    const error = onError.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("port");

    await session.stop();
  });

  it("normalises metadata for radios with multiple GUI clients", async () => {
    const factory = new MockTransportFactory();
    const adapter = createVitaDiscoveryAdapter({
      transportFactory: factory,
      offlineTimeoutMs: 0,
    });

    const onOnline = vi.fn<(descriptor: FlexRadioDescriptor) => void>();

    const session = await adapter.start({
      onOnline,
    });

    factory.emit(SAMPLE_PACKET_IN_USE.slice());

    expect(onOnline).toHaveBeenCalledTimes(1);
    const descriptor = onOnline.mock.calls[0][0];
    const meta = descriptor.discoveryMeta;
    expect(meta).toBeDefined();
    expect(meta?.availableClients).toBe(0);
    expect(meta?.inUseHosts).toBe(
      "MacBook-Pro.localdomain,LAPTOP-9V8U8FDA.localdomain",
    );
    expect(meta?.inUseIps).toBe("10.16.83.154,10.16.83.60");
    expect(meta?.guiClientPrograms).toBe("SmartSDR-Mac,SmartSDR-Win");
    expect(meta?.guiClientHosts).toBe(
      "MacBook-Pro.localdomain,LAPTOP-9V8U8FDA.localdomain",
    );
    expect(meta?.guiClientStations).toBe("MacBook Pro,LAPTOP-9V8U8FDA");
    expect(meta?.guiClientHandles).toBe("0x29DD2CDC,0x7D2D0108");
    expect(meta?.guiClientIps).toBe("10.16.83.154,10.16.83.60");
    expect(descriptor.guiClients).toEqual([
      expect.objectContaining({
        handle: 0x29dd2cdc,
        program: "SmartSDR-Mac",
        station: "MacBook Pro",
      }),
      expect.objectContaining({
        handle: 0x7d2d0108,
        program: "SmartSDR-Win",
        station: "LAPTOP-9V8U8FDA",
      }),
    ]);

    await session.stop();
  });
});
