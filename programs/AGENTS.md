Parent DOX: [demo DOX](../AGENTS.md).

# Purpose

- Own interactive UUI demonstrations and ordinary activation handler programs.

# Ownership

- Own master-detail and responsive-fields demos, activation handlers, and
  `program_test.ts`; the form child owns its larger interactive/download
  fixture.

# Local Contracts

- Reuse `src/fields.ts` for shared labels, help, validation, and enum choices.
  The responsive fixture keeps selected unhinted fields through explicit
  `description: undefined`, plus its two long geometry hints and screen-specific
  sample labels.

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
