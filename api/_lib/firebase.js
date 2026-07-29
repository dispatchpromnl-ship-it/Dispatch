const admin = require('firebase-admin');

let app = null;

function getFirebaseApp() {
  if (app) return app;

  const rawCreds = process.env.GOOGLE_CREDENTIALS;
  if (!rawCreds) {
    const err = new Error('GOOGLE_CREDENTIALS environment variable is not set.');
    err.statusCode = 500;
    throw err;
  }

  let credentials;
  try {
    credentials = JSON.parse(rawCreds);
  } catch {
    const err = new Error('GOOGLE_CREDENTIALS is not valid JSON.');
    err.statusCode = 500;
    throw err;
  }

  app = admin.initializeApp({
    credential: admin.cert(credentials),
    storageBucket: 'agx-dispatch.firebasestorage.app',
  });

  return app;
}

function getStorageBucket() {
  const firebaseApp = getFirebaseApp();
  return admin.storage(firebaseApp).bucket();
}

module.exports = { getFirebaseApp, getStorageBucket };
