# Home Assistant — Project Context

This directory has no local config files. All work here happens through the
`home-assistant` MCP server, which talks to a remote HA instance directly
(entities, automations, scripts, scenes, helpers, dashboards, etc. all live on
the HA server, not on disk). There is nothing to `git` or read from the
filesystem — use the MCP tools (`ha_search`, `ha_get_overview`,
`ha_config_get_*`, `ha_call_service`, ...) as the source of truth.

**Before creating/editing automations, scripts, scenes, dashboards, or
helpers, read the `home-assistant-best-practices` skill** (via the MCP
resource `skill://home-assistant-best-practices/SKILL.md`) and follow its
Reference Files table. Key house rules baked into that skill: prefer
entity_id over device_id, use native helpers over templates where possible,
never hand-edit YAML/.storage directly.

## Custom card resource hosting rule

- Never create or update inline Lovelace resources for custom cards.
- Custom-card behavior must live in a local source file under
 `home-dark-cards/`.
- For a URL-mode custom-card change, assume the user has copied the updated
 local file to `/config/www/home-dark-cards/` once the local edit is complete.
 Immediately update the existing resource with a new cache-busting URL; do not
 wait for copy confirmation unless the user explicitly says they have not
 copied it.
- Use URL-mode module resources under `/local/home-dark-cards/<file>.js` only
 after the local source update. Reuse an existing resource ID when one exists;
 do not create duplicate resources.
- Before changing a dashboard or resource, inspect the live resource registry.
  If the dashboard uses an inline resource, tell the user explicitly. Do not
  silently update or replace that inline resource.

## System

- HA Core 2026.8.1, Home Assistant OS 18.2, Supervisor 2026.07.5, Python 3.14.6,
  installed as an OS/Supervisor install (not container-only), on a KVM VM
  (`board: ova`). Re-verified 2026-08-14; the previously recorded Core 2026.7.3 /
  HA OS 18.1 values were stale.
- Location: "Home", timezone Europe/Bucharest.
- Recorder DB: MySQL/MariaDB (~3,900 MiB), oldest run 2026-08-02.
- Lovelace: storage mode, 8 dashboards, 38 views, 30 resources.
- Installed add-ons (16): Music Assistant 2.9.13, Terminal & SSH, Mosquitto
  broker, YT Music PO Token Generator, ESPHome Device Builder, Studio Code
  Server, Zigbee2MQTT, RPC Shutdown, Samba share, chrony, Everything Presence
  Zone Configurator, Piper (TTS), Whisper (STT), Home Assistant MCP Server,
  OpenThread Border Router, and Matter Server. The ZigStar TI CC2652P/P7 FW
  Flasher add-on is no longer installed.
- HACS installed (2.0.5), 28 downloaded custom repos.
- Integrations seen in system health: Airly, HA Cloud (not logged in), Daikin
  Onecta (OAuth2), HACS, Supervisor/hassio, core, Lovelace, network, recorder.

## Scale

- 2030 entities across 42 domains, 375 services, 14 areas (no floors defined
  — all areas are "unassigned" to a floor). (Was 17; `laundry_room`,
  `soundbar`, `q_series_soundbar` were empty leftovers and removed
  2026-07-23.) Entity count re-verified 2026-08-14; the earlier 2016 was stale.
- 74 automations (57 on, 16 off, 1 unavailable), only 2 scripts, 1 scene-ish
  setup via automations (no dedicated scenes found in top-level scan).
- Big domains: sensor (645), binary_sensor (303), number (233), switch (202),
  select (100), update (89), button (79), light (78), media_player (37),
  device_tracker (30), climate (13), cover (11). The media_player count was
  re-verified as 37 on 2026-08-14 (12 idle, 9 off, 15 unavailable, 1 playing);
  the earlier 39 was stale.

## Areas (14, all floor-unassigned)

Apartment, Cinema, Eric's Bathroom, Eric's Room, Hallway, Kitchen, Laundry,
Living Room, Master Bathroom, Master Bedroom (area_id `bedroom`), Office,
Studio, Studio Bathroom, Garage (added most recently, 2026).

