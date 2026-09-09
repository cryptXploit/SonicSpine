import { SessionAnalytics } from '../analytics/SessionManager';

export interface SavedSession extends SessionAnalytics {
  id?: number;
  timestamp: number;
}

const DB_NAME = 'SonicSpineDB';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_SETTINGS = 'settings';

export class Database {
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("IndexedDB blocked or failed");
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessionStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true });
          sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
    });
  }

  public async saveSession(session: SessionAnalytics): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error("DB not initialized"));

      const transaction = this.db.transaction([STORE_SESSIONS], 'readwrite');
      const store = transaction.objectStore(STORE_SESSIONS);
      
      const record: SavedSession = {
        ...session,
        timestamp: Date.now()
      };

      const request = store.add(record);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  public async getRecentSessions(limit: number = 10): Promise<SavedSession[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error("DB not initialized"));

      const transaction = this.db.transaction([STORE_SESSIONS], 'readonly');
      const store = transaction.objectStore(STORE_SESSIONS);
      const index = store.index('timestamp');
      
      const request = index.openCursor(null, 'prev'); // descending
      const results: SavedSession[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Used for testing to forcefully close the connection
  public close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const db = new Database();
