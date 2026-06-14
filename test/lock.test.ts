import { describe, it, expect } from "vitest";
import { createMutex } from "../src/lock.js";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("createMutex", () => {
  it("serializes concurrent critical sections (no interleaving)", async () => {
    const mutex = createMutex();
    const log: string[] = [];

    const task = (id: string) =>
      mutex.runExclusive(async () => {
        log.push(`${id}-start`);
        await delay(5);
        log.push(`${id}-end`);
      });

    // Fire three concurrently; the mutex must run them one-at-a-time, in order.
    await Promise.all([task("a"), task("b"), task("c")]);

    expect(log).toEqual([
      "a-start",
      "a-end",
      "b-start",
      "b-end",
      "c-start",
      "c-end",
    ]);
  });

  it("returns the critical section's value", async () => {
    const mutex = createMutex();
    const result = await mutex.runExclusive(async () => 42);
    expect(result).toBe(42);
  });

  it("releases the lock even when the critical section throws", async () => {
    const mutex = createMutex();
    await expect(
      mutex.runExclusive(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // Lock must be free for the next caller despite the prior rejection.
    const after = await mutex.runExclusive(async () => "recovered");
    expect(after).toBe("recovered");
  });
});
