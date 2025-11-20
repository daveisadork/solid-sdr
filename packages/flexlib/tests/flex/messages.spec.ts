import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import { parseFlexMessage } from "../../src/flex/protocol.js";

const messagesPath = fileURLToPath(
  new URL("../../messages.txt", import.meta.url),
);

describe("real message log", () => {
  it("parses every status line and applies it to the store", () => {
    const lines = readFileSync(messagesPath, "utf-8")
      .split(/\r?\n/)
      .filter(Boolean);

    const store = createRadioStateStore();
    for (const raw of lines) {
      const parsed = parseFlexMessage(raw, Date.now());
      expect(parsed).toBeDefined();
      if (!parsed || parsed.kind !== "status") continue;
      expect(() => store.apply(parsed)).not.toThrow();
    }
  });
});