Biggest areas by entity count: Office (152), Master Bedroom (134), Garage
(136), Eric's Room (171), Living Room (105), Kitchen (119), Cinema (120).

## Notable devices / people

- People: Andrei, Loredana (Lori); child referred to as "Eric" (Eric's Room /
  Eric's Bathroom).
- Zigbee via Zigbee2MQTT + ZigStar coordinator. KNX bus in use (KNX switches,
  KNX date/time entities) alongside Zigbee/WiFi devices.
- Shelly devices (EM, Plus1PM) for power monitoring/switching.
- Climate: Daikin Onecta AC integration, KNX-driven heating (Apartment/Studio
  "Central Heating (Architect Edition)" automations), per-room HVAC presence
  control automations (Office, Eric's Room, Master Bedroom, Living Room).
- Media: Cinema TV/SHIELD/Chromecast setup, Living Room Soundbar, Roborock
  vacuum, Music Assistant.
- Security: Front Door Lock, Doorbell (camera + ring event + announcement
  automation), garage presence alerts, exterior sirens (Gradina/Poarta/Fata).
- House-mode pattern: `input_select.house_mode` driven by presence
  (Home/Away) which in turn drives day/night mode and other automations
  ("Set House Mode to Away/Home", "Set Day or Night mode based on House
  Mode", "Set House Night Mode").

## Automation naming conventions already in use

- Per-area status automations: `"<Area> ALL Brightness Status"` /
  `"<Area> ALL ON/OFF Status"` — keep a room's group/"ALL" entity in sync.
  Follow this pattern for any new area rather than inventing a new one.
- Per-area motion-light automations: `"<Area> Motion Light"`.
- HVAC automations prefixed `HVAC:` for mode-setting, or
  `"<Area> Heating with Presence Control"` / `"<Area> HVAC Control on
  door/window change"` for per-room logic.
- WOL entries use `WOL <Device>` naming for Wake-on-LAN buttons.

## Dashboards

- `mobile-home` (title "Mobile", sidebar-visible) — a purpose-built mobile
  dashboard created 2026-07-23, native `sections`/`tile` cards throughout
  (no HACS cards used, for upgrade-safety). Views: Home (quick actions,
  house mode, favorites, doorbell), Lights (per-area), Climate (per-area),
  Security (locks, doorbell, all cameras, sirens/garage), Storm Trooper
  (the Tesla in the Garage — climate/locks/covers/seat heaters/remote
  buttons), Media (media players + Roborock).
- HACS lovelace cards are installed and available for future styling
  passes if a punchier look is wanted: Mushroom, Bubble Card, button-card,
  card-mod, mini-media-player, mini-graph-card, clock-weather-card,
  vehicle-status-card (good fit for Storm Trooper), stack-in-card,
  swipe-card, Xiaomi Vacuum Map Card, Kiosk Mode, layout-card.
- `automation.set_house_night_mode` is wired as the "Good Night" shortcut's
  target — if that automation is renamed/removed, update the shortcut's
  `tap_action` too.
- `sensor.whole_house_grid_power` — a `min_max` helper (type `sum`) combining
  `sensor.shelly_pro3em_general_total_active_power` (main 3-phase meter),
  `sensor.shelly_em_studio_channel_1_power` + `_channel_2_power` (Studio EM),
  and `sensor.shelly_parking_general_power` (whole garage circuit). Created
  2026-07-23 as the `grid_power` source for the Tesla Style Energy Flow card
  on the Storm Trooper view, replacing the single Solix-only grid sensor.
- Storm Trooper view's "Energy Flow" section: `custom:tesla-style-energy-flow`
  card (HACS). Home battery is an Anker Solix C1000X portable power station
  (not a full house solar+battery system) — `solar_power` and
  charge/discharge power come from its sensors
  (`sensor.battery_solar_power`, `sensor.solix_c1000_x_dc_input_power`,
  `sensor.solix_c1000_x_ac_output_power`, `sensor.solix_c1000_x_state_of_charge`).
  EV charging comes from the Tesla Wall Connector
  (`sensor.tesla_wall_connector_total_power`,
  `binary_sensor.tesla_wall_connector_vehicle_connected`) and
  `switch.storm_trooper_charge`.

## Home Dashboard (design import, 2026-07-23)

Imported from a Claude Design project (claude.ai/design, project
`cd898565-0d17-494a-bdc6-f2600aef62f1`, file `Home Dashboard.dc.html` —
a "Modernist" brutalist mobile-app mock with 3 tabs: Home / Tesla /
Energy, room grid -> room detail with Grid/Stack device layouts, scenes
row, animated energy flow). It used a mocked local-state component
framework (`DCLogic`), not real HA cards, so it was reimplemented as a
genuine custom Lovelace card wired to live entities rather than copied
verbatim.

- **Dashboard**: `home-design` ("Home Dashboard", sidebar-visible),
  single `panel` view holding one `custom:home-dashboard-card`.
- **Card source**: hosted as an inline dashboard resource (`resource_id`
  `18170230da53421c9cf077e3f6e84fc9`, ~22.5KB, under the 24KB inline
  cap) — not a HACS card. Uses `<ha-icon>` for MDI icons (no bundled SVG
  library). To edit: change the class in
  `home-dashboard-card.js` (scratchpad copy) and re-register via
  `ha_config_set_dashboard_resource(resource_id=..., content=...)`,
  then update the dashboard if the config shape changed.
- **Rooms** (curated 4-6 devices each, matching the mock's 8-room grid
  rather than all 14 real areas): Living Room, Kitchen, Bathroom (=
  Master Bathroom), Office, Garage, Hallway, Bedroom (= Master Bedroom),
  Eric's Room.
- **Scenes row**: Good Morning -> `automation.hvac_comfort_mode`
  (trigger), Away -> `input_select.house_mode` = "Away", Night ->
  `automation.set_house_night_mode` (trigger), Movie ->
  `automation.cinema_scenes` (trigger).
- **Tesla tab**: Storm Trooper, same entities as the mobile dashboard's
  Storm Trooper view (lock/climate/covers/charge limit/odometer).
  Trips list from the original mock was dropped (no real trip-log data
  source exists); location shows the raw `device_tracker` state instead
  of a live map (no real map rendering was built into the card).
- **Energy tab**: simplified from the mock's solar+battery+grid flow to
  match this house's actual metering — Grid -> Home -> EV only (no
  separate solar path). `sensor.whole_house_grid_power` is used for
  both "Grid" and "Home" (no whole-home meter independent of grid
  import exists). New helpers created for this:
  - `sensor.whole_house_grid_energy` — `min_max` (sum) of
    `sensor.shelly_pro3em_general_total_active_energy` +
    `sensor.shelly_em_studio_channel_1_energy` +
    `_channel_2_energy` + `sensor.shelly_parking_general_energy`.
  - `sensor.grid_energy_today` — daily `utility_meter` off the above;
    used for both "Consumed today" and "Imported from grid" tiles
    (currently identical numbers pending real solar/battery-to-home
    metering).
  - `sensor.tesla_wall_connector_ev_charged_today` — daily
    `utility_meter` off `sensor.tesla_wall_connector_energy`.

## Home Dashboard Dark (design import 2026-07-24, rebuilt modular 2026-07-24)

Second design import, from a Claude Design project
(`b817b005-aa16-4c55-9a74-313497fe35f3`, file `HA Dashboard Options.dc.html`)
— dark navy, rounded iOS-style cards ("design 1a" of a 3-way comparison).
Originally built (and iterated on: energy-flow embed, animation-restart
fix, person-photo fix, mojibake fix, working sliders, per-light rows,
touch-slider fix) as a **single monolithic custom card**
(`home-dashboard-1a-card`) that rendered an entire internal SPA — screen
state, room drill-down, tab bar — all in one ~20KB JS file with zero
Lovelace-editor visibility into its internals.

**2026-07-24: rebuilt as a modular card set**, per explicit user request
("too much JavaScript... buttons and cards should be editable... make
everything modular like Bubble Card / Mushroom"). The monolith is gone;
`home-dark` is now composed entirely from small, independent custom
cards plus native Lovelace primitives, each a normal entry in a normal
card list — addable, removable, reorderable, and editable straight from
the dashboard editor, no JS reading required for day-to-day changes.

- **Card set** (5 inline dashboard resources, each self-contained,
  each individually swappable):
  - `home-header-card` — clock/date/weather. Config: `weather_entity`.
  - `home-chip-card` — one small pill per instance. Config: `kind`
    (`person` / `lock` / `light-group` / generic `entity`), `entity`,
    `label`. Tap → more-info.
  - `home-room-tile-card` — one room-summary tile. Config: `name`,
    `icon`, `light_group_entity`, `climate_entity`, `cover_entity`,
    `media_entity`, `motion_entity` (all optional except `name`). Tap →
    more-info on its light group (or climate if no lights). Domain
    icons + an "on" tag render only for whichever fields are set.
  - `home-navbar-card` — config-driven bottom tab bar (`tabs: [{id,
    icon, path}]`, `current`). Built but **not used** in the shipped
    config — see below.
  - Resource IDs: header `f5ede969d4124ec89d4e76d2d2f4ecca`, chip
    `e9296b183aed49a7ba6c3a7af8cfdd81`, room-tile
    `02af4e539e264967a4c8b7079075876e`, navbar
    `ca45e225cdc14d5c9913b421f5c33d58`. The old monolith resource
    (`f93dd85117d34e15b016bdf8e44d571e`) is still registered but no
    longer referenced by any dashboard — safe to delete if unused
    elsewhere.
- **Navigation**: dropped the old JS-driven screen/room-drill-down state
  machine in favor of HA's **native multi-view tab strip** — `home-dark`
  is now 6 real Lovelace views (`sections` type): Home, Lights, Climate,
  Blinds, Media, Vacuum. Switching views is 100% native (add/remove/
  reorder views from the dashboard editor); no custom navbar JS is
  wired in, even though `home-navbar-card` exists if a bottom-tab look
  is ever wanted instead of the top strip.
- **Scope change from the old per-room drill-down screen**: tapping a
  room tile on Home no longer opens a dedicated room page (that required
  the SPA state machine). Room tiles are now overview-only (tap = more
  -info on the room's light group). Full per-entity controls live in the
  Lights/Climate/Blinds/Media views, each grouped by room under a native
  `heading` card — same entities, same granularity, just organized by
  domain instead of by room. Revisit if per-room pages are wanted back
  (straightforward: one more view per room, still built from the same
  modular card architecture).
- **Home view** sections: `home-header-card` → 4 `home-chip-card`s
  (Andrei, Loredana, whole-house `light.house_all` group, front door
  lock) → "Quick Devices" → "Rooms" (10 `home-room-tile-card`s, one per area) →
  the `custom:tesla-style-energy-flow` HACS card (user's exact config,
  unchanged) as a plain, independently removable card — no more DOM
  -surgery/persistent-slot workaround, since native views don't
  innerHTML-wipe other cards on re-render the way the monolith's
  `_render()` did.
- **Lights / Climate / Blinds / Media views**: one section per room
  (native `heading` card plus domain-specific controls), covering the
  same entity lists established during the per-light-rows work (individual
  lights per room including Eric's Room's 6 Hue bulbs
  `light.erics_room_line_hue_light_1`–`_6`, `_all` aggregates and
  diagnostic/presence LEDs excluded). Climate: 8 rooms. Blinds: 5 rooms.
  Media: 3 rooms (Living Room, Cinema, Office).
- **Vacuum view**: `custom:home-vacuum-card` for `vacuum.roborock`, with
  map, actions, status metrics, alerts, and collapsible sections.
- Reuses `vacuum.roborock`, `switch.storm_trooper_charge` +
  `sensor.storm_trooper_battery_level`, `lock.front_door`,
  `person.andrei` / `person.loredana`, `weather.openweathermap`,
  `light.house_all` (whole-house light group, used for the Home chip) —
  same entities as before plus this one new group lookup.
- All prior fixes carried forward into the modular card set include
  HTML-entity-only text, capability-aware light dimmability, and touch-friendly
  slider interaction.
- **Fix (2026-07-24, layout):** after the modular rebuild the Home view
  looked broken — the individual dark cards (header/chips/tiles/rows)
  floated on HA's default theme background instead of one unified dark
  screen like the old monolith, and the 4 top chips (Andrei/Loredana/
  Lights/Front Door) had no grid wrapper so each stretched full-width
  and stacked vertically instead of sitting inline. Fixed by adding
  `"background": {"color": "#1a2433", "opacity": 100}` to every section
  in every view (2026.4 section-background feature), and wrapping the
  chip row in a nested native `grid` card (`columns: 4`), matching the
  pattern already used for Quick Devices/Rooms.
- **Fix (2026-07-24, sections):** each view was still split across
  several `sections`-view "sections" (one per logical group — header,
  chips, quick devices, rooms, energy flow, or one per room on the
  Lights/Climate/Blinds/Media views). Each section renders as its own
  separate bordered/backgrounded box in HA's sections view, so the page
  looked like a stack of disconnected boxes rather than one continuous
  panel. Flattened every view down to a **single section** per view —
  all of that view's cards concatenated in their original order into
  one `sections: [{type: grid, cards: [...], background: {...}}]` —
  so everything now stacks top-to-bottom in one unified dark panel.
  Card content and order is unchanged; only the sections-view grouping
  was removed.
- Screenshot-based visual verification is unavailable on this instance
  (`ha_config_get_dashboard(include_screenshot=True)` reports the
  "dashboard screenshot" beta feature is disabled, and no
  internal/external URL is configured for browser automation) — layout
  issues are diagnosed by reading the sections/grid config directly
  against HA's sections-view layout rules, not by visual screenshot.

## Media player integration

The `home-dark` Media view and the Living Room, Cinema, and Office room popups
use the separately maintained `custom:mediocre-media-player-card` resource.
The local card set does not contain a media-player source file.

- The external resource is managed separately from the local JavaScript cards.

### Dashboard change

The `home-dark` Media view has three media-player cards, and the Living Room,
Cinema, and Office Bubble Card popups have compact versions for the same players.
The remaining seven popups contain no media entity. The obsolete local media-card
resource was removed after verifying that no dashboard configuration referenced it.

### Open recommendation: Office uses the weaker entity

The Media view's Office card targets `media_player.heos_office`, but
`media_player.office_ma` is the Music Assistant wrapper for the same physical
device (both carry unique_id `1346989420`) and is strictly more capable: it adds
SEEK, SHUFFLE_SET, REPEAT_SET, MEDIA_ANNOUNCE and SEARCH_MEDIA on top of
everything `heos_office` supports. Living Room and Cinema already use their `_ma`
entities, so Office is the odd one out. Switching it would enable the seek bar
and the shuffle/repeat buttons there. Not changed unilaterally.

### Verified resource hosting modes (2026-08-24)

Local Home Dark cards are registered as URL-mode module resources under
`/local/home-dark-cards/` and require manual copying to
`/config/www/home-dark-cards/`. Retired, unreferenced resources are removed after
a cross-dashboard search confirms no remaining usage.

### Verified `media_player.play_media` payload

Core's `MEDIA_PLAYER_PLAY_MEDIA_SCHEMA` declares `media_content_type` and
`media_content_id` as required top-level strings. The `media` object exposed by
the service picker is optional sugar that `_promote_media_fields` flattens into
those same two keys, and supplying both `media` and the flat keys raises
`vol.Invalid`. The card therefore sends the flat keys. `enqueue` and `announce`
are `vol.Exclusive` in one group, so only one is ever sent.

## Known rough edges

- No floors configured — all areas are flat.
- `automation.turn_on_living_room_tv_wake_on_lan` is `unavailable`.
- `automation.master_bedroom_bed_light_copied` looks like a leftover
  duplicate (state off) — check before assuming it's live.
