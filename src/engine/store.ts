/**
 * Session store for a hub's mock data. The v35 prototype keeps each hub's
 * records in local state that its create/edit/delete actions change; this does
 * the same (in memory, per browser tab) until the hub is wired to real APIs.
 *
 *   const ingest = createStore(() => initialIngestData());
 *   const data = ingest.use();                       // re-renders on change
 *   ingest.update((d) => { d.sceai.sources.push(src); });   // mutate a draft copy
 */
import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  /** mutate a structured clone of the state, then publish it */
  update: (fn: (draft: T) => void) => void;
  use: () => T;
  reset: () => void;
}

export function createStore<T>(init: () => T): Store<T> {
  let state = init();
  const subs = new Set<() => void>();
  const publish = () => subs.forEach((f) => f());
  const store: Store<T> = {
    get: () => state,
    set: (next) => {
      state = next;
      publish();
    },
    update: (fn) => {
      const draft = structuredClone(state);
      fn(draft);
      state = draft;
      publish();
    },
    use: () =>
      useSyncExternalStore(
        (cb) => {
          subs.add(cb);
          return () => subs.delete(cb);
        },
        () => state,
      ),
    reset: () => {
      state = init();
      publish();
    },
  };
  return store;
}
