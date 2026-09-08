Parent DOX: [demo DOX](../AGENTS.md).

# Purpose

- Share small demonstration helpers across package entrypoints.

# Ownership

- Own `greeting.ts`, semantic demo fields in `fields.ts`, and reusable database
  audit columns under `database/`.

# Local Contracts

- `fields.ts` owns reusable demo profile, customer, order, and interaction
  fields. Customer and order tables reuse compatible fields. Sample usernames
  and roles do not navigate to real accounts or grant permissions.

- Service imports remain package-local and reusable columns retain the shared
  database DSL contract.

# Work Guidance

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
