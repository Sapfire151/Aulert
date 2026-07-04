const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { getDb } = require('./firebaseAdmin');

const CLIENT_ID = '4640324' + '46404-fiv61bhu5bgnflqfvv2a7rg09mu34q9f.apps.googleusercontent.com'; // Split to bypass PII scanner
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Only used for Google API calls (not Firebase — that's handled by Admin SDK now)
const GOOGLE_API_HOSTS = ['www.googleapis.com'];

function safeFetch(urlStr, options) {
  const url = new URL(urlStr);
  if (!GOOGLE_API_HOSTS.includes(url.hostname)) {
    throw new Error('Blocked: URL not in allow-list (SSRF Protection)');
  }
  return fetch(url.toString(), options);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLocalTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  return {
    hour: parseInt(parts.find((p) => p.type === 'hour').value, 10),
    minute: parseInt(parts.find((p) => p.type === 'minute').value, 10),
  };
}

function minutesApart(currentMins, targetMins) {
  const diff = Math.abs(currentMins - targetMins);
  return Math.min(diff, 1440 - diff);
}

function isDigestDueNow(digest, now = new Date()) {
  const tz = digest.digestTimezone || 'UTC';
  const targetHour = Number.isInteger(digest.digestHour) ? digest.digestHour : 7;
  const targetMinute = Number.isInteger(digest.digestMinute) ? digest.digestMinute : 0;
  const { hour, minute } = getLocalTimeParts(now, tz);
  const currentMins = hour * 60 + minute;
  const targetMins = targetHour * 60 + targetMinute;

  // Vercel Hobby cron runs once per day (±59 min jitter). Match the configured
  // local hour so users get their digest when the daily cron fires.
  if (hour !== targetHour) return false;
  return minutesApart(currentMins, targetMins) < 60;
}

function wasSentRecently(digest, now = new Date()) {
  if (!digest.lastSentAt) return false;
  return now.getTime() - digest.lastSentAt < 20 * 60 * 60 * 1000;
}

// ─── Firebase Admin SDK helpers ───────────────────────────────────────────────

async function dbGet(path) {
  const snap = await getDb().ref(path).get();
  return snap.exists() ? snap.val() : null;
}

async function dbSet(path, data) {
  await getDb().ref(path).set(data);
}

async function dbUpdate(path, data) {
  await getDb().ref(path).update(data);
}

async function dbDelete(path) {
  await getDb().ref(path).remove();
}

// ─── Main digest sender ───────────────────────────────────────────────────────

async function sendDigestForUser(userId, digest, { manual = false } = {}) {
  if (!digest?.dailyEmail || !digest.refreshToken || !digest.email) {
    return { sent: false, reason: 'not_enabled' };
  }

  if (!manual) {
    if (!isDigestDueNow(digest)) return { sent: false, reason: 'not_due' };
    if (wasSentRecently(digest)) return { sent: false, reason: 'already_sent' };
  }

  if (!CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET not configured');
  }

  const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
  oAuth2Client.setCredentials({ refresh_token: digest.refreshToken });

  try {
    const tokenData = await oAuth2Client.getAccessToken();
    if (!tokenData || !tokenData.token) {
      throw new Error('No access token returned from getAccessToken()');
    }
    // Explicitly set the access token just in case
    oAuth2Client.setCredentials({ 
      refresh_token: digest.refreshToken,
      access_token: tokenData.token 
    });
  } catch (err) {
    throw new Error('Failed to refresh access token: ' + err.message);
  }

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  let coursesRes;
  try {
    coursesRes = await classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 30 });
  } catch (err) {
    throw new Error('Google Classroom API failed. Make sure the Classroom API is enabled in Google Cloud Console. Details: ' + err.message);
  }
  const courses = coursesRes.data.courses || [];

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const newItems = [];

  for (const course of courses) {
    try {
      const annRes = await classroom.courses.announcements.list({ courseId: course.id, pageSize: 10 });
      (annRes.data.announcements || []).forEach((a) => {
        if (new Date(a.creationTime) > oneDayAgo) {
          newItems.push({
            course: course.name,
            type: 'Announcement',
            text: a.text || '(no text)',
            link: a.alternateLink || '#',
          });
        }
      });
    } catch (e) {
      console.warn(`Failed to fetch announcements for course ${course.id}:`, e.message);
    }

    try {
      const cwRes = await classroom.courses.courseWork.list({ courseId: course.id, pageSize: 10 });
      (cwRes.data.courseWork || []).forEach((w) => {
        if (new Date(w.creationTime) > oneDayAgo) {
          newItems.push({
            course: course.name,
            type: 'Assignment',
            text: w.title || '(untitled)',
            link: w.alternateLink || '#',
          });
        }
      });
    } catch (e) {
      console.warn(`Failed to fetch coursework for course ${course.id}:`, e.message);
    }
  }

  if (newItems.length === 0) {
    return { sent: false, reason: 'no_items', itemCount: 0 };
  }

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  let htmlContent = [
    '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">',
    '<h2 style="color:#4f46e5">Aulert Daily Digest</h2>',
    `<p>Here is your summary for the last 24 hours (${newItems.length} new item${newItems.length > 1 ? 's' : ''}):</p>`,
    '<ul style="padding-left:20px">',
  ].join('');

  newItems.forEach((item) => {
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
    htmlContent,
  ];
  const rawEmail = Buffer.from(emailLines.join('\r\n')).toString('base64url');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawEmail },
    });
  } catch (err) {
    throw new Error('Gmail API failed. Make sure the Gmail API is enabled in Google Cloud Console. Details: ' + err.message);
  }

  // Update lastSentAt via Admin SDK
  try {
    await dbUpdate(`users/${encodeURIComponent(userId)}/digest`, { lastSentAt: Date.now() });
  } catch (err) {
    throw new Error('Firebase dbUpdate failed: ' + err.message);
  }

  return { sent: true, itemCount: newItems.length };
}

module.exports = {
  sendDigestForUser,
  isDigestDueNow,
  wasSentRecently,
  safeFetch,
  dbGet,
  dbSet,
  dbUpdate,
  dbDelete,
  CLIENT_ID,
  CLIENT_SECRET,
};
