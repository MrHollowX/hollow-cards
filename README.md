# Home Dark Cards

This repository contains standalone JavaScript custom cards for the Home
Assistant `home-dark` Lovelace dashboard. The shared, agent-neutral project
guidance is [`ai-skill/SKILL.md`](ai-skill/SKILL.md); coding agents should read
it before making changes.

## Repository contents

- [`home-dark-cards/`](home-dark-cards/) — local card sources and their detailed
  configuration, resource, and deployment contracts.
- [`tests/`](tests/) — Node.js invariant tests for the 16 source cards (23 tests).
- [`ai-overview.md`](ai-overview.md) — architecture and onboarding notes.
- [`AGENTS.md`](AGENTS.md) — short discovery pointer to the shared skill.

The cards run in the Home Assistant browser frontend. They receive state and
service APIs through Home Assistant's `hass` object. This repository has no
backend, build system, package manifest, local HA configuration, database, or
generated bundle.

## Verification

Run the invariant suite with:

```text
node --test tests/home-dark-cards-invariants.test.cjs
```

Live entities, dashboards, and Lovelace resources remain on the remote Home
Assistant instance. See the skill and the card README for the MCP workflow,
URL-mode deployment directory, cache-busting rules, and the retained inline
`home-cover-card` exception.

There are no tool-specific skill copies in this repository. `AGENTS.md` is only
the discovery pointer; [`ai-skill/SKILL.md`](ai-skill/SKILL.md) is the shared
source for all coding agents.
