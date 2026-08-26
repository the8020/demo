import { assertEquals } from "@std/assert";
import service from "./service.ts";

const context = {
  signal: new AbortController().signal,
  meta: {
    requestId: "request-shell",
    serviceId: "example/core-ui/shell",
    serviceGeneration: 1,
    canonicalBasePath: "/example/core-ui/shell",
    originalUrl: "https://platform.example/example/core-ui/shell/",
    auth: {
      authenticated: true,
      realm: "bootstrap-admin" as const,
      userId: "bootstrap-admin:Admin",
      username: "Admin",
      authVersion: 1,
    },
    uui: {
      protocolVersion: 1,
      heartbeatIntervalMilliseconds: 12_345,
      reconnectInitialDelayMilliseconds: 321,
      reconnectMaximumDelayMilliseconds: 4_321,
    },
  },
};

Deno.test("shell emits only non-secret boot data and local assets", async () => {
  const response = await service.fetch(
    new Request("https://service/"),
    context,
  );
  const body = await response.text();
  assertEquals(response.status, 200);
  assertEquals(
    body.includes("wss://platform.example/example/core-ui/session/connect"),
    true,
  );
  assertEquals(body.includes("platform_auth"), false);
  assertEquals(body.includes("resumeToken"), false);
  assertEquals(body.includes('"heartbeatInterval":12345'), true);
  assertEquals(body.includes('"reconnectInitialDelay":321'), true);
  assertEquals(body.includes('"reconnectMaximumDelay":4321'), true);
  const css = await service.fetch(
    new Request("https://service/styles.css"),
    context,
  );
  assertEquals(css.status, 200);
  assertEquals(css.headers.get("content-type"), "text/css; charset=utf-8");
});
