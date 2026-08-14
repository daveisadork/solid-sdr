import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  connectSession,
  createTnfAndWait,
  removeTrackedTnfs,
  type TestSession,
  untrackTnf,
  useSession,
  waitFor,
} from "./harness/session.js";

// Arbitrary quiet frequencies well inside ham bands. TNFs are receive-side
// notches; frequency choice has no RF-emission implications.
const FREQ_A_MHZ = 28.123456;
const FREQ_B_MHZ = 21.234567;

describe("TNF lifecycle", () => {
  const { radio } = useSession();

  afterEach(async () => {
    await removeTrackedTnfs(radio());
  });

  it("tnf create makes a TNF appear via status with the requested frequency", async () => {
    const tnf = await createTnfAndWait(radio(), FREQ_A_MHZ);
    expect(tnf.frequencyMHz).toBeCloseTo(FREQ_A_MHZ, 6);
  });

  it("a freshly created TNF has the radio's real defaults", async () => {
    const tnf = await createTnfAndWait(radio(), FREQ_A_MHZ);
    const snapshot = tnf.snapshot();
    // Grounding data for unit-test fixtures: what a real radio reports for a
    // brand-new TNF (contrived unit fixtures should match this shape).
    expect(snapshot.permanent).toBe(false);
    expect(snapshot.depth).toBeGreaterThanOrEqual(1);
    expect(snapshot.depth).toBeLessThanOrEqual(3);
    expect(snapshot.bandwidthMHz).toBeGreaterThan(0);
  });

  it("tnf set updates frequency, depth, width, and permanent", async () => {
    const tnf = await createTnfAndWait(radio(), FREQ_A_MHZ);

    await tnf.setFrequency(FREQ_B_MHZ);
    await tnf.setDepth(2);
    await tnf.setBandwidth(0.0002);
    await tnf.setPermanent(true);

    // Local state is patched optimistically; these assertions confirm the
    // radio accepted the commands (rejections would have thrown above) and
    // that local state holds the expected values.
    const snapshot = tnf.snapshot();
    expect(snapshot.frequencyMHz).toBeCloseTo(FREQ_B_MHZ, 6);
    expect(snapshot.depth).toBe(2);
    expect(snapshot.bandwidthMHz).toBeCloseTo(0.0002, 6);
    expect(snapshot.permanent).toBe(true);

    // Never leave a permanent TNF behind.
    await tnf.setPermanent(false);
  });

  it("tnf remove deletes the TNF from state", async () => {
    const tnf = await createTnfAndWait(radio(), FREQ_A_MHZ);
    const id = tnf.id;

    await tnf.remove();
    untrackTnf(id);

    await waitFor(
      () =>
        radio()
          .tnfs()
          .every((t) => t.id !== id),
      `TNF ${id} to disappear from state`,
    );
  });
});

describe("TNF multi-client visibility", () => {
  // TNFs are radio-global. Changes made by one client must be observed by
  // another client purely via status messages — the observer session has no
  // optimistic patches, so its state is ground truth for what the radio sent.
  const { radio } = useSession();
  let observer: TestSession | undefined;

  beforeAll(async () => {
    observer = await connectSession();
  });

  afterAll(async () => {
    await observer?.dispose();
  });

  afterEach(async () => {
    await removeTrackedTnfs(radio());
  });

  it("a TNF created by one client is announced to another", async () => {
    const tnf = await createTnfAndWait(radio(), FREQ_A_MHZ);

    const remote = await waitFor(
      () => observer?.radio.tnf(tnf.id),
      `TNF ${tnf.id} to appear on the observer connection`,
    );
    expect(remote.frequencyMHz).toBeCloseTo(FREQ_A_MHZ, 6);
  });

  it("tnf set changes propagate to the other client", async () => {
    const tnf = await createTnfAndWait(radio(), FREQ_A_MHZ);
    await waitFor(
      () => observer?.radio.tnf(tnf.id),
      `TNF ${tnf.id} to appear on the observer connection`,
    );

    await tnf.setFrequency(FREQ_B_MHZ);

    await waitFor(() => {
      const remote = observer?.radio.tnf(tnf.id);
      return (
        remote !== undefined &&
        Math.abs(remote.frequencyMHz - FREQ_B_MHZ) < 1e-6
      );
    }, `observer to see TNF ${tnf.id} move to ${FREQ_B_MHZ} MHz`);
  });

  it("tnf remove propagates to the other client", async () => {
    const tnf = await createTnfAndWait(radio(), FREQ_A_MHZ);
    const id = tnf.id;
    await waitFor(
      () => observer?.radio.tnf(id),
      `TNF ${id} to appear on the observer connection`,
    );

    await tnf.remove();
    untrackTnf(id);

    await waitFor(
      () => observer?.radio.tnfs().every((t) => t.id !== id) === true,
      `observer to see TNF ${id} removed`,
    );
  });
});
