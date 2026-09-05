Parent DOX: [demo DOX](../AGENTS.md).

# Purpose

- Own interactive UUI demonstrations and ordinary activation handler programs.

# Ownership

- Own master-detail and responsive-fields demos, activation handlers, and
  `program_test.ts`; the form child owns its larger interactive/download
  fixture.

# Local Contracts

- Only the three interactive demos declare `uui = true`; activation programs
  remain hidden non-UUI handlers.
- Retain UUI Model wrappers across ordinary calls and presentation returns.
- Keep deliberate uncaught exception actions so the standard shared recovery
  path is exercised.

# Work Guidance

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

- [demo-form/AGENTS.md](demo-form/AGENTS.md): Exercise UUI fields, messages,
  presentation stacks, and streamed downloads.
