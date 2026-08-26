interface Options {
  projectRoot: string;
  kernel: string;
  admin: string;
  browser: string;
}

interface KernelProcess {
  root: string;
  child: Deno.ChildProcess;
}

interface UISession {
  session_id: string;
  worker_id: string;
  sandbox_id: string;
  state: string;
}

interface CDPTarget {
  webSocketDebuggerUrl: string;
}

interface CDPResponse {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message?: string };
}

class BrowserPage {
  readonly exceptions: string[] = [];
  readonly #socket: WebSocket;
  readonly #pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  #sequence = 0;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as CDPResponse;
      if (message.method === "Runtime.exceptionThrown") {
        this.exceptions.push(JSON.stringify(message.params ?? {}));
      }
      if (message.id === undefined) return;
      const pending = this.#pending.get(message.id);
      if (pending === undefined) return;
      this.#pending.delete(message.id);
      if (message.error !== undefined) {
        pending.reject(
          new Error(message.error.message ?? "CDP command failed"),
        );
      } else pending.resolve(message.result);
    };
    socket.onclose = () => {
      for (const pending of this.#pending.values()) {
        pending.reject(new Error("browser debugging connection closed"));
      }
      this.#pending.clear();
    };
  }

  static async connect(webSocketURL: string): Promise<BrowserPage> {
    const socket = new WebSocket(webSocketURL);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("connect to browser debugger"));
    });
    const page = new BrowserPage(socket);
    await page.command("Runtime.enable");
    await page.command("Page.enable");
    await page.command("Network.enable");
    return page;
  }

  command<Result = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<Result> {
    const id = ++this.#sequence;
    return new Promise<Result>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as Result),
        reject,
      });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<Result>(expression: string): Promise<Result> {
    const response = await this.command<{
      result?: { value?: Result; description?: string };
      exceptionDetails?: { text?: string };
    }>("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (response.exceptionDetails !== undefined) {
      throw new Error(
        response.result?.description ?? response.exceptionDetails.text ??
          "browser evaluation failed",
      );
    }
    return response.result?.value as Result;
  }

  close(): void {
    this.#socket.close();
  }
}

const options = parseOptions(Deno.args);
const temporaryRoot = await Deno.makeTempDir({ prefix: "platform-phase1d-" });
const primaryRoot = `${temporaryRoot}/node-primary`;
const secondaryRoot = `${temporaryRoot}/node-secondary`;
const browserData = `${temporaryRoot}/chromium`;
const primaryPort = await freePort();
const secondaryPort = await freePort();
const debugPort = await freePort();
const kernels: KernelProcess[] = [];
let browser: Deno.ChildProcess | undefined;
const pages: BrowserPage[] = [];

