// server/src/utils/osrm.js
// Node 18+ has global fetch
export async function osrmRoute(profile, coords) {
  // OSRM expects lon,lat — we store lat,lng, so flip
  const coordStr = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");

  // profile: 'cycling' | 'walking'
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coordStr
    }?overview=full&geometries=geojson&steps=false&continue_straight=true&exclude=ferry`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`OSRM ${r.status}`);
  const json = await r.json();
  if (json.code !== "Ok" || !json.routes?.[0]) throw new Error("OSRM bad response");

  const route = json.routes[0];
  const snapped = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const km = (route.distance || 0) / 1000;

  return { points: snapped, km };
}
