import { describe, expect, it } from "vitest";
import type {
  CwxStateChange,
  RadioStateChange,
} from "../../src/flex/state/index.js";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";

function asCwxChange(change: RadioStateChange | undefined): CwxStateChange {
  if (change?.entity !== "cwx") {
    throw new Error(`expected a cwx change, got ${change?.entity}`);
  }
  return change;
}

describe("CWX snapshot", () => {
  it("parses break_in_delay, wpm, qsk_enabled, and macros", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when cwx status arrives
    store.apply(makeStatus("S1|cwx break_in_delay=250 wpm=25 qsk_enabled=1"));

    // then cwx state is tracked
    const cwx = store.getCwx();
    expect(cwx).toBeDefined();
    expect(cwx?.delay).toBe(250);
    expect(cwx?.speed).toBe(25);
    expect(cwx?.qskEnabled).toBe(true);
  });

  it("parses macros from status updates", () => {
    // given a store with initial cwx state
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|cwx wpm=20"));

    // when macro status arrives (1-indexed on wire)
    store.apply(makeStatus("S2|cwx macro1=CQ macro3=73"));

    // then macros are stored (0-indexed in snapshot)
    const cwx = store.getCwx();
    expect(cwx?.macros[0]).toBe("CQ");
    expect(cwx?.macros[1]).toBe(""); // untouched slot
    expect(cwx?.macros[2]).toBe("73");
    expect(cwx?.macros).toHaveLength(12);
  });

  it("reports transient sent/erase attributes as progress, not state", () => {
    // given a store with cwx state
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|cwx wpm=20"));

    // when transient events arrive
    const changes = store.apply(makeStatus("S2|cwx sent=5"));

    // then progress is carried out-of-band with an empty state diff
    expect(changes).toHaveLength(1);
    const change = asCwxChange(changes[0]);
    expect(Object.keys(change.diff as Record<string, unknown>)).toHaveLength(0);
    expect(change.progress).toEqual([{ kind: "charSent", radioIndex: 5 }]);
  });

  it("keeps every sent pair when one line carries several", () => {
    // given a store with cwx state
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|cwx wpm=20"));

    // when a single status carries multiple progress pairs
    const changes = store.apply(makeStatus("S2|cwx sent=5 sent=6 erase=7,9"));

    // then each pair survives in order (a map would collapse the sent keys)
    expect(asCwxChange(changes[0]).progress).toEqual([
      { kind: "charSent", radioIndex: 5 },
      { kind: "charSent", radioIndex: 6 },
      { kind: "erased", start: 7, stop: 9 },
    ]);
  });

  it("does not treat quoted macro text as progress", () => {
    // given a store with cwx state
    const store = createRadioStateStore();

    // when a macro's contents happen to contain a progress-looking token
    const changes = store.apply(makeStatus('S1|cwx macro2="sent=3"'));

    // then only the macro is updated
    expect(asCwxChange(changes[0]).progress).toBeUndefined();
    expect(store.getCwx()?.macros[1]).toBe("sent=3");
  });
});

describe("CWX controller", () => {
  it("provides getters and sends commands", async () => {
    // given a connected radio with cwx state
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|cwx break_in_delay=200 wpm=22 qsk_enabled=0 macro1=CQ",
    );

    // then controller reflects state
    const cwx = radio.cwx();
    expect(cwx.delay).toBe(200);
    expect(cwx.speed).toBe(22);
    expect(cwx.qskEnabled).toBe(false);
    expect(cwx.macros[0]).toBe("CQ");

    // given a change listener
    const changes: RadioStateChange[] = [];
    cwx.on("change", (c) => changes.push(c));

    // when we update speed
    await cwx.setSpeed(30);
    expect(connection.lastCommand()).toBe("cwx wpm 30");

    // when we update delay
    await cwx.setDelay(500);
    expect(connection.lastCommand()).toBe("cwx delay 500");

    // when we enable QSK
    await cwx.setQskEnabled(true);
    expect(connection.lastCommand()).toBe("cwx qsk_enabled 1");

    // when we save a macro
    await cwx.setMacro(0, "TEST DE W1AW");
    expect(connection.lastCommand()).toBe('cwx macro save 1 "TEST DE W1AW"');

    // when we send a macro
    await cwx.sendMacro(2);
    expect(connection.lastCommand()).toBe("cwx macro send 3");

    // when we send text
    await cwx.send("CQ CQ CQ");
    expect(connection.lastCommand()).toBe('cwx send "CQ\x7fCQ\x7fCQ"');

    // when we erase
    await cwx.erase(3);
    expect(connection.lastCommand()).toBe("cwx erase 3");

    // when we clear the buffer
    await cwx.clearBuffer();
    expect(connection.lastCommand()).toBe("cwx clear");
  });

  it("escapes spaces in send text as DEL (0x7f)", async () => {
    // given a connected radio with cwx
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|cwx wpm=20");

    // when send text contains spaces
    await radio.cwx().send("hello world test");
    expect(connection.lastCommand()).toBe('cwx send "hello\x7fworld\x7ftest"');

    // when send text contains no spaces
    await radio.cwx().send("single");
    expect(connection.lastCommand()).toBe('cwx send "single"');
  });

  it("tracks sends by block id and reports the queued buffer position", async () => {
    // given a connected radio that answers a tracked send
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|cwx wpm=20");
    connection.prepareResponse("cwx send", { message: "42,7" });

    // when we send with a block id
    const queued = await radio.cwx().send("CQ TEST", 7);

    // then the block is echoed and the buffer position reported
    expect(connection.lastCommand()).toBe('cwx send "CQ\x7fTEST" 7');
    expect(queued).toEqual({ block: 7, radioIndex: 42 });

    // and a tracked macro send behaves the same way
    connection.prepareResponse("cwx macro send", { message: "50,8" });
    const macroQueued = await radio.cwx().sendMacro(0, 8);
    expect(connection.lastCommand()).toBe("cwx macro send 1 8");
    expect(macroQueued).toEqual({ block: 8, radioIndex: 50 });
  });

  it("emits charSent and eraseSent for transmit progress", async () => {
    // given a connected radio with progress listeners
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|cwx wpm=20");
    const sent: number[] = [];
    const erased: { start: number; stop: number }[] = [];
    radio.cwx().on("charSent", ({ radioIndex }) => sent.push(radioIndex));
    radio.cwx().on("eraseSent", (event) => erased.push(event));

    // when progress statuses arrive
    connection.emitStatus("S2|cwx sent=10");
    connection.emitStatus("S3|cwx sent=11 sent=12");
    connection.emitStatus("S4|cwx erase=13,15");

    // then one event fires per character, in order
    expect(sent).toEqual([10, 11, 12]);
    expect(erased).toEqual([{ start: 13, stop: 15 }]);
  });

  it("clamps speed and delay values", async () => {
    // given a connected radio with cwx
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|cwx wpm=20 break_in_delay=100");

    // when speed is out of range
    await radio.cwx().setSpeed(200);
    expect(connection.lastCommand()).toBe("cwx wpm 100");

    await radio.cwx().setSpeed(1);
    expect(connection.lastCommand()).toBe("cwx wpm 5");

    // when delay is out of range
    await radio.cwx().setDelay(5000);
    expect(connection.lastCommand()).toBe("cwx delay 2000");
  });
});
