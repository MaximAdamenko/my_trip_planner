// server/src/routes/routeGen.js
import { Router } from "express";

const router = Router();

/* ---------- small geo helpers ---------- */
const toRad = (d) => (d * Math.PI) / 180;
const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const polylineKm = (pts) => {
  let k = 0;
  for (let i = 1; i < pts.length; i++) k += haversineKm(pts[i - 1], pts[i]);
  return k;
};

/* ---------- daily ranges ---------- */
const DAILY = {
  trek: { min: 5, max: 15 }, // km/day
  bike: { min: 30, max: 60 },
};

/* ---------- geocode with Node's built-in fetch ---------- */
async function geocode(location) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
    encodeURIComponent(location);
  const res = await fetch(url, {
    headers: { "User-Agent": "trip-planner/1.0 (educational)" },
  });
  if (!res.ok) throw new Error("geocode failed");
  const json = await res.json();
  if (!json?.length) throw new Error("location not found");
  const { lat, lon } = json[0];
  return [parseFloat(lat), parseFloat(lon)];
}

/* ---------- core builder with clamp ---------- */
function buildRoute({ center, days, kind, loop }) {
  const range = kind === "trek" ? DAILY.trek : DAILY.bike;
  const target =
    days * (range.min + Math.random() * (range.max - range.min)); // km
  let radiusKm = Math.max(1.2, target / (loop ? 6.28 : 4.0)); // start guess
  let tries = 0;
  let pts = [];

  while (tries++ < 6) {
    const N = 36; // smoothness
    const out = [];
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * 2 * Math.PI;
      const rJitter = radiusKm * (0.85 + Math.random() * 0.3);
      const dLat = (rJitter / 111.32) * Math.cos(t);
      const dLon = (rJitter / (111.32 * Math.cos(toRad(center[0])))) * Math.sin(t);
      out.push([center[0] + dLat, center[1] + dLon]);
    }
    if (loop) out.push(out[0]);
    else out.splice(N / 2, 0, center);

    const len = polylineKm(out);
    if (Math.abs(len - target) <= target * 0.12) {
      pts = out;
      break;
    }
    const factor = Math.max(0.5, Math.min(1.6, target / Math.max(len, 1e-6)));
    radiusKm *= factor;
    if (tries === 6) pts = out;
  }

  // hard clamp so we never exceed max/day by >5%
  const hardMax = range.max * days * 1.05;
  let totalKm = polylineKm(pts);
  if (totalKm > hardMax) {
    // decimate lightly
    const keep = [];
    for (let i = 0; i < pts.length; i += 2) keep.push(pts[i]);
    if (loop && (keep[0][0] !== keep.at(-1)[0] || keep[0][1] !== keep.at(-1)[1])) {
      keep.push(keep[0]);
    }
    pts = keep;
    totalKm = polylineKm(pts);
  }

  // day markers
  const perDay = totalKm / days;
  const breaks = [];
  let acc = 0;
  for (let i = 1, k = 1; i < pts.length - 1 && breaks.length < days - 1; i++) {
    acc += haversineKm(pts[i - 1], pts[i]);
    if (acc >= perDay * k) {
      breaks.push(pts[i]);
      k++;
    }
  }

  return {
    points: pts,
    meta: { totalKm: Math.round(totalKm), days, breaks },
  };
}

/* ---------- POST /api/routes/generate ---------- */
router.post("/generate", async (req, res) => {
  try {
    let { location, lat, lon, days, type } = req.body || {};
    days = Number(days || 1);

    // resolve center
    let center;
    if (typeof lat === "number" && typeof lon === "number") {
      center = [lat, lon];
    } else if (location) {
      center = await geocode(location);
    } else {
      return res.status(400).json({ ok: false, error: "location or lat/lon required" });
    }

    // type → kind + loop
    const t = String(type || "").toLowerCase();
    const kind = t.includes("bike") ? "bike" : "trek";
    const loop = t.includes("loop") || kind === "trek"; // trek defaults to loop

    const route = buildRoute({ center, days, kind, loop });
    return res.json({ ok: true, ...route });
  } catch (e) {
    console.error("generate error:", e);
    return res.status(500).json({ ok: false, error: "Failed to generate route" });
  }
});

export default router;
