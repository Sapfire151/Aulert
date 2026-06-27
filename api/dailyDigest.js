const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const {
  sendDigestForUser,
  safeFetch,
  DB_BASE,
  CLIENT_SECRET,
} = require('./lib/digestCore');

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  let authorized = false;
  if (authHeader.length === expectedAuth.length) {
    authorized = crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));
  }

  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!CLIENT_SECRET) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_SECRET not configured' });
  }

  try {
    const usersResp = await fetch(`${DB_BASE}/users.json`);
    if (!usersResp.ok) throw new Error('Failed to fetch users from database');
    const allUsers = await usersResp.json();

    if (!allUsers) return res.status(200).json({ message: 'No users registered', sent: 0 });

    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [userId, userData] of Object.entries(allUsers)) {
      const digest = userData.digest;
      if (!digest || !digest.dailyEmail || !digest.refreshToken || !digest.email) continue;

      try {
        const result = await sendDigestForUser(userId, digest, { manual: false });
        if (result.sent) sentCount++;
        else skippedCount++;
      } catch (e) {
        errorCount++;
        console.warn(`Failed for user ${userId}:`, e.message);

        if (e.message && (e.message.includes('invalid_grant') || e.message.includes('Token has been expired or revoked'))) {
          console.warn(`Removing stale digest entry for user ${userId}`);
          try {
            await safeFetch(`${DB_BASE}/users/${userId}/digest.json`, { method: 'DELETE' });
          } catch (cleanupErr) {
            console.warn('Cleanup failed:', cleanupErr.message);
          }
        }
      }
    }

    res.status(200).json({ sent: sentCount, skipped: skippedCount, errors: errorCount });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
