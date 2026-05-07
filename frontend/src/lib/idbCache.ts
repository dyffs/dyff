import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'fastpr-cache'
const DB_VERSION = 1

interface CacheEntry<T> {
  value: T
  expiresAt: number | null // null = never expires
}

let dbPromise: Promise<IDBPDatabase> | null = null

/**
 * Ensures an object store exists. Because IndexedDB schema changes require a
 * version bump, we pre-register known store names here. Add a new name when
 * introducing a new cache use-case and bump DB_VERSION accordingly.
 *
 * Known stores:
 *   'repo-content'  – RepoContent blobs keyed by owner/repo@commitSha
 */
const KNOWN_STORES = ['repo-content'] as const
export type KnownStore = (typeof KNOWN_STORES)[number]

// Re-open the DB at the correct version that includes all known stores
function getVersionedDb (): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade (db) {
        for (const store of KNOWN_STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store)
          }
        }
      },
    })
  }
  return dbPromise
}

/**
 * Generic, typed IndexedDB cache.
 *
 * Usage:
 *   const cache = createIdbCache<RepoContent>('repo-content')
 *   await cache.set('owner/repo@sha', content, { ttlMs: 7 * 24 * 60 * 60 * 1000 })
 *   const hit = await cache.get('owner/repo@sha')
 */
export function createIdbCache<T> (storeName: KnownStore) {
  async function get (key: string): Promise<T | undefined> {
    try {
      const db = await getVersionedDb()
      const entry = await db.get(storeName, key) as CacheEntry<T> | undefined
      if (!entry) return undefined

      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        // Expired – delete in the background, return miss
        void db.delete(storeName, key)
        return undefined
      }

      return entry.value
    } catch (err) {
      console.warn(`[idbCache] get failed for store="${storeName}" key="${key}"`, err)
      return undefined
    }
  }

  async function set (key: string, value: T, options?: { ttlMs?: number }): Promise<void> {
    try {
      const db = await getVersionedDb()
      const entry: CacheEntry<T> = {
        value,
        expiresAt: options?.ttlMs != null ? Date.now() + options.ttlMs : null,
      }
      await db.put(storeName, entry, key)
    } catch (err) {
      console.warn(`[idbCache] set failed for store="${storeName}" key="${key}"`, err)
    }
  }

  async function del (key: string): Promise<void> {
    try {
      const db = await getVersionedDb()
      await db.delete(storeName, key)
    } catch (err) {
      console.warn(`[idbCache] delete failed for store="${storeName}" key="${key}"`, err)
    }
  }

  async function clear (): Promise<void> {
    try {
      const db = await getVersionedDb()
      await db.clear(storeName)
    } catch (err) {
      console.warn(`[idbCache] clear failed for store="${storeName}"`, err)
    }
  }

  async function keys (): Promise<string[]> {
    try {
      const db = await getVersionedDb()
      return (await db.getAllKeys(storeName)) as string[]
    } catch (err) {
      console.warn(`[idbCache] keys failed for store="${storeName}"`, err)
      return []
    }
  }

  return { get, set, delete: del, clear, keys }
}
