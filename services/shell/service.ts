import { defineService, type RequestMetadata } from "@platform/http";
import uiConfig from "../../ui-config.json" with { type: "json" };

const frontend = new URL("./frontend/", import.meta.url);
const generated = new URL("./.generated/", import.meta.url);
const service = defineService();

service.get(
  "/",
  { summary: "Render the authenticated UUI shell" },
  ({ meta }) => shellResponse(meta),
);
service.get(
  "/index.html",
  { summary: "Render the authenticated UUI shell" },
  ({ meta }) => shellResponse(meta),
);
service.get(
  "/main.js",
  { summary: "Serve the built UUI browser client" },
  () =>
    fileResponse(
      new URL("main.js", generated),
      "text/javascript; charset=utf-8",
      "no-cache",
    ),
);
service.get(
  "/main.js.map",
  { summary: "Serve the development source map" },
  () =>
    fileResponse(
      new URL("main.js.map", generated),
      "application/json; charset=utf-8",
      "no-cache",
    ),
);
service.get(
  "/styles.css",
  { summary: "Serve UUI shell styles" },
  () =>
    fileResponse(
      new URL("styles.css", frontend),
      "text/css; charset=utf-8",
      "no-cache",
    ),
);

async function shellResponse(meta: RequestMetadata): Promise<Response> {
  const source = await Deno.readTextFile(new URL("index.html", frontend));
  const requestURL = new URL(meta.originalUrl);
  const websocketScheme = requestURL.protocol === "https:" ? "wss:" : "ws:";
  const boot = {
    websocketUrl:
      `${websocketScheme}//${requestURL.host}${uiConfig.sessionWebSocketPath}`,
    protocol: meta.uui?.protocolVersion ?? 1,
    heartbeatInterval: meta.uui?.heartbeatIntervalMilliseconds ?? 30_000,
    reconnectInitialDelay: meta.uui?.reconnectInitialDelayMilliseconds ?? 250,
    reconnectMaximumDelay: meta.uui?.reconnectMaximumDelayMilliseconds ??
      10_000,
    buildVersion: "phase-1d",
  };
  const html = source.replace(
    /\{\s*"__platform_boot_placeholder__"\s*:\s*true\s*\}/,
    escapeJSON(boot),
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'self'; connect-src 'self' ws: wss:; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

async function fileResponse(
  source: URL,
  contentType: string,
  cacheControl: string,
): Promise<Response> {
  try {
    return new Response(await Deno.readFile(source), {
      headers: {
        "content-type": contentType,
        "cache-control": cacheControl,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return new Response("Not Found\n", { status: 404 });
    }
    throw error;
  }
}

function escapeJSON(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(
    ">",
    "\\u003e",
  ).replaceAll("&", "\\u0026");
}

export default service;
