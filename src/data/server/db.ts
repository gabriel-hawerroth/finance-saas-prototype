/**
 * Runtime access to the mock database: lazy load from localStorage, seeding,
 * persistence and the simulated session cookie.
 */
import { ApiError } from "@/domain/errors";
import type { Id } from "@/domain/types";
import { storage } from "@/lib/storage";
import { buildDemoDataset, buildStarterDataset, DEMO_USER } from "./seed";
import { DB_KEY, DB_VERSION, SESSION_KEY, type Dataset, type DB, type StoredUser } from "./store";

let db: DB | null = null;

function freshDB(): DB {
  return {
    version: DB_VERSION,
    users: [structuredClone(DEMO_USER)],
    datasets: { [DEMO_USER.id]: buildDemoDataset() },
    tokens: [],
    inbox: [],
    userSeq: 100,
  };
}

export function getDB(): DB {
  if (db) return db;
  const stored = storage.get<DB | null>(DB_KEY, null);
  db = stored && stored.version === DB_VERSION ? stored : freshDB();
  if (!stored || stored.version !== DB_VERSION) persist();
  return db;
}

/** Writes the DB; on quota errors retries without attachment payloads. */
export function persist(): void {
  if (!db || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    const slim = JSON.parse(JSON.stringify(db)) as DB;
    for (const ds of Object.values(slim.datasets)) {
      for (const r of ds.releases) if (r.attachment) r.attachment = { ...r.attachment, dataUrl: "" };
      for (const p of ds.payments) if (p.attachment) p.attachment = { ...p.attachment, dataUrl: "" };
    }
    try {
      window.localStorage.setItem(DB_KEY, JSON.stringify(slim));
    } catch {
      /* give up silently: data stays in memory for this tab */
    }
  }
}

export function resetDB(): void {
  db = freshDB();
  persist();
}

/* ───── session ("cookie") ───── */

export function getSessionUserId(): Id | null {
  return storage.get<Id | null>(SESSION_KEY, null);
}

export function setSessionUserId(id: Id | null): void {
  if (id == null) storage.remove(SESSION_KEY);
  else storage.set(SESSION_KEY, id);
}

export function currentUser(): StoredUser {
  const id = getSessionUserId();
  const user = id == null ? undefined : getDB().users.find((u) => u.id === id);
  if (!user) throw new ApiError(401, { errorDescription: "unauthorized" });
  return user;
}

export function datasetOf(userId: Id): Dataset {
  const d = getDB();
  if (!d.datasets[userId]) d.datasets[userId] = buildStarterDataset();
  return d.datasets[userId];
}

/** Read access to the signed-in user's dataset. */
export function read<T>(fn: (ds: Dataset, user: StoredUser) => T): T {
  const user = currentUser();
  return fn(datasetOf(user.id), user);
}

/**
 * Transactional write: the mutation runs on a draft copy and is committed only if
 * it does not throw, so business errors never leave partial state behind.
 */
export function write<T>(fn: (ds: Dataset, user: StoredUser) => T): T {
  const user = currentUser();
  const d = getDB();
  const draft = structuredClone(datasetOf(user.id));
  const result = fn(draft, user);
  d.datasets[user.id] = draft;
  persist();
  return result;
}
