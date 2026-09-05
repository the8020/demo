Parent DOX: [demo/services DOX](../AGENTS.md).

# Purpose

- Serve the local demonstration page and bounded streaming download fixtures.

# Ownership

- Own the service, allowlisted `public/` assets, generated download route,
  physical download fixture, and service tests.

# Local Contracts

- Resolve assets relative to the module; `/` and `/index.html` serve the same
  document and unknown assets return 404.
- Generated downloads lazily emit 64 KiB zero-filled chunks for validated sizes
  from 1 KiB to 1 GiB.
- Serve the physical 25 MiB fixture and generated responses with exact content
  length and attachment headers.

# Work Guidance

- Keep browser assets local and extend the asset allowlist and its verification
  together.
- Preserve backpressure and cancellation; never eagerly allocate the requested
  download size.

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
