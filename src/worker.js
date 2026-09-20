const maxSize = 32 * 1024 * 1024;
const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
]);

const uploadTarget = atob(
  "aHR0cHM6Ly9hcGkuaW1nYmIuY29tLzEvdXBsb2Fk"
);

const createJson = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const getSuffix = (type) =>
  ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp"
  }[type] || "png");

const createToken = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 20);

async function handleUpload(request, env) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return createJson(
      { error: "Choose an image to upload." },
      400
    );
  }

  if (!allowedTypes.has(file.type)) {
    return createJson(
      {
        error:
          "Only JPG, PNG, GIF, and WebP are supported."
      },
      415
    );
  }

  if (file.size > maxSize) {
    return createJson(
      {
        error:
          "Images must be 32 MB or smaller."
      },
      413
    );
  }

  if (!env.apiKey) {
    return createJson(
      {
        error:
          "Upload service is not configured."
      },
      503
    );
  }

  const formData = new FormData();
  formData.set("image", file);

  const response = await fetch(
    `${uploadTarget}?key=${encodeURIComponent(env.apiKey)}`,
    {
      method: "POST",
      body: formData
    }
  );

  if (!response.ok) {
    return createJson(
      {
        error:
          "Unable to store this image. Please try again."
      },
      502
    );
  }

  const result = await response.json();
  const imageData = result?.data;
  const imageUrl =
    imageData?.display_url || imageData?.url;
  const imageId = String(imageData?.id || "");

  if (!imageUrl || !imageId) {
    return createJson(
      {
        error:
          "The upload service returned an invalid response."
      },
      502
    );
  }

  const token = createToken();

  await env.DB
    .prepare(
      "INSERT INTO assets (token, source_id, source_url, content_type) VALUES (?, ?, ?, ?)"
    )
    .bind(
      token,
      imageId,
      imageUrl,
      file.type
    )
    .run();

  const url = new URL(request.url);

  return createJson({
    url: `${url.origin}/images/${token}.${getSuffix(file.type)}`,
    id: token
  });
}

async function handleImage(request, env, id) {
  const image = await env.DB
    .prepare(
      "SELECT source_url, content_type FROM assets WHERE token = ?"
    )
    .bind(id)
    .first();

  if (!image) {
    return new Response("Image not found.", {
      status: 404
    });
  }

  const response = await fetch(
    image.source_url,
    {
      headers: {
        "user-agent": "FieImg/1.0"
      }
    }
  );

  if (!response.ok) {
    return new Response(
      "Image is temporarily unavailable.",
      {
        status: 502
      }
    );
  }

  const headers = new Headers(response.headers);

  headers.set(
    "content-type",
    image.content_type
  );

  headers.set(
    "cache-control",
    "public, max-age=31536000, immutable"
  );

  headers.set(
    "x-content-type-options",
    "nosniff"
  );

  headers.delete("set-cookie");

  return new Response(response.body, {
    status: 200,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      request.method === "POST" &&
      url.pathname === "/api/upload"
    ) {
      return handleUpload(request, env);
    }

    const match = url.pathname.match(
      /^\/images\/([a-f0-9]{20})\.(?:jpg|png|gif|webp)$/i
    );

    if (
      request.method === "GET" &&
      match
    ) {
      return handleImage(
        request,
        env,
        match[1]
      );
    }

    if (
      url.pathname.startsWith("/api/")
    ) {
      return createJson(
        { error: "Not found." },
        404
      );
    }

    return env.ASSETS.fetch(request);
  }
};
