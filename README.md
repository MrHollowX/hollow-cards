# Home Assistant AI Skills

This repo ships an AI coding-agent **skill** for working safely with a live Home
Assistant instance — `home-assistant-best-practices`. It's a decision workflow
and anti-pattern reference for creating or editing automations, scripts,
scenes, dashboards, helpers, blueprints, and AppDaemon apps, aimed at agents
that talk to HA through its MCP server rather than by editing local YAML.

There is no local HA configuration in this repo. All actual HA work (reading
entities, writing automations, editing dashboards, etc.) happens through the
`home-assistant` MCP server against a remote instance — this repo only holds
the skill definition, its reference docs, and the project-context files that
point agents at it.

## Core principle

Prefer native Home Assistant constructs over templates and `device_id`:

- Purpose-specific triggers/conditions and built-in helpers (`min_max`,
  `threshold`, `derivative`, `utility_meter`, `group`, ...) over
  `condition: template` and template sensors.
- `entity_id` (or `device_ieee` for ZHA) over `device_id` for triggers and
  service calls.

Templates bypass HA's config validation and fail silently at runtime; native
constructs are validated at load time and are easier to debug.

## Where the skill lives

| Tool | Location | Notes |
|---|---|---|
| Claude Code | `home-assistant-skills` plugin (enabled in `.claude/settings.local.json`) | Canonical source: `skill://home-assistant-best-practices/SKILL.md` |
| Cursor / other AGENTS.md-reading tools | [`.cursor/rules/home-assistant-best-practices.mdc`](.cursor/rules/home-assistant-best-practices.mdc) + [`.cursor/rules/home-assistant/references/`](.cursor/rules/home-assistant/references) | Manually mirrored copy of the same rule — kept in sync by hand when the source skill updates |
| Project context (either tool) | [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) | Session-start context: how work here is executed, plus a snapshot of the target HA instance for grounding suggestions. The two files mirror each other. |

## Reference files

Read on demand from the rule's Reference Files table — each covers one
decision area:

| File | Covers |
|---|---|
| `references/safe-refactoring.md` | Impact analysis before renaming entities, replacing helpers, or restructuring automations |
| `references/automation-patterns.md` | Triggers, conditions, waits, variables, automation modes, disabling automations |
| `references/helper-selection.md` | Built-in helper vs. template sensor decision matrix |
| `references/template-guidelines.md` | Confirming a template is actually the right tool |
| `references/yaml-only-integrations.md` | Editing YAML-only integrations that have no config flow |
| `references/device-control.md` | `entity_id` vs `device_id`, service calls, Zigbee button/remote patterns |
| `references/scenes.md` | Scene authoring, snapshot/restore vs. scripts |
| `references/dashboard-guide.md` | Lovelace layout, view types, strategies, custom cards, CSS |
| `references/dashboard-cards.md` | Looking up available card types |
| `references/domain-docs.md` | Fetching trigger/condition/action docs for a domain |
| `references/examples.yaml` | Compound examples combining multiple practices |
| `references/appdaemon.md` | AppDaemon app structure, scheduling, state management |
| `references/blueprint-guide.md` | Blueprint metadata, `!input` selectors, versioning |

Paths above are relative to `.cursor/rules/home-assistant/`.

## Keeping things in sync

The Claude Code plugin is the source of truth. When it's updated, the Cursor
mirror (`.cursor/rules/home-assistant-best-practices.mdc` and its
`references/`) and `CLAUDE.md`/`AGENTS.md` need to be updated by hand to
match — there's no automated sync between them.

## Reusing this elsewhere

- **Claude Code:** install the `home-assistant-skills` plugin and connect the
  `home-assistant` MCP server to your own HA instance.
- **Cursor or other AGENTS.md-reading tools:** copy `.cursor/rules/` (or the
  `AGENTS.md`/`CLAUDE.md` equivalents) into your project and connect the same
  MCP server.

## Other contents

The [`home-dark-cards/`](home-dark-cards) directory holds an unrelated set of
custom Lovelace card sources for a specific dashboard — see its own
[README](home-dark-cards/README.md) for details.
