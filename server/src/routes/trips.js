import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "trips.json");

async function loadTrips() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const s = await fs.readFile(FILE, "utf8");
    return JSON.parse(s);
  } catch (e) {
    if (e.code === "ENOENT") {
      await fs.writeFile(FILE, "[]");
      return [];
    }
    throw e;
  }
}

async function saveTrips(all) {
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

// GET /api/trips  -> list current user's trips
router.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const all = await loadTrips();
  res.json({ ok: true, trips: all.filter(t => t.userId === userId) });
});

// POST /api/trips -> create a trip for current user
router.post("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { name, description = "", points = [], meta = {}, center = null } = req.body || {};
  if (!name || !Array.isArray(points) || points.length < 2) {
    return res.status(400).json({ ok: false, error: "Bad payload" });
  }

  const all = await loadTrips();
  const trip = {
    id: crypto.randomUUID(),
    userId,
    name,
    description,
    points,
    meta,
    center,
    createdAt: new Date().toISOString(),
  };
  all.push(trip);
  await saveTrips(all);
  res.status(201).json({ ok: true, trip });
});

export default router;

