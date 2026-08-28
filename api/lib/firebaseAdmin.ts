import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import path from 'path';
import fs from 'fs';

let _db: unknown = null;

/**
 * Returns the Firebase Admin DB instance, initializing lazily on first call.
 * This prevents module-load crashes if the env var is missing — errors surface
 * as proper API responses instead of silent 500s.
 */
export function getDb(): unknown {
  if (_db) return _db;

  if (getApps().length === 0) {
    let serviceAccount: unknown;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Production / Vercel: full JSON stored as a single-line env var
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (e) {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT env var is not valid JSON: ' + (e instanceof Error ? e.message : String(e))
        );
      }
    } else {
      // Local dev: load from the service account JSON file in the repo root
      let keyPath = path.resolve(__dirname, '../../tcasx-48020-firebase-adminsdk-fbsvc-a8b8b295e4.json');
      if (!fs.existsSync(keyPath)) {
        keyPath = path.resolve(process.cwd(), 'tcasx-48020-firebase-adminsdk-fbsvc-a8b8b295e4.json');
      }

      if (!fs.existsSync(keyPath)) {
        throw new Error(
          'Firebase Admin: FIREBASE_SERVICE_ACCOUNT env var not set and no local key file found at ' + keyPath
        );
      }
      try {
        serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      } catch (e) {
        throw new Error('Firebase Admin: failed to parse local key file: ' + (e instanceof Error ? e.message : String(e)));
      }
    }

    initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      databaseURL: 'https://tcasx-48020-default-rtdb.asia-southeast1.firebasedatabase.app',
    });
  }

  _db = getDatabase();
  return _db;
}
