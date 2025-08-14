// server/src/routes/trips.js
import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const router = Router();

// ---- simple JSON file store -----------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "trips.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(DATA_FILE); }
  catch { await fs.writeFile(DATA_FILE, "[]", "utf8"); }
}

async function readTrips() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try { return JSON.parse(raw) || []; } catch { return []; }
}

async function writeTrips(list) {
  await ensureStore();
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}
// ---------------------------------------------------------------------------

// Create a trip
router.post("/", async (req, res) => {
  try {
    const { name, description = "", points, meta, center, owner } = req.body || {};
    if (!name || !Array.isArray(points) || points.length < 2) {
      return res.status(400).json({ ok: false, error: "Invalid trip payload" });
    }

    const all = await readTrips();
    const id = crypto.randomUUID();
    const trip = {
      id,
      name,
      description,
      points,
      meta,
      center,
      owner: owner || null,      // optional “owner” if you ever pass one from client
      createdAt: Date.now(),
    };

    all.push(trip);
    await writeTrips(all);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List trips (optionally filter by ?owner=xxx)
router.get("/", async (req, res) => {
  try {
    const { owner } = req.query;
    let all = await readTrips();
    if (owner) all = all.filter(t => t.owner === owner);
    // newest first
    all.sort((a, b) => b.createdAt - a.createdAt);
    res.json({ ok: true, trips: all });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Fetch a single trip
router.get("/:id", async (req, res) => {
  try {
    const all = await readTrips();
    const trip = all.find(t => t.id === req.params.id);
    if (!trip) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, trip });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Delete a trip (optional)
router.delete("/:id", async (req, res) => {
  try {
    const all = await readTrips();
    const idx = all.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Not found" });
    all.splice(idx, 1);
    await writeTrips(all);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
