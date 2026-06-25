export type EventHandler<T> = (payload: T) => void;

/**
 * Minimal typed publish/subscribe bus. `Events` maps each event name to its
 * payload type, giving compile-time safety on both `emit` and `on`.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private readonly handlers: {
    [K in keyof Events]?: Set<EventHandler<Events[K]>>;
  } = {};

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers[event];
    if (!set) {
      set = new Set();
      this.handlers[event] = set;
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribe to the next occurrence only. */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const wrapped: EventHandler<Events[K]> = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers[event]?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers[event];
    if (!set) return;
    // Copy first so a handler may unsubscribe while we iterate.
    for (const handler of Array.from(set)) handler(payload);
  }

  clear(): void {
    for (const key of Object.keys(this.handlers) as Array<keyof Events>) {
      delete this.handlers[key];
    }
  }
}
