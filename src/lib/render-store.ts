"use client";

/**
 * Finished renders, kept on this machine.
 *
 * A clip the studio finishes is the deliverable: nothing else consumes it, the
 * user watches it and saves it. On fal it goes to a public CDN and lives about
 * a week. Replicate has nowhere to put it — `/v1/files` is an input staging
 * area, auth-gated and expiring in a day — so before this it lived in an object
 * URL and vanished on reload.
 *
 * WHY INDEXEDDB AND NOT LOCALSTORAGE
 * localStorage holds strings, so a video has to be base64'd: a 10 MB clip
 * becomes about 13.3 MB of characters, and the browser stores those as UTF-16,
 * so roughly 26 MB of a quota that is commonly 5 MB. The first render would
 * fail, and it would fail by throwing inside a write that also carries the
 * asset roll. IndexedDB stores the Blob itself, at its own size, with a quota
 * measured in hundreds of megabytes.
 *
 * The roll holds `idb:<id>` in place of a URL. That survives reload where an
 * object URL does not, and it is obviously not a network address, so nothing
 * tries to fetch or health-check it.
 */

const DB = "heartstamp-renders";
const STORE = "renders";
const VERSION = 1;

export const IDB_SCHEME = "idb:";
export const isLocalRender = (url: string) => url.startsWith(IDB_SCHEME);

/**
 * Total bytes kept before the oldest are dropped.
 *
 * Generous, because these are the only copies. A 13-second 720p clip is a few
 * megabytes, so this is dozens of renders — long enough that anything still
 * wanted has been downloaded, which is what the footer has always asked for.
 */
const BUDGET = 600 * 1024 * 1024;

type Row = { id: string; blob: Blob; name: string; type: string; size: number; at: number };

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB, VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    // Private browsing and blocked storage both land here. A render that cannot
    // be kept is still a render, so this degrades rather than throws.
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        let request: IDBRequest<T>;
        try {
          request = run(db.transaction(STORE, mode).objectStore(STORE));
        } catch {
          return resolve(null);
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      }),
  );
}

/* ------------------------- the session's object URLs ------------------------ */

/*
 * Created once per id and held for the life of the page. Components read this
 * synchronously — an <img> cannot await — so the map is filled by `hydrate()`
 * before the first render that needs it, and added to as new renders land.
 */
const urls = new Map<string, string>();
let hydrated = false;
const listeners = new Set<() => void>();

const publish = () => listeners.forEach((l) => l());

export function subscribeRenders(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The object URL for an `idb:` reference, or null if it is not loaded. */
export function localRenderSrc(url: string): string | null {
  return urls.get(url.slice(IDB_SCHEME.length)) ?? null;
}

export const rendersHydrated = () => hydrated;

/** Loads every stored render into object URLs. Safe to call more than once. */
export async function hydrateRenders(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  const rows = (await tx<Row[]>("readonly", (s) => s.getAll() as IDBRequest<Row[]>)) ?? [];
  for (const row of rows) {
    if (row?.blob && !urls.has(row.id)) urls.set(row.id, URL.createObjectURL(row.blob));
  }
  await evict(rows);
  publish();
}

/** Oldest first, until the total is under budget. */
async function evict(rows: Row[]) {
  const sorted = [...rows].sort((a, b) => a.at - b.at);
  let total = sorted.reduce((n, r) => n + (r.size ?? 0), 0);
  for (const row of sorted) {
    if (total <= BUDGET) break;
    total -= row.size ?? 0;
    await deleteRender(`${IDB_SCHEME}${row.id}`);
  }
}

/** Stores a finished render and returns the reference to put on the asset. */
export async function saveRender(blob: Blob, name: string): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const row: Row = { id, blob, name, type: blob.type, size: blob.size, at: Date.now() };
  const stored = await tx("readwrite", (s) => s.put(row) as IDBRequest<IDBValidKey>);

  // Object URL either way: a render that could not be stored is still playable
  // for this session, which beats losing it because the disk said no.
  urls.set(id, URL.createObjectURL(blob));
  publish();

  if (stored === null) return URL.createObjectURL(blob);
  return `${IDB_SCHEME}${id}`;
}

export async function deleteRender(url: string): Promise<void> {
  if (!isLocalRender(url)) return;
  const id = url.slice(IDB_SCHEME.length);
  const src = urls.get(id);
  if (src) URL.revokeObjectURL(src);
  urls.delete(id);
  await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  publish();
}

/** What is being kept, for the roll's own accounting. */
export async function renderBytes(): Promise<number> {
  const rows = (await tx<Row[]>("readonly", (s) => s.getAll() as IDBRequest<Row[]>)) ?? [];
  return rows.reduce((n, r) => n + (r?.size ?? 0), 0);
}
