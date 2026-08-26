import { assertEquals } from "@std/assert";
import { type KernelInvoke, kernelInvokeSymbol } from "@platform/kernel";
import service from "./service.ts";

const context = {
  signal: new AbortController().signal,
  meta: {
    requestId: "request-test",
    serviceId: "example/core-ui/login",
    serviceGeneration: 1,
    canonicalBasePath: "/example/core-ui/login",
    originalUrl: "https://example.test/example/core-ui/login/",
    auth: { authenticated: false },
  },
};

Deno.test("login page and kernel-issued authentication cookie", async () => {
  const calls: string[] = [];
  (globalThis as unknown as Record<symbol, unknown>)[kernelInvokeSymbol] =
    ((operation) => {
      calls.push(operation);
      return Promise.resolve(
        operation === "auth.bootstrapLogin"
          ? {
            authenticated: true,
            setCookie: "platform_auth=opaque; HttpOnly; Path=/; SameSite=Lax",
          }
          : { setCookie: "platform_auth=; Max-Age=0; HttpOnly; Path=/" },
      );
    }) satisfies KernelInvoke;
  try {
    const page = await service.fetch(new Request("https://service/"), context);
    assertEquals(page.status, 200);
    assertEquals((await page.text()).includes('type="password"'), true);
    const login = await service.fetch(
      new Request("https://service/", {
        method: "POST",
        body: new URLSearchParams({ username: "Admin", password: "private" }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      context,
    );
    assertEquals(login.status, 303);
    assertEquals(login.headers.get("location"), "/example/core-ui/shell/");
    assertEquals(login.headers.get("set-cookie")?.includes("opaque"), true);
    const logout = await service.fetch(
      new Request("https://service/logout"),
      context,
    );
    assertEquals(logout.status, 303);
    assertEquals(calls, ["auth.bootstrapLogin", "auth.logoutCurrent"]);
  } finally {
    delete (globalThis as unknown as Record<symbol, unknown>)[
      kernelInvokeSymbol
    ];
  }
});
