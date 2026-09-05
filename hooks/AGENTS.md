Parent DOX: [demo DOX](../AGENTS.md).

# Purpose

- Declare demo package activation handlers.

# Ownership

- Own `prepare-demo.toml` and `seed-demo.toml`; `../programs/` owns the
  executable handlers.

# Local Contracts

- Declare pre-activate and post-activate triggers explicitly with full program
  identities.
- Handlers receive shared chain state and a separate frozen activation scope.

# Work Guidance

# Verification

- Kernel package handler-index tests verify declaration contracts; run
  `go test ./kernel/packages/...` from the sibling kernel repository with its
  local Go environment.
- Run this package's `deno task check` for the referenced handler programs.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
