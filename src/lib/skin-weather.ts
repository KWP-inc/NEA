/**
 * Calgary skin forecast: turns today's weather into plain skin tips.
 * Pure rules, no AI: dry air, cold, wind, strong sun (UV), chinooks, heat and wildfire smoke.
 */
export type Weather = {
  temp: number; // °C now
  feels: number; // °C, with wind chill
  humidity: number; // % relative humidity
  dew: number; // °C dew point (how much water is really in the air)
  wind: number; // km/h
  uv: number; // UV index now
  uvMax: number; // highest UV index today
  maxToday: number; // °C
  maxYesterday: number | null; // °C
  pm25: number | null; // µg/m³ fine smoke particles, when known
  month: number; // 1–12
};

export type TipKey = "uv" | "dry" | "cold" | "wind" | "chinook" | "heat" | "smoke" | "easy";
export type SkinTip = { key: TipKey; title: string; tip: string; weight: number };
export type Forecast = { level: "easy" | "care" | "protect"; headline: string; tips: SkinTip[]; facts: { temp: number; feels: number; humidity: number; uv: number; wind: number }; at: string };

export function skinForecast(w: Weather, at = new Date().toISOString()): Forecast {
  const tips: SkinTip[] = [];
  const winter = w.month >= 10 || w.month <= 4;

  if (w.pm25 != null && w.pm25 >= 35) tips.push({ key: "smoke", title: "Smoky air", tip: "Smoke sticks to skin. Wash your face tonight and use a vitamin C serum tomorrow morning.", weight: w.pm25 >= 80 ? 95 : 75 });

  if (w.uvMax >= 8) tips.push({ key: "uv", title: `Very strong sun (UV ${Math.round(w.uvMax)})`, tip: "Wear SPF 50, a hat and sunglasses. Put SPF on again every 2 hours outside.", weight: 92 });
  else if (w.uvMax >= 6) tips.push({ key: "uv", title: `Strong sun (UV ${Math.round(w.uvMax)})`, tip: "Wear SPF 30 or more. Put it on again at lunch if you're outside.", weight: 80 });
  else if (w.uvMax >= 3) tips.push({ key: "uv", title: `Some sun (UV ${Math.round(w.uvMax)})`, tip: "SPF 30 this morning is enough for a normal day.", weight: 50 });

  if (winter && w.maxYesterday != null && w.maxToday - w.maxYesterday >= 10 && w.wind >= 20) tips.push({ key: "chinook", title: "Chinook day", tip: "Warm, dry wind pulls water out of skin fast. Use a thicker cream and skip scrubs and acids today.", weight: 88 });

  if (w.feels <= -20) tips.push({ key: "cold", title: `Bitter cold (feels like ${Math.round(w.feels)}°)`, tip: "Cover your cheeks and nose. Put a thick balm on dry spots before you go out.", weight: 90 });
  else if (w.feels <= -8) tips.push({ key: "cold", title: `Cold (feels like ${Math.round(w.feels)}°)`, tip: "Cold air weakens your skin barrier. Use a rich moisturiser and a lip balm.", weight: 65 });

  if (w.dew <= -12 || w.humidity <= 25) tips.push({ key: "dry", title: "Very dry air", tip: "Your skin loses water quickly today. Moisturise on damp skin, and again at night.", weight: 78 });
  else if (w.dew <= -4 || w.humidity <= 38) tips.push({ key: "dry", title: "Dry air", tip: "Add a hydrating serum under your moisturiser.", weight: 55 });

  if (w.wind >= 40) tips.push({ key: "wind", title: `Strong wind (${Math.round(w.wind)} km/h)`, tip: "Wind can sting and redden skin. Use a barrier cream and keep your face covered.", weight: 70 });

  if (w.temp >= 27) tips.push({ key: "heat", title: `Hot day (${Math.round(w.temp)}°)`, tip: "Switch to a light gel moisturiser. Rinse off sweat, then put SPF on again.", weight: 68 });

  // winter sun on snow still reaches skin, even when the UV number is low
  if (winter && w.uvMax < 3 && !tips.some((t) => t.key === "uv") && tips.length < 3) tips.push({ key: "uv", title: "Low sun", tip: "UV is low, but snow bounces light back at your face. A light SPF still helps.", weight: 30 });

  tips.sort((a, b) => b.weight - a.weight);
  const top = tips.slice(0, 3);
  const worst = top[0]?.weight ?? 0;
  if (!top.length) top.push({ key: "easy", title: "An easy skin day", tip: "Nothing harsh in the air today. Keep to your normal routine and SPF.", weight: 10 });
  const level = worst >= 85 ? "protect" : worst >= 55 ? "care" : "easy";
  const headline = level === "protect" ? "Protect your skin today" : level === "care" ? "Take a little extra care today" : "An easy day for your skin";
  return { level, headline, tips: top, facts: { temp: Math.round(w.temp), feels: Math.round(w.feels), humidity: Math.round(w.humidity), uv: Math.round(w.uvMax * 10) / 10, wind: Math.round(w.wind) }, at };
}
