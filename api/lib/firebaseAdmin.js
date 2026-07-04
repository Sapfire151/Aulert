const admin = require('firebase-admin');

// Singleton — only initialize once across hot-reloads in Vercel serverless
if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Production: full JSON stored as env var
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not valid JSON: ' + e.message);
    }
  } else {
    // Local dev: load from the service account JSON file in the repo root
    // This file is git-ignored; never commit it.
    try {
      const path = require('path');
      const fs = require('fs');
      const keyPath = path.resolve(__dirname, '../../tcasx-48020-firebase-adminsdk-fbsvc-a8b8b295e4.json');
      if (fs.existsSync(keyPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        credential = admin.credential.cert(serviceAccount);
      } else {
        throw new Error('No FIREBASE_SERVICE_ACCOUNT env var and no local key file found.');
      }
    } catch (e) {
      throw new Error('Firebase Admin init failed (local): ' + e.message);
    }
  }

  admin.initializeApp({
    credential,
    databaseURL: 'https://tcasx-48020-default-rtdb.asia-southeast1.firebasedatabase.app',
  });
}

const db = admin.database();

module.exports = { db, admin };
