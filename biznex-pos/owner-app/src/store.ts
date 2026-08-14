import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local data store — offline-first cache of everything the app shows.
 *
 * Each dataset (dashboard, orders, products, …) is kept in memory for instant
 * reads AND persisted to AsyncStorage so it survives app restarts. Screens
 * render from the cache immediately, then the background sync engine updates
 * it through the tunnel. `useCache()` subscribes a screen to its dataset so
 * it re-renders the moment fresh data arrives — exactly how regular apps work.
 */

interface Entry<T> {
  syncedAt: number;
  data: T;
}

const PREFIX = 'biznex_cache_';
const memory = new Map<string, Entry<unknown>>();
const listeners = new Set<() => void>();

function keyOf(name: string): string {
  return PREFIX + name;
}

function notify(): void {
  listeners.forEach((cb) => cb());
}

/** Load every persisted dataset into memory. Safe to call at startup. */
export async function hydrateCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const wanted = keys.filter((k) => k.startsWith(PREFIX));
    if (wanted.length === 0) return;
    const pairs = await AsyncStorage.multiGet(wanted);
    for (const [k, raw] of pairs) {
      if (!raw) continue;
      try {
        const entry = JSON.parse(raw) as Entry<unknown>;
        if (entry && typeof entry.syncedAt === 'number' && 'data' in entry) {
          memory.set(k, entry);
        }
      } catch {
        /* skip corrupt entry */
      }
    }
    notify();
  } catch {
    /* storage unavailable — app still works, just without persistence */
  }
}

/** Current cached value for a dataset, or null if never synced. */
export function getCache<T>(name: string): T | null {
  const entry = memory.get(keyOf(name)) as Entry<T> | undefined;
  return entry ? entry.data : null;
}

/** When the cached value was last written, or null if never synced. */
export function getSyncedAt(name: string): number | null {
  const entry = memory.get(keyOf(name));
  return entry ? entry.syncedAt : null;
}

/**
 * Write a dataset to the store: updates memory (instant for subscribers),
 * persists it, and notifies listeners. Never throws.
 */
export async function setCache<T>(name: string, data: T): Promise<void> {
  const entry: Entry<T> = { syncedAt: Date.now(), data };
  memory.set(keyOf(name), entry);
  notify();
  try {
    await AsyncStorage.setItem(keyOf(name), JSON.stringify(entry));
  } catch {
    /* persist failed — memory copy still serves this session */
  }
}

/** Remove a dataset from the store (e.g. on sign-out). */
export async function clearCache(name: string): Promise<void> {
  memory.delete(keyOf(name));
  notify();
  try {
    await AsyncStorage.removeItem(keyOf(name));
  } catch {
    /* noop */
  }
}

/** Clear every cached dataset (sign-out). */
export async function clearAllCache(): Promise<void> {
  memory.clear();
  notify();
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {
    /* noop */
  }
}

/** Subscribe to any store change. Returns an unsubscribe function. */
export function subscribeCache(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * React hook: returns the cached value for a dataset and re-renders whenever
 * it changes (initial render uses whatever is in memory — possibly from a
 * previous session, so screens appear instantly).
 */
export function useCache<T>(name: string): T | null {
  const [value, setValue] = useState<T | null>(() => getCache<T>(name));
  useEffect(() => {
    const off = subscribeCache(() => setValue(getCache<T>(name)));
    // If hydration finished between first render and this effect, make sure
    // we pick up the persisted value.
    setValue(getCache<T>(name));
    return off;
  }, [name]);
  return value;
}

/** React hook: the last-synced timestamp for a dataset. */
export function useSyncedAt(name: string): number | null {
  const [at, setAt] = useState<number | null>(() => getSyncedAt(name));
  useEffect(() => {
    const off = subscribeCache(() => setAt(getSyncedAt(name)));
    setAt(getSyncedAt(name));
    return off;
  }, [name]);
  return at;
}
