import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ ok: false, error: "Missing lat/lon" });
    const key = process.env.OWM_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "Missing OWM_API_KEY" });
    const r = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key}`);
    const json = await r.json();
    if (!json?.list) return res.status(502).json({ ok: false, error: "Bad response" });
    const days = json.list
      .filter(x => x.dt_txt?.includes("12:00:00"))
      .slice(0, 3)
      .map(x => ({
        dt: x.dt,
        dt_txt: x.dt_txt,
        temp: x.main?.temp,
        feels_like: x.main?.feels_like,
        description: x.weather?.[0]?.description,
        icon: x.weather?.[0]?.icon
      }));
    res.json({ ok: true, city: json.city?.name, days });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
