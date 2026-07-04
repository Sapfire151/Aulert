const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const path = require('path');
const fs = require('fs');

let _db = null;

/**
 * Returns the Firebase Admin DB instance, initializing lazily on first call.
 * This prevents module-load crashes if the env var is missing — errors surface
 * as proper API responses instead of silent 500s.
 */
function getDb() {
  if (_db) return _db;

  if (getApps().length === 0) {
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Production / Vercel: full JSON stored as a single-line env var
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (e) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not valid JSON: ' + e.message);
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
        throw new Error('Firebase Admin: failed to parse local key file: ' + e.message);
      }
    }

    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: 'https://tcasx-48020-default-rtdb.asia-southeast1.firebasedatabase.app',
    });
  }

  _db = getDatabase();
  return _db;
}

module.exports = { getDb };