try {
  await prepareWorkspaces(options.projectRoot, primaryRoot, secondaryRoot);
  kernels.push(startKernel(primaryRoot, primaryPort));
  await waitForHTTP(`http://127.0.0.1:${primaryPort}/`);
  await waitForAdmin(primaryRoot);
  await admin(primaryRoot, [
    "auth",
    "bootstrap-admin",
    "add",
    "admin",
    "--password-stdin",
  ], "phase1d-password\n");
  await waitForServices(primaryRoot, [
    "example/core-ui/login",
    "example/core-ui/session",
    "example/core-ui/shell",
  ]);

  kernels.push(startKernel(secondaryRoot, secondaryPort, primaryRoot));
  await waitForHTTP(`http://127.0.0.1:${secondaryPort}/`);
  await waitForAdmin(secondaryRoot);
  await waitForServices(secondaryRoot, ["example/core-ui/shell"]);

  browser = new Deno.Command(options.browser, {
    args: [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${browserData}`,
      "about:blank",
    ],
    stdout: "null",
    stderr: "null",
  }).spawn();
  await waitForHTTP(`http://127.0.0.1:${debugPort}/json/version`);

  const primaryBase = `http://127.0.0.1:${primaryPort}`;
  const first = await openPage(
    debugPort,
    `${primaryBase}/example/core-ui/shell/`,
  );
  pages.push(first);
  await waitForPage(
    first,
    `location.pathname === "/example/core-ui/login/" && document.querySelector("h1")?.textContent === "Sign in"`,
    "login redirect and form",
  );
  await setValue(first, 'input[name="username"]', "admin");
  await setValue(first, 'input[name="password"]', "phase1d-password");
  await click(first, 'button[type="submit"]');
  await waitForScreen(first, "Welcome to Platform");

  const cookie = await authenticationCookie(first);
  assert(cookie.httpOnly === true, "authentication cookie is not HttpOnly");
  assert(
    cookie.value.length >= 64 && !cookie.value.includes("admin"),
    "authentication cookie is not opaque",
  );
  const shared = await fetch(
    `http://127.0.0.1:${secondaryPort}/example/core-ui/shell/`,
    {
      headers: { cookie: `${cookie.name}=${cookie.value}` },
      redirect: "manual",
    },
  );
  assert(
    shared.status === 200,
    `shared authentication state returned ${shared.status} on node two`,
  );
  await shared.body?.cancel();

  await waitForPage(
    first,
    `document.querySelectorAll(".data-list tbody tr").length >= 2`,
    "home program discovery",
  );
  const initialSessions = await waitForUISessions(primaryRoot, 1);
  const firstSession = initialSessions[0]!;

  await clickRow(first, "core/admin/services");
  await waitForScreen(first, "Services");
  await clickRow(first, "core/example1/variables");
  await waitForScreen(first, "core/example1/variables");
  await clickButton(first, "Enable");
  await waitForPage(
    first,
    `[...document.querySelectorAll("button")].some((item) => item.textContent?.trim() === "Disable")`,
    "service enable through Deno admin bus",
    30_000,
  );
  await setValue(first, '[data-bind="workersDesired"]', "2");
  await clickButton(first, "Save");
  let managedSandbox = "";
  await waitFor(
    async () => {
      const inspected = await admin(primaryRoot, [
        "service",
        "inspect",
        "core/example1/variables",
      ]);
      const service = inspected.service as {
        worker_count?: number;
        instances?: Array<{ sandbox_id?: string }>;
        effective_configuration?: { workers?: { desired?: number } };
      };
      managedSandbox = service.instances?.[0]?.sandbox_id ?? "";
      return service.worker_count === 2 &&
        service.effective_configuration?.workers?.desired === 2 &&
        managedSandbox.length > 0;
    },
    "service capacity mutation through Deno admin bus",
    30_000,
    250,
  );
  await clickRow(first, managedSandbox);
  await waitForScreen(first, managedSandbox);
  await clickButton(first, "Back");
  await waitForScreen(first, "core/example1/variables");
  await clickButton(first, "Back");
  await waitForScreen(first, "Services");
  await clickButton(first, "Back");
  await waitForScreen(first, "Welcome to Platform");

  await clickRow(first, "core/admin/sandboxes");
  await waitForScreen(first, "Sandboxes");
  await clickRow(first, managedSandbox);
  await waitForScreen(first, managedSandbox);
  await clickRow(first, "core/example1/variables");
  await waitForScreen(first, "core/example1/variables");
  await clickButton(first, "Back");
  await waitForScreen(first, managedSandbox);
  await clickButton(first, "Back");
  await waitForScreen(first, "Sandboxes");
  await clickRow(first, firstSession.sandbox_id);
  await waitForScreen(first, firstSession.sandbox_id);
  await waitForPage(
    first,
    `[...document.querySelectorAll(".data-list tbody tr")].some((item) => item.textContent?.includes(${
      JSON.stringify(firstSession.session_id)
    }))`,
    "UUI session in sandbox detail",
  );
  await clickButton(first, "Back");
  await waitForScreen(first, "Sandboxes");
  await clickButton(first, "Back");
  await waitForScreen(first, "Welcome to Platform");

  await clickRow(first, "core/admin/services");
  await waitForScreen(first, "Services");
  await clickRow(first, "core/example1/variables");
  await waitForScreen(first, "core/example1/variables");
  await clickButton(first, "Disable");
  await waitForPage(
    first,
    `[...document.querySelectorAll("button")].some((item) => item.textContent?.trim() === "Enable")`,
    "service disable through Deno admin bus",
    30_000,
  );
  await clickButton(first, "Back");
  await waitForScreen(first, "Services");
  await clickButton(first, "Back");
  await waitForScreen(first, "Welcome to Platform");

  await clickRow(first, "example/core-ui/demo-form");
  await waitForScreen(first, "Form and binding demonstration");
  await setValue(first, '[data-bind="email"]', "changed@example.test");
  assert(
    await first.evaluate<boolean>(
      `[...document.querySelectorAll('[data-bind="email"]')].every((item) => item.value === "changed@example.test")`,
    ),
    "controls sharing one binding did not synchronize",
  );

  await first.evaluate(`(() => {
    window.__platformScreenMarker = document.querySelector(".screen");
    window.__platformConnectionTransitions = [];
    const state = document.querySelector("#connection-state");
    new MutationObserver(() => window.__platformConnectionTransitions.push(state?.textContent ?? ""))
      .observe(state, { childList: true, subtree: true, characterData: true });
  })()`);
  await first.command("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await delay(4_000);
  await first.command("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await waitForPage(
    first,
    `document.querySelector("#connection-state")?.textContent === "Connected" &&
      window.__platformConnectionTransitions?.includes("Reconnecting…")`,
    "brief WebSocket reconnect",
    15_000,
  );
  assert(
    await first.evaluate<boolean>(
      `window.__platformScreenMarker === document.querySelector(".screen") &&
       document.querySelector('[data-bind="email"]')?.value === "changed@example.test"`,
    ),
    "brief reconnect redrew the screen or lost a dirty edit",
  );

  await clickButton(first, "Save");
  await waitForPage(
    first,
    `document.querySelector('[data-bind="status"]')?.value === "Saved 1 time."`,
    "form action and model mutation",
  );
  await first.command("Page.reload", { ignoreCache: true });
  await waitForScreen(first, "Form and binding demonstration");
  await waitForPage(
    first,
    `document.querySelector('[data-bind="status"]')?.value === "Saved 1 time." &&
      document.querySelector('[data-bind="email"]')?.value === "changed@example.test"`,
    "page-reload snapshot",
  );
  const afterReload = await waitForUISessions(primaryRoot, 1);
  assert(
    afterReload[0]?.worker_id === firstSession.worker_id,
    "page reload did not resume the original Worker",
  );
  await clickButton(first, "Throw TypeError");
  await waitForScreen(first, "Program terminated");
  assert(
    await first.evaluate<boolean>(`(() => {
      const text = document.querySelector(".screen")?.textContent ?? "";
      const message = document.querySelector('[data-bind="message"]')?.value ?? "";
      const stack = document.querySelector('[data-bind="stack"]')?.value ?? "";
      const source = document.querySelector('[data-bind="source"]')?.value ?? "";
      return text.includes("TypeError") &&
        message.includes("intentionally raised an uncaught TypeError") &&
        stack.includes("demo-form/program.ts") &&
        source.includes("raiseDemoTypeError");
    })()`),
    "TypeError short dump is missing exception, stack, or source details",
  );
  await first.command("Browser.grantPermissions", {
    origin: primaryBase,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  });
  await clickButton(first, "Copy short dump");
  await waitForPage(
    first,
    `document.querySelector('[data-bind="copyStatus"]')?.value?.startsWith("Copied ") === true`,
    "short dump clipboard action",
  );
  assert(
    await first.evaluate<boolean>(
      `(async () => (await navigator.clipboard.readText()).includes("PROGRAM TERMINATED"))()`,
    ),
    "copied short dump is unavailable from the browser clipboard",
  );
  await clickButton(first, "Home");
  await waitForScreen(first, "Welcome to Platform");

  await clickRow(first, "example/core-ui/demo-master-detail");
  await waitForScreen(first, "Master-detail demonstration");
  assert(
    await first.evaluate<boolean>(`(() => {
      const split = document.querySelector(".layout-split");
      return split?.dataset.responsive === "stack" &&
        split?.style.getPropertyValue("--split-ratio") === "50fr 50fr";
    })()`),
    "master-detail split layout is not responsive 50/50 data",
  );
  await clickRow(first, "ORD-1002");
  await waitForPage(
    first,
    `document.querySelector('[data-bind="selectedOrder.customer"]')?.value === "Another Corp"`,
    "master-detail selection",
  );
  await clickButton(first, "Open form demo");
  await waitForScreen(first, "Form and binding demonstration");
  await clickButton(first, "Back");
  await waitForScreen(first, "Master-detail demonstration");
  await clickButton(first, "Throw ValueError");
  await waitForScreen(first, "Program terminated");
  assert(
    await first.evaluate<boolean>(`(() => {
      const text = document.querySelector(".screen")?.textContent ?? "";
      const properties = document.querySelector('[data-bind="properties"]')?.value ?? "";
      return text.includes("ValueError") && properties.includes("orderNumber") &&
        properties.includes("ORD-0");
    })()`),
    "custom ValueError short dump is missing custom exception properties",
  );
  await clickButton(first, "Home");
  await waitForScreen(first, "Welcome to Platform");

  const second = await openPage(
    debugPort,
    `${primaryBase}/example/core-ui/shell/`,
  );
  pages.push(second);
  await waitForScreen(second, "Welcome to Platform");
  const isolated = await waitForUISessions(primaryRoot, 2);
  const secondSession = isolated.find((item) =>
    item.session_id !== firstSession.session_id
  );
  assert(
    secondSession !== undefined,
    "second browser tab reused a UUI session",
  );
  assert(
    secondSession.worker_id !== firstSession.worker_id,
    "two logical UUI sessions shared one Worker",
  );
  assert(
    secondSession.sandbox_id === firstSession.sandbox_id,
    "two sessions did not share the configured service-instance sandbox",
  );
  await admin(primaryRoot, ["worker", "kill", firstSession.worker_id]);
  await waitFor(
    async () => {
      const sessions = await uiSessions(primaryRoot);
      return sessions.length === 1 &&
        sessions[0]?.session_id === secondSession.session_id;
    },
    "single-Worker failure isolation",
    15_000,
  );
  await clickRow(second, "example/core-ui/demo-form");
  await waitForScreen(second, "Form and binding demonstration");
  await clickButton(second, "Back");
  await waitForScreen(second, "Welcome to Platform");

  await clickButton(second, "Logout");
  await waitForPage(
    second,
    `location.pathname === "/example/core-ui/login/" && document.querySelector("h1")?.textContent === "Sign in"`,
    "logout redirect",
  );
  const remainingCookies = await browserCookies(second);
  assert(
    !remainingCookies.some((item) => item.name === "platform_auth"),
    "logout did not clear the authentication cookie",
  );
  await waitForUISessions(primaryRoot, 0);
  assert(
    pages.every((page) => page.exceptions.length === 0),
    `browser exceptions: ${
      pages.flatMap((page) => page.exceptions).join("; ")
    }`,
  );
  console.log(
    "Phase 1D browser E2E passed: login, admin programs, service control, sandbox links, shared-node auth, programs, short dumps, recovery, reconnect, reload, isolation, and logout",
  );
} finally {
  for (const page of pages) page.close();
  if (browser !== undefined) await stopProcess(browser);
  for (const kernel of kernels.toReversed()) {
    await stopKernel(kernel);
  }
  await removeTemporaryRoot(temporaryRoot);
}

function parseOptions(arguments_: string[]): Options {
  const values = new Map<string, string>();
  for (const argument of arguments_) {
    const separator = argument.indexOf("=");
    if (!argument.startsWith("--") || separator < 3) {
      throw new Error(`invalid option ${argument}`);
    }
    values.set(argument.slice(2, separator), argument.slice(separator + 1));
  }
  const required = (name: string): string => {
    const value = values.get(name);
    if (value === undefined || value.length === 0) {
      throw new Error(`--${name}=... is required`);
    }
    return value;
  };
  return {
    projectRoot: required("project-root"),
    kernel: required("kernel"),
    admin: required("admin"),
    browser: required("browser"),
  };
}

async function prepareWorkspaces(
  projectRoot: string,
  primary: string,
  secondary: string,
): Promise<void> {
  for (const root of [primary, secondary]) {
    await Deno.mkdir(`${root}/packages/example`, { recursive: true });
  }
  await Deno.mkdir(`${primary}/packages/core`, { recursive: true });
  await copyTree(
    `${projectRoot}/packages/example/core-ui`,
    `${primary}/packages/example/core-ui`,
  );
  await copyTree(
    `${projectRoot}/packages/example/core-ui`,
    `${secondary}/packages/example/core-ui`,
  );
  await copyTree(
    `${projectRoot}/packages/core/admin`,
    `${primary}/packages/core/admin`,
  );
  await copyTree(
    `${projectRoot}/packages/core/uui`,
    `${primary}/packages/core/uui`,
  );
  await copyTree(
    `${projectRoot}/packages/core/example1`,
    `${primary}/packages/core/example1`,
  );
  await Deno.remove(`${secondary}/packages/example/core-ui/services/login`, {
    recursive: true,
  });
  await Deno.remove(`${secondary}/packages/example/core-ui/services/session`, {
    recursive: true,
  });
  await Deno.mkdir(`${primary}/config/auth`, { recursive: true });
  await Deno.mkdir(`${primary}/state/auth/bootstrap-sessions`, {
    recursive: true,
  });
  await Deno.chmod(`${primary}/state/auth/bootstrap-sessions`, 0o700);
  await writeDesiredState(primary, "login", "request");
  await writeDesiredState(primary, "shell", "request");
  await writeDesiredState(primary, "session", "session");
  await writeDesiredState(secondary, "shell", "request");
}

async function copyTree(source: string, destination: string): Promise<void> {
  await Deno.mkdir(destination, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const from = `${source}/${entry.name}`;
    const to = `${destination}/${entry.name}`;
    if (entry.isDirectory) await copyTree(from, to);
    else if (entry.isFile) await Deno.copyFile(from, to);
    else if (entry.isSymlink) {
      await Deno.symlink(await Deno.readLink(from), to);
    }
  }
}

async function writeDesiredState(
  root: string,
  service: string,
  mode: "request" | "session",
): Promise<void> {
  const directory = `${root}/state/services/example/core-ui/${service}`;
  await Deno.mkdir(directory, { recursive: true });
  const workers = mode === "session"
    ? "minimum = 0\ndesired = 0\nmaximum = 1000\nmax_in_flight = 1"
    : "minimum = 1\ndesired = 1\nmaximum = 2\nmax_in_flight = 32";
  await Deno.writeTextFile(
    `${directory}/state.toml`,
    `schema = 1
enabled = true
generation = 0

[instances]
minimum = 1
desired = 1
maximum = 2

[workers]
${workers}

[timeouts]
request = "30s"
drain = "30s"
idle = "0s"

[runtime]
group_key = "example/core-ui/${service}"
dependency_mode = "cached-only"
`,
  );
}

function startKernel(
  root: string,
  port: number,
  sharedRoots?: string,
): KernelProcess {
  const sharedSettings = sharedRoots === undefined ? [] : [
    "--set",
    `auth.bootstrap.users_file=${sharedRoots}/config/auth/bootstrap-users.toml`,
    "--set",
    `auth.bootstrap.sessions_root=${sharedRoots}/state/auth/bootstrap-sessions`,
  ];
  const child = new Deno.Command(options.kernel, {
    args: [
      "--root",
      root,
      "--set",
      `network.main_port=${port}`,
      "--set",
      "sandbox.runtime.mode=rootless",
      "--set",
      "sandbox.warm_pool.size=0",
      "--set",
      "uui.heartbeat_interval=1000",
      "--set",
      "uui.heartbeat_timeout=3000",
      ...sharedSettings,
    ],
    cwd: options.projectRoot,
    stdout: "null",
    stderr: "inherit",
  }).spawn();
  return { root, child };
}

async function admin(
  root: string,
  arguments_: string[],
  input?: string,
): Promise<Record<string, unknown>> {
  const child = new Deno.Command(options.admin, {
    args: ["--root", root, "--json", ...arguments_],
    stdin: input === undefined ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  if (input !== undefined) {
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(input));
    await writer.close();
  }
  const output = await child.output();
  const text = new TextDecoder().decode(output.stdout).trim();
  if (!output.success) {
    const error = new TextDecoder().decode(output.stderr).trim();
    throw new Error(error || text || `${arguments_.join(" ")} failed`);
  }
  const envelope = JSON.parse(text) as {
    success?: boolean;
    result?: Record<string, unknown>;
    error?: { message?: string };
  };
  if (envelope.success !== true || envelope.result === undefined) {
    throw new Error(envelope.error?.message ?? "administrative command failed");
  }
  return envelope.result;
}

async function waitForServices(
  root: string,
  expected: string[],
): Promise<void> {
  let lastObservation = "service list was not available";
  try {
    await waitFor(
      async () => {
        try {
          const result = await admin(root, ["service", "list"]);
          const services = result.services as
            | Array<{
              service_id?: string;
              state?: string;
              enabled?: boolean;
            }>
            | undefined;
          lastObservation = JSON.stringify(services ?? result);
          return services !== undefined &&
            expected.every((serviceId) =>
              services.some((service) =>
                service.service_id === serviceId && service.enabled === true &&
                (service.state === "IDLE" || service.state === "READY")
              )
            );
        } catch (error) {
          lastObservation = error instanceof Error
            ? error.message
            : String(error);
          return false;
        }
      },
      `enabled services in ${root}`,
      180_000,
      1_000,
    );
  } catch (error) {
    const inspections = await Promise.all(expected.map(async (serviceId) => {
      try {
        return await admin(root, ["service", "inspect", serviceId]);
      } catch (inspectError) {
        return {
          service_id: serviceId,
          inspect_error: inspectError instanceof Error
            ? inspectError.message
            : String(inspectError),
        };
      }
    }));
    const log = await latestKernelLog(root);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
        `last service observation: ${lastObservation}\n` +
        `service inspections: ${JSON.stringify(inspections)}\n${log}`,
    );
  }
}

async function latestKernelLog(root: string): Promise<string> {
  const directory = `${root}/.kernel/logs`;
  try {
    const candidates: Array<{ path: string; modified: number }> = [];
    for await (const entry of Deno.readDir(directory)) {
      if (!entry.isFile || !entry.name.endsWith(".log")) continue;
      const path = `${directory}/${entry.name}`;
      const info = await Deno.stat(path);
      candidates.push({ path, modified: info.mtime?.getTime() ?? 0 });
    }
    candidates.sort((left, right) => right.modified - left.modified);
    if (candidates.length === 0) return "kernel log: unavailable";
    const source = await Deno.readTextFile(candidates[0]!.path);
    return `kernel log tail:\n${source.slice(-8_000)}`;
  } catch (error) {
    return `kernel log: ${error instanceof Error ? error.message : error}`;
  }
}

async function waitForAdmin(root: string): Promise<void> {
  await waitFor(
    async () => {
      try {
        await admin(root, ["system", "status"]);
        return true;
      } catch {
        return false;
      }
    },
    `kernel command bus in ${root}`,
    120_000,
    250,
  );
}

async function uiSessions(root: string): Promise<UISession[]> {
  const result = await admin(root, ["ui-session", "list"]);
  const summaries = (result.ui_sessions ?? []) as Array<{
    session_id: string;
  }>;
  return await Promise.all(summaries.map(async (summary) => {
    const inspected = await admin(root, [
      "ui-session",
      "inspect",
      summary.session_id,
    ]);
    return inspected.ui_session as UISession;
  }));
}

async function waitForUISessions(
  root: string,
  count: number,
): Promise<UISession[]> {
  let sessions: UISession[] = [];
  await waitFor(
    async () => {
      sessions = await uiSessions(root);
      return sessions.length === count;
    },
    `${count} UUI sessions`,
    15_000,
  );
  return sessions;
}

async function openPage(port: number, url: string): Promise<BrowserPage> {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  if (!response.ok) throw new Error(`create browser page: ${response.status}`);
  const target = await response.json() as CDPTarget;
  return await BrowserPage.connect(target.webSocketDebuggerUrl);
}

async function browserCookies(
  page: BrowserPage,
): Promise<Array<{ name: string; value: string; httpOnly?: boolean }>> {
  const response = await page.command<{
    cookies: Array<{ name: string; value: string; httpOnly?: boolean }>;
  }>("Network.getAllCookies");
  return response.cookies;
}

async function authenticationCookie(
  page: BrowserPage,
): Promise<{ name: string; value: string; httpOnly?: boolean }> {
  const cookie = (await browserCookies(page)).find((item) =>
    item.name === "platform_auth"
  );
  if (cookie === undefined) throw new Error("authentication cookie is missing");
  return cookie;
}

async function setValue(
  page: BrowserPage,
  selector: string,
  value: string,
): Promise<void> {
  const changed = await page.evaluate<boolean>(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) return false;
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  assert(changed, `missing input ${selector}`);
}

async function click(page: BrowserPage, selector: string): Promise<void> {
  const clicked = await page.evaluate<boolean>(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!(target instanceof HTMLElement)) return false;
    target.click();
    return true;
  })()`);
  assert(clicked, `missing clickable ${selector}`);
}

async function clickButton(page: BrowserPage, label: string): Promise<void> {
  const clicked = await page.evaluate<boolean>(`(() => {
    const target = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === ${
    JSON.stringify(label)
  });
    if (!(target instanceof HTMLButtonElement)) return false;
    target.click();
    return true;
  })()`);
  assert(clicked, `missing ${label} button`);
}

async function clickRow(page: BrowserPage, text: string): Promise<void> {
  const clicked = await page.evaluate<boolean>(`(() => {
    const target = [...document.querySelectorAll(".data-list tbody tr")].find((item) => item.textContent?.includes(${
    JSON.stringify(text)
  }));
    if (!(target instanceof HTMLTableRowElement)) return false;
    target.click();
    return true;
  })()`);
  assert(clicked, `missing row containing ${text}`);
}

async function waitForScreen(
  page: BrowserPage,
  title: string,
): Promise<void> {
  await waitForPage(
    page,
    `document.querySelector("#connection-state")?.textContent === "Connected" && document.querySelector("h1")?.textContent === ${
      JSON.stringify(title)
    }`,
    title,
  );
}

async function waitForPage(
  page: BrowserPage,
  expression: string,
  description: string,
  timeout = 10_000,
): Promise<void> {
  await waitFor(
    async () => {
      try {
        return await page.evaluate<boolean>(expression || "false");
      } catch {
        return false;
      }
    },
    description,
    timeout,
  );
}

async function waitForHTTP(url: string): Promise<void> {
  await waitFor(
    async () => {
      try {
        const response = await fetch(url, { redirect: "manual" });
        await response.body?.cancel();
        return response.status > 0;
      } catch {
        return false;
      }
    },
    url,
    30_000,
  );
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  description: string,
  timeout: number,
  interval = 50,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!(await predicate())) {
    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for ${description}`);
    }
    await delay(interval);
  }
}

function freePort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

function stopChild(child: Deno.ChildProcess): void {
  try {
    child.kill("SIGKILL");
  } catch {
    // The process already exited.
  }
}

async function stopProcess(child: Deno.ChildProcess): Promise<void> {
  stopChild(child);
  await child.status.catch(() => {});
}

async function stopKernel(kernel: KernelProcess): Promise<void> {
  try {
    await admin(kernel.root, ["system", "shutdown"]);
  } catch {
    await stopProcess(kernel.child);
    return;
  }
  const exited = await Promise.race([
    kernel.child.status.then(() => true, () => true),
    delay(15_000).then(() => false),
  ]);
  if (!exited) await stopProcess(kernel.child);
}

async function removeTemporaryRoot(root: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await Deno.remove(root, { recursive: true });
      return;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return;
      lastError = error;
      await delay(100 * (attempt + 1));
    }
  }
  console.error(
    `Phase 1D E2E cleanup could not remove ${root}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
