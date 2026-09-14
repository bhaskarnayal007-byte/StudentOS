import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

// Point this at your real table via .env — the handlers below don't name any
// column except `user_id`, so a different schema needs no code change.
const TABLE = process.env.DATA_TABLE ?? "items";

router.use(requireAuth);

/** GET /api/data/items — this user's rows, newest first. */
router.get("/items", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      // Not optional. The service role key bypasses RLS, so this filter is
      // what scopes the query — drop it and every user sees every row.
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** POST /api/data/items — body is the row, minus user_id. */
router.post("/items", async (req, res, next) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "Body must be an object" });
    }

    // user_id is set from the verified token and overwrites anything the
    // client sent, so a caller can't write a row onto someone else's account.
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ ...body, user_id: req.user.id })
      .select()
      .single();

    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
