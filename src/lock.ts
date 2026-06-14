/**
 * Minimal async mutex: serializes critical sections so concurrent HTTP clients
 * can't run two `memory_write` index-regens at once (which would race on
 * MEMORY.md / hot.md). Each call chains onto the previous one's completion.
 */
export interface Mutex {
  runExclusive<T>(fn: () => Promise<T>): Promise<T>;
}

export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    runExclusive<T>(fn: () => Promise<T>): Promise<T> {
      const result = tail.then(() => fn());
      // Advance the chain whether fn resolves or rejects, so one failure
      // never deadlocks subsequent callers.
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}
