import type { TestProject } from "vitest/node";
import { FlexClient } from "../../src/flex/flex-client.js";
import { NodeTransport } from "../../src/flex/node-transport.js";
import type { Radio } from "../../src/flex/radio-core.js";
import { writeHandshakeArtifact } from "./harness/artifacts.js";
import {
  TEST_GUI_CLIENT_ID,
  TEST_PROGRAM,
  TEST_STATION,
} from "./harness/constants.js";
import { RecordingTransport } from "./harness/recording.js";
import { resolveTarget } from "./harness/target.js";
import { classifySeries, type ReconInfo } from "./harness/types.js";

const log = (message: string): void => {
  process.stderr.write(`[flex-it] ${message}\n`);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(
  probe: () => boolean,
  description: string,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!probe()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${description}`);
    }
    await sleep(50);
  }
}

function buildRecon(radio: Radio, originalTxInhibit: boolean): ReconInfo {
  const snapshot = radio.snapshot();
  if (!snapshot) throw new Error("Radio snapshot unavailable after connect");
  const descriptor = radio.descriptor;
  return {
    serial: snapshot.serial || radio.serial,
    model: snapshot.model,
    series: classifySeries(snapshot.model),
    nickname: snapshot.nickname,
    callsign: snapshot.callsign,
    version: snapshot.version,
    radioOptions: snapshot.radioOptions,
    scuCount: snapshot.scuCount,
    sliceCount: snapshot.sliceCount,
    txCount: snapshot.txCount,
    availableSlices: snapshot.availableSlices,
    availablePanadapters: snapshot.availablePanadapters,
    daxIqCapacity: snapshot.daxIqCapacity,
    atuPresent: snapshot.atuPresent,
    gpsInstalled: snapshot.gpsInstalled,
    oscillatorGnssPresent: snapshot.oscillatorGnssPresent,
    oscillatorGpsdoPresent: snapshot.oscillatorGpsdoPresent,
    oscillatorTcxoPresent: snapshot.oscillatorTcxoPresent,
    oscillatorExternalPresent: snapshot.oscillatorExternalPresent,
    originalTxInhibit,
    discovery: descriptor
      ? {
          status: descriptor.status,
          licensedClients: descriptor.licensedClients,
          availableClients: descriptor.availableClients,
          maxSlices: descriptor.maxSlices,
          maxPanadapters: descriptor.maxPanadapters,
          maxLicensedVersion: descriptor.maxLicensedVersion,
          minSoftwareVersion: descriptor.minSoftwareVersion,
        }
      : undefined,
  };
}

/**
 * Recon phase. Runs once in the vitest main process before any test worker:
 *
 * 1. Resolve the target radio (FLEX_RADIO env or LAN discovery).
 * 2. Refuse to run if any other client is connected (FLEX_ALLOW_SHARED=1
 *    overrides — multiflex tests open their own extra connections instead).
 * 3. Connect non-GUI, gather radio facts for capability-gated tests.
 * 4. SAFETY: record the radio's tx_inhibit, force it ON, and hold this
 *    connection open as a guard for the entire run. Teardown restores the
 *    original value. Tests must never be able to key the transmitter.
 * 5. Capture the real handshake wire traffic as a submittable artifact.
 */
export default async function setup(
  project: TestProject,
): Promise<() => Promise<void>> {
  const allowShared = process.env.FLEX_ALLOW_SHARED === "1";

  const transport = new RecordingTransport(new NodeTransport());
  const client = new FlexClient({ transport });

  const { target, descriptor } = await resolveTarget(client);
  log(
    descriptor
      ? `target: ${descriptor.model} "${descriptor.nickname}" (${descriptor.serial}) at ${target.host}:${target.port}`
      : `target: ${target.host}:${target.port} (no discovery packet seen)`,
  );

  const preConnectClients = descriptor?.guiClients ?? [];
  if (preConnectClients.length > 0 && !allowShared) {
    const list = preConnectClients
      .map((c) => `  - ${c.program ?? "?"} @ ${c.station ?? "?"}`)
      .join("\n");
    throw new Error(
      `Refusing to run: other clients are connected to the radio:\n${list}\n` +
        `Disconnect them or set FLEX_ALLOW_SHARED=1 to override.`,
    );
  }

  log("connecting (non-GUI recon session)...");
  const radio = await client.connect(target, {
    clientInfo: { program: TEST_PROGRAM, isGui: false },
  });
  const guardConnection = transport.connections.at(-1);

  try {
    // Status messages (transmit state among them) can trail the handshake
    // acks; reading tx_inhibit too early would capture the store default
    // instead of the radio's real value — and teardown would then "restore"
    // the wrong thing. Give the subscriptions a moment to settle.
    await sleep(1_500);
    await waitFor(() => radio.snapshot() !== undefined, "radio snapshot");

    const foreignGuiClients = radio
      .stateSnapshot()
      .guiClients.filter((c) => !c.isThisClient);
    if (foreignGuiClients.length > 0 && !allowShared) {
      const list = foreignGuiClients
        .map((c) => `  - ${c.program ?? "?"} @ ${c.station ?? "?"} (${c.id})`)
        .join("\n");
      throw new Error(
        `Refusing to run: other GUI clients are connected to the radio:\n${list}\n` +
          `Disconnect them or set FLEX_ALLOW_SHARED=1 to override.`,
      );
    }

    const originalTxInhibit = radio.snapshot()?.txInhibit === true;
    log(
      `tx inhibit on radio before suite: ${originalTxInhibit ? "ON" : "OFF"}`,
    );
    if (!originalTxInhibit) {
      log("forcing tx inhibit ON for the duration of the run");
      try {
        await radio.setTxInhibit(true);
      } catch (error) {
        throw new Error(
          `Could not enable tx inhibit — refusing to run any tests. Cause: ${String(error)}`,
        );
      }
      await waitFor(
        () => radio.snapshot()?.txInhibit === true,
        "radio to confirm tx inhibit ON",
      );
    }

    const recon = buildRecon(radio, originalTxInhibit);
    log(
      `recon: ${recon.model} v${recon.version} | SCUs=${recon.scuCount} ` +
        `slices=${recon.sliceCount} gps=${recon.gpsInstalled ? "yes" : "no"} ` +
        `atu=${recon.atuPresent ? "yes" : "no"} options="${recon.radioOptions}"`,
    );

    if (guardConnection) {
      const file = writeHandshakeArtifact({
        recon,
        descriptor,
        connection: guardConnection,
        transport,
        kind: "nongui",
      });
      log(`handshake artifact written: ${file}`);
    }

    if (process.env.FLEX_CAPTURE_GUI === "1") {
      log("FLEX_CAPTURE_GUI=1: capturing GUI-client handshake...");
      const guiTransport = new RecordingTransport(new NodeTransport());
      const guiClient = new FlexClient({ transport: guiTransport });
      try {
        const guiRadio = await guiClient.connect(target, {
          clientInfo: {
            program: TEST_PROGRAM,
            isGui: true,
            guiClientId: TEST_GUI_CLIENT_ID,
            station: TEST_STATION,
          },
        });
        await sleep(1_500);
        const guiConnection = guiTransport.connections.at(-1);
        if (guiConnection) {
          const file = writeHandshakeArtifact({
            recon,
            descriptor,
            connection: guiConnection,
            transport: guiTransport,
            kind: "gui",
          });
          log(`GUI handshake artifact written: ${file}`);
        }
        await guiRadio.disconnect();
      } finally {
        await guiClient.close().catch(() => {});
      }
      // The GUI connect may have restored per-client persistence that
      // touches transmit settings — re-assert the guard.
      if (radio.snapshot()?.txInhibit !== true) {
        log("tx inhibit dropped after GUI capture — re-forcing");
        await radio.setTxInhibit(true);
        await waitFor(
          () => radio.snapshot()?.txInhibit === true,
          "radio to confirm tx inhibit ON",
        );
      }
    }

    const baselineTnfIds = new Set(radio.tnfs().map((tnf) => tnf.id));

    project.provide("flex:target", target);
    project.provide("flex:recon", recon);

    // Teardown: leave the radio exactly as we found it.
    return async () => {
      try {
        if (radio.connectionState === "connected") {
          if (radio.snapshot()?.txInhibit !== true) {
            log(
              "WARNING: tx inhibit was OFF at teardown — a test or another client changed it",
            );
          }

          // Sweep TNFs leaked by tests. Only safe when we know no other
          // client has been creating TNFs concurrently.
          if (!allowShared) {
            const leaked = radio
              .tnfs()
              .filter((tnf) => !baselineTnfIds.has(tnf.id));
            for (const tnf of leaked) {
              log(`removing leaked test TNF ${tnf.id}`);
              await tnf.remove().catch(() => {});
            }
          }

          if (!originalTxInhibit) {
            log("restoring tx inhibit to OFF (its pre-suite value)");
            await radio.setTxInhibit(false).catch((error) => {
              log(`WARNING: failed to restore tx inhibit: ${String(error)}`);
            });
            await waitFor(
              () => radio.snapshot()?.txInhibit === false,
              "radio to confirm tx inhibit restore",
            ).catch(() => {});
          } else {
            log("tx inhibit was ON before the suite — leaving it ON");
          }
        } else {
          log(
            "WARNING: guard connection lost during run — cannot verify/restore radio state",
          );
        }
      } finally {
        await radio.disconnect().catch(() => {});
        await client.close().catch(() => {});
      }
    };
  } catch (error) {
    await radio.disconnect().catch(() => {});
    await client.close().catch(() => {});
    throw error;
  }
}
