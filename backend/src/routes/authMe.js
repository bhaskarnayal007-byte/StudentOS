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
 * delete cascade`). Storage has no cascade, so their note files are removed
 * first. The id comes from the verified token, never the body.
 */
export async function deleteMe(request, supabase) {
  const user = await verifySupabaseToken(request, supabase);
  await removeNoteFiles(supabase, user.id);
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return json(204, null);
}

/** Every file in the user's note-files folder (supabase/migrations/0008). */
async function removeNoteFiles(supabase, userId) {
  const bucket = supabase.storage.from("note-files");
  // A page at a time until the folder is empty; the cap stops a runaway loop.
  for (let page = 0; page < 100; page++) {
    const { data, error } = await bucket.list(userId, { limit: 1000 });
    // No bucket yet (0008 not run): nothing to remove, so don't block the delete.
    if (error && /not found/i.test(error.message)) return;
    if (error) throw error;
    if (!data?.length) return;
    const { error: removeError } = await bucket.remove(data.map((f) => `${userId}/${f.name}`));
    if (removeError) throw removeError;
  }
}
