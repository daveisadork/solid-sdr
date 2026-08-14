import { defineConfig } from "vitest/config";

/**
 * Integration test config — runs against a REAL radio.
 *
 * Never wired into `pnpm test` or CI. Run with `pnpm test:integration`.
 *
 * Target selection (see tests/integration/harness/target.ts):
 *   FLEX_RADIO=host[:port]   connect directly, skip discovery
 *   (unset)                  discover radios; prompts if more than one is found
 *
 * Other env switches:
 *   FLEX_ALLOW_SHARED=1      run even when other clients are connected
 *   FLEX_CAPTURE_GUI=1       also capture a GUI-client handshake artifact
 */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.itest.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    // One radio, shared global state (TNFs, tx inhibit): everything runs
    // strictly sequentially.
    fileParallelism: false,
    maxConcurrency: 1,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
