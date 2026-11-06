// GET /api/auth/me and DELETE /api/auth/me.
import verifySupabaseToken from "../auth/verifySupabaseToken.js";
import { json } from "../http/jsonResponse.js";

/**
 * Sign-up, sign-in and refresh happen in the app against Supabase directly,
 * so this only answers "who does this token belong to?", which the app asks
 * on boot to confirm a restored session is still good.
 */
export async function getMe(request, supabase) {
  const user = await verifySupabaseToken(request, supabase);
  return json(200, { id: user.id, email: user.email, createdAt: user.created_at });
}

/**
 * Deletes the caller's own account. Needs the service-role key, which is why
 * it lives here and not in the app. Their user_state row goes with it (`on
 * delete cascade`). The id comes from the verified token, never the body.
 */
export async function deleteMe(request, supabase) {
  const user = await verifySupabaseToken(request, supabase);
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return json(204, null);
}
