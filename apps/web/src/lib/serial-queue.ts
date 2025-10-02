export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();
  private _size = 0;

  /** Enqueue an async task to run strictly after all already enqueued tasks. */
  enqueue<T>(task: () => Promise<T>): Promise<T> {
    this._size++;
    const run = async () => task().finally(() => this._size--);
    const p = this.tail.then(run, run);
    this.tail = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  }

  /** Tasks waiting or running (coarse). */
  size() {
    return this._size;
  }

  /** Wait for everything currently queued to finish. */
  async drain(): Promise<void> {
    const done = this.tail;
    await done;
  }
}
