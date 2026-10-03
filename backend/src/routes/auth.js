import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

/**
 * Sign-up, sign-in and refresh all happen in the browser against Supabase
 * Auth directly, using the anon key — that's the supported flow and it keeps
 * this server off the login path entirely.
 *
 * So this file only answers "who does this token belong to?", which is what
 * a frontend needs on boot to confirm a restored session is still good.
 */
router.get("/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    createdAt: req.user.created_at,
  });
});

/**
 * Delete the caller's own account. Needs the service-role key, which is why it
 * lives here and not in the browser. Their user_state row goes with it
 * (`on delete cascade`, see supabase/migrations/0001_user_state.sql).
 * The id comes from the verified token, never the request body.
 */
router.delete("/me", requireAuth, async (req, res, next) => {
  const { error } = await supabase.auth.admin.deleteUser(req.user.id);
  if (error) return next(error);
  res.status(204).end();
});

export default router;
