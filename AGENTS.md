# Purpose

- Provide a self-contained static-site demonstration package for the platform
  HTTP service runtime.

# Ownership

- Own the `core/demo/static` service, its static-file allowlist, generated and
  physical download paths, and the HTML, CSS, JavaScript, image, and binary
  assets rendered or downloaded by the demo page.
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
- `install.sh` formats, lints, type-checks, and tests the service with the
  repository-local Deno runtime.

# Child DOX Index
