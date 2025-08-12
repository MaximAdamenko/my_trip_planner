export function toRad(d) { return (d * Math.PI) / 180; }
export function toDeg(r) { return (r * 180) / Math.PI; }
export function haversine(a, b) {
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const la1 = toRad(a[0]);
  const la2 = toRad(b[0]);
  const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function destPoint(lat, lon, bearingDeg, distKm) {
  const R = 6371;
  const br = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const δ = distKm / R;
  const sinφ2 = Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(br);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(br)*Math.sin(δ)*Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1)*Math.sin(φ2);
  const λ2 = λ1 + Math.atan2(y, x);
  return [toDeg(φ2), ((toDeg(λ2)+540)%360)-180];
}
