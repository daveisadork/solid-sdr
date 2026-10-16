import { describe, expect, it } from "vitest";
import { createConnectedRadio } from "../helpers.js";

async function setup(sliceStatus = "mode=CW chain_mode=CW") {
  const { radio, connection } = await createConnectedRadio();
  connection.emitStatus(`S1|slice 0 index_letter=A ${sliceStatus}`);
  const autoDx = radio.slice("0")?.autoDx;
  if (!autoDx) throw new Error("autodx missing");
  return { radio, connection, autoDx };
}

describe("AutoDX", () => {
  it("is available before any status and has defaults", async () => {
    const { autoDx } = await setup();
    expect(autoDx.state).toBe("Disabled");
    expect(autoDx.enabled).toBe(false);
    expect(autoDx.trigger).toBe("either");
    expect(autoDx.detect).toBe("");
  });

  it("applies enable locally and sends it", async () => {
    const { autoDx, connection } = await setup();
    await autoDx.setEnabled(true);
    expect(connection.lastCommand()).toBe("autodx 0 enable 1");
    expect(autoDx.enabled).toBe(true);
    await autoDx.setEnabled(false);
    expect(connection.lastCommand()).toBe("autodx 0 enable 0");
    expect(autoDx.enabled).toBe(false);
  });

  it("undoes enable when the radio rejects it, without refusing locally", async () => {
    // an unset chain is unknown, so the command is still sent
    const { autoDx, connection } = await setup("mode=FREEDV");
    connection.prepareResponse("autodx 0 enable", {
      code: 0x50000001,
      message: "not cw",
    });
    await expect(autoDx.setEnabled(true)).rejects.toThrow();
    expect(connection.lastCommand()).toBe("autodx 0 enable 1");
    expect(autoDx.enabled).toBe(false);
  });

  it("takes the first word of the detect call and clears with three tokens", async () => {
    const { autoDx, connection } = await setup();
    await autoDx.setDetect("KH7XY UP");
    expect(connection.lastCommand()).toBe("autodx 0 detect KH7XY");
    expect(autoDx.detect).toBe("KH7XY");

    const before = connection.commands.length;
    await autoDx.setDetect("  KH7XY   up ");
    expect(connection.commands).toHaveLength(before);

    await autoDx.setDetect("   ");
    expect(connection.lastCommand()).toBe("autodx 0 detect");
    expect(autoDx.detect).toBe("");
  });

  it("sends trigger, exchange, and timing settings with their ranges", async () => {
    const { autoDx, connection } = await setup();
    await autoDx.setTrigger("call_up");
    expect(connection.lastCommand()).toBe("autodx 0 trigger call_up");
    const before = connection.commands.length;
    await autoDx.setTrigger("unknown");
    expect(connection.commands).toHaveLength(before);

    await autoDx.setExchange("5NN TU 23");
    expect(connection.lastCommand()).toBe('autodx 0 exchange "5NN TU 23"');

    await autoDx.setAwaitReplyMs(100);
    expect(connection.lastCommand()).toBe("autodx 0 await_reply_ms 2000");
    await autoDx.setAwaitReplyMs(999999);
    expect(connection.lastCommand()).toBe("autodx 0 await_reply_ms 60000");
    await autoDx.setTxDelayMs(5);
    expect(connection.lastCommand()).toBe("autodx 0 tx_delay_ms 100");
    await autoDx.setTimeoutMs(1);
    expect(connection.lastCommand()).toBe("autodx 0 timeout_ms 60000");
    await autoDx.setTimeoutMs(0);
    expect(connection.lastCommand()).toBe("autodx 0 timeout_ms 0");
    await autoDx.setTimeoutRestart(true);
    expect(connection.lastCommand()).toBe("autodx 0 timeout_restart 1");
    await autoDx.setCallRetries(-4);
    expect(connection.commands.at(-1)).toBe("autodx 0 timeout_restart 1");
    await autoDx.setCallRetries(3);
    expect(connection.lastCommand()).toBe("autodx 0 call_retries 3");
    await autoDx.requestStatus();
    expect(connection.lastCommand()).toBe("autodx 0 status");

    await expect(autoDx.setExchange("a\nb")).rejects.toThrow(RangeError);
  });

  it("rejects when the radio refuses a config command", async () => {
    const { autoDx, connection } = await setup();
    connection.prepareResponse("autodx 0 trigger", {
      code: 0x50000001,
      message: "bad",
    });
    await expect(autoDx.setTrigger("up")).rejects.toThrow();
  });

  it("stores status without sending commands", async () => {
    const { autoDx, connection } = await setup();
    const before = connection.commands.length;
    connection.emitStatus(
      'S2|autodx slice=0 state=await_reply enabled=1 detect=KH7XY trigger=up exchange="5NN 23" await_reply_ms=5000 tx_delay_ms=300 timeout_ms=120000 timeout_restart=1 call_retries=2 dx_call=KH7XY rx_rst=599 rx_exchange="a \x1eb\x1e" qso_count=4',
    );
    expect(connection.commands).toHaveLength(before);
    expect(autoDx.state).toBe("AwaitReply");
    expect(autoDx.enabled).toBe(true);
    expect(autoDx.detect).toBe("KH7XY");
    expect(autoDx.trigger).toBe("up");
    expect(autoDx.exchange).toBe("5NN 23");
    expect(autoDx.awaitReplyMs).toBe(5000);
    expect(autoDx.txDelayMs).toBe(300);
    expect(autoDx.timeoutMs).toBe(120000);
    expect(autoDx.timeoutRestart).toBe(true);
    expect(autoDx.callRetries).toBe(2);
    expect(autoDx.dxCall).toBe("KH7XY");
    expect(autoDx.rxRst).toBe("599");
    expect(autoDx.rxExchange).toBe('a "b"');
    expect(autoDx.qsoCount).toBe(4);

    connection.emitStatus("S3|autodx slice=0 state=bogus trigger=weird");
    expect(autoDx.state).toBe("Unknown");
    expect(autoDx.trigger).toBe("unknown");
  });

  it("treats the first sent_seq as a baseline and surfaces later ones", async () => {
    const { autoDx, connection } = await setup();
    const sent: string[] = [];
    autoDx.on("sentText", ({ text }) => sent.push(text));

    connection.emitStatus('S2|autodx slice=0 sent_seq=7 sent_text="CQ DX"');
    expect(sent).toEqual([]);
    connection.emitStatus('S3|autodx slice=0 sent_seq=7 sent_text="CQ DX"');
    expect(sent).toEqual([]);

    connection.emitStatus('S4|autodx slice=0 sent_seq=8 sent_text="KH7XY"');
    connection.emitStatus('S5|autodx slice=0 sent_seq=9 sent_text="KH7XY"');
    expect(sent).toEqual(["KH7XY", "KH7XY"]);
  });

  it("ignores status for a missing slice and drops the controller with its slice", async () => {
    const { radio, connection, autoDx } = await setup();
    connection.emitStatus("S2|autodx slice=9 state=monitor");
    expect(radio.stateSnapshot().autoDxes).toHaveLength(0);

    connection.emitStatus("S3|autodx slice=0 state=monitor");
    expect(autoDx.state).toBe("Monitor");

    connection.emitStatus("S4|slice 0 in_use=0");
    expect(radio.autoDx("0")).toBeUndefined();
    expect(radio.stateSnapshot().autoDxes).toHaveLength(0);
    expect(() => autoDx.snapshot()).toThrow();
  });
});
