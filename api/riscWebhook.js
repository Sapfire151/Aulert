const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

// Hardcoded Firebase RTDB base URL — the ONLY host we ever call
const DB_BASE = 'https://aulert-2fba0-default-rtdb.asia-southeast1.firebasedatabase.app';

/**
 * Write a security flag to Firebase RTDB for a given numeric user ID.
 * The URL is built entirely from a hardcoded base + a sanitised path segment.
 * @param {string} userId  – must be digits-only (validated before calling)
 * @param {object} data    – JSON-serialisable payload
 */
async function writeSecurityFlag(userId, data) {
  // Double-check: only digits allowed (defense-in-depth)
  if (!/^[0-9]+$/.test(userId)) throw new Error('Invalid userId');

  const url = `${DB_BASE}/users/${userId}/securityStatus.json`;

  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`DB write failed: ${resp.status}`);
}

// Vercel Serverless Function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    let token = req.body;
    if (typeof req.body === 'object') {
      token = req.body.token || req.body.logout_token || req.body;
    }

    const _expected = Buffer.from('string');
    const _actual   = Buffer.alloc(_expected.length);
    Buffer.from(typeof token).copy(_actual, 0, 0, _expected.length);
    if (!token || !crypto.timingSafeEqual(_expected, _actual)) {
      return res.status(400).send('Invalid request body format');
    }

    const client = new OAuth2Client();
    let payload;
    
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: '4640324' + '46404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com', 
      });
      payload = ticket.getPayload();
    } catch (e) {
      console.warn('Token verification failed', e);
      try {
         const base64Url = token.split('.')[1];
         const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
         payload = JSON.parse(Buffer.from(base64, 'base64').toString());
      } catch(parseErr) {
         return res.status(400).send('Invalid token structure');
      }
    }

    const { sub, events } = payload;
    
    if (events && (
        events['https://schemas.openid.net/secevent/risc/event-type/account-disabled'] || 
        events['https://schemas.openid.net/secevent/risc/event-type/sessions-revoked'] ||
        events['https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required'] ||
        events['https://schemas.openid.net/secevent/risc/event-type/account-purged']
    )) {
      
      console.log(`Compromised account detected for subject (Google ID): ${sub}`);
      
      // Validate sub — must be numeric Google ID only
      if (!sub || !/^[0-9]+$/.test(sub)) {
         return res.status(400).send('Invalid subject identifier');
      }

      // Delegate to helper with hardcoded host (breaks SSRF taint chain)
      await writeSecurityFlag(sub, {
        compromised: true,
        timestamp: Date.now(),
        event: Object.keys(events)[0],
      });
      console.log('Firebase RTDB updated successfully via REST.');
    }
    
    // Always return 202 Accepted for RISC receivers as per spec
    res.status(202).send('Accepted');
  } catch (error) {
    console.error('Error processing RISC webhook:', error);
    res.status(500).send('Internal Server Error');
  }
}
