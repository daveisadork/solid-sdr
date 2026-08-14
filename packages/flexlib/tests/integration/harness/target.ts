import { createInterface } from "node:readline/promises";
import type { FlexRadioDescriptor } from "../../../src/flex/adapters.js";
import type { FlexClient } from "../../../src/flex/flex-client.js";
import { DEFAULT_RADIO_PORT } from "./constants.js";
import type { RadioTarget } from "./types.js";

const DISCOVERY_WINDOW_MS = 3_500;

export interface ResolvedTarget {
  readonly target: RadioTarget;
  readonly descriptor?: FlexRadioDescriptor;
}

/** Parse `host[:port]` from the FLEX_RADIO env var. */
function parseEnvTarget(raw: string): RadioTarget {
  const [host, portRaw] = raw.split(":");
  if (!host) throw new Error(`FLEX_RADIO is set but empty: "${raw}"`);
  const port = portRaw ? Number.parseInt(portRaw, 10) : DEFAULT_RADIO_PORT;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`FLEX_RADIO has an invalid port: "${raw}"`);
  }
  return { host, port };
}

function describeRadio(d: FlexRadioDescriptor): string {
  return `${d.model} "${d.nickname}" (${d.serial}) at ${d.host}:${d.port} — ${d.status}`;
}

async function discoverRadios(
  client: FlexClient,
  windowMs: number,
): Promise<FlexRadioDescriptor[]> {
  await client.startDiscovery();
  try {
    await new Promise((resolve) => setTimeout(resolve, windowMs));
  } finally {
    await client.stopDiscovery();
  }
  return client
    .radios()
    .map((radio) => radio.descriptor)
    .filter((d): d is FlexRadioDescriptor => d !== undefined);
}

async function promptForRadio(
  radios: FlexRadioDescriptor[],
): Promise<FlexRadioDescriptor> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    process.stderr.write("Multiple radios discovered:\n");
    radios.forEach((d, i) => {
      process.stderr.write(`  [${i + 1}] ${describeRadio(d)}\n`);
    });
    for (;;) {
      const answer = await rl.question(
        `Select radio to test against [1-${radios.length}]: `,
      );
      const index = Number.parseInt(answer.trim(), 10) - 1;
      const chosen = radios[index];
      if (chosen) return chosen;
      process.stderr.write("Invalid selection.\n");
    }
  } finally {
    rl.close();
  }
}

/**
 * Determine which radio the suite runs against.
 *
 * - `FLEX_RADIO=host[:port]` connects directly. Discovery still runs briefly
 *   so we can attach the radio's discovery metadata to recon/artifacts, but
 *   finding nothing is not an error (the radio may be on another subnet).
 * - Otherwise radios are discovered on the LAN. Exactly one → use it.
 *   Several → interactive prompt when stdin is a TTY, abort otherwise.
 */
export async function resolveTarget(
  client: FlexClient,
): Promise<ResolvedTarget> {
  const env = process.env.FLEX_RADIO?.trim();
  if (env) {
    const target = parseEnvTarget(env);
    const radios = await discoverRadios(client, 1_500).catch(() => []);
    const descriptor = radios.find((d) => d.host === target.host);
    return { target, descriptor };
  }

  const radios = await discoverRadios(client, DISCOVERY_WINDOW_MS);
  if (radios.length === 0) {
    throw new Error(
      "No radios discovered on the network. " +
        "Set FLEX_RADIO=host[:port] to connect directly.",
    );
  }

  let chosen: FlexRadioDescriptor;
  if (radios.length === 1) {
    chosen = radios[0];
  } else if (process.stdin.isTTY) {
    chosen = await promptForRadio(radios);
  } else {
    const list = radios.map((d) => `  - ${describeRadio(d)}`).join("\n");
    throw new Error(
      `Multiple radios discovered and stdin is not a TTY. ` +
        `Set FLEX_RADIO=host[:port] to pick one:\n${list}`,
    );
  }

  return {
    target: { host: chosen.host, port: chosen.port },
    descriptor: chosen,
  };
}
