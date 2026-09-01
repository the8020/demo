# Purpose

- Collect all first-party 80|20 service and UUI demonstrations in one package.
- This file is the root contract of the independent `the8020/demo` Git
  repository.

# Ownership

- Own the `the8020/demo/static`, `the8020/demo/variables`, and
  `the8020/demo/variables-import` services; the demo form, master-detail, and
  responsive-fields programs; shared demo helpers; and their tests/assets.
- The form and master-detail programs deliberately expose uncaught exception
  actions so standard UUI recovery can be exercised across package boundaries.
- The static service owns its allowlist, generated and physical download paths,
  and the HTML, CSS, JavaScript, image, and binary assets rendered or downloaded
  by the demo page.
- Keep browser assets local to the package so the demo does not require a CDN or
  browser network access outside the platform service.

# Local Contracts

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
- Variable services exercise the canonical scale-to-zero defaults: zero
  minimum/maximum Workers, zero minimum sandboxes, and four Workers per sandbox.
  The static service keeps eight minimum Workers across at least two sandboxes,
  permits 1,000 Workers, and packs at most 50 of its Workers per sandbox. All
  are stateless with concurrency 32, 70% target utilization, two-minute Worker
  keepalive, and ten-minute inactive session value.
- Source checks resolve sibling `kernel` and `uui` repositories; deployed
  Workers use only the canonical runtime `@the8020/*` and `@packages/*` aliases.
- The responsive-fields program deliberately mixes hinted and unhinted fields
  across sibling cards, gives its two-row textarea a hint, and includes an
  overlong short-field label, providing the browser fixture for reserved
  one-line field-message, label-ellipsis, and row-span geometry.

# Work Guidance

- Keep the page lightweight, responsive, accessible, and useful for visually
  exercising common Bootstrap-style controls.
- Add new browser files to the service allowlist and its verification together.
- Preserve response-stream backpressure and client cancellation; never allocate
  the selected generated-download size eagerly.

# Verification

- `service_test.ts` verifies both index routes, local asset bodies and content
  types, missing-file behavior, `HEAD` semantics, generated-download bounds and
  byte counts, and the complete physical 25 MiB response.
- `program_test.ts` covers the three UUI demos, nested invocation, shared model
  bindings, field metadata including responsive hint fixtures, and deliberate
  exception behavior.
- Package-owned `deno task check` formats, lints, and type-checks every service
  and program; `deno task test` runs the service and program tests.

# Child DOX Index
