import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";

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

export default router;
