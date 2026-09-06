# Hollow Cards

Hollow Cards is a set of standalone JavaScript custom cards for Home Assistant.
The card element names use the `custom:hollow-*` prefix. Existing dashboard
paths remain unchanged because they belong to the external dashboard
configuration.

The shared, agent-neutral project guidance is [`ai-skill/SKILL.md`](ai-skill/SKILL.md);
coding agents should read it before making changes.

## Install with HACS

HACS can install Hollow Cards as a Dashboard repository. If the repository is
not listed in the HACS catalog yet, add `MrHollowX/hollow-cards-set` as a
custom repository and choose the **Dashboard** category.

After downloading, add one module resource to Home Assistant:

```yaml
resources:
  - url: /hacsfiles/hollow-cards-set/hollow-cards-set.js
    type: module
```

This path matches the `hollow-cards-set` repository name. Remove duplicate old
`/local/hollow-cards/*.js` resources when switching to the HACS entry point.

The dashboard card types are `custom:hollow-header-card`,
`custom:hollow-climate-card`, and the other `custom:hollow-*` types.

When card source files change, run
`powershell -File scripts/sync-hacs-dist.ps1` before committing so the HACS
payload stays synchronized.

## Repository contents

- [`hollow-cards/`](hollow-cards/) — local card sources and their detailed
  configuration, resource, and deployment contracts.
- [`tests/`](tests/) — Node.js invariant tests for the 16 source cards (23 tests).
- [`ai-overview.md`](ai-overview.md) — architecture and onboarding notes.
- [`AGENTS.md`](AGENTS.md) — short discovery pointer to the shared skill.

The cards run in the Home Assistant browser frontend. They receive state and
service APIs through Home Assistant's `hass` object. This repository has no
backend, local Home Assistant configuration, or database. The root
`hacs.json`, `dist/` payload, and sync script are packaging-only assets for
HACS; card behavior remains in `hollow-cards/`.

## Verification

Run the invariant suite with:

```text
node --test tests/hollow-cards-invariants.test.cjs
```

Live entities, dashboards, and Lovelace resources remain on the remote Home
Assistant instance. See the skill and the card README for the MCP workflow,
URL-mode deployment directory, cache-busting rules, and the retained inline
`hollow-cover-card` exception.

There are no tool-specific skill copies in this repository. `AGENTS.md` is only
the discovery pointer; [`ai-skill/SKILL.md`](ai-skill/SKILL.md) is the shared
source for all coding agents.
