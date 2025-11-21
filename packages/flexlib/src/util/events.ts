export type Listener<T> = (payload: T) => void;

export interface Subscription {
  unsubscribe(): void;
}

export interface ListenerErrorInfo<
  TEvents extends Record<string, unknown>,
  TKey extends keyof TEvents = keyof TEvents,
> {
  readonly event: TKey;
  readonly payload: TEvents[TKey];
  readonly listenerIndex: number;
  readonly listenerCount: number;
  readonly error: unknown;
}

export interface TypedEventEmitterOptions<
  TEvents extends Record<string, unknown>,
> {
  readonly onListenerError?: (
    info: ListenerErrorInfo<TEvents>,
  ) => void;
  readonly rethrowStrategy?: "async" | "none";
}

export class TypedEventEmitter<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();
  private readonly options: TypedEventEmitterOptions<TEvents>;

  constructor(options: TypedEventEmitterOptions<TEvents> = {}) {
    this.options = options;
  }

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
    const errors: unknown[] = [];
    const total = bucket.size;
    let index = 0;
    for (const listener of bucket) {
      try {
        listener(payload);
      } catch (error) {
        errors.push(error);
        this.options.onListenerError?.({
          event,
          payload,
          listenerIndex: index,
          listenerCount: total,
          error,
        });
      }
      index += 1;
    }
    if (errors.length > 0) {
      this.scheduleAsyncRethrow(event, errors);
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

  private scheduleAsyncRethrow(
    event: keyof TEvents,
    errors: readonly unknown[],
  ): void {
    const strategy = this.options.rethrowStrategy ?? "async";
    if (strategy === "none") return;
    const throwErrors = () => {
      if (errors.length === 1) {
        throw errors[0];
      }
      throw new AggregateError(
        errors,
        `TypedEventEmitter listener failure | event=${String(event)} | count=${errors.length}`,
      );
    };
    if (typeof queueMicrotask === "function") {
      queueMicrotask(throwErrors);
    } else {
      Promise.resolve().then(throwErrors);
    }
  }
}
