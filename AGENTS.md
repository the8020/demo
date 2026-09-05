Parent DOX: [8020 workspace](../AGENTS.md).

Framework source:
[agent0ai/dox/AGENTS.md](https://github.com/agent0ai/dox/blob/765ae4ac02cc884eefcd41a3d0f71941721adb89/AGENTS.md).

# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable
  docs must stay understandable from the nearest applicable AGENTS.md plus every
  parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path,
   read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide
   rules
7. If docs conflict, the closer doc controls local work details, but no child
   doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session
before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or
  quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child
index changes. Update child docs when parent changes alter local rules. Remove
stale or contradictory text immediately. Small edits that do not change behavior
or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences,
  durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX
  Index
- Each parent explains what its direct children cover and what stays owned by
  the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own
  purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user
  instructions; if there are no specific standards or instructions yet, leave it
  empty
- Verification must reflect an existing check; if no verification framework
  exists yet, leave it empty and update it when one exists

Default section order:

- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local
  version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for
  risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the
relevant child AGENTS.md

## Child DOX Index

This root retains repository-wide contracts and files outside the child scopes
below.

- [hooks/AGENTS.md](hooks/AGENTS.md): Declare demo package activation handlers.
- [programs/AGENTS.md](programs/AGENTS.md): Own interactive UUI demonstrations
  and ordinary activation handler programs.
- [services/AGENTS.md](services/AGENTS.md): Own service demonstrations for
  static content, variables, package imports, and database access.
- [src/AGENTS.md](src/AGENTS.md): Share small demonstration helpers across
  package entrypoints.
- [tables/AGENTS.md](tables/AGENTS.md): Describe the demo customer/order
  database integration fixture.

# Purpose

- Collect all first-party 80|20 service and UUI demonstrations in one package.
- This file is the root contract of the independent `the8020/demo` Git
  repository.

# Ownership

- Own the `the8020/demo/static`, `the8020/demo/variables`,
  `the8020/demo/variables-import`, and disabled-by-default
  `the8020/demo/database` services; the demo form, master-detail, and
  responsive-fields programs; shared demo helpers; and their tests/assets.
- The form and master-detail programs deliberately expose uncaught exception
  actions so standard UUI recovery can be exercised across package boundaries.
- The static service owns its allowlist, generated and physical download paths,
  and the HTML, CSS, JavaScript, image, and binary assets rendered or downloaded
  by the demo page.
- Keep browser assets local to the package so the demo does not require a CDN or
  browser network access outside the platform service.

# Local Contracts

- The three interactive demos declare `uui = true`; activation hook programs
  keep the non-UUI default and stay out of Home.
- `/` and `/index.html` return the same HTML document.
- `/assets/styles.css`, `/assets/app.js`, and `/assets/favicon.svg` return
  explicit content types; every other asset path returns `404`.
- `/downloads/generated?size=<bytes>` lazily emits zero-filled 64 KiB chunks for
  validated sizes from 1 KiB through 1 GiB without a backing file.
- `/downloads/static-25mb.bin` opens and streams the physical 25 MiB package
  fixture from the read-only mount.
- Both downloads return exact `Content-Length`, `application/octet-stream`, and
  attachment headers; the page uses native download links and never buffers
  download bodies in browser JavaScript.
- The portable 30-minute request timeout allows slow 1 GiB transfers without a
  kernel setting change.
- Resolve package assets relative to `import.meta.url` and rely only on the
  service runtime's read-only package mount.
- Variable-service responses identify `the8020/demo`; the import variant uses
  the package-local shared greeting helper rather than a second package.
- `tables/` is the integration fixture for the platform database DSL. Customers,
  orders, and order items cover reusable columns, logical references, generated
  identity, exact decimals, JSON/bytes/datetime, indexes, and a composite key.
  The database service exercises transactional creation, a join/aggregate read,
  and rollback through normal Kysely.
- Demo services exercise the canonical scale-to-zero defaults: zero
  minimum/maximum Workers, zero minimum sandboxes, and four Workers per sandbox.
  All are stateless with concurrency 32, 70% target utilization, two-minute
  Worker keepalive, and ten-minute inactive session value.
- `hooks/prepare-demo.toml` and `hooks/seed-demo.toml` declare
  `hook = "pre-activate"` and `hook = "post-activate"`, selecting the ordinary
  non-discoverable `the8020/demo/pre-activate` and `the8020/demo/post-activate`
  programs. Their default exports receive shared chain state followed by the
  frozen activation scope; they validate that scope and idempotently seed rows.
- Source checks resolve sibling `kernel` and `uui` repositories; deployed
  Workers use only the canonical runtime `@the8020/*` and `/p/*` aliases.
- The responsive-fields program deliberately mixes hinted and unhinted fields
  across sibling cards, gives its two-row textarea a hint, and includes an
  overlong short-field label, providing the browser fixture for reserved
  one-line field-message, label-ellipsis, and row-span geometry.
- The form program exposes screen actions for one message, all four semantic
  kinds, alternating long Markdown and short stacked messages, a delayed
  background sequence, and a 105-message burst. These fixtures exercise UUI
  roundtrip clearing, asynchronous delivery, expanding a long card after a
  shorter predecessor, stacked-card geometry, and the 10-toast/100-history
  limits through the public `sendMessage()` import.
- The form program's Presentation flow is the browser fixture for an ordinary
  screen shown as a modal, a nested modal, a later page and modal, restoration
  of the earlier page-plus-modal continuation, and a `ScreenChannel` background
  redraw that preserves a dirty browser value.
- The form program also includes an inline Yes/No confirmation modal whose
  result returns to the calling screen and emits a choice-specific UUI message;
  it deliberately requires no separate package or program.
- The form program's Downloads section keeps a CSV row-count slider and both
  download actions in one field group. The slider defaults to 100,000 rows and
  permits 1,000 through 1,000,000 in steps of 1,000. The ordinary example uses a
  small text `File`; the virtual CSV yields a header followed by batches of at
  most 1,000 rows with `row,previous_total,total`, where each total adds the row
  number to the preceding total. Both call public UUI `download()` without
  awaiting completion. Each transfer captures the selected row count and remains
  independent of subsequent edits or Reset.

- Demo screen functions retain UUI Model wrappers across ordinary calls and
  presentation returns. The master-detail list uses the shared measured-capacity
  and query pipeline; its source collection remains intact.

# Work Guidance

- Keep the page lightweight, responsive, accessible, and useful for visually
  exercising common Bootstrap-style controls.
- User-visible descriptions, hints, placeholders, notices, and empty-state copy
  must help the user act or understand a user-visible outcome. Never add copy
  solely to explain internal architecture, storage, persistence, sessions,
  transport, or implementation details; omit it entirely and keep those details
  in DOX or developer documentation. For example, never show
  `Value is stored per-session in the user storage.` or
  `The value is sent directly to kernel secret storage and is not shown again.`
  in the UI.
- Add new browser files to the service allowlist and its verification together.
- Preserve response-stream backpressure and client cancellation; never allocate
  the selected generated-download size eagerly.

# Verification

- `service_test.ts` verifies both index routes, local asset bodies and content
  types, missing-file behavior, `HEAD` semantics, generated-download bounds and
  byte counts, and the complete physical 25 MiB response.
- `program_test.ts` covers the three UUI demos, nested invocation, shared model
  bindings, field metadata including responsive hint fixtures, synchronous and
  asynchronous message variants and limits, and deliberate exception behavior.
- Download tests verify the default 100,000-row export, a partial final batch,
  exact running totals across batch boundaries, and both public download paths
  while the form remains interactive. UUI's `test:download-browser` also runs
  the real demo form, verifies native text/CSV downloads and slider-selected row
  counts, and checks the shared field group's buttons at desktop/mobile widths.
- `tables_test.ts` verifies canonical descriptors, imported reusable columns,
  logical references, composite keys, and exact decimal metadata. Live platform
  smoke tests exercise the database service against the kernel-owned SQLite
  connection.
- Package-owned `deno task check` formats, lints, and type-checks every service
  and program; `deno task test` runs the service and program tests.
