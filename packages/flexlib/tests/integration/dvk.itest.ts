/**
 * DVK (Digital Voice Keyer) integration tests.
 *
 * Verified radio behavior these tests guard (FLEX-8600 v4.2.20):
 * - Slot ids are monotonic and never reused. The official SmartSDR panel
 *   labels each slot's playback button `F<id>` and maps F1-F12 to ids 1-12,
 *   so a slot minted past id 12 has no reachable keyboard shortcut there —
 *   and that panel binds no create/remove command, so it cannot recover. This
 *   suite therefore never calls create/remove: it borrows an existing empty
 *   slot and restores it. Those two verbs are covered by unit tests only.
 * - Rename/upload/clear confirmations arrive as marker-less updates
 *   (`dvk id=N name="X" duration=D`); add/delete carry `added`/`deleted`.
 * - Upload → download round-trips byte-identically over the inverted-TCP
 *   download path. The file server stays busy ~2s after an upload and
 *   rejects downloads with 50000053 "File server busy" until it releases.
 * - Recording captures the station's TX audio source in wall-time; it needs
 *   a GUI session (a non-GUI client has no station mic chain and records
 *   0ms takes). This suite connects as a GUI client for that reason.
 * - Preview end is announced by a handle-0 broadcast (`S0|dvk status=idle`)
 *   after the recording's duration; there are no progress updates.
 *
 * Safety: NEVER calls playback_start (it keys the transmitter). Recording
 * and preview are local to the radio (mic capture / speaker playback). Runs
 * under the harness tx-inhibit guard; every setting touched (mic source,
 * mic level, TX DAX) is restored, and the borrowed slot is put back to its
 * original name and left empty.
 */
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { validateDvkWavFile } from "../../src/flex/dvk.js";
import { FlexClient } from "../../src/flex/flex-client.js";
import { NodeTransport } from "../../src/flex/node-transport.js";
import type { Radio } from "../../src/flex/radio-core.js";
import {
  TEST_GUI_CLIENT_ID,
  TEST_PROGRAM,
  TEST_STATION,
} from "./harness/constants.js";
import { ensureTxInhibit, waitFor } from "./harness/session.js";

const TEST_NAME = "SolidSDR IT";
const UPLOAD_WAV_MS = 500;
const REC_WINDOW_MS = 2_000;

/** Deterministic 0.5 s stereo 24 kHz 16-bit WAV: quiet 440 Hz sine. */
function buildTestWav(): Uint8Array {
  const sampleRate = 24_000;
  const channels = 2;
  const frames = (sampleRate * UPLOAD_WAV_MS) / 1_000;
  const dataBytes = frames * channels * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(
      Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 4000,
    );
    view.setInt16(44 + i * 4, sample, true);
    view.setInt16(44 + i * 4 + 2, sample, true);
  }
  return new Uint8Array(buf);
}

