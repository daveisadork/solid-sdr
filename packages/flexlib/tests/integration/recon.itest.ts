import { describe, expect, it } from "vitest";
import { hasGps, recon } from "./harness/capabilities.js";
import { useSession } from "./harness/session.js";

describe("connection handshake", () => {
  const { radio } = useSession();

  it("connects and receives a client handle", () => {
    expect(radio().connectionState).toBe("connected");
    expect(radio().clientHandle).toBeTruthy();
  });

  it("populates the radio snapshot with identity matching recon", () => {
    const snapshot = radio().snapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot?.model).toBe(recon().model);
    expect(snapshot?.version).toBe(recon().version);
    expect(snapshot?.serial).toBe(recon().serial);
  });

  it("runs with the tx inhibit guard engaged", () => {
    // The suite's cardinal safety rule: tests never run without tx inhibit.
    expect(radio().snapshot()?.txInhibit).toBe(true);
  });

  it("reports plausible hardware facts", () => {
    const snapshot = radio().snapshot();
    expect(snapshot?.scuCount).toBeGreaterThan(0);
    expect(snapshot?.sliceCount).toBeGreaterThan(0);
    expect(snapshot?.rxAntennaList.length).toBeGreaterThan(0);
  });

  describe.skipIf(!hasGps())("GPS-equipped radios", () => {
    it("reports gpsInstalled in the snapshot", () => {
      expect(radio().snapshot()?.gpsInstalled).toBe(true);
    });
  });
});
