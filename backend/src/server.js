import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

// Behind Render's proxy, so req.ip / secure-cookie logic sees the real client.
app.set("trust proxy", 1);

app.use(helmet());

const origins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json({ limit: "1mb" }));

// Before the routes, so a health check still passes if Supabase is down.
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`listening on :${port}`));
