const { OAuth2Client } = require('google-auth-library');

const DB_BASE = 'https://aulert-2fba0-default-rtdb.asia-southeast1.firebasedatabase.app';
const CLIENT_ID = '4640324' + '46404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const ALLOWED_HOSTS = [
  'www.googleapis.com',
  'aulert-2fba0-default-rtdb.asia-southeast1.firebasedatabase.app'
];

function safeFetch(urlStr, options) {
  const url = new URL(urlStr);
  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    throw new Error('Blocked: URL not in allow-list (SSRF Protection)');
  }
  return fetch(url.toString(), options);
}

/**
 * Validates and sanitizes the userId to prevent Firebase path injection.
 * Only allows numeric user IDs (Google sub values).
 */
function isValidUserId(id) {
  return typeof id === 'string' && /^[0-9]{1,30}$/.test(id);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://aulert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Validate Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.split(' ')[1];

    if (!token || token.length < 10) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify token to get user identity
    let userId, email;

    try {
      // Try as ID token first
      const client = new OAuth2Client(CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID,
      });
      const payload = ticket.getPayload();
      userId = payload.sub;
      email = payload.email;
    } catch {
      // Fall back to access token — fetch user info from Google
      const userInfoRes = await safeFetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!userInfoRes.ok) {
        return res.status(401).json({ error: 'Token verification failed' });
      }
      const info = await userInfoRes.json();
      userId = info.id;
      email = info.email;
    }

    if (!userId || !isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid user identity' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const { dailyEmail, authCode } = req.body || {};

    // === DISABLE daily email ===
    if (!dailyEmail) {
      const url = `${DB_BASE}/users/${encodeURIComponent(userId)}/digest.json`;
      const delResp = await safeFetch(url, { method: 'DELETE' });
      if (!delResp.ok) {
        console.error('Firebase DELETE failed:', delResp.status);
        return res.status(500).json({ error: 'Failed to remove email preference' });
      }
      return res.status(200).json({ success: true, message: 'Daily email disabled' });
    }

    // === ENABLE daily email ===
    if (!authCode || typeof authCode !== 'string') {
      return res.status(400).json({ error: 'Authorization code is required to enable daily emails' });
    }

    if (!CLIENT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error: missing client secret' });
    }

    // Exchange authorization code for tokens
    const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, 'postmessage');
    let tokens;
    try {
      const tokenResponse = await oAuth2Client.getToken(authCode);
      tokens = tokenResponse.tokens;
    } catch (tokenErr) {
      console.error('Token exchange failed');
      return res.status(400).json({ error: 'Failed to exchange authorization code. Please try again.' });
    }

    if (!tokens.refresh_token) {
      return res.status(400).json({
        error: 'No refresh token received. Please revoke Aulert access in your Google Account settings and try again.'
      });
    }

    const url = `${DB_BASE}/users/${encodeURIComponent(userId)}/digest.json`;
    const resp = await safeFetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dailyEmail: true,
        email: email,
        refreshToken: tokens.refresh_token,
        updatedAt: Date.now()
      }),
    });

    if (!resp.ok) {
      console.error('Firebase PUT failed:', resp.status);
      return res.status(500).json({ error: 'Failed to save email preference' });
    }

    res.status(200).json({ success: true, message: 'Daily email enabled' });

  } catch (error) {
    console.error('Error in emailPrefs handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
