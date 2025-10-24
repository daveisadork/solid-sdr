export type Listener<T> = (payload: T) => void;

export interface Subscription {
  unsubscribe(): void;
}

export class TypedEventEmitter<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<
    keyof TEvents,
    Set<Listener<unknown>>
  >();

  on<TKey extends keyof TEvents>(
    event: TKey,
    listener: Listener<TEvents[TKey]>,
  ): Subscription {
    const bucket = this.ensureBucket(event);
    bucket.add(listener);
    return {
      unsubscribe: () => this.off(event, listener),
    };
  }

  once<TKey extends keyof TEvents>(
    event: TKey,
    listener: Listener<TEvents[TKey]>,
  ): Subscription {
    const wrapper: Listener<TEvents[TKey]> = (payload) => {
      this.off(event, wrapper);
      listener(payload);
    };
    return this.on(event, wrapper);
  }

  off<TKey extends keyof TEvents>(
    event: TKey,
    listener: Listener<TEvents[TKey]>,
  ): void {
    const bucket = this.getBucket(event);
    if (!bucket) return;
    bucket.delete(listener);
    if (bucket.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    const bucket = this.getBucket(event);
    if (!bucket) return;
    for (const listener of bucket) {
      listener(payload);
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }

  private ensureBucket<TKey extends keyof TEvents>(
    event: TKey,
  ): Set<Listener<TEvents[TKey]>> {
    let bucket = this.listeners.get(event) as
      | Set<Listener<TEvents[TKey]>>
      | undefined;
    if (!bucket) {
      bucket = new Set<Listener<TEvents[TKey]>>();
      this.listeners.set(event, bucket as Set<Listener<unknown>>);
    }
    return bucket;
  }

  private getBucket<TKey extends keyof TEvents>(
    event: TKey,
  ): Set<Listener<TEvents[TKey]>> | undefined {
    return this.listeners.get(event) as
      | Set<Listener<TEvents[TKey]>>
      | undefined;
  }
}
