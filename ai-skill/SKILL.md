---
name: home-dark-cards-agent
description: >
  Work safely on this repository's Home Assistant custom Lovelace cards,
  documentation, tests, and live-dashboard integration workflow. Use for
  changes to the JavaScript cards under home-dark-cards/ or their documented
  Home Assistant resource and dashboard contracts.
metadata:
  audience: coding-agents
  scope: repository
---

# Home Dark Cards coding-agent skill

Use this as the shared project guidance for any coding agent. It describes the
repository's real boundaries and the parts of the workflow that are easy to
get wrong.

## Repository boundary

- `home-dark-cards/*.js` is the source of truth for the local custom cards.
- `home-dark-cards/README.md` records card contracts, verified entities, resource
  IDs, hosting modes, and deployment notes. Read the relevant section before
  changing a card's configuration contract or resource behavior.
- The cards are native browser custom elements running inside Home Assistant.
  They use the Lovelace lifecycle (`setConfig`, `set hass`, `getCardSize`, and,
  where applicable, `getGridOptions`) and the frontend `hass` object for state
  and service calls.
- There is no repository-owned backend, build system, package manifest, local
  Home Assistant configuration, database, or generated bundle. Do not invent
  one as part of a card change.
- The `tests/` directory contains the Node.js invariant suite. Run it after
  JavaScript changes:

  ```text
  node --test tests/home-dark-cards-invariants.test.cjs
  ```

## Card implementation rules

- Keep each card independently usable and configuration-driven. Preserve its
  existing custom element name, required fields, public options, and HA service
  payload shape unless the user explicitly requests a contract change.
- Treat live entity state and capability attributes as authoritative. Disable or
  avoid service calls when an entity is unavailable or does not expose the
  required feature bits.
- Preserve active focus, slider interaction, menus, timers, observers, and
  other transient UI state when updating from `hass`; do not rebuild the whole
  DOM unnecessarily during an interaction.
- Scope CSS to the card. Use MDI names and Home Assistant theme variables where
  the existing card system does so; avoid introducing a new icon or styling
  framework for a local fix.
- Avoid broad refactors while fixing one card. Update the card README whenever
  a user-visible option, required field, entity-domain constraint, or deployment
  contract changes.

## Home Assistant integration workflow

Actual entities, dashboards, helpers, automations, and resource registrations
live on the remote Home Assistant instance, not in this checkout. When live HA
access is available, inspect the current entity/dashboard/resource state before
making a related change. Use the Home Assistant MCP interface for HA changes;
never hand-edit HA `.storage` data or pretend that a local YAML file is the
source of truth.

For dashboard or resource work:

1. Inspect the live resource registry and find the existing resource by ID.
2. Keep local card behavior in `home-dark-cards/`; do not move it into an inline
   Lovelace resource or create a duplicate resource.
3. URL-mode modules are manually copied to `/config/www/home-dark-cards/` and
   loaded from `/local/home-dark-cards/<file>.js`. After a source update, use a
   new cache-busting query suffix on the existing resource ID when updating the
   live registry.
4. `home-cover-card` is the known inline-resource exception. Verify the live
   registry before touching it, and tell the user explicitly if a requested
   change depends on that inline content.
5. Verify the resulting dashboard/resource configuration after the change. If
   the agent cannot upload local files to HA, state that the updated URL-mode
   file still needs to be copied before browser validation.

Prefer stable entity-based targeting over device-specific targeting when editing
related HA automations or service calls, and prefer native HA helpers and
capabilities over templates or hard-coded state where the platform provides the
needed behavior.

## Safe change checklist

Before finishing:

- inspect the target card and its README contract;
- preserve unrelated working-tree changes;
- run the invariant test suite;
- check that new selectors and service calls handle unavailable entities;
- update documentation for intentional contract changes; and
- report any live-HA deployment or manual file-copy step that could not be
  completed by the agent.
