const { OAuth2Client } = require('google-auth-library');
const {
  sendDigestForUser,
  safeFetch,
  dbGet,
  dbSet,
  dbUpdate,
  dbDelete,
  CLIENT_ID,
  CLIENT_SECRET,
} = require('./lib/digestCore');

function isValidUserId(id) {
  return typeof id === 'string' && /^[0-9]{1,30}$/.test(id);
}

function parseDigestTime(body) {
  const hour = body.digestHour;
  const minute = body.digestMinute;
  const timezone = body.digestTimezone;

  const parsed = {};
  if (hour !== undefined) {
    const h = Number(hour);
    if (!Number.isInteger(h) || h < 0 || h > 23) return { error: 'Invalid digest hour' };
    parsed.digestHour = h;
  }
  if (minute !== undefined) {
    const m = Number(minute);
    if (!Number.isInteger(m) || m < 0 || m > 59) return { error: 'Invalid digest minute' };
    parsed.digestMinute = m;
  }
  if (timezone !== undefined) {
    if (typeof timezone !== 'string' || timezone.length > 64) return { error: 'Invalid timezone' };
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      return { error: 'Invalid timezone' };
    }
    parsed.digestTimezone = timezone;
  }
  return { parsed };
}

async function verifyUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }
  const token = authHeader.split(' ')[1];
  if (!token || token.length < 10) {
    return { error: 'Invalid token', status: 401 };
  }

  let userId;
  let email;

  try {
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    userId = payload.sub;
    email = payload.email;
  } catch {
    const userInfoRes = await safeFetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!userInfoRes.ok) {
      return { error: 'Token verification failed', status: 401 };
    }
    const info = await userInfoRes.json();
    userId = info.id;
    email = info.email;
  }

  if (!userId || !isValidUserId(userId)) {
    return { error: 'Invalid user identity', status: 400 };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Invalid email address', status: 400 };
  }

  return { userId, email };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://aulert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const auth = await verifyUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { userId, email } = auth;

    const body = req.body || {};
    const { dailyEmail, authCode, sendNow } = body;

    const digestPath = `users/${encodeURIComponent(userId)}/digest`;

    // === SEND NOW ===
    if (sendNow) {
      const digest = await dbGet(digestPath);
      if (!digest) {
        return res.status(404).json({ error: 'Daily digest is not enabled' });
      }
      if (!digest.dailyEmail) {
        return res.status(400).json({ error: 'Daily digest is not enabled' });
      }

      try {
        const result = await sendDigestForUser(userId, digest, { manual: true });
        if (result.sent) {
          return res.status(200).json({ success: true, message: 'Digest sent', itemCount: result.itemCount });
        }
        return res.status(200).json({
          success: true,
          message: 'No new items in the last 24 hours',
          itemCount: 0,
        });
      } catch (e) {
        console.error('sendNow failed:', e.message);
        return res.status(500).json({ error: 'Failed to send digest' });
      }
    }

    // === UPDATE SEND TIME (only when not an enable/disable request) ===
    const timeParse = parseDigestTime(body);
    if (timeParse.error) return res.status(400).json({ error: timeParse.error });
    if (Object.keys(timeParse.parsed).length > 0 && dailyEmail === undefined && !authCode) {
      const existing = await dbGet(digestPath);
      if (!existing) {
        return res.status(404).json({ error: 'Daily digest is not enabled' });
      }
      await dbUpdate(digestPath, { ...timeParse.parsed, updatedAt: Date.now() });
      return res.status(200).json({ success: true, message: 'Send time updated' });
    }

    // === DISABLE daily email ===
    if (dailyEmail === false) {
      await dbDelete(digestPath);
      return res.status(200).json({ success: true, message: 'Daily email disabled' });
    }

    // === ENABLE daily email ===
    if (!authCode || typeof authCode !== 'string') {
      return res.status(400).json({ error: 'Authorization code is required to enable daily emails' });
    }

    if (!CLIENT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error: missing client secret' });
    }

    const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, 'postmessage');
    let tokens;
    try {
      const tokenResponse = await oAuth2Client.getToken(authCode);
      tokens = tokenResponse.tokens;
    } catch (tokenErr) {
      console.error('Token exchange failed:', tokenErr.message, tokenErr.response?.data);
      const detail = tokenErr.response?.data?.error_description || tokenErr.response?.data?.error || tokenErr.message;
      return res.status(400).json({ error: 'Failed to exchange authorization code: ' + (detail || 'Please try again.') });
    }

    if (!tokens.refresh_token) {
      return res.status(400).json({
        error: 'No refresh token received. Please revoke Aulert access in your Google Account settings and try again.',
      });
    }

    const defaultTz = body.digestTimezone || 'UTC';
    const digestPayload = {
      dailyEmail: true,
      email,
      refreshToken: tokens.refresh_token,
      digestHour: timeParse.parsed.digestHour ?? 7,
      digestMinute: timeParse.parsed.digestMinute ?? 0,
      digestTimezone: timeParse.parsed.digestTimezone ?? defaultTz,
      updatedAt: Date.now(),
    };

    await dbSet(digestPath, digestPayload);

    res.status(200).json({ success: true, message: 'Daily email enabled' });
  } catch (error) {
    console.error('Error in emailPrefs handler:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
