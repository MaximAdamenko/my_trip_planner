import { Router } from "express";
import Trip from "../models/Trip.js";
import auth from "../middleware/authMiddleware.js";

const router = Router();

// helper: normalize incoming [lat,lon] or {lat,lon} into numbers
function normalizePoints(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => {
    const lat = Array.isArray(p) ? p[0] : p?.lat;
    const lon = Array.isArray(p) ? p[1] : p?.lon;
    return { lat: Number(lat), lon: Number(lon) };
  });
}

// Create (save) a trip
router.post("/", auth, async (req, res) => {
  try {
    const { name, description, type, days, totalKm, center, points } = req.body || {};

    const pts = normalizePoints(points);
    if (!name || !type || !days || !totalKm || pts.length < 2) {
      return res.status(400).json({ ok: false, error: "Missing or invalid fields" });
    }
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const trip = await Trip.create({
      userId: req.user.id,
      name,
      description: description || "",
      type,                // "hike" | "bike"
      days: Number(days),
      totalKm: Number(totalKm),
      center: center
        ? { lat: Number(center.lat), lon: Number(center.lon) }
        : undefined,
      points: pts,
    });

    res.json({ ok: true, trip });
  } catch (e) {
    // surface a clearer server error to the client
    res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
});

// List my trips (handy for Day 7)
router.get("/", auth, async (req, res) => {
  const trips = await Trip.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, trips });
});

router.get("/:id", auth, async (req, res) => {
  const t = await Trip.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!t) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, trip: t });
});

// Rename a trip
router.patch("/:id", auth, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });
  const t = await Trip.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { name } },
    { new: true }
  ).lean();
  if (!t) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, trip: t });
});

// Delete a trip
router.delete("/:id", auth, async (req, res) => {
  const r = await Trip.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (!r.deletedCount) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true });
});


export default router;
