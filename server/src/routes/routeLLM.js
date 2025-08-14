// server/src/routes/routeLLM.js
import { Router } from "express";
import OpenAI from "openai";
import { haversine, destPoint } from "../utils/geo.js";

const router = Router();

/* ---------- helpers ---------- */
function bboxAround({ lat, lon }, km) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon };
}

async function geocodeCity(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
  const r = await fetch(url, { headers: { "User-Agent": "trip-planner/1.0" } });
  const j = await r.json();
  if (!j?.[0]) return null;
  return { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name };
}

async function geocodeInBBox(name, box, cityName) {
  const vb = `&bounded=1&viewbox=${box.minLon},${box.maxLat},${box.maxLon},${box.minLat}`;
  let url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}${vb}`;
  let r = await fetch(url, { headers: { "User-Agent": "trip-planner/1.0" } });
  let j = await r.json();
  if (j?.[0]) return { lat: +j[0].lat, lon: +j[0].lon };

  url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${name}, ${cityName}`)}${vb}`;
  r = await fetch(url, { headers: { "User-Agent": "trip-planner/1.0" } });
  j = await r.json();
  if (j?.[0]) return { lat: +j[0].lat, lon: +j[0].lon };

  return null;
}

async function routeOSRM(profile, points, closeLoop) {
  const wp = closeLoop && points.length > 1 ? [...points, points[0]] : points;
  const coords = wp
    .map((p) => `${p.lon ?? p[1]},${p.lat ?? p[0]}`)
    .join(";");

  // Try the requested profile first; fall back to driving if needed.
  let url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?geometries=geojson&overview=full&steps=false&continue_straight=false`;
  let r = await fetch(url);
  if (!r.ok && profile !== "driving") {
    url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full&steps=false&continue_straight=false`;
    r = await fetch(url);
  }
  const j = await r.json();
  if (!j?.routes?.[0]?.geometry?.coordinates) return null;
  return j.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}

function extractJSON(s) {
  try { return JSON.parse(s); } catch {}
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i !== -1 && j !== -1 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch {} }
  return null;
}

function sumKm(line) {
  let s = 0;
  for (let i = 1; i < line.length; i++) s += haversine(line[i - 1], line[i]);
  return s;
}

function makeRing(center, days, type, scale = 1) {
  const minDay = type === "bike" ? 30 : 5;
  const maxDay = type === "bike" ? 60 : 15;
  const dayKm  = (minDay + maxDay) / 2;
  const target = dayKm * Number(days);

  const baseR = Math.max(1, target / (2 * Math.PI)) * scale; // circumference ~ 2πR
  const n = Math.max(12, Number(days) * 14);
  const bearings = Array.from({ length: n }, (_, i) => (360 * i) / n);
  const jitter = type === "bike" ? 0.08 : 0.12;

  const ring = bearings.map((b) => {
    const f = 1 + (Math.random() - 0.5) * jitter;
    const [lat, lon] = destPoint(center.lat, center.lon, b, baseR * f);
    return { lat, lon };
  });

  return type === "bike" ? ring : [...ring, ring[0]];
}

async function sizedProcedural(center, days, type, profile, closeLoop, tries = 6) {
  const minTotal = Number(days) * (type === "bike" ? 30 : 5);
  const maxTotal = Number(days) * (type === "bike" ? 60 : 15);
  const target   = (minTotal + maxTotal) / 2;

  let factor = 1;
  let best = null, bestDiff = Infinity;

  for (let k = 0; k < tries; k++) {
    const wp   = makeRing(center, days, type, factor);
    const line = await routeOSRM(profile, wp, closeLoop);
    if (!line) continue;

    const tot = sumKm(line);
    const diff = Math.abs(tot - target);
    if (diff < bestDiff) { best = { line, tot }; bestDiff = diff; }

    if (tot >= minTotal && tot <= maxTotal) break;

    if (tot > 0) {
      const ratio = target / tot;
      factor *= Math.sqrt(ratio); // damped adjustment
    }
  }
  return best;
}

/* ---------- route ---------- */
router.post("/generate", async (req, res) => {
  try {
    const { location, days, type } = req.body || {};
    if (!location || !days || !type) {
      return res.status(400).json({ ok: false, error: "Invalid input" });
    }

    const city = typeof location === "string" ? await geocodeCity(location) : location;
    if (!city?.lat || !city?.lon) {
      return res.status(404).json({ ok: false, error: "Location not found" });
    }

    const haveKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
    const model   = process.env.LLM_MODEL || "gpt-4o-mini";

    let names = [];
    if (haveKey) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const prompt = `
Return ONLY JSON with 5-10 short local waypoint names for a scenic ${type === "bike" ? "point-to-point" : "loop"} inside or very near the base city.
Schema: {"waypoints":[{"name":"string"}]}
Base city: ${location}
Mode: ${type}
Days: ${days}
        `.trim();

        const resp = await openai.chat.completions.create({
          model,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3
        });

        const json = extractJSON(resp?.choices?.[0]?.message?.content || "");
        names = (json?.waypoints || []).map(w => w?.name).filter(Boolean);
      } catch (e) {
        console.warn("[LLM] Skipping LLM (will fall back):", e?.message || e);
      }
    } else {
      console.warn("[LLM] No OPENAI_API_KEY; generating procedural route.");
    }

    // Geocode the waypoints (if any)
    const box  = bboxAround({ lat: city.lat, lon: city.lon }, type === "bike" ? 25 : 8);
    const geos = [];
    for (const n of names) {
      const g = await geocodeInBBox(n, box, city.name);
      if (g) geos.push(g);
    }

    const profile   = type === "bike" ? "cycling" : "walking";
    const closeLoop = type !== "bike";

    let line = geos.length >= 2 ? await routeOSRM(profile, geos, closeLoop) : null;

    const minTotal = Number(days) * (type === "bike" ? 30 : 5);
    const maxTotal = Number(days) * (type === "bike" ? 60 : 15);

    let total = line ? sumKm(line) : 0;

    // Always guarantee a route (within bounds) by procedural fallback.
    if (!line || total < minTotal || total > maxTotal) {
      const sized = await sizedProcedural({ lat: city.lat, lon: city.lon }, days, type, profile, closeLoop);
      if (!sized) return res.status(502).json({ ok: false, error: "Routing service failed" });
      line  = sized.line;
      total = sized.tot;
    }

    // Compute per-day markers
    const perDay = Math.min(
      type === "bike" ? 60 : 15,
      Math.max(type === "bike" ? 30 : 5, total / Number(days))
    );
    const breaks = [];
    let acc = 0;
    for (let i = 1; i < line.length; i++) {
      acc += haversine(line[i - 1], line[i]);
      if (acc >= (breaks.length + 1) * perDay && breaks.length < Number(days) - 1) {
        breaks.push(i);
      }
    }

    return res.json({
      ok: true,
      center: { lat: city.lat, lon: city.lon, name: city.name },
      points: line,                    // [[lat, lon], ...]
      meta: { days: Number(days), type, totalKm: Math.round(total), breaks }
    });
  } catch (e) {
    console.error("[/api/llm/generate] error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Internal error" });
  }
});

export default router;
