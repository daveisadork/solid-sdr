import { describe, expect, it } from "vitest";
import type { RadioStateChange } from "../../src/flex/state/index.js";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";

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

  it("ignores transient sent/erase attributes without error", () => {
    // given a store with cwx state
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|cwx wpm=20"));

    // when transient events arrive
    const changes = store.apply(makeStatus("S2|cwx sent=5"));

    // then no error and change is returned (raw map updated)
    expect(changes).toHaveLength(0); // no diff in tracked fields
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
