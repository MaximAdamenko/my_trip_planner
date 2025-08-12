import { Router } from "express";
import { destPoint, haversine } from "../utils/geo.js";

const router = Router();

function boundsFromPoints(points) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const [lat, lon] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return [[minLat, minLon], [maxLat, maxLon]];
}
function decimate(points, maxPts = 16) {
  if (points.length <= maxPts) return points;
  const out = [];
  for (let i = 0; i < maxPts; i++) out.push(points[Math.floor((i * (points.length - 1)) / (maxPts - 1))]);
  return out;
}
async function routeOSRM(profile, points, closeLoop) {
  const wp = closeLoop && points.length > 1 ? [...points, points[0]] : points;
  const coords = wp.map(([lat, lon]) => `${lon},${lat}`).join(";");
  let url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?geometries=geojson&overview=full&steps=false&continue_straight=false`;
  let r = await fetch(url);
  if (!r.ok && profile !== "driving") {
    url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full&steps=false&continue_straight=false`;
    r = await fetch(url);
  }
  const j = await r.json();
  if (!j?.routes?.[0]?.geometry?.coordinates) return null;
  const line = j.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  return { points: line, bbox: boundsFromPoints(line) };
}

router.post("/generate", async (req, res) => {
  try {
    const { location, days, type } = req.body || {};
    if (!location || !days || !type) return res.status(400).json({ ok: false, error: "Invalid input" });

    // geocode
    let center;
    if (typeof location === "string") {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;
      const r = await fetch(url, { headers: { "User-Agent": "trip-planner/1.0" } });
      const j = await r.json();
      if (!j?.[0]) return res.status(404).json({ ok: false, error: "Location not found" });
      center = { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name };
    } else {
      center = { lat: +location.lat, lon: +location.lon, name: "" };
    }

    // day ranges
    const ranges = type === "bike" ? { min: 30, max: 60, def: 45 } : { min: 5, max: 15, def: 10 };
    const dayKm = ranges.def;
    const target = dayKm * Number(days);

    // ring around center (cleaner)
    const baseR = Math.max(1, target / (2 * Math.PI));
    const n = Math.max(12, Number(days) * 14);
    const bearings = Array.from({ length: n }, (_, i) => (360 * i) / n);
    const jitterAmp = type === "bike" ? 0.08 : 0.12;

    let ring = bearings.map(b => {
      const factor = 1 + (Math.random() - 0.5) * jitterAmp;
      return destPoint(center.lat, center.lon, b, baseR * factor);
    });
    // rescale to target
    let L = 0;
    for (let i = 1; i < ring.length; i++) L += haversine(ring[i - 1], ring[i]);
    L += haversine(ring.at(-1), ring[0]);
    const scale = target / Math.max(L, 0.001);
    ring = bearings.map(b => {
      const factor = 1 + (Math.random() - 0.5) * jitterAmp;
      return destPoint(center.lat, center.lon, b, baseR * factor * scale);
    });

    // snap to roads; close only for hike
    const waypoints = decimate(ring, 16);
    const { points } =
      (await routeOSRM(type === "bike" ? "cycling" : "walking", waypoints, type !== "bike")) ||
      { points: type !== "bike" ? [...ring, ring[0]] : ring };

    // metrics + day breaks
    let total = 0;
    for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
    const breaks = [];
    let acc = 0;
    for (let i = 1; i < points.length; i++) {
      acc += haversine(points[i - 1], points[i]);
      if (acc >= (breaks.length + 1) * dayKm && breaks.length < days - 1) breaks.push(i);
    }

    res.json({ ok: true, center, points, meta: { days: Number(days), type, dayKm, totalKm: Math.round(total), breaks } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;


