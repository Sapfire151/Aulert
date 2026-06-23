const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const DB_BASE = 'https://aulert-2fba0-default-rtdb.asia-southeast1.firebasedatabase.app';
const CLIENT_ID = '4640324' + '46404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

/** Escape HTML special characters to prevent XSS in email body */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  // Only allow Vercel Cron (authenticated via CRON_SECRET)
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
    let errorCount = 0;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const [userId, userData] of Object.entries(allUsers)) {
      const digest = userData.digest;
      if (!digest || !digest.dailyEmail || !digest.refreshToken || !digest.email) continue;

      const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
      oAuth2Client.setCredentials({ refresh_token: digest.refreshToken });

      try {
        // Verify the refresh token is still valid by attempting a token refresh
        await oAuth2Client.getAccessToken();

        const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });

        const coursesRes = await classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 30 });
        const courses = coursesRes.data.courses || [];

        let newItems = [];

        for (const course of courses) {
          // Announcements
          try {
            const annRes = await classroom.courses.announcements.list({ courseId: course.id, pageSize: 10 });
            (annRes.data.announcements || []).forEach(a => {
              if (new Date(a.creationTime) > oneDayAgo) {
                newItems.push({
                  course: course.name,
                  type: 'Announcement',
                  text: a.text || '(no text)',
                  link: a.alternateLink || '#'
                });
              }
            });
          } catch (e) {
            console.warn(`Failed to fetch announcements for course ${course.id}:`, e.message);
          }

          // CourseWork
          try {
            const cwRes = await classroom.courses.courseWork.list({ courseId: course.id, pageSize: 10 });
            (cwRes.data.courseWork || []).forEach(w => {
              if (new Date(w.creationTime) > oneDayAgo) {
                newItems.push({
                  course: course.name,
                  type: 'Assignment',
                  text: w.title || '(untitled)',
                  link: w.alternateLink || '#'
                });
              }
            });
          } catch (e) {
            console.warn(`Failed to fetch coursework for course ${course.id}:`, e.message);
          }
        }

        if (newItems.length > 0) {
          const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

          let htmlContent = [
            '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">',
            '<h2 style="color:#4f46e5">Aulert Daily Digest</h2>',
            `<p>Here is your summary for the last 24 hours (${newItems.length} new item${newItems.length > 1 ? 's' : ''}):</p>`,
            '<ul style="padding-left:20px">'
          ].join('');

          newItems.forEach(item => {
            const safeCourse = escapeHtml(item.course);
            const safeText = escapeHtml(item.text.slice(0, 120));
            const safeLink = encodeURI(item.link);
            htmlContent += `<li style="margin-bottom:8px"><b>${safeCourse}</b> [${item.type}]: <a href="${safeLink}">${safeText}</a></li>`;
          });
          htmlContent += '</ul><p style="color:#888;font-size:12px">You can disable this digest from Aulert Settings.</p></div>';

          const emailLines = [
            `To: ${digest.email}`,
            'Subject: Your Aulert Daily Digest',
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlContent
          ];
          const rawEmail = Buffer.from(emailLines.join('\r\n')).toString('base64url');

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: rawEmail }
          });
          sentCount++;
        }
      } catch (e) {
        errorCount++;
        console.warn(`Failed for user ${userId}:`, e.message);

        // If refresh token is invalid, clean up the stale entry
        if (e.message && (e.message.includes('invalid_grant') || e.message.includes('Token has been expired or revoked'))) {
          console.warn(`Removing stale digest entry for user ${userId}`);
          try {
            await fetch(`${DB_BASE}/users/${userId}/digest.json`, { method: 'DELETE' });
          } catch (cleanupErr) {
            console.warn('Cleanup failed:', cleanupErr.message);
          }
        }
      }
    }

    res.status(200).json({ sent: sentCount, errors: errorCount });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
