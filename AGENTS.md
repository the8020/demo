# Purpose

- Provide the portable first-party bootstrap login and Unified User Interface
  proof package.

# Ownership

- Own the public login service, authenticated browser shell, authenticated
  session-mode service, two demonstration programs, browser source/build, and
  package-local layouts.
- Do not own authentication storage/validation, cookie construction, sandbox
  placement, physical WebSockets, or kernel routing.

# Local Contracts

- Service identity and canonical paths derive from `packages/example/core-ui`;
  login, shell, and session are ordinary default-enabled services.
- `ui-config.json` is the trusted package configuration for login, post-login,
  logout, and session WebSocket URLs; browser requests never choose redirects.
- Login/logout call the typed kernel API; passwords and opaque authentication
  cookies never enter UUI messages or browser boot data.
- One session service Worker delegates startup and uncaught-program recovery to
  the shared UUI framework, which obtains the configured core Home and Program
  terminated IDs from trusted kernel metadata.
- Programs obtain the current authenticated identity on demand through
  `kernel.auth.currentUser()` instead of receiving identity or infrastructure
  dependencies through their function parameters.
- Programs are plain default-exported functions with ordinary TypeScript call
  stacks, classes, and closures; there is no program wrapper, decorator, or
  framework navigation stack.
- Both demos expose deliberate uncaught exception actions: the form raises a
  `TypeError`, while master-detail raises a custom `ValueError` with inspectable
  fields.
- Layouts and future overrides are serializable data without executable code;
  user-specific layout variants are not persisted in this phase.
- Browser source uses the shared UUI protocol types, preserves DOM/model/dirty
  edits across brief reconnects, and requests a full current snapshot only after
  reload or explicit resync.
- Browser source executes bounded framework clipboard-write commands using the
  standard Clipboard API with a compatibility fallback.
- Reload resume synchronizes the Worker-acknowledged client sequence before a
  new event is emitted, preventing post-reload actions from being mistaken for
  duplicates.
- `.generated/main.js` and its source map are build products from
  `services/shell/frontend/main.ts` and are never source-of-truth files.

# Work Guidance

- Keep all assets local, semantic, keyboard-accessible, responsive, and free of
  backend-provided CSS or executable layout content.

# Verification

- Deno checks cover all services/programs; UUI and frontend tests cover
  discovery and containment failures, dynamic/default-export loading, static and
  natural class/closure program calls, model binding, resume decisions, and
  exception escape, renderer-supporting pure helpers, and core UUI discovery;
  `services/shell/build.sh` rebuilds the browser bundle.
- `browser_e2e.ts` drives real Chromium through two isolated kernel nodes and
  covers login/cookie sharing, direct home-list invocation, the core-admin
  service/sandbox lists and linked details, authorized service enable/disable
  and capacity changes, sandbox session relationships, nested demos, dirty
  reconnect, reload resume, TypeError/ValueError short dumps, source context,
  clipboard copy, Home recovery, per-tab Worker isolation, single-Worker
  failure, and logout; administrative polling is throttled, startup failures
  include service/log diagnostics, enabled `IDLE` services are accepted before
  first-request lazy provisioning, and process cleanup is time-bounded.

# Child DOX Index