describe("DVK", () => {
  let client: FlexClient;
  let radio: Radio;
  /** An existing empty slot, borrowed for the run and restored afterwards. */
  let slotId: string | undefined;
  let slotOriginalName: string | undefined;
  /** Mic settings captured by the rec test; afterAll backstop restore. */
  let micSelectionToRestore: string | undefined;
  let daxToRestore: boolean | undefined;
  let micLevelToRestore: number | undefined;

  const dvk = () => radio.dvk();
  const slot = () => dvk().recordings.find((r) => r.id === slotId);
  const requireSlotId = (): string => {
    if (!slotId) throw new Error("no slot allocated (create test failed?)");
    return slotId;
  };

  beforeAll(async () => {
    client = new FlexClient({ transport: new NodeTransport() });
    // GUI session: DVK recording captures the station's TX audio source, and
    // only a GUI client has a station/mic chain. Fixed id per harness rules —
    // the radio persists per-client settings.
    radio = await client.connect(inject("flex:target"), {
      clientInfo: {
        program: TEST_PROGRAM,
        isGui: true,
        guiClientId: TEST_GUI_CLIENT_ID,
        station: TEST_STATION,
      },
    });
    // GUI connect restores per-client persistence, which can flip tx inhibit.
    await ensureTxInhibit(radio);
    await waitFor(
      () => radio.getStore().getDvk() !== undefined,
      "initial dvk status after sub dvk all",
    );
    const spare = dvk().recordings.find((r) => r.durationMs === 0);
    if (!spare) {
      throw new Error(
        "no empty DVK slot to borrow — clear one on the radio before running " +
          "this suite (it will not create a slot; see the file header)",
      );
    }
    slotId = spare.id;
    slotOriginalName = spare.name;
  });

  afterAll(async () => {
    try {
      // Backstop: a failed rec test may have left mic settings switched.
      if (
        micSelectionToRestore &&
        radio.snapshot()?.micSelection !== micSelectionToRestore
      ) {
        await radio.setMicSelection(micSelectionToRestore).catch(() => {});
      }
      if (daxToRestore === true && radio.snapshot()?.daxEnabled !== true) {
        await radio.setDaxEnabled(true).catch(() => {});
      }
      if (
        micLevelToRestore !== undefined &&
        radio.snapshot()?.micLevel !== micLevelToRestore
      ) {
        await radio.setMicLevel(micLevelToRestore).catch(() => {});
      }
      // Put the borrowed slot back: original name, empty content. Never
      // remove it — the radio would never hand that id back out.
      const current = slot();
      if (slotId && slotOriginalName !== undefined && current) {
        const originalName = slotOriginalName;
        if (current.durationMs !== 0) {
          await dvk()
            .clear(slotId)
            .catch(() => {});
        }
        if (current.name !== originalName) {
          await dvk()
            .setName(slotId, originalName)
            .catch(() => {});
        }
        await waitFor(() => {
          const r = slot();
          return (
            r !== undefined && r.name === originalName && r.durationMs === 0
          );
        }, "slot restore to reflect in state").catch((e) =>
          console.warn(`[flex-it] dvk slot restore not confirmed: ${e}`),
        );
      }
    } finally {
      await radio.disconnect().catch(() => {});
      await client.close().catch(() => {});
    }
  });

  it("set_name round-trips", async () => {
    await dvk().setName(requireSlotId(), TEST_NAME);
    await waitFor(
      () => slot()?.name === TEST_NAME,
      "rename to reflect in state",
    );
  });

  it("upload accepts a valid WAV and the slot reports its duration", async () => {
    const upload = await dvk().upload(
      requireSlotId(),
      buildTestWav(),
      "itest.wav",
    );
    await new Promise<void>((resolve, reject) => {
      upload.on("done", () => resolve());
      upload.on("failed", ({ reason }) =>
        reject(new Error(`upload failed: ${reason ?? "unknown"}`)),
      );
    });

    const uploaded = await waitFor(() => {
      const r = slot();
      return r && r.durationMs > 0 ? r : undefined;
    }, "uploaded slot to report a duration");
    expect(uploaded.durationMs).toBe(UPLOAD_WAV_MS);
  });

  it("download round-trips the uploaded WAV byte-identically", async () => {
    // Exercises the controller's internal retry too: this runs right after
    // the upload, inside the file server's busy window.
    const uploaded = buildTestWav();
    const downloaded = await dvk().download(requireSlotId());

    expect(() => validateDvkWavFile(downloaded)).not.toThrow();
    expect(downloaded.byteLength).toBe(uploaded.byteLength);
    expect(downloaded.every((b, i) => b === uploaded[i])).toBe(true);
  });

  it("rec_start/rec_stop capture a wall-time take from the mic", async () => {
    const id = requireSlotId();

    // Recording captures the station's TX audio source. Force the physical
    // MIC with some gain (TX DAX is a separate override switch that routes
    // DAX audio instead of the selected mic) and restore afterwards. What is
    // recorded does not matter — silence still yields a wall-time take.
    const before = radio.snapshot();
    const originalMicSelection = before?.micSelection;
    const originalDaxEnabled = before?.daxEnabled === true;
    const originalMicLevel = before?.micLevel;
    micSelectionToRestore = originalMicSelection;
    daxToRestore = originalDaxEnabled;
    micLevelToRestore = originalMicLevel;
    try {
      if (originalMicSelection !== "MIC") {
        await radio.setMicSelection("MIC");
      }
      if (originalDaxEnabled) {
        await radio.setDaxEnabled(false);
      }
      if (originalMicLevel === 0) {
        await radio.setMicLevel(50);
      }

      await dvk().startRecording(id);
      await waitFor(
        () => dvk().status === "recording",
        "status to become recording",
      );
      expect(dvk().statusRecordingId).toBe(id);

      await new Promise((resolve) => setTimeout(resolve, REC_WINDOW_MS));

      await dvk().stopRecording(id);
      await waitFor(() => dvk().status === "idle", "status to return to idle");

      const recorded = await waitFor(() => {
        const r = slot();
        return r && r.durationMs !== UPLOAD_WAV_MS ? r : undefined;
      }, "rec_stop update to replace the uploaded duration");
      expect(recorded.durationMs).toBeGreaterThanOrEqual(REC_WINDOW_MS - 500);
      expect(recorded.durationMs).toBeLessThanOrEqual(REC_WINDOW_MS + 1_000);
    } finally {
      if (originalMicSelection && originalMicSelection !== "MIC") {
        await radio.setMicSelection(originalMicSelection).catch(() => {});
      }
      if (originalDaxEnabled) {
        await radio.setDaxEnabled(true).catch(() => {});
      }
      if (originalMicLevel === 0) {
        await radio.setMicLevel(0).catch(() => {});
      }
      micSelectionToRestore = undefined;
      daxToRestore = undefined;
      micLevelToRestore = undefined;
    }
  });

  it("preview plays to completion and the radio announces the end", async () => {
    const id = requireSlotId();
    const durationMs = slot()?.durationMs ?? 0;
    expect(durationMs).toBeGreaterThan(0);

    const startedAt = Date.now();
    await dvk().startPreview(id);
    await waitFor(() => dvk().status === "preview", "status to become preview");
    expect(dvk().statusRecordingId).toBe(slotId);

    // The end-of-preview idle status arrives on its own (handle-0 broadcast)
    // once the recording has played out. There are no progress updates.
    await waitFor(() => dvk().status === "idle", "preview to end on its own", {
      timeoutMs: durationMs + 5_000,
    });
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(durationMs - 500);
  });

  it("preview_stop cuts a preview short", async () => {
    const id = requireSlotId();

    await dvk().startPreview(id);
    await waitFor(() => dvk().status === "preview", "status to become preview");

    await new Promise((resolve) => setTimeout(resolve, 500));
    await dvk().stopPreview(id);
    await waitFor(
      () => dvk().status === "idle",
      "status to return to idle after stop",
    );
  });

  it("clear empties the slot but keeps it", async () => {
    await dvk().clear(requireSlotId());
    await waitFor(
      () => slot()?.durationMs === 0,
      "clear to zero the slot duration",
    );
    expect(slot()).toBeDefined();
  });
});
