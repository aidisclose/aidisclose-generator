// aidisclose global counter — Cloudflare Worker
//
// GET  /  -> { "count": <n> }            (read-only, never increments)
// POST /  -> { "count": <n+1> }          (increment, returns new total)
//
// Storage: a single KV key "count" in the bound namespace `AID_COUNTER`.
// Abuse mitigation: a lightweight per-IP rate limit (one increment per IP
// per RATE_WINDOW seconds) so the total can't be trivially spammed.

const ALLOWED_ORIGINS = [
  "https://aidisclose.org",
  "https://www.aidisclose.org",
  // add "http://localhost:8080" etc. while testing locally
];

const RATE_WINDOW = 60; // seconds between counted increments per IP

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, origin, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const kv = env.AID_COUNTER;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const current = parseInt((await kv.get("count")) || "0", 10) || 0;

    if (request.method === "GET") {
      return json({ count: current }, origin);
    }

    if (request.method === "POST") {
      // Per-IP rate limit: skip the increment if this IP bumped recently.
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const seen = await kv.get(`ip:${ip}`);
      if (seen) {
        return json({ count: current, throttled: true }, origin);
      }
      const next = current + 1;
      await kv.put("count", String(next));
      await kv.put(`ip:${ip}`, "1", { expirationTtl: RATE_WINDOW });
      return json({ count: next }, origin);
    }

    return json({ error: "method not allowed" }, origin, 405);
  },
};
