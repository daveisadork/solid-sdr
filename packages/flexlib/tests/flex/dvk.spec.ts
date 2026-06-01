import { describe, expect, it } from "vitest";
import { createConnectedRadio, makeStatus } from "../helpers.js";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";

describe("DVK snapshot", () => {
  it("parses global status updates", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a dvk status arrives
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));

    // then dvk state is tracked
    const dvk = store.getDvk();
    expect(dvk).toBeDefined();
    expect(dvk?.status).toBe("idle");
    expect(dvk?.enabled).toBe(true);
  });

  it("tracks recording additions", () => {
    // given a store with dvk state
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));

    // when a recording is added
    store.apply(makeStatus('S2|dvk added id=1 name="CQ DX" duration=3500'));

    // then the recording appears in state
    const dvk = store.getDvk();
    expect(dvk?.recordings).toHaveLength(1);
    expect(dvk?.recordings[0].id).toBe("1");
    expect(dvk?.recordings[0].name).toBe("CQ DX");
    expect(dvk?.recordings[0].durationMs).toBe(3500);
  });

  it("tracks recording deletions", () => {
    // given a store with a recording
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));
    store.apply(makeStatus("S2|dvk added id=1 name=CQ duration=2000"));
    store.apply(makeStatus("S3|dvk added id=2 name=73 duration=1500"));
    expect(store.getDvk()?.recordings).toHaveLength(2);

    // when a recording is deleted
    store.apply(makeStatus("S4|dvk deleted id=1"));

    // then only the other remains
    const dvk = store.getDvk();
    expect(dvk?.recordings).toHaveLength(1);
    expect(dvk?.recordings[0].id).toBe("2");
  });

  it("updates existing recordings", () => {
    // given a store with a recording
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));
    store.apply(makeStatus("S2|dvk added id=1 name=CQ duration=2000"));

    // when the same recording is re-added with updated info
    store.apply(makeStatus("S3|dvk added id=1 name=CQ-DX duration=3000"));

    // then it is updated in place
    const dvk = store.getDvk();
    expect(dvk?.recordings).toHaveLength(1);
    expect(dvk?.recordings[0].name).toBe("CQ-DX");
    expect(dvk?.recordings[0].durationMs).toBe(3000);
  });

  it("tracks playback status", () => {
    // given a store with dvk
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));

    // when playback starts
    store.apply(makeStatus("S2|dvk status=playback id=1"));

    // then status and id are updated
    const dvk = store.getDvk();
    expect(dvk?.status).toBe("playback");
    expect(dvk?.statusRecordingId).toBe("1");
  });

  it("forces status to disabled when enabled=0 arrives alone", () => {
    // given a store with active playback
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=playback enabled=1 id=5"));
    expect(store.getDvk()?.status).toBe("playback");
    expect(store.getDvk()?.statusRecordingId).toBe("5");

    // when enabled=0 arrives without status/id
    store.apply(makeStatus("S2|dvk enabled=0"));

    // then status is forced to disabled and recordingId cleared
    const dvk = store.getDvk();
    expect(dvk?.enabled).toBe(false);
    expect(dvk?.status).toBe("disabled");
    expect(dvk?.statusRecordingId).toBeUndefined();
  });

  it("overrides status when enabled=0 arrives with status and id in same message", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a contradictory message arrives
    store.apply(makeStatus("S1|dvk status=playback enabled=0 id=5"));

    // then enabled=0 wins and forces disabled with cleared id
    const dvk = store.getDvk();
    expect(dvk?.enabled).toBe(false);
    expect(dvk?.status).toBe("disabled");
    expect(dvk?.statusRecordingId).toBeUndefined();
  });

  it("does not override when enabled=1 arrives with status and id", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when enabled=1 arrives with playback status
    store.apply(makeStatus("S1|dvk status=playback enabled=1 id=5"));

    // then status and id are preserved
    const dvk = store.getDvk();
    expect(dvk?.enabled).toBe(true);
    expect(dvk?.status).toBe("playback");
    expect(dvk?.statusRecordingId).toBe("5");
  });

  it("does not override when enabled key is absent", () => {
    // given a store in playback
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=playback enabled=1 id=5"));

    // when a status-only update arrives without enabled key
    store.apply(makeStatus("S2|dvk status=idle"));

    // then enabled is unchanged and status/id are not forced
    const dvk = store.getDvk();
    expect(dvk?.enabled).toBe(true);
    expect(dvk?.status).toBe("idle");
    expect(dvk?.statusRecordingId).toBe("5");
  });

  it("snapshot includes dvk", () => {
    // given a store with dvk state
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));

    // then snapshot includes dvk
    expect(store.snapshot().dvk).toBeDefined();
    expect(store.snapshot().dvk?.status).toBe("idle");
  });
});

describe("DVK controller", () => {
  it("provides getters and sends commands", async () => {
    // given a connected radio with dvk state
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");
    connection.emitStatus("S2|dvk added id=1 name=CQ duration=2000");

    // then controller reflects state
    const dvk = radio.dvk();
    expect(dvk.status).toBe("idle");
    expect(dvk.enabled).toBe(true);
    expect(dvk.recordings).toHaveLength(1);

    // given a change listener
    const changes: RadioStateChange[] = [];
    dvk.on("change", (c) => changes.push(c));

    // when commands are sent
    await dvk.create("New Rec");
    expect(connection.lastCommand()).toBe('dvk create name="New Rec"');

    await dvk.startRecording("1");
    expect(connection.lastCommand()).toBe("dvk rec_start id=1");

    await dvk.stopRecording();
    expect(connection.lastCommand()).toBe("dvk rec_stop");

    await dvk.startPreview("1");
    expect(connection.lastCommand()).toBe("dvk preview_start id=1");

    await dvk.stopPreview();
    expect(connection.lastCommand()).toBe("dvk preview_stop");

    await dvk.startPlayback("1");
    expect(connection.lastCommand()).toBe("dvk playback_start id=1");

    await dvk.stopPlayback();
    expect(connection.lastCommand()).toBe("dvk playback_stop");

    await dvk.remove("1");
    expect(connection.lastCommand()).toBe("dvk remove id=1");

    await dvk.setName("1", "Renamed");
    expect(connection.lastCommand()).toBe('dvk set_name id=1 name="Renamed"');

    await dvk.clearAll();
    expect(connection.lastCommand()).toBe("dvk clear");
  });

  it("emits change events on status updates", async () => {
    // given a connected radio with dvk
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");

    const dvk = radio.dvk();
    const changes: RadioStateChange[] = [];
    dvk.on("change", (c) => changes.push(c));

    // when status changes
    connection.emitStatus("S2|dvk status=recording id=1");

    // then change event fires
    expect(changes).toHaveLength(1);
    expect(dvk.status).toBe("recording");
  });
});
