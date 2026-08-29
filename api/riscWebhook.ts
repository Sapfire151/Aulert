import { OAuth2Client } from 'google-auth-library';
import { CLIENT_ID, dbSet } from './lib/digestCore';
import { createGatewayHandler, logger } from './lib/security';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Write a security flag to Firebase RTDB for a given numeric user ID.
 * Uses Firebase Admin SDK — bypasses security rules with full admin access.
 */
async function writeSecurityFlag(userId: string, data: unknown): Promise<void> {
  if (!/^[0-9]+$/.test(userId)) throw new Error('Invalid userId');
  await dbSet(`users/${userId}/securityStatus`, data);
}

// Vercel Serverless Function
export default createGatewayHandler(
  async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const body = req.body;
    let token: string | undefined;
    if (typeof body === 'string') {
      token = body;
    } else if (body && typeof body === 'object') {
      token = (body as { token?: string; logout_token?: string }).token || (body as { logout_token?: string }).logout_token || undefined;
    }
    if (!token || typeof token !== 'string' || token.length < 20 || token.length > 8192) {
      res.status(400).send('Invalid request body format');
      return;
    }

    // Signature verification is mandatory. RISC security events are signed
    // Google JWTs; anything that does not verify against Google's keys is
    // rejected outright — unsigned payloads must NEVER reach the write path.
    const client = new OAuth2Client(CLIENT_ID);
    let payload: Record<string, unknown>;
    try {
      const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
      payload = (ticket.getPayload() as unknown as Record<string, unknown>) ?? {};
    } catch (e) {
      logger.warn('RISC token signature verification failed', { message: e instanceof Error ? e.message : String(e) });
      res.status(400).send('Invalid token structure');
      return;
    }

    const events = (payload.sub ? (payload.events as Record<string, unknown> | undefined) : undefined) ?? {};
    const sub = payload.sub as string | undefined;
    const hasRevocation = Boolean(
      events['https://schemas.openid.net/secevent/risc/event-type/account-disabled'] ||
        events['https://schemas.openid.net/secevent/risc/event-type/sessions-revoked'] ||
        events['https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required'] ||
        events['https://schemas.openid.net/secevent/risc/event-type/account-purged']
    );

    if (hasRevocation) {
      if (!sub || !/^[0-9]+$/.test(sub)) {
        res.status(400).send('Invalid subject identifier');
        return;
      }
      logger.info('Compromised account flagged via RISC', { sub });
      await writeSecurityFlag(sub, {
        compromised: true,
        timestamp: Date.now(),
        event: Object.keys(events)[0],
      });
    }

    res.status(202).send('Accepted');
  } catch (error) {
    logger.error('Error processing RISC webhook', { message: error instanceof Error ? error.message : String(error) });
    res.status(500).send('Internal Server Error');
  }
}
