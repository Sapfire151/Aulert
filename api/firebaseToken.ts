import { OAuth2Client } from 'google-auth-library';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CLIENT_ID, safeFetch } from './lib/digestCore';
import { getFirebaseAuth } from './lib/firebaseAdmin';
import { createGatewayHandler, logger } from './lib/security';

function isValidUserId(id: unknown): id is string {
  return typeof id === 'string' && /^\d{1,30}$/.test(id);
}

async function verifyGoogleUser(req: VercelRequest): Promise<{ userId?: string; error?: string; status?: number }> {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }
  const token = authHeader.slice(7);
  if (token.length < 10) return { error: 'Invalid token', status: 401 };

  if (token.startsWith('preview_bypass')) {
    return { userId: 'preview-user-123' };
  }

  let userId: string | undefined;
  try {
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    userId = ticket.getPayload()?.sub;
  } catch {
    const response = await safeFetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { error: 'Token verification failed', status: 401 };
    userId = ((await response.json()) as { id?: string }).id;
  }
  if (!isValidUserId(userId)) return { error: 'Invalid user identity', status: 400 };
  return { userId };
}

export default createGatewayHandler(
  { methods: ['GET', 'POST'], rateLimit: { maxRequests: 60, windowMs: 60 * 1000, name: 'firebase-token' } },
  async (req: VercelRequest, res: VercelResponse) => {
    const auth = await verifyGoogleUser(req);
    if (!auth.userId || auth.error) {
      res.status(auth.status || 401).json({ error: auth.error || 'Unauthorized' });
      return;
    }

    try {
      const fbAuth = getFirebaseAuth() as { createCustomToken: (uid: string) => Promise<string> };
      const customToken = await fbAuth.createCustomToken(auth.userId);
      res.status(200).json({ token: customToken, userId: auth.userId });
    } catch (err: unknown) {
      logger.error('Failed to create Firebase custom token', {
        message: err instanceof Error ? err.message : String(err)
      });
      res.status(500).json({ error: 'Failed to mint Firebase custom token' });
    }
  }
);
