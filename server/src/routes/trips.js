import { Router } from "express";
import { randomUUID } from "crypto";

const router = Router();

// super-simple in-memory store (persists while server is running)
const DB = globalThis.__TRIPS_DB__ || (globalThis.__TRIPS_DB__ = new Map());

/**
 * GET /api/trips
 * Return a lightweight list (no giant polyline in the list view)
 */
router.get("/", (req, res) => {
  const trips = [...DB.values()].map(({ points, ...light }) => light);
  res.json({ ok: true, trips });
});

/**
 * GET /api/trips/:id
 * Return the full trip (including points) so the UI can re-render the map.
 */
router.get("/:id", (req, res) => {
  const t = DB.get(req.params.id);
  if (!t) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, trip: t });
});

/**
 * POST /api/trips
 * Body: { name, description, points, meta, center }
 */
router.post("/", (req, res) => {
  const { name = "", description = "", points, meta = {}, center = null } = req.body || {};
  if (!Array.isArray(points) || points.length < 2) {
    return res.status(400).json({ ok: false, error: "Invalid points" });
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const record = { id, name, description, points, meta, center, createdAt };
  DB.set(id, record);
  res.json({ ok: true, id });
});

export default router;
