const { OAuth2Client } = require('google-auth-library');

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

    if (!token || typeof token !== 'string') {
      return res.status(400).send('Invalid request body format');
    }

    const client = new OAuth2Client();
    let payload;
    
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: '464032446404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com', 
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
      
      // Update Firebase RTDB using REST API (no firebase-admin needed)
      const dbUrl = `https://aulert-2fba0-default-rtdb.asia-southeast1.firebasedatabase.app/users/${sub}/securityStatus.json`;
      
      await fetch(dbUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compromised: true,
          timestamp: Date.now(),
          event: Object.keys(events)[0]
        })
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
