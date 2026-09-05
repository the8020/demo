Parent DOX: [demo DOX](../AGENTS.md).

# Purpose

- Own service demonstrations for static content, variables, package imports, and
  database access.

# Ownership

- Own service manifests and handlers; the static child owns its asset and
  download contract.

# Local Contracts

- Use canonical stateless service policy and read-only package mounts; the
  database demo remains disabled by default.
- The database demo exercises normal Kysely transactions, joins, aggregates, and
  rollback against the shared database API.
- The import variant reuses the package-local greeting helper.

# Work Guidance

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

- [static/AGENTS.md](static/AGENTS.md): Serve the local demonstration page and
  bounded streaming download fixtures.
