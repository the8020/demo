Parent DOX: [demo DOX](../AGENTS.md).

# Purpose

- Describe the demo customer/order database integration fixture.

# Ownership

- Own `customers.ts`, `orders.ts`, and `order_items.ts` and their descriptor
  tests; physical schema deployment remains kernel-owned.

# Local Contracts

- Default-export authored table descriptors through `/p/the8020/db/mod.ts`;
  table identity follows the package and file path.
- Preserve coverage of reusable columns, logical references, generated
  identities, exact decimals, JSON/bytes/datetime, indexes, and composite keys.

# Work Guidance

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
