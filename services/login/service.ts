import { defineService } from "@platform/http";
import { kernel } from "@platform/kernel";
import uiConfig from "../../ui-config.json" with { type: "json" };

const service = defineService();

service.get(
  "/",
  { summary: "Render the bootstrap administrator login" },
  () => htmlResponse(loginPage()),
);

service.post(
  "/",
  { summary: "Authenticate a bootstrap administrator" },
  async ({ request }) => {
    const form = await request.formData();
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const result = await kernel.auth.bootstrapLogin({ username, password });
    if (!result.authenticated || result.setCookie === undefined) {
      return htmlResponse(loginPage("Invalid username or password."), 401);
    }
    return new Response(null, {
      status: 303,
      headers: {
        location: uiConfig.postLoginUrl,
        "set-cookie": result.setCookie,
        "cache-control": "no-store",
      },
    });
  },
);

const logout = async (): Promise<Response> => {
  const result = await kernel.auth.logoutCurrent();
  return new Response(null, {
    status: 303,
    headers: {
      location: uiConfig.loginUrl,
      "set-cookie": result.setCookie,
      "cache-control": "no-store",
    },
  });
};

service.post(
  "/logout",
  { summary: "End the current authentication session" },
  logout,
);
service.get(
  "/logout",
  { summary: "End the current authentication session" },
  logout,
);

function loginPage(error = ""): string {
  const errorMarkup = error === ""
    ? ""
    : `<p class="error" role="alert">${escapeHTML(error)}</p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Platform sign in</title><style>
:root{font-family:system-ui,sans-serif;color-scheme:light dark}body{display:grid;min-height:100vh;margin:0;place-items:center;background:#eef2f7;color:#18202a}.card{width:min(24rem,calc(100% - 2rem));padding:2rem;border-radius:.8rem;background:white;box-shadow:0 1rem 3rem #2233}.card h1{margin-top:0}label{display:grid;gap:.35rem;margin:1rem 0;font-weight:600}input,button{box-sizing:border-box;width:100%;padding:.75rem;border:1px solid #9aa7b6;border-radius:.4rem;font:inherit}button{border:0;background:#2457d6;color:white;font-weight:700;cursor:pointer}.error{padding:.7rem;border-radius:.4rem;background:#fee2e2;color:#991b1b}.hint{font-size:.85rem;color:#52606d}</style></head>
<body><main class="card"><h1>Sign in</h1>${errorMarkup}<form method="post" autocomplete="on"><label>Username<input name="username" autocomplete="username" required autofocus></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form><p class="hint">No administrator yet? Run <code>auth bootstrap-admin add &lt;username&gt;</code> in the local administrative console.</p></main></body></html>`;
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function escapeHTML(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(
    ">",
    "&gt;",
  ).replaceAll('"', "&quot;");
}

export default service;
