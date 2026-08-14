import { afterAll, afterEach, beforeAll, inject } from "vitest";
import { FlexClient } from "../../../src/flex/flex-client.js";
import { NodeTransport } from "../../../src/flex/node-transport.js";
import type { Radio } from "../../../src/flex/radio-core.js";
import type { TnfController } from "../../../src/flex/tnf.js";
import { TEST_PROGRAM, TEST_STATION } from "./constants.js";

export interface SessionOptions {
  /** Connect as a GUI client. Default false — non-GUI minimizes radio-side effects. */
  readonly gui?: boolean;
  /**
   * Fixed GUI client ID to reuse (required when `gui` is true — never let the
   * radio mint a fresh ID; it persists them). Use the TEST_GUI_CLIENT_ID*
   * constants.
   */
  readonly guiClientId?: string;
}

export interface TestSession {
  readonly client: FlexClient;
  readonly radio: Radio;
  dispose(): Promise<void>;
}

/**
 * Open a connection to the target radio (resolved during recon).
 *
 * SAFETY: after every connect, tx inhibit is re-verified and re-forced if
 * anything (e.g. GUI client persistence restore) turned it back off. Tests
 * must never run without it.
 */
export async function connectSession(
  options: SessionOptions = {},
): Promise<TestSession> {
  const target = inject("flex:target");
  const gui = options.gui === true;
  if (gui && !options.guiClientId) {
    throw new Error(
      "GUI sessions must reuse a fixed client ID (TEST_GUI_CLIENT_ID*)",
    );
  }

  const client = new FlexClient({ transport: new NodeTransport() });
  let radio: Radio;
  try {
    radio = await client.connect(target, {
      clientInfo: {
        program: TEST_PROGRAM,
        isGui: gui,
        guiClientId: gui ? options.guiClientId : undefined,
        station: gui ? TEST_STATION : undefined,
      },
    });
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }

  const session: TestSession = {
    client,
    radio,
    async dispose() {
      await radio.disconnect().catch(() => {});
      await client.close().catch(() => {});
    },
  };

  try {
    await ensureTxInhibit(radio);
  } catch (error) {
    await session.dispose();
    throw error;
  }

  return session;
}

/** Force tx inhibit on and wait until the radio confirms it. */
export async function ensureTxInhibit(radio: Radio): Promise<void> {
  if (radio.snapshot()?.txInhibit === true) return;
  console.warn("[flex-it] tx inhibit was OFF after connect — re-forcing it on");
  await radio.setTxInhibit(true);
  await waitFor(
    () => radio.snapshot()?.txInhibit === true,
    "radio to confirm tx inhibit on",
  );
}

/**
 * Shared per-file session. Registers beforeAll/afterAll; call the returned
 * accessors inside tests only.
 */
export function useSession(options: SessionOptions = {}): {
  radio: () => Radio;
  session: () => TestSession;
} {
  let current: TestSession | undefined;

  beforeAll(async () => {
    current = await connectSession(options);
  });

  afterAll(async () => {
    await current?.dispose();
    current = undefined;
  });

  const session = (): TestSession => {
    if (!current) throw new Error("Session not connected (outside test run?)");
    return current;
  };

  return { session, radio: () => session().radio };
}

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

export interface WaitForOptions {
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
}

/**
 * Poll until `probe` returns a truthy value, then return it.
 *
 * Radio commands often ACK before the resulting status message arrives, so
 * asserting on state right after a command is a race — always wait for the
 * state to actually reflect the change.
 */
export async function waitFor<T>(
  probe: () => T | undefined | null | false,
  description: string,
  options: WaitForOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${description}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ---------------------------------------------------------------------------
// TNF helpers — create is async on the wire (the new TNF arrives via a
// later status message), and cleanup must only ever touch TNFs we created.
// ---------------------------------------------------------------------------

const trackedTnfIds = new Set<string>();

/**
 * Create a TNF and wait for it to appear in local state. The TNF is tracked;
 * call {@link removeTrackedTnfs} in afterEach to guarantee cleanup.
 */
export async function createTnfAndWait(
  radio: Radio,
  frequencyMHz: number,
  options: WaitForOptions = {},
): Promise<TnfController> {
  const before = new Set(radio.tnfs().map((tnf) => tnf.id));
  await radio.createTnf(frequencyMHz);
  const created = await waitFor(
    () => radio.tnfs().find((tnf) => !before.has(tnf.id)),
    `TNF at ${frequencyMHz} MHz to appear in state`,
    options,
  );
  trackedTnfIds.add(created.id);
  return created;
}

/** Stop tracking a TNF the test already removed itself. */
export function untrackTnf(id: string): void {
  trackedTnfIds.delete(id);
}

/** Remove every TNF created via {@link createTnfAndWait} that still exists. */
export async function removeTrackedTnfs(radio: Radio): Promise<void> {
  const ids = Array.from(trackedTnfIds);
  trackedTnfIds.clear();
  for (const id of ids) {
    const controller = radio.tnf(id);
    if (!controller) continue;
    await controller.remove().catch(() => {});
  }
}

/** Register an afterEach hook that sweeps tracked TNFs. */
export function useTnfCleanup(radio: () => Radio): void {
  afterEach(async () => {
    await removeTrackedTnfs(radio());
  });
}
