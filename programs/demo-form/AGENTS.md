Parent DOX: [demo/programs DOX](../AGENTS.md).

# Purpose

- Exercise UUI fields, messages, presentation stacks, and streamed downloads.

# Ownership

- Own the form program, layout, `downloads.ts`, and download tests.

# Local Contracts

- Use public UUI APIs for messages, modal/page presentation, ScreenChannel
  redraws, and downloads.
- Capture the selected CSV row count per transfer and emit lazy batches of at
  most 1,000 rows; the default is 100,000 rows.
- Keep both download actions and the CSV size slider in the same field group.

# Work Guidance

- Preserve response backpressure, cancellation, and interaction during
  background transfers.

# Verification

- Run `deno task test` and `deno task check` from the demo root.
- The sibling UUI package's `deno task test:download-browser` exercises this
  real form in Chromium.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
