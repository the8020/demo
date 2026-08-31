import { defineService, z } from "@the8020/http";

interface StaticAsset {
  source: URL;
  contentType: string;
  cacheControl: string;
}

const publicRoot = new URL("./public/", import.meta.url);
const indexSource = new URL("index.html", publicRoot);
const staticDownloadSource = new URL(
  "downloads/static-25mb.bin",
  publicRoot,
);
const basePathPlaceholder = "__THE8020_BASE_PATH__";
const minimumGeneratedSize = 1024;
const maximumGeneratedSize = 1024 * 1024 * 1024;
const generatedChunkSize = 64 * 1024;

const assets: ReadonlyMap<string, StaticAsset> = new Map([
  [
    "/assets/styles.css",
    {
      source: new URL("assets/styles.css", publicRoot),
      contentType: "text/css; charset=utf-8",
      cacheControl: "public, max-age=300",
    },
  ],
  [
    "/assets/app.js",
    {
      source: new URL("assets/app.js", publicRoot),
      contentType: "text/javascript; charset=utf-8",
      cacheControl: "public, max-age=300",
    },
  ],
  [
    "/assets/favicon.svg",
    {
      source: new URL("assets/favicon.svg", publicRoot),
      contentType: "image/svg+xml; charset=utf-8",
      cacheControl: "public, max-age=86400",
    },
  ],
]);

const service = defineService();

service.get(
  "/",
  { summary: "Render the static demo index" },
  ({ meta }) => indexResponse(meta.canonicalBasePath),
);

service.get(
  "/index.html",
  { summary: "Render the static demo index file" },
  ({ meta }) => indexResponse(meta.canonicalBasePath),
);

service.get(
  "/assets/*",
  { summary: "Serve an allowlisted static browser asset" },
  ({ request }) => assetResponse(new URL(request.url).pathname),
);

service.get(
  "/downloads/generated",
  {
    summary: "Stream an artificially generated download",
    query: z.object({
      size: z.coerce.number().int().min(minimumGeneratedSize).max(
        maximumGeneratedSize,
      ),
    }),
  },
  ({ query }) => generatedDownloadResponse(query.size),
);

service.get(
  "/downloads/static-25mb.bin",
  { summary: "Stream the physical 25 MiB demonstration file" },
  () => staticDownloadResponse(),
);

async function indexResponse(canonicalBasePath: string): Promise<Response> {
  const template = await Deno.readTextFile(indexSource);
  const body = template.replaceAll(basePathPlaceholder, canonicalBasePath);
  return new Response(body, {
    headers: {
      "cache-control": "no-cache",
      "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

async function assetResponse(path: string): Promise<Response> {
  const asset = assets.get(path);
  if (asset === undefined) {
    return new Response("Not Found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }
  const body = await Deno.readFile(asset.source);
  return new Response(body, {
    headers: {
      "cache-control": asset.cacheControl,
      "content-type": asset.contentType,
      "x-content-type-options": "nosniff",
    },
  });
}

function generatedDownloadResponse(size: number): Response {
  let remaining = size;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (remaining === 0) {
        controller.close();
        return;
      }
      const length = Math.min(generatedChunkSize, remaining);
      controller.enqueue(new Uint8Array(length));
      remaining -= length;
      if (remaining === 0) controller.close();
    },
  });
  return new Response(body, {
    headers: downloadHeaders(
      `the8020-generated-${size}-bytes.bin`,
      size,
      "no-store",
    ),
  });
}

async function staticDownloadResponse(): Promise<Response> {
  const file = await Deno.open(staticDownloadSource, { read: true });
  try {
    const information = await file.stat();
    if (!information.isFile) {
      throw new TypeError("static download source must be a regular file");
    }
    return new Response(file.readable, {
      headers: downloadHeaders(
        "the8020-static-25mb.bin",
        information.size,
        "public, max-age=300",
      ),
    });
  } catch (error) {
    file.close();
    throw error;
  }
}

function downloadHeaders(
  filename: string,
  size: number,
  cacheControl: string,
): Headers {
  return new Headers({
    "cache-control": cacheControl,
    "content-disposition": `attachment; filename="${filename}"`,
    "content-length": String(size),
    "content-type": "application/octet-stream",
    "x-content-type-options": "nosniff",
  });
}

export default service;
