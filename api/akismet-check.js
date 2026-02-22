// Aulert — Akismet proxy
// This function keeps your API key secret on the server.

const AKISMET_KEY  = process.env.AKISMET_KEY;   // Set this in Vercel dashboard
const AKISMET_BLOG = process.env.AKISMET_BLOG;  // e.g. https://your-site.com

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow requests from your site only (CORS protection)
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const body = req.body;

    // Build the Akismet request payload
    const params = new URLSearchParams({
      api_key         : AKISMET_KEY,
      blog            : AKISMET_BLOG,
      user_ip         : req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      user_agent      : body.user_agent  || '',
      referrer        : body.referrer    || '',
      comment_type    : 'contact-form',
      comment_content : body.comment_content || '',
      comment_author  : body.comment_author  || '',
    });

    const akismetRes = await fetch(
      `https://rest.akismet.com/1.1/comment-check`,
      {
        method  : 'POST',
        headers : { 'Content-Type': 'application/x-www-form-urlencoded' },
        body    : params.toString(),
      }
    );

    const text = await akismetRes.text();
    // Akismet responds with the plain text "true" (spam) or "false" (ham)
    return res.status(200).json({ isSpam: text.trim() === 'true' });

  } catch (err) {
    console.error('[Akismet proxy] Error:', err);
    // Fail open — if something goes wrong, let the message through
    return res.status(200).json({ isSpam: false });
  }
}