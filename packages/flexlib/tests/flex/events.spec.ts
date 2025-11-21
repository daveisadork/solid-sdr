import { describe, expect, it } from "vitest";
import {
  TypedEventEmitter,
  type ListenerErrorInfo,
  type Subscription,
} from "../../src/util/events.js";

interface TestEvents {
  foo: string;
  bar: number;
}

describe("TypedEventEmitter", () => {
  it("delivers events to registered listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const payloads: string[] = [];
    emitter.on("foo", (payload) => payloads.push(payload));

    emitter.emit("foo", "a");
    emitter.emit("foo", "b");

    expect(payloads).toEqual(["a", "b"]);
  });

  it("supports once listeners that remove themselves after firing", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const payloads: number[] = [];
    emitter.once("bar", (payload) => payloads.push(payload));

    emitter.emit("bar", 1);
    emitter.emit("bar", 2);

    expect(payloads).toEqual([1]);
  });

  it("removes listeners via subscription handles", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const payloads: string[] = [];
    const subscription = emitter.on("foo", (payload) => payloads.push(payload));

    emitter.emit("foo", "first");
    subscription.unsubscribe();
    emitter.emit("foo", "second");

    expect(payloads).toEqual(["first"]);
  });

  it("clears all listeners via removeAll", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const payloads: Array<{ event: keyof TestEvents; value: string | number }> =
      [];
    const subscriptions: Subscription[] = [
      emitter.on("foo", (payload) =>
        payloads.push({ event: "foo", value: payload }),
      ),
      emitter.on("bar", (payload) =>
        payloads.push({ event: "bar", value: payload }),
      ),
    ];

    emitter.emit("foo", "a");
    emitter.emit("bar", 1);

    emitter.removeAll();
    subscriptions.forEach((subscription) => subscription.unsubscribe());

    emitter.emit("foo", "b");
    emitter.emit("bar", 2);

    expect(payloads).toEqual([
      { event: "foo", value: "a" },
      { event: "bar", value: 1 },
    ]);
  });

  it("still calls all listeners even when one throws and reports via callback", () => {
    const errors: ListenerErrorInfo<TestEvents>[] = [];
    const emitter = new TypedEventEmitter<TestEvents>({
      onListenerError: (info) => errors.push(info),
      rethrowStrategy: "none",
    });
    const calls: string[] = [];

    emitter.on("foo", () => {
      calls.push("first");
      throw new Error("boom");
    });

    emitter.on("foo", () => {
      calls.push("second");
    });

    expect(() => emitter.emit("foo", "payload")).not.toThrow();
    expect(calls).toEqual(["first", "second"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      event: "foo",
      payload: "payload",
      listenerIndex: 0,
      listenerCount: 2,
    });
    expect((errors[0].error as Error).message).toBe("boom");
  });

  it("rethrows listener errors on a future tick by default", () => {
    const captured: Array<() => void> = [];
    const originalQueueMicrotask = globalThis.queueMicrotask;
    (globalThis as { queueMicrotask?: typeof queueMicrotask }).queueMicrotask =
      (fn: () => void) => {
        captured.push(fn);
      };

    try {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.on("foo", () => {
        throw new Error("later");
      });
      expect(() => emitter.emit("foo", "payload")).not.toThrow();
      expect(captured).toHaveLength(1);
      expect(() => captured[0]()).toThrowError("later");
    } finally {
      if (originalQueueMicrotask) {
        globalThis.queueMicrotask = originalQueueMicrotask;
      } else {
        delete (globalThis as { queueMicrotask?: typeof queueMicrotask })
          .queueMicrotask;
      }
    }
  });
});
