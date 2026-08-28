/**
 * CI guard: validate secret-shaped environment variables when present.
 *
 * Runs in GitHub Actions. Secrets are NOT automatically available to the job,
 * so this script only validates a variable IF it is set (local dev / protected
 * CI). Missing variables are reported as a warning, not a failure, so the
 * pipeline does not break when secrets are intentionally absent from CI.
 */
const requiredShape = {
  FIREBASE_SERVICE_ACCOUNT: validateFirebase,
  DISCORD_WEBHOOK_ENCRYPTION_KEY: validateEncryptionKey,
  CLIENT_ID: validateClientId,
};

function validateFirebase(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return `FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${e.message}`;
  }
  const need = ['type', 'project_id', 'private_key', 'client_email'];
  const missing = need.filter((k) => !parsed[k]);
  if (missing.length) return `FIREBASE_SERVICE_ACCOUNT missing keys: ${missing.join(', ')}`;
  if (parsed.type !== 'service_account') return 'FIREBASE_SERVICE_ACCOUNT type must be "service_account"';
  return null;
}

function validateEncryptionKey(raw) {
  const isHex64 = /^[a-f0-9]{64}$/i.test(raw);
  let isB64_32 = false;
  if (!isHex64) {
    try {
      const buf = Buffer.from(raw, 'base64');
      isB64_32 = buf.length === 32;
    } catch {
      /* ignore */
    }
  }
  if (!isHex64 && !isB64_32) {
    return 'DISCORD_WEBHOOK_ENCRYPTION_KEY must be a 64-char hex string or a 32-byte base64 string';
  }
  return null;
}

function validateClientId(raw) {
  if (!/.+\.apps\.googleusercontent\.com$/.test(raw)) {
    return 'CLIENT_ID must end with .apps.googleusercontent.com';
  }
  return null;
}

let warnings = 0;
let errors = 0;

for (const [name, fn] of Object.entries(requiredShape)) {
  const val = process.env[name];
  if (val === undefined || val === '') {
    console.warn(`⚠ ${name} not set — skipped (add as CI secret to validate).`);
    warnings++;
    continue;
  }
  const err = fn(val);
  if (err) {
    console.error(`✗ ${name}: ${err}`);
    errors++;
  } else {
    console.log(`✓ ${name} valid`);
  }
}

if (errors > 0) {
  console.error(`\nEnv validation failed with ${errors} error(s).`);
  process.exit(1);
}
console.log(`\nEnv validation passed (${warnings} skipped, none failed).`);
