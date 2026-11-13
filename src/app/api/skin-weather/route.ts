import { NextResponse } from "next/server";
import { site } from "@/lib/site";
import { skinForecast } from "@/lib/skin-weather";

/**
 * Calgary skin forecast. Weather and air quality come from Open-Meteo (free, no key, open data),
 * read on the server and cached for 30 minutes, so visitors never call a third party from their browser.
 */
export const revalidate = 1800;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function GET() {
  const { lat, lng } = site.address;
  const q = `latitude=${lat}&longitude=${lng}&timezone=America%2FEdmonton`;
  try {
    const [wRes, aRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,wind_speed_10m,uv_index&daily=uv_index_max,temperature_2m_max&past_days=1&forecast_days=1&wind_speed_unit=kmh`, { next: { revalidate }, signal: AbortSignal.timeout(6000) }),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=pm2_5`, { next: { revalidate }, signal: AbortSignal.timeout(6000) }).catch(() => null),
    ]);
    if (!wRes.ok) throw new Error(`weather ${wRes.status}`);
    const w = (await wRes.json()) as { current?: Record<string, unknown>; daily?: { uv_index_max?: unknown[]; temperature_2m_max?: unknown[] } };
    const air = aRes && aRes.ok ? ((await aRes.json().catch(() => null)) as { current?: { pm2_5?: unknown } } | null) : null;
    const c = w.current ?? {};
    const temp = num(c.temperature_2m);
    const humidity = num(c.relative_humidity_2m);
    if (temp == null || humidity == null) throw new Error("weather data missing");
    // with past_days=1 the daily lists are [yesterday, today]
    const maxes = (w.daily?.temperature_2m_max ?? []).map(num);
    const uvs = (w.daily?.uv_index_max ?? []).map(num);
    const month = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", month: "numeric" }).format(new Date()));
    const forecast = skinForecast({
      temp,
      feels: num(c.apparent_temperature) ?? temp,
      humidity,
      dew: num(c.dew_point_2m) ?? temp - (100 - humidity) / 5,
      wind: num(c.wind_speed_10m) ?? 0,
      uv: num(c.uv_index) ?? 0,
      uvMax: uvs[uvs.length - 1] ?? num(c.uv_index) ?? 0,
      maxToday: maxes[maxes.length - 1] ?? temp,
      maxYesterday: maxes.length > 1 ? maxes[0] : null,
      pm25: num(air?.current?.pm2_5),
      month,
    });
    return NextResponse.json(forecast, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch (e) {
    console.error("[skin-weather]", e);
    return NextResponse.json({ error: "Weather is not available right now." }, { status: 503 });
  }
}
