const crypto = require('crypto');
const { dbGet, dbDelete, deliverDiscordForUser, CLIENT_SECRET } = require('./lib/digestCore');

export default async function handler(req, res) {
  const supplied = req.headers.authorization || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  const authorized = supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
  if (!CLIENT_SECRET) return res.status(500).json({ error: 'GOOGLE_CLIENT_SECRET not configured' });

  try {
    const users = await dbGet('users');
    if (!users) return res.status(200).json({ message: 'No users registered', sent: 0, migrated: 0 });

    let sent = 0;
    let errors = 0;
    let migrated = 0;
    for (const [userId, userData] of Object.entries(users)) {
      if (userData.digest) {
        await dbDelete(`users/${encodeURIComponent(userId)}/digest`);
        migrated++;
      }
      if (!userData.discord) continue;
      try {
        const result = await deliverDiscordForUser(userId, userData.discord);
        sent += result.sent || 0;
        errors += result.errors || 0;
      } catch (error) {
        errors++;
        console.warn(`Discord cron failed for ${userId}:`, error.message);
        if (/invalid_grant|expired or revoked/i.test(error.message)) {
          await dbDelete(`users/${encodeURIComponent(userId)}/discord`);
        }
      }
    }
    return res.status(200).json({ sent, errors, migrated });
  } catch (error) {
    console.error('Discord cron error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
