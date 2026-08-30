import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

let _db: unknown = null;
let _auth: unknown = null;

function ensureInitialized(): void {
  if (getApps().length === 0) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env var is required');
    }
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      databaseURL: 'https://tcasx-48020-default-rtdb.asia-southeast1.firebasedatabase.app',
    });
  }
}

/**
 * Returns the Firebase Admin DB instance, initializing lazily on first call.
 * This prevents module-load crashes if the env var is missing — errors surface
 * as proper API responses instead of silent 500s.
 */
export function getDb(): unknown {
  if (_db) return _db;
  ensureInitialized();
  _db = getDatabase();
  return _db;
}

/**
 * Returns the Firebase Admin Auth instance, initializing lazily on first call.
 */
export function getFirebaseAuth(): unknown {
  if (_auth) return _auth;
  ensureInitialized();
  _auth = getAuth();
  return _auth;
}

