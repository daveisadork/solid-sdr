# flexlib integration tests

These tests run against a **real radio**. They are completely separate from the
unit suite: CI never runs them, `pnpm test` never picks them up, and they only
exist to validate real radio behavior and to capture real wire traffic as
fixture data.

## Running

```sh
# from the repo root (or packages/flexlib)
pnpm test:integration
```

Target selection:

- No configuration: radios are discovered on the LAN. One radio → used
  automatically. Several → interactive picker (TTY only).
- `FLEX_RADIO=host[:port]` — connect directly, e.g. `FLEX_RADIO=10.0.0.5`.
  Port defaults to 4992.

Other switches:

- `FLEX_ALLOW_SHARED=1` — run even when other clients are connected to the
  radio. By default the suite refuses, because tests mutate radio-global state.
- `FLEX_CAPTURE_GUI=1` — additionally capture a GUI-client handshake artifact.
  Note: a GUI connect makes the radio restore per-client persistence
  (panadapters/slices may be spawned for the test client ID).

## Safety rules (non-negotiable)

1. **TX inhibit is forced ON before any test runs** and held by a guard
   connection for the entire run. The pre-existing value is restored at the
   end. If the suite cannot confirm tx inhibit, it refuses to run. Tests must
   NEVER cause the radio to transmit.
2. **Leave no trace.** Any setting a test changes must be restored; anything a
   test creates must be deleted. Delete only what you created. Global teardown
   sweeps leaked test TNFs as a backstop, but tests should clean up themselves
   (see `useTnfCleanup` / `removeTrackedTnfs`).
3. GUI connections must reuse the fixed client IDs in `harness/constants.ts` —
   the radio persists per-client-ID settings, so minting fresh IDs pollutes it.

## Writing tests

- Files end in `.itest.ts` (this keeps them invisible to the unit runner).
- Everything runs sequentially — one radio, shared state, no parallelism.
- Recon data about the target radio is available in any test file via
  `harness/capabilities.ts`:

  ```ts
  import { hasGps, is8xxx, recon } from "./harness/capabilities.js";

  describe.skipIf(!hasGps())("GPS status", () => { ... });
  it.runIf(is8xxx())("8xxx-only behavior", () => { ... });
  ```

- Get a connection with `useSession()` (non-GUI by default). Open extra
  connections with `connectSession()` for multiflex scenarios.
- Commands ACK before the resulting status arrives — never assert immediately;
  use `waitFor(...)` from `harness/session.ts`.

## Ephemeral experiments

Drop a `*.itest.ts` into `scratch/` (gitignored) to probe real radio behavior
during feature development with the full harness in place. Run just that file:

```sh
pnpm test:integration scratch/my-experiment.itest.ts
```

Delete it afterwards or promote it into a real test.

## Captured artifacts

Every run captures the connect handshake (all TCP traffic in both directions,
timestamped) plus raw discovery packets into `artifacts/<MODEL>_v<VERSION>/`.
These are the main thing we want from community members: run the suite (or
just let recon complete) against your radio and attach the artifact directory
to an issue — radios with/without GPS, 1 vs 2 SCUs, different models and
license states all produce usefully different handshakes.

Curated captures are committed under `fixtures/` and used to ground unit-test
fixture data in reality.
