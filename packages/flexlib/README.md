# flexlib-ts

An idiomatic TypeScript client surface for FlexRadio devices. The library mirrors the structure of the official FlexLib SDK: the `flex` domain wraps the TCP command/session workflow, the `vita` domain parses UDP/VITA transport, and `util` modules provide shared helpers for spectral math and conversions. Adapters keep platform integrations (sockets, discovery beacons, audio sinks) separate from the core radio model.

## Usage

```ts
import { createFlexClient } from "flexlib-ts";

const client = createFlexClient({
  control: flexControlAdapter, // implements TCP/TLS command I/O
  discovery: optionalDiscovery, // provides LAN or WAN discovery
  audio: optionalAudioAdapter, // opens PCM sinks for audio/DAX
});

const session = await client.connect(radioDescriptor);

session.on("change", (change) => {
  if (change.entity === "slice") {
    console.log("slice update", change.id, change.snapshot);
  }
});

session.on("reply", (reply) => {
  if (reply.code && reply.code !== 0) {
    console.warn("Command failed", reply.code);
  }
});

const slice = session.slice("0");
if (slice) {
  await slice.setFrequency(14.074);
  await slice.setMode("DIGU");
  await slice.setFilter(-300, 2800);
  await slice.setAgcMode("fast");
  await slice.setNrEnabled(true);
  await slice.setNrLevel(5);
}

const pan = session.panadapter("0x40000000");
if (pan) {
  await pan.setBandwidth(5_000_000);
  await pan.setWnbEnabled(true);
  await pan.setWnbLevel(30);
}
```

Adapters encapsulate host integrations:

- `control`: opens the command connection and emits parsed wire messages.
- `discovery` (optional): discovers radios and notifies about availability.
- `audio` (optional): receives PCM stream parameters and returns a writable sink.
- Response codes automatically map to friendly reasons (e.g. `0x50000001 → Unable to get foundation receiver assignment`). Extend the map via `registerResponseCode` if you uncover new values.

Complementary parsing helpers live under the `vita` namespace and can be combined with Node, browser, or native socket adapters to decode waterfall, FFT, and meter payloads.

## Directory Layout

- `src/flex/` – session/client implementation, models for slices, panadapters, meters, and response handling.
- `src/vita/` – UDP/VITA packet parsing utilities (discovery, FFT tiles, waterfall frames, meters).
- `src/util/` – shared helpers used by both domains (tile math, frequency helpers, etc.).
- `tests/` – Vitest coverage mirroring the structure above with shared fixtures in `helpers.ts`.

## Importing

The package ships entrypoints per domain to keep bundle size minimal:

```ts
import { createFlexClient } from "flexlib-ts/flex";
import { parseVitaPacket } from "flexlib-ts/vita";
import { createWaterfallTile } from "flexlib-ts/util";
```

## Development

- Install dependencies: `pnpm install`
- Run type-checking: `pnpm run typecheck`
- Run tests: `pnpm run test`
- Lint the project: `pnpm run lint`
- Build the library: `pnpm run build`
