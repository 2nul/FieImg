const MAX_SIZE = 32 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const TARGET = atob("aHR0cHM6Ly9hcGkuaW1nYmIuY29tLzEvdXBsb2Fk");

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const suffixFor = (type) => ({ "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" }[type] || "png");
const token = () => crypto.randomUUID().replaceAll("-", "").slice(0, 20);

async function upload(request, env) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose an image to upload." }, 400);
  if (!ALLOWED_TYPES.has(file.type)) return json({ error: "Only JPG, PNG, GIF, and WebP are supported." }, 415);
  if (file.size > MAX_SIZE) return json({ error: "Images must be 32 MB or smaller." }, 413);
  if (!env.apiKey) return json({ error: "Upload service is not configured." }, 503);

  const upstreamForm = new FormData();
  upstreamForm.set("image", file);
  const upstream = await fetch(`${TARGET}?key=${encodeURIComponent(env.apiKey)}`, { method: "POST", body: upstreamForm });
  if (!upstream.ok) return json({ error: "Unable to store this image. Please try again." }, 502);

  const result = await upstream.json();
  const source = result?.data;
  const sourceUrl = source?.display_url || source?.url;
  const sourceId = String(source?.id || "");
  if (!sourceUrl || !sourceId) return json({ error: "The upload service returned an invalid response." }, 502);

  const id = token();
  await env.DB.prepare("INSERT INTO assets (token, source_id, source_url, content_type) VALUES (?, ?, ?, ?)")
    .bind(id, sourceId, sourceUrl, file.type)
    .run();
  const url = new URL(request.url);
  return json({ url: `${url.origin}/images/${id}.${suffixFor(file.type)}`, id });
}

async function image(request, env, id) {
  const row = await env.DB.prepare("SELECT source_url, content_type FROM assets WHERE token = ?").bind(id).first();
  if (!row) return new Response("Image not found.", { status: 404 });
  const origin = await fetch(row.source_url, { headers: { "user-agent": "FieImg/1.0" } });
  if (!origin.ok) return new Response("Image is temporarily unavailable.", { status: 502 });
  const headers = new Headers(origin.headers);
  headers.set("content-type", row.content_type);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.delete("set-cookie");
  return new Response(origin.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/upload") return upload(request, env);
    const match = url.pathname.match(/^\/images\/([a-f0-9]{20})\.(?:jpg|png|gif|webp)$/i);
    if (request.method === "GET" && match) return image(request, env, match[1]);
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);
    return env.ASSETS.fetch(request);
  }
};
