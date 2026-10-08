Parent DOX: [demo DOX](../AGENTS.md).

# Purpose

- Local browser assets served through UUI's authenticated package-asset path.

# Ownership

- `arkanoid.js` is the checked-in bundle of the Arkanoid browser sources;
  `arkanoid.css` owns its responsive canvas presentation.

# Local Contracts

- No CDN or runtime browser dependencies. Rebuild JavaScript from its ordinary
  source; the generated bundle is excluded from formatting and linting.
- The shell owns package-asset delivery, distinct from the static demo service.

# Work Guidance

# Verification

- Run `deno task build:arkanoid`, `deno task check`, `deno task test` and
  `deno task test:arkanoid-browser` from the package root.

# Child DOX Index
