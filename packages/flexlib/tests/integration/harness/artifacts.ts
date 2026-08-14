import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FlexRadioDescriptor } from "../../../src/flex/adapters.js";
import type { RecordingConnection, RecordingTransport } from "./recording.js";
import type { ReconInfo } from "./types.js";

const ARTIFACTS_DIR = join(import.meta.dirname, "..", "artifacts");

/**
 * Write a captured handshake (and any discovery packets) as a submittable
 * artifact. Layout:
 *
 *   tests/integration/artifacts/<MODEL>_v<VERSION>/
 *     handshake.<gui|nongui>.json
 *     discovery.<n>.bin
 *
 * Curated copies get promoted by hand into tests/integration/fixtures/.
 */
export function writeHandshakeArtifact(options: {
  readonly recon: ReconInfo;
  readonly descriptor: FlexRadioDescriptor | undefined;
  readonly connection: RecordingConnection;
  readonly transport: RecordingTransport;
  readonly kind: "gui" | "nongui";
}): string {
  const { recon, descriptor, connection, transport, kind } = options;
  const version = recon.version.split("+")[0] || recon.version || "unknown";
  const dir = join(ARTIFACTS_DIR, `${recon.model || "UNKNOWN"}_v${version}`);
  mkdirSync(dir, { recursive: true });

  const artifact = {
    capturedAt: new Date().toISOString(),
    kind,
    radio: recon,
    discovery: descriptor ?? null,
    wire: connection.records,
  };
  const file = join(dir, `handshake.${kind}.json`);
  writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`);

  // Raw discovery packets, deduped byte-for-byte, for VITA parser fixtures.
  const seen = new Set<string>();
  let index = 0;
  for (const packet of transport.discoveryPackets) {
    const key = Buffer.from(packet).toString("base64");
    if (seen.has(key)) continue;
    seen.add(key);
    writeFileSync(join(dir, `discovery.${index}.bin`), packet);
    index += 1;
  }

  return file;
}
