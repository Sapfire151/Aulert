import { google, classroom_v1 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ClassroomCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
}

export function getClassroomClient(credentials: ClassroomCredentials) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
    expiry_date: credentials.expiryDate,
  });

  const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

  return {
    classroom,
    oauth2Client,
  };
}

/**
 * Executes a Classroom API operation with automatic invalid_grant detection.
 * If token refresh fails with invalid_grant, automatically marks users.needs_reauth = true.
 */
export async function executeClassroomCall<T>(
  userId: string,
  operation: (classroom: classroom_v1.Classroom) => Promise<T>,
  credentials: ClassroomCredentials
): Promise<{ data: T | null; error?: string; needsReauth?: boolean }> {
  try {
    const { classroom } = getClassroomClient(credentials);
    const result = await operation(classroom);
    return { data: result };
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    console.error(`Classroom API error for user ${userId}:`, errorMessage);

    // Detect token revocation or expiration (invalid_grant)
    if (
      errorMessage.includes('invalid_grant') ||
      errorMessage.includes('Token has been expired or revoked')
    ) {
      console.warn(`User ${userId} token invalid_grant; setting needs_reauth = true`);
      const supabase = createAdminClient();
      await supabase
        .from('users')
        .update({ needs_reauth: true, updated_at: new Date().toISOString() })
        .eq('id', userId);

      return { data: null, error: 'Token expired or revoked', needsReauth: true };
    }

    return { data: null, error: errorMessage };
  }
}
