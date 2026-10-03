const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      ...extra
    }
  });

function cors(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || "";
  const ok = origin && (origin === allowed || allowed === "*");
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function signToken(secret, payload) {
  const data = new TextEncoder().encode(payload);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return `${base64url(data)}.${hex(sig)}`;
}

async function verifyToken(secret, token) {
  if (!token || !token.includes(".")) return false;
  const [a, b] = token.split(".");
  const raw = Uint8Array.from(atob(a.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4-a.length%4)%4)), c => c.charCodeAt(0));
  const expected = await signToken(secret, new TextDecoder().decode(raw));
  return expected === token && JSON.parse(new TextDecoder().decode(raw)).exp > Date.now();
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return verifyToken(env.ADMIN_SECRET, token);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = cors(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/visit" && request.method === "POST") {
        const body = await request.json();
        const visitorId = String(body.visitorId || "").trim();

        if (!/^[0-9a-f-]{20,80}$/i.test(visitorId)) {
          return json({ error: "invalid visitor id" }, 400, headers);
        }

        const exists = await env.DB.prepare(
          "SELECT visitor_id FROM visitors WHERE visitor_id = ?"
        ).bind(visitorId).first();

        if (exists) {
          const row = await env.DB.prepare(
            "SELECT current_count, total_count FROM counters WHERE id = 1"
          ).first();
          return json({ counted: false, current: row.current_count, total: row.total_count }, 200, headers);
        }

        const now = new Date().toISOString();
        const result = await env.DB.prepare(
          "INSERT OR IGNORE INTO visitors(visitor_id, first_seen) VALUES(?, ?)"
        ).bind(visitorId, now).run();

        if (result.meta.changes === 1) {
          await env.DB.prepare(
            "UPDATE counters SET current_count = current_count + 1, total_count = total_count + 1 WHERE id = 1"
          ).run();
        }

        const row = await env.DB.prepare(
          "SELECT current_count, total_count FROM counters WHERE id = 1"
        ).first();

        return json({ counted: result.meta.changes === 1, current: row.current_count, total: row.total_count }, 200, headers);
      }

      if (url.pathname === "/api/login" && request.method === "POST") {
        const body = await request.json();
        if (String(body.password || "") !== env.ADMIN_PASSWORD) {
          return json({ error: "invalid password" }, 401, headers);
        }

        const payload = JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 });
        const token = await signToken(env.ADMIN_SECRET, payload);
        return json({ token }, 200, headers);
      }

      if (url.pathname === "/api/stats" && request.method === "GET") {
        if (!(await requireAdmin(request, env))) return json({ error: "unauthorized" }, 401, headers);
        const row = await env.DB.prepare(
          "SELECT current_count, total_count FROM counters WHERE id = 1"
        ).first();
        return json({ current: row.current_count, total: row.total_count }, 200, headers);
      }

      if (url.pathname === "/api/manual" && request.method === "POST") {
        if (!(await requireAdmin(request, env))) return json({ error: "unauthorized" }, 401, headers);
        const body = await request.json();
        const delta = Number(body.delta);
        if (![1, -1].includes(delta)) return json({ error: "delta must be 1 or -1" }, 400, headers);

        const row = await env.DB.prepare(
          "SELECT current_count, total_count FROM counters WHERE id = 1"
        ).first();

        const nextCurrent = Math.max(0, row.current_count + delta);
        const nextTotal = Math.max(0, row.total_count + (delta === 1 ? 1 : 0));

        await env.DB.prepare(
          "UPDATE counters SET current_count = ?, total_count = ? WHERE id = 1"
        ).bind(nextCurrent, nextTotal).run();

        return json({ current: nextCurrent, total: nextTotal }, 200, headers);
      }

      return json({ error: "not found" }, 404, headers);
    } catch (e) {
      return json({ error: "server error" }, 500, headers);
    }
  }
};
