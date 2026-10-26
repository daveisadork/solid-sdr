import { describe, expect, it } from "vitest";
import { buildNtpSourceCreateCommand } from "../../src/flex/ntp-source.js";
import { createConnectedRadio } from "../helpers.js";

describe("NTP sources", () => {
  it("subscribes in the handshake and parses status", async () => {
    const { radio, connection } = await createConnectedRadio();
    expect(connection.commands).toContain("sub ntp_sources all");

    connection.emitStatus(
      'S1|ntp_sources id=pool1 address=pool.ntp.org directive=pool description="Public pool" enabled=1 selected=1 prefer=1 state=selected stratum=2 reach=255',
    );
    const source = radio.ntpSource("pool1");
    expect(source?.address).toBe("pool.ntp.org");
    expect(source?.directive).toBe("pool");
    expect(source?.description).toBe("Public pool");
    expect(source?.enabled).toBe(true);
    expect(source?.selected).toBe(true);
    expect(source?.prefer).toBe(true);
    expect(source?.state).toBe("selected");
    expect(source?.stratum).toBe(2);
    expect(source?.reachability).toBe(255);

    connection.emitStatus("S2|ntp_sources id=pool1 state=unknown");
    expect(radio.ntpSource("pool1")?.stratum).toBe(-1);
    expect(radio.ntpSource("pool1")?.reachability).toBe(-1);
  });

  it("creates, enables, disables, and removes", async () => {
    const { radio, connection } = await createConnectedRadio();

    await radio.createNtpSource({
      id: "a1",
      address: "time.example.com",
      directive: "server",
      description: "My server",
      prefer: true,
    });
    expect(connection.lastCommand()).toBe(
      'ntp_sources create id=a1 address=time.example.com directive=server description="My server" prefer=1',
    );

    connection.emitStatus(
      "S1|ntp_sources id=a1 address=time.example.com directive=server enabled=1",
    );
    const source = radio.ntpSource("a1");
    await source?.setEnabled(false);
    expect(connection.lastCommand()).toBe("ntp_sources disable id=a1");
    expect(source?.enabled).toBe(false);
    await source?.setEnabled(true);
    expect(connection.lastCommand()).toBe("ntp_sources enable id=a1");

    await source?.remove();
    expect(connection.lastCommand()).toBe("ntp_sources remove id=a1");
    connection.emitStatus("S2|ntp_sources id=a1 removed");
    expect(radio.ntpSource("a1")).toBeUndefined();
  });

  it("resubscribes to the source when the radio refuses an enable change", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|ntp_sources id=a1 address=x directive=server enabled=1",
    );
    connection.prepareResponse("ntp_sources disable", {
      code: 0x50000001,
      message: "gone",
    });
    const source = radio.ntpSource("a1");
    await expect(source?.setEnabled(false)).rejects.toThrow();
    expect(connection.lastCommand()).toBe("sub ntp_sources a1");
    connection.emitStatus(
      "S2|ntp_sources id=a1 address=x directive=server enabled=1",
    );
    expect(source?.enabled).toBe(true);
  });

  it("validates fields before sending", async () => {
    const base = {
      id: "a1",
      address: "h.example",
      directive: "server" as const,
    };
    expect(() => buildNtpSourceCreateCommand({ ...base, id: "-a" })).toThrow(
      RangeError,
    );
    expect(() => buildNtpSourceCreateCommand({ ...base, id: "a-" })).toThrow(
      RangeError,
    );
    expect(() =>
      buildNtpSourceCreateCommand({ ...base, id: "x".repeat(65) }),
    ).toThrow(RangeError);
    expect(() =>
      buildNtpSourceCreateCommand({ ...base, address: "bad host" }),
    ).toThrow(RangeError);
    expect(() =>
      buildNtpSourceCreateCommand({ ...base, address: "a".repeat(254) }),
    ).toThrow(RangeError);
    expect(() =>
      buildNtpSourceCreateCommand({ ...base, description: 'say "hi"' }),
    ).toThrow(RangeError);
    expect(() =>
      buildNtpSourceCreateCommand({ ...base, description: "d".repeat(63) }),
    ).toThrow(RangeError);
    expect(() =>
      buildNtpSourceCreateCommand({ ...base, directive: "bogus" as never }),
    ).toThrow(RangeError);
    expect(
      buildNtpSourceCreateCommand({ ...base, description: "d".repeat(62) }),
    ).toContain("description=");

    const { radio, connection } = await createConnectedRadio();
    const before = connection.commands.length;
    await expect(
      radio.createNtpSource({ ...base, id: "-bad" }),
    ).rejects.toThrow(RangeError);
    expect(connection.commands).toHaveLength(before);
  });

  it("does not send a create at the 10-source cap", async () => {
    const { radio, connection } = await createConnectedRadio();
    for (let i = 0; i < 10; i += 1) {
      connection.emitStatus(
        `S${i}|ntp_sources id=s${i} address=h${i}.example directive=server enabled=1`,
      );
    }
    const before = connection.commands.length;
    await expect(
      radio.createNtpSource({
        id: "extra",
        address: "x.example",
        directive: "server",
      }),
    ).rejects.toThrow(RangeError);
    expect(connection.commands).toHaveLength(before);
  });
});
