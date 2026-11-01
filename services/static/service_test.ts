import { test } from "/p/the8020/services/test_localization.ts";
import { assertEquals, assertStringIncludes } from "@std/assert";
import service from "./service.ts";
import {
  defaultConfiguration,
  Localization,
  withLocalization,
} from "/p/the8020/i18n/mod.ts";
import czech from "../../i18n/locales/cs.json" with { type: "json" };

const canonicalBasePath = "/the8020/demo/static";

Deno.test("static demo localizes HTML and safely embeds browser texts", async () => {
  await withLocalization(
    new Localization(
      "cs",
      defaultConfiguration,
      (packageId) =>
        Promise.resolve({
          package: packageId,
          language: "cs",
          texts: {
            ...czech.texts,
            "static.profile_saved": '</script><img src=x onerror="alert(1)">',
          },
        }),
    ),
    async () => {
      const response = await request("/");
      const body = await response.text();
      assertEquals(response.status, 200);
      assertStringIncludes(body, 'lang="cs"');
      assertStringIncludes(body, "Spustit ukázku");
      assertEquals(body.includes("{{"), false);
      assertEquals(body.includes("[!"), false);
      assertEquals(body.includes("</script><img"), false);
      const encoded = body.match(/id="locale">([\s\S]*?)<\/script>/)![1]!;
      assertEquals(
        JSON.parse(encoded)["static.profile_saved"],
        '</script><img src=x onerror="alert(1)">',
      );
    },
  );
});

function context() {
  return {
    signal: new AbortController().signal,
    meta: {
      contextId: "request-demo-test",
      serviceId: "the8020/demo/static",
      serviceGeneration: 1,
      canonicalBasePath,
      originalUrl: `http://localhost:9090${canonicalBasePath}/`,
      client: { ipAddress: "203.0.113.4", networkScope: "public" as const },
      user: { userId: "user:system", username: "system" },
      auth: { authenticated: false },
      execution: {
        nodeId: "node-test",
        sandboxId: "sandbox-test",
        workerId: "worker-test",
      },
    },
  };
}

async function request(path: string, method = "GET"): Promise<Response> {
  return await service.fetch(
    new Request(`http://service${path}`, { method }),
    context(),
  );
}

test("static demo serves the same index at slash and index.html", async () => {
  const root = await request("/");
  const index = await request("/index.html");

  assertEquals(root.status, 200);
  assertEquals(root.headers.get("content-type"), "text/html; charset=utf-8");
  assertEquals(index.status, 200);
  const rootBody = await root.text();
  assertEquals(rootBody, await index.text());
  assertStringIncludes(
    rootBody,
    `${canonicalBasePath}/assets/styles.css`,
  );
  assertStringIncludes(rootBody, `${canonicalBasePath}/assets/app.js`);
  assertStringIncludes(
    rootBody,
    `${canonicalBasePath}/downloads/generated?size=26214400`,
  );
  assertStringIncludes(
    rootBody,
    `${canonicalBasePath}/downloads/static-25mb.bin`,
  );
  assertEquals(rootBody.includes("__THE8020_BASE_PATH__"), false);
});

test("static demo serves local assets with explicit content types", async () => {
  const stylesheet = await request("/assets/styles.css");
  assertEquals(stylesheet.status, 200);
  assertEquals(
    stylesheet.headers.get("content-type"),
    "text/css; charset=utf-8",
  );
  assertStringIncludes(await stylesheet.text(), ".form-range");

  const script = await request("/assets/app.js");
  assertEquals(script.status, 200);
  assertEquals(
    script.headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assertStringIncludes(await script.text(), "data-range-output");

  const icon = await request("/assets/favicon.svg");
  assertEquals(icon.status, 200);
  assertEquals(
    icon.headers.get("content-type"),
    "image/svg+xml; charset=utf-8",
  );
  assertStringIncludes(await icon.text(), "<svg");
});

test("static demo rejects files outside its asset allowlist", async () => {
  const missing = await request("/assets/missing.css");
  assertEquals(missing.status, 404);
  assertEquals(await missing.text(), "Not Found\n");
});

test("static demo supports HEAD through the GET routes", async () => {
  const response = await request("/assets/styles.css", "HEAD");
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/css; charset=utf-8",
  );
  assertEquals(await response.text(), "");
});

test("generated downloads stream the validated byte count", async () => {
  const size = 70_000;
  const response = await request(`/downloads/generated?size=${size}`);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-length"), String(size));
  assertEquals(
    response.headers.get("content-type"),
    "application/octet-stream",
  );
  assertEquals(
    response.headers.get("content-disposition"),
    `attachment; filename="the8020-generated-${size}-bytes.bin"`,
  );
  const body = new Uint8Array(await response.arrayBuffer());
  assertEquals(body.byteLength, size);
  assertEquals(body.every((value) => value === 0), true);
});

test("generated downloads accept 1 GiB without buffering it for HEAD", async () => {
  const size = 1024 * 1024 * 1024;
  const response = await request(`/downloads/generated?size=${size}`, "HEAD");
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-length"), String(size));
  assertEquals(await response.text(), "");
});

test("generated downloads reject sizes outside 1 KiB through 1 GiB", async () => {
  for (const size of [1023, 1024 * 1024 * 1024 + 1]) {
    const response = await request(`/downloads/generated?size=${size}`);
    assertEquals(response.status, 400);
  }
});

test("physical download streams the complete 25 MiB package file", async () => {
  const size = 25 * 1024 * 1024;
  const response = await request("/downloads/static-25mb.bin");
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-length"), String(size));
  assertEquals(
    response.headers.get("content-type"),
    "application/octet-stream",
  );
  assertEquals(
    response.headers.get("content-disposition"),
    'attachment; filename="the8020-static-25mb.bin"',
  );
  assertEquals((await response.arrayBuffer()).byteLength, size);
});
