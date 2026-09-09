Parent DOX: [demo/programs DOX](../AGENTS.md).

# Purpose

- Exercise UUI fields, messages, presentation stacks, and streamed downloads.

# Ownership

- Own the form program, layout, `downloads.ts`, and download tests.

# Local Contracts

- Form and presentation fields reuse `src/fields.ts`; controls, layout, and
  range presentation remain local.

- Use public UUI APIs for messages, modal/page presentation, ScreenChannel
  redraws, and downloads.
- Capture the selected CSV row count per transfer and emit lazy batches of at
  most 1,000 rows; the default is 100,000 rows.
- Keep both download actions and the CSV size slider in the same field group.
- The Code section uses the shared code editor with its component-owned agent
  fallback. Save/Reset keep using the same model as native fields; the UUI
  native agent fixture edits the code headlessly and then opens it in Chromium.

# Work Guidance

- Preserve response backpressure, cancellation, and interaction during
  background transfers.

# Verification

- Run `deno task test` and `deno task check` from the demo root.
- The sibling UUI package's `deno task test:download-browser` exercises this
  real form in Chromium.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
