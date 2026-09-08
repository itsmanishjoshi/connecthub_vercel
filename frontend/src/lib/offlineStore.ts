const DB_NAME = 'connecthub-offline';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_VERSION = 1;

interface Snapshot<T> {
  key: string;
  version: number;
  userId: string;
  savedAt: number;
  data: T;
}

export interface CachedValue<T> {
  data: T;
  savedAt: number;
}

function currentUserId(): string | null {
  return localStorage.getItem('current_user_id');
}

function scopedKey(key: string, userId: string): string {
  return `${userId}:${key}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function saveSnapshot<T>(key: string, data: T): Promise<void> {
  const userId = currentUserId();
  if (!userId || !('indexedDB' in window)) return;

  const snapshot: Snapshot<T> = {
    key: scopedKey(key, userId),
    version: SNAPSHOT_VERSION,
    userId,
    savedAt: Date.now(),
    data,
  };
  await transact('readwrite', (store) => store.put(snapshot));
}

export async function readSnapshot<T>(key: string): Promise<CachedValue<T> | null> {
  const userId = currentUserId();
  if (!userId || !('indexedDB' in window)) return null;

  const snapshot = await transact<Snapshot<T> | undefined>(
    'readonly',
    (store) => store.get(scopedKey(key, userId)),
  );
  if (!snapshot || snapshot.version !== SNAPSHOT_VERSION || snapshot.userId !== userId) {
    return null;
  }
  return { data: snapshot.data, savedAt: snapshot.savedAt };
}

export async function removeUserSnapshots(userId: string): Promise<void> {
  if (!userId || !('indexedDB' in window)) return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(`${userId}:`)) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
