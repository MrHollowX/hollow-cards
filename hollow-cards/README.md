# Hollow Cards

This folder contains the JavaScript custom-card sources for Hollow Cards. The
files now use the `hollow-*` filenames and custom element names. The existing
Home Assistant dashboard route remains unchanged, but its card configurations
must use the new `custom:hollow-*` types. They provide the
dashboard header, room summaries, person
presence, status and security summaries, light, switch, climate, cover, vacuum,
appliance, camera, energy, and entity-status controls, an expandable card
container, and fixed bottom navigation. Media players are provided by the
separately maintained `custom:mediocre-media-player-card` resource.

The shared coding-agent guidance for this repository is in
[`../ai-skill/SKILL.md`](../ai-skill/SKILL.md). It applies to all agents and
covers card lifecycle contracts, unavailable-entity handling, Home Assistant
resource deployment, and safe dashboard changes. There are no separate
tool-specific instructions to keep synchronized.

## Local verification

The repository currently contains 16 card source files and a 23-test Node.js
invariant suite. Run it from the repository root after JavaScript changes:

```text
node --test tests/hollow-cards-invariants.test.cjs
```

The suite checks registration safety, capability-aware controls, service-call
guards, interaction-state preservation, and card-specific editor/runtime
contracts. It does not replace validation against the live Home Assistant
dashboard after a resource deployment.

**Hosting modes, verified against the live resource registry on 2026-08-24.**
Local cards are registered as URL-mode module resources under
`/local/hollow-cards/` and require manual host copying, except for
`hollow-cover-card`. Its resource ID `264907031d174aae8eaf44caa4dab133` remains
the separately managed inline-resource exception. Media playback uses a
separately registered external card resource. The unused legacy
`HomeDashboardCard` inline resource was removed after a cross-dashboard search
found no references.

## Export metadata

- **Source:** Home Assistant dashboard resource registry
- **Home Assistant Core:** `2026.8.1`
- **Exported:** `2026-08-19 17:34 (UTC+03:00)`
- **Dashboard usage:** the live dashboard contains 16 `custom:hollow-climate-card` references (eight Climate-view cards and eight room-popup cards), 13 `custom:hollow-entity-status-card` references (three Climate-view cards, three bathroom room-popup cards, five room-popup door/window groups, and Cinema/Garage occupancy groups), three `custom:hollow-switch-card` references for the bathroom fans, six external media-player-card references (three Media-view cards and three room-popup cards), six floating-menu references (one in each view), and 10 room popups.
- **Deployment directory:** `/config/www/hollow-cards/` for URL-mode resources
- **Registered URL prefix:** `/local/hollow-cards/`
- **Resource type:** JavaScript modules; URL-mode resources require manual copying
  to `/config/www/hollow-cards/` because MCP cannot upload those files
- **Current resource sync:** local cards use URL-mode resources with
  cache-busting query suffixes, except for the existing inline
  `hollow-cover-card` resource
- **Removed legacy resources:** the unused `HomeDashboardCard` and
  `hollow-navbar-card` registrations were removed after cross-dashboard searches
  found no usages
- **HACS resources:** the repository root contains `hacs.json`; HACS installs
  the mirrored JavaScript payload from `dist/` and exposes the Hollow Cards
  entry point under `/hacsfiles/<repository-name>/`.

## Exported resources

| File | Card name | Resource ID |
|---|---|---|
| `hollow-header-card.js` | `hollow-header-card` | `f5ede969d4124ec89d4e76d2d2f4ecca` |
| `hollow-room-tile-card.js` | `hollow-room-tile-card` | `02af4e539e264967a4c8b7079075876e` |
| `hollow-light-card.js` | `hollow-light-card` | `376b336445804f819b97c6b461f530cb` |
| `hollow-person-card.js` | `hollow-person-card` | `d655ab1709e94df7be303b4504d5397c` |
| `hollow-door-security-card.js` | `hollow-door-security-card` | `fdf4fcf92eee4a61805911ed6fc8a781` |
| `hollow-status-card.js` | `hollow-status-card` | `aa8e713224b14feab81eb6aa0586560d` |
| `hollow-climate-card.js` | `hollow-climate-card` | `d3ddace99f314afbbbe9ad689d437161` |
| `hollow-entity-status-card.js` | `hollow-entity-status-card` | `72bcc61a0f334c23912a28e272f5a6ef` |
| `hollow-cover-card.js` | `hollow-cover-card` | `264907031d174aae8eaf44caa4dab133` |
| `hollow-floating-menu-card.js` | `hollow-floating-menu-card` | `f6e3ebca911144e2ab3dc847a082a31e` |
| `hollow-switch-card.js` | `hollow-switch-card` | `257d462671f14a0fba4d422931a99f2b` |
| `hollow-group-card.js` | `hollow-group-card` | `e0a94f1cc4cc4b9b95f828176e7c0a57` |
| `hollow-energy-overview-card.js` | `hollow-energy-overview-card` | `da52af5bbea0436d882c4261595b237e` |
| `hollow-vacuum-card.js` | `hollow-vacuum-card` | `3192edab42a1488192bc960c27807df7` |
| `hollow-appliance-card.js` | `hollow-appliance-card` | [Not recorded in this repository] |
| `hollow-camera-grid-card.js` | `hollow-camera-grid-card` | [Not recorded in this repository] |

### Home floating menu card

- **Card type:** `custom:hollow-floating-menu-card`
- **Purpose:** Fixed, safe-area-aware bottom navigation that remains visible while
  the dashboard view scrolls. The live dashboard places one instance
  in each of its six views and uses `view_path` to avoid duplicate fixed menus
  when inactive views remain mounted.
- **Resource:** `hollow-floating-menu-card.js`
- **Resource ID:** `f6e3ebca911144e2ab3dc847a082a31e`

```yaml
type: custom:hollow-floating-menu-card
view_path: home
show_labels: false
tabs:
  - id: home
    icon: mdi:home
    label: Home
    path: /home-dark/home
  - id: lights
    icon: mdi:lightbulb
    label: Lights
    path: /home-dark/lights
```

- Omit `tabs` to use the six source-defined defaults: Home, Lights, Climate,
  Cameras, Media, and Vacuum. Configure `tabs` to replace those defaults; each
  entry requires a unique `id` and a `path`, while `icon` and `label` default
  to `mdi:circle-outline` and the tab ID.
- `current` optionally forces the active tab by ID. Without it, the card
  resolves the active tab from the browser path.
- `view_path` identifies the current view for instances repeated across
  dashboard views. When the active tab has a matching `view_path`, that
  instance remains visible and the inactive instances hide themselves.
- `show_labels` defaults to `false`; labels remain available through button
  tooltips and accessible names.
- `getCardSize()` returns `0` because the navigation is fixed rather than
  consuming normal card-flow height. The card requests a full-width,
  auto-height sections-grid placement.
- **Deployment:** Copy `hollow-floating-menu-card.js` to
  `/config/www/hollow-cards/` before loading the dashboard. Its resource is
  registered as `/local/hollow-cards/hollow-floating-menu-card.js`.

## Icon configuration

All Hollow Cards use Material Design Icons (MDI) names. Configure
`icon: mdi:...` to override the primary icon for `hollow-header-card`,
`hollow-room-tile-card`, `hollow-person-card`,
`hollow-status-card`, `hollow-climate-card`, `hollow-cover-card`,
`hollow-switch-card`, `hollow-entity-status-card`, `hollow-group-card`,
`hollow-energy-overview-card`, `hollow-vacuum-card`, and
`hollow-camera-grid-card`. Existing dynamic status and control icons remain
state-driven unless their card exposes one of the options below.

- `hollow-light-card` uses `icon_on` and `icon_off` for state-specific icons.
  Its `icon` is the fallback when a state-specific icon is not configured.
- `hollow-floating-menu-card` uses `tabs[].icon`.
- `hollow-status-card` additionally supports `pm25_icon`, `pm10_icon`, and
  `aqi_icon`.
- `hollow-cover-card` accepts a per-room `rooms[].icon`, which takes precedence
  over the card-level icon.
- `hollow-door-security-card` accepts `icons.camera`, `door_open`,
  `door_closed`, `silent_on`, `silent_off`, `lock_locked`, `lock_unlocked`,
  and `lock_unavailable`.
- `hollow-vacuum-card` accepts `icons.battery`, `room`, `clean`, `pause`,
  `dock`, `locate`, and `map_unavailable`.
- `hollow-camera-grid-card` accepts `camera_icon` and `unavailable_icon`; a
  camera group can use its own `icon`.

```yaml
type: custom:hollow-status-card
icon: mdi:home-analytics
pm25_icon: mdi:air-filter
pm10_icon: mdi:blur-radial
aqi_icon: mdi:weather-hazy
```

```yaml
type: custom:hollow-cover-card
rooms:
  - name: Living Room
    icon: mdi:blinds-horizontal
    entities:
      - cover.living_room
```

```yaml
type: custom:hollow-door-security-card
icon: mdi:doorbell-video
icons:
  camera: mdi:doorbell-video
  door_open: mdi:door-open
  door_closed: mdi:door-closed
  silent_on: mdi:bell
  silent_off: mdi:bell-off
  lock_locked: mdi:lock
  lock_unlocked: mdi:lock-open-variant
  lock_unavailable: mdi:lock-question
```

```yaml
type: custom:hollow-vacuum-card
icon: mdi:robot-vacuum-variant
icons:
  battery: mdi:battery
  room: mdi:map-marker-outline
  clean: mdi:play
  pause: mdi:pause
  dock: mdi:home-map-marker
  locate: mdi:crosshairs-gps
  map_unavailable: mdi:map-marker-off-outline
```

```yaml
type: custom:hollow-camera-grid-card
icon: mdi:cctv
camera_icon: mdi:video-outline
unavailable_icon: mdi:camera-off-outline
camera_groups:
  - title: Doorbell
    icon: mdi:doorbell-video
    cameras:
      - entity: camera.doorbell
```

## Card usage

Each example below uses the card type, source filename, and deployed resource URL.
Entity IDs marked as verified were present in the current dashboard configuration or
were verified in Home Assistant's entity registry. `[Needs configuration]` means the
card supports the option, but this repository does not confirm an installation-specific
value.

Cards with required fields validate their configuration when Home Assistant
loads the card. The individual card sections identify required entries and any
source-enforced entity-domain or value constraints.

### Home header card

- **Card type:** `custom:hollow-header-card`
- **Purpose:** Displays the current time, date, current weather, humidity, and an
  optional daily forecast.
- **Resource:** `hollow-header-card.js`
- **URL:** `/local/hollow-cards/hollow-header-card.js?v=20260905-no-feels-like`

```yaml
type: custom:hollow-header-card
weather_entity: weather.openweathermap
forecast_days: 5
show_forecast: false
```

- `weather_entity` is optional. The current dashboard uses the verified
  `weather.openweathermap` entity.
- `forecast_days` accepts a number and is rounded and clamped to `1`–`5`; the default is
  `3`. The current dashboard sets it to `5`.
- `show_forecast` defaults to `true`. Set it to `false` to hide forecast UI and disable
  forecast requests and refresh timers. The current dashboard sets it to `false`.
- `clickable` defaults to `false`. Set it to `true` to make the card keyboard
  and pointer accessible as a forecast show/hide toggle. This changes only the
  card instance's current display; it does not persist a dashboard setting.
- The greeting is `Welcome, <Home Assistant user name> 👋`. When the frontend
  user name is unavailable, it is `Welcome, there 👋`.
- Current humidity comes from the weather entity's `humidity` attribute. The
  `apparent_temperature` attribute is intentionally not displayed.
- The clock/date remain at the top while the current weather summary and forecast
  share a compact horizontal row. Current weather details and each forecast day are
  readable icon-led one-line items without nested forecast boxes or item borders.
  The forecast list uses a horizontally scrollable flex layout when its items cannot
  fit, including on the narrowest mobile widths, so the card avoids unnecessary
  vertical growth and page-level horizontal overflow.
- Enabled daily forecasts use Home Assistant's `weather.get_forecasts` service with
  `type: daily`. Results are cached and refreshed at most every 30 minutes.

### Home room tile card

- **Card type:** `custom:hollow-room-tile-card`
- **Purpose:** Room summary tile showing the configured room icon, climate readings,
  configured domain icons, and an `on` indicator when the light group is on. Tapping
  opens a configured URL hash when `popup_hash` is set; otherwise it opens more-info
  for the light group, or the climate entity when no light group is set.
- **Resource:** `hollow-room-tile-card.js`
- **URL:** `/local/hollow-cards/hollow-room-tile-card.js?v=20260812-1531-source-sync`

This is the current verified Living Room configuration:

```yaml
type: custom:hollow-room-tile-card
name: Living Room
icon: mdi:sofa
light_group_entity: light.living_room_all
climate_entity: climate.living_room
cover_entity: cover.living_room_window_shutter
media_entity: media_player.living_room_soundbar_ma
popup_hash: '#living-room'
```

- `name` is required.
- `icon` defaults to `mdi:home`.
- `light_group_entity`, `climate_entity`, `cover_entity`, `media_entity`, and
  `motion_entity` are optional. Each configured field adds its domain icon; the
  `motion_entity` value is used for the motion icon and does not add a motion status.
- The climate entity supplies `current_temperature` and `current_humidity` when
  available. Temperature units use the climate entity's `temperature_unit` or
  `unit_of_measurement`, then Home Assistant's configured unit system, with an
  explicit Celsius fallback only when neither source is available.
- `popup_hash` is optional. The card normalizes a missing leading `#` and navigates
  to that hash so a Bubble Card `card_type: pop-up` with the same hash can open.
  Popup contents are configured in the Home Assistant dashboard, not in this resource.

### Home vacuum card

- **Card type:** `custom:hollow-vacuum-card`
- **Purpose:** Hollow Cards Roborock control card with current state, Clean/Pause/Dock/
  Locate controls, a pinch-zoomable live map, icon-led cleaning and dock metrics,
  and collapsible configuration sections.
- **Resource:** `hollow-vacuum-card.js`
- **Resource ID:** `3192edab42a1488192bc960c27807df7`
- **URL:** `/local/hollow-cards/hollow-vacuum-card.js?v=20260824-1637`

This is the current verified Vacuum-view configuration:

```yaml
type: custom:hollow-vacuum-card
entity: vacuum.roborock
name: Roborock
status_entity: sensor.roborock_status
battery_entity: sensor.roborock_battery
room_entity: sensor.roborock_current_room
map_image_entity: image.roborock_home_custom
map_title: Roborock map
collapsed_sections:
  - settings
select_entities:
  - entity: select.living_room_roborock_cleaning_mode
    name: Cleaning mode
  - entity: select.roborock_mop_intensity
    name: Mop intensity
  - entity: select.roborock_mop_mode
    name: Mop mode
status_sections:
  - title: Cleaning overview
    entities:
      - entity: sensor.roborock_cleaning_area
        label: Cleaned area
        icon: mdi:floor-plan
        suffix: ' m2'
      - entity: sensor.roborock_cleaning_time
        label: Cleaning time
        icon: mdi:clock-outline
        format: duration-minutes
      - entity: sensor.roborock_last_clean_begin
        label: Last clean began
        icon: mdi:calendar-clock
        format: date-time
  - title: Dock health
    entities:
      - entity: binary_sensor.living_room_roborock_dock_clean_water_box
        label: Clean water
        icon: mdi:water-check-outline
        state_map: { 'off': Ready, 'on': Refill }
      - entity: binary_sensor.living_room_roborock_dock_dirty_water_box
        label: Dirty water
        icon: mdi:water-remove-outline
        state_map: { 'off': Empty, 'on': Empty tank }
      - entity: binary_sensor.living_room_roborock_dock_mop_drying
        label: Mop drying
        icon: mdi:weather-sunny
        state_map: { 'off': Idle, 'on': Drying }
      - entity: sensor.roborock_dock_dock_error
        label: Dock status
        icon: mdi:garage-variant
        state_map: { ok: Healthy }
      - entity: binary_sensor.roborock_water_shortage
        label: Water shortage
        icon: mdi:water-alert
        state_map: { 'off': Water OK, 'on': Refill water }
        alert_states: [ 'on' ]
```

- `entity` is required and is the vacuum controlled by the four action buttons.
- The Clean, Pause, Dock, and Locate buttons call `vacuum.start`,
  `vacuum.pause`, `vacuum.return_to_base`, and `vacuum.locate`,
  respectively.
- `status_entity`, `battery_entity`, and `room_entity` are optional display entities.
  Missing or unavailable values render a readable fallback.
- `map_image_entity` is optional. It must expose an `entity_picture` attribute;
  tapping the rendered map opens a full-screen viewer with pinch-to-zoom,
  drag-to-pan, Reset, backdrop-close, and Escape-key support. If no image is
  available, the card opens the image entity's native more-info dialog instead.
- `select_entities` configures themed, keyboard-accessible listboxes. Each entry needs
  an `entity` from the `select` domain; `name` is optional.
- `status_sections` is optional. Each section has a `title` and an `entities` list.
  Metric entries support `entity`, `label`, `icon`, `suffix`, `state_map`,
  `alert_states`, and `format`. `format` accepts `duration-minutes` and `date-time`.
  States included in `alert_states` use red icon and value treatment.
- Every map or status section can be collapsed. Their keys are `map`, `status-0`,
  `status-1`, and so on in `status_sections` order; the settings key is `settings`.
  Add any keys to `collapsed_sections` to make those sections start collapsed. When
  omitted, map and status sections start expanded and Cleaning Settings starts
  collapsed.

### Home energy overview card

- **Card type:** `custom:hollow-energy-overview-card`
- **Purpose:** Responsive Hollow Cards summary of daily energy usage and cost. Each
  item opens the usage entity's native more-info dialog.
- **Resource:** `hollow-energy-overview-card.js`
- **Resource ID:** `da52af5bbea0436d882c4261595b237e`

The verified current card on the Lights view is:

```yaml
type: custom:hollow-energy-overview-card
title: Daily Overview
icon: mdi:chart-line
price_entity: input_number.energy_price
price_per_kwh: 1.13
items:
  - label: Studio
    icon: mdi:desk
    usage_entity: sensor.studio_general_studio_energy_today
  - label: Garage
    icon: mdi:garage
    usage_entity: sensor.garage_energy_meter_garage_energy_today
  - label: Apartment
    icon: mdi:home-apartment
    usage_entity: sensor.apartment_energy_meter_apartment_energy_today
  - label: Total
    icon: mdi:transmission-tower
    usage_entity: sensor.grid_energy_today
```

- `items` is required and must contain one or more entries with a
  `usage_entity` and either a `cost_entity`, `price_per_kwh`, or a card-level
  `price_entity`.
- An item's `cost_entity` is used directly when configured. Otherwise, the card
  multiplies the usage by the current non-negative `price_entity` value, falling
  back to the item's `price_per_kwh`.
- `title` defaults to `Today's usage & cost`; `icon` defaults to `mdi:chart-line`.
- Missing, unavailable, or non-numeric usage, cost, or price values render
  `Unavailable` rather than a calculated value.

### Home appliance card

- **Card type:** `custom:hollow-appliance-card`
- **Purpose:** Compact Home Connect appliance summary with online state,
  operation and program status, optional progress and timing, and expandable
  controls for appliance power, program selection, stop, and switch-like
  options.
- **Resource:** `hollow-appliance-card.js`
- **Resource ID / deployed URL / dashboard usage:** [Not recorded in this
  repository].

```yaml
type: custom:hollow-appliance-card
name: Washing Machine
location: Laundry
icon: mdi:washing-machine
connectivity_entity: binary_sensor.washing_machine_connected
state_entity: sensor.washing_machine_operation_state
program_entity: select.washing_machine_program
progress_entity: sensor.washing_machine_program_progress
remaining_entity: sensor.washing_machine_remaining_program_time
finish_time_entity: sensor.washing_machine_program_finish_time
power_entity: switch.washing_machine_power
stop_button_entity: button.washing_machine_stop
metric:
  entity: sensor.washing_machine_energy
  label: Energy
  unit: ' kWh'
status_entities:
  - entity: binary_sensor.washing_machine_door
    label: Door
options:
  - entity: switch.washing_machine_remote_start
    name: Remote start
    icon: mdi:remote
```

- `name` and `connectivity_entity` are required. The summary is offline unless
  the connectivity entity state is exactly `on`.
- `location`, `icon`, and `accent` are optional. Their defaults are an empty
  location, `mdi:home-outline`, and `#3d8bfd`.
- `state_entity`, `progress_entity`, `finish_time_entity`, `remaining_entity`,
  `program_entity`, `power_entity`, and `stop_button_entity` are optional.
  Missing or unavailable optional values do not render a corresponding control
  or metric.
- The built-in operation labels map Home Connect state values: `inactive`
  (Standby), `ready` (Ready to start), `delayedstart` (Programmed), `run`
  (Running), `pause` (Paused), `actionrequired` (Action required), `finished`
  (Finished), `error` (Attention needed), and `aborting` (Stopping). Other
  state values are converted from separators and camel case into title-cased
  text.
- `progress_entity` is displayed as a progress bar only for a numeric value;
  values are clamped from `0` to `100`. Remaining time is displayed only for
  active states (`run`, `pause`, `delayedstart`, or `actionrequired`).
- `metric` accepts `entity` and optional `label` and `unit`. When present and
  available, it is displayed in preference to remaining time.
- `status_entities` accepts objects with `entity` and optional `label`. The
  card shows up to three status items: operation, configured status entities,
  and finish time.
- `options` accepts objects with `entity`, `name`, and `icon`. Each available
  option is rendered as a switch-like button.
- Expanding the card reveals available controls. A configured `power_entity`
  and every configured option call `switch.turn_on` or `switch.turn_off`;
  `program_entity` calls `select.select_option`; and an active configured
  `stop_button_entity` calls `button.press` after a browser confirmation.
- The program picker is an in-card keyboard-accessible listbox. It closes on
  Escape or outside pointer interaction and adjusts above or below its trigger
  according to the available viewport space.

### Home camera grid card

- **Card type:** `custom:hollow-camera-grid-card`
- **Purpose:** Responsive grouped camera-snapshot grid. Each camera tile shows
  a snapshot and normalized availability status, then opens the camera's native
  Home Assistant more-info dialog when selected.
- **Resource:** `hollow-camera-grid-card.js`
- **Resource ID / deployed URL / dashboard usage:** [Not recorded in this
  repository].

```yaml
type: custom:hollow-camera-grid-card
title: Home cameras
subtitle: Camera snapshots
icon: mdi:cctv
camera_icon: mdi:video-outline
unavailable_icon: mdi:camera-off-outline
camera_groups:
  - title: Entrance
    icon: mdi:doorbell-video
    cameras:
      - entity: camera.doorbell
        name: Doorbell
```

- `camera_groups` is required and must contain at least one group. Every group
  requires a non-empty `cameras` list, and each camera item requires an entity
  ID beginning with `camera.`.
- A group accepts `title` and `icon`; a camera accepts `entity` and an optional
  `name`. When `name` is omitted, the card uses the camera entity's
  `friendly_name`, then its entity ID.
- `title`, `subtitle`, `icon`, `camera_icon`, and `unavailable_icon` are
  optional. Defaults are `Cameras`, `Camera snapshots`, `mdi:cctv`,
  `mdi:video-outline`, and `mdi:camera-off-outline`.
- Available cameras load a lazy snapshot from Home Assistant's
  `/api/camera_proxy/<entity_id>` endpoint. When the entity exposes an
  `access_token` attribute, the card supplies it as the endpoint's `token`
  query parameter.
- A camera state of `idle` is labeled `Online`; `recording` is labeled
  `Recording`; and missing, `unknown`, or `unavailable` cameras display an
  unavailable tile rather than a snapshot.
- The card requests full-width sections-grid placement through
  `getGridOptions()` and displays camera tiles in a two-column responsive
  grid.

### Home cover card

- **Card type:** `custom:hollow-cover-card`
- **Purpose:** Dark modular control card for blinds and shutters, including
  capability-aware open, stop, close, position, discrete slat-tilt, and shutter
  light-position controls.
- **Resource:** `hollow-cover-card.js`
- **Resource ID:** `264907031d174aae8eaf44caa4dab133`
- **Hosting:** Existing inline module resource. Keep the local source as the
  behavioral reference; do not replace this resource with a URL-mode resource
  as part of the generic deployment workflow.

```yaml
type: custom:hollow-cover-card
kind: blinds
entities:
  - cover.living_room_window_shutter
name: Blinds
half_open_position: 50
```

- `kind` is required and accepts `blinds` or `shutters`; `blind` and `shutter`
  are normalized to those values. In flat configuration, `entity` or `entities`
  is required and every value must be a `cover.*` entity ID.
- `rooms` is an alternative grouped configuration. Each room needs `entity` or
  `entities` containing `cover.*` IDs and accepts `name`, `names`, `kind`,
  `half_open_position`, and `icon`. `names` supplies display names in the same
  order as `entities`; otherwise the card uses a one-entity room name or the
  cover entity's `friendly_name`.
- `name` is optional. For a flat configuration with multiple entities, each
  entity's `friendly_name` is used. A flat configuration with one entity uses
  the direct single-cover layout; grouped and multi-entity configurations use
  card containers per room and cover.
- `half_open_position` is clamped to `0`–`100` and is used for the shutters
  light-position action. A room-level value overrides the card-level value.
- A configured room `icon` overrides the card icon; otherwise the card uses
  `mdi:blinds-horizontal` for blinds and `mdi:window-shutter` for shutters.
- `show_tilt_buttons` is optional and defaults to `true` for backward
  compatibility. When enabled, covers that expose live tilt-position support
  show four discrete `set_cover_tilt_position` actions at exactly `0%`, `25%`,
  `75%`, and `100%`, labelled `Fully closed`, `Slightly open`, `Mostly open`,
  and `Fully open`. Set it to `false` to hide the tilt controls and related
  unavailable notice for every room/entity in the card.
- In flat configuration, the card editor exposes `kind`, a multi-select cover
  entity selector, `name`, `icon`, `half_open_position`, and
  `show_tilt_buttons`. For `rooms` configuration, it exposes
  `show_tilt_buttons` plus a `rooms_json` text field containing the room array.
  Invalid JSON or a non-array value is ignored by the editor.
- The main Open/Stop/Close commands and the continuous cover-position slider
  remain available; the old position presets and tilt slider are not rendered.
  Failed cover-service calls render an in-card error message. When the
  configured blinds/shutters kind conflicts with a cover's `device_class`, the
  card renders an informational mismatch notice.

### Home climate card

- **Card type:** `custom:hollow-climate-card`
- **Purpose:** Dedicated climate control card for both heating and cooling entities.
  It reads the live climate entity attributes and renders only the controls exposed by
  that entity.
- **Resource:** `hollow-climate-card.js`
- **Resource ID:** `d3ddace99f314afbbbe9ad689d437161`
- **URL:** `/local/hollow-cards/hollow-climate-card.js?v=20260826-additional-ac-power-controls`

The current dashboard uses this card for all eight climate entities:
`climate.living_room`, `climate.cinema`, `climate.office_ac`, `climate.erics_room`,
`climate.master_bedroom`, `climate.master_bathroom`, `climate.erics_bathroom`, and
`climate.studio_bathroom`.

```yaml
type: custom:hollow-climate-card
entity: climate.cinema
name: Cinema
power_switch: switch.cinema_air_conditioning_knx_switch
show_power_toggle: true
additional_entities:
  - entity: climate.office_ac
    name: Office Air Conditioning
    power_switch: switch.cinema_air_conditioning_knx_switch
    show_power_toggle: true
additional_entities_collapsed: true
show_additional_title: true
```

- `entity` is required and must be a climate entity. `name` is optional; the entity
  `friendly_name` is used when it is omitted.
- `icon` overrides the primary icon. Without it, the card uses the primary
  climate entity's configured icon, then `mdi:thermostat`.
- `additional_entities` optionally adds named A/C controls below a separator.
  Each entry requires `entity: climate.*`; `name`, `power_switch`, and
  `show_power_toggle` are optional. The card renders compatible HVAC mode, fan
  mode, vertical swing, and horizontal swing menus for each entry, excluding
  duplicate temperature, humidity, and preset controls.
- An additional entity's power control uses its native
  `climate.turn_on`/`climate.turn_off` capability by default.
  `additional_entities[].power_switch` explicitly routes that A/C's power
  control through the named `switch.*` entity. The Cinema configuration above
  intentionally uses its KNX switch to control the Office A/C.
- `additional_entities[].show_power_toggle` defaults to `true`; set it to
  `false` to hide that A/C's power control.
- The additional A/C section is collapsible and starts collapsed by default.
  Set `additional_entities_collapsed: false` to start it expanded, or
  `additional_entities_collapsible: false` to keep it permanently expanded.
  `show_additional_title: false` hides the visible “Air conditioning” title;
  the icon-only toggle remains accessible through its expand/collapse label.
- `show_power_toggle` defaults to `false` for the primary climate entity. Set
  it to `true` together with `power_switch`, or with native climate power
  capability, to render a labeled A/C On/Off button beside the target-
  temperature stepper. The current Living Room popup example configures
  `power_switch` but does not enable this option, so the primary power button
  is not rendered by the current source.
- `power_switch` is optional and must be a confirmed `switch.*` entity for the
  room's A/C power circuit. When the primary power toggle is enabled, it calls
  `switch.turn_on` or `switch.turn_off` for that switch. The displayed state
  uses a local optimistic preview until Home Assistant confirms the switch
  state; failed calls and a five-second timeout fall back to the latest Home
  Assistant state.
- When `power_switch` is omitted, an enabled primary power toggle uses a native
  climate fallback only when the live entity exposes both
  `climate.turn_on` and `climate.turn_off` capability bits
  (`supported_features` 256 and 128). It derives native power from the climate
  state (`off` means off) and calls the matching native climate service. It
  does not guess a switch entity or show a power control for entities without
  that capability. The current Office entity is the verified
  native-capability case.
- When `additional_entities` is non-empty, the primary entity's power button is
  not rendered beside the temperature stepper. Each additional entity manages
  its own optional power button in the additional A/C section.
- Entities whose state is `unknown` or `unavailable` show an unavailable message
  and render no climate controls or service actions.
- HVAC mode options come from `hvac_modes` and call `climate.set_hvac_mode`.
- Target temperature uses `temperature`, `min_temp`, `max_temp`, and
  `target_temp_step`. The target readout is centered between minus/plus controls
  at the bottom of the card; there is no target-temperature slider. Each button
  press is rounded, bounded, and sent as one `climate.set_temperature` call,
  with a local pending value until Home Assistant reports the requested value.
- The current temperature is shown only in the top summary; the bottom control
  contains the target temperature.
- Target humidity, when supported, uses the same minus/plus stepper pattern; the
  current humidity remains visible beside its target value. It is rendered only
  when `target_humidity` is present and the entity exposes humidity support through
  its range or supported feature flag. The climate card has no range-slider controls.
- HVAC, fan, preset, swing, and horizontal swing controls are each rendered
  independently when their own mode array is present and call the matching
  climate service. Fan/preset/swing menus are not hidden just because
  `hvac_modes` is absent.
- Mode controls use themed in-card listbox menus rather than native HTML
  `<select>` elements, so mobile browsers do not replace them with an Android/iOS
  picker. Menus support touch and keyboard operation, outside-click/Escape close,
  focus-visible styling, and accessible listbox/option roles.
- Current humidity is shown whenever `current_humidity` is available.
- Current HVAC action is shown when `hvac_action` is exposed. No heating/AC options are
  hardcoded in the card source.
- Pending optimistic values reconcile only against their requested field's
  authoritative value and baseline. Updates to current temperature, HVAC action,
  or unrelated attributes do not clear another pending control. A matching
  requested value clears the preview; a different value for that same field is
  treated as rejection, and a five-second timeout falls back to HA state.
- Open menus choose above or below placement from the available viewport space,
  cap their height, scroll internally, and reposition on viewport resize/scroll.
- The card uses `getCardSize()` and `getGridOptions()` for sections-view layout,
  `hass.callService` calls with `entity_id`, keyboard-selectable buttons, and the
  original `home-dark-*` theme variables with fixed dark fallbacks: card
  `#212c42`, page `#1a2433`, primary `#f5f7fb`, secondary `#91a2bb`, accent
  `#ffb340`, controls `#2b3850`, and muted text `#66758f`.
- The live dashboard uses 16 climate-card instances: eight in the
  Climate view and eight in room popups. The dashboard configuration, not this
  JavaScript resource, owns popup membership and room layout.
- After the first paint, identical Home Assistant updates skip rebuilding the card
  `innerHTML`. The skip compares a render signature of the entity id, availability,
  HVAC/preset/fan/swing modes and current values, current and target temperatures
  (including heat/cool range attributes), humidity, pending/preview/optimistic
  values, power state, and the open menu. `_render(true)` still redraws for menu
  open/close and stepper/power optimistic updates even when hass state is unchanged.
- While a menu is open, HA state updates defer the full DOM refresh so its dynamic
  options and focused option are not replaced while it is being used. Stepper and
  power-button focus is also preserved during normal state updates. Menu, stepper,
  and power-button pointer/click/key events are handled in the card's capture phase
  and stopped so they do not close or activate the surrounding Bubble Card popup.
  A deferred refresh is applied after the menu closes or focus leaves the control,
  except for local optimistic control updates that are rendered immediately.

### Home entity status card

- **Card type:** `custom:hollow-entity-status-card`
- **Purpose:** Compact, theme-aligned status group for numeric and binary Home
  Assistant entities. Each metric opens its normal Home Assistant more-info dialog.
- **Resource:** `hollow-entity-status-card.js`
- **URL:** `/local/hollow-cards/hollow-entity-status-card.js?v=20260819-2335-progressive-lux`
- **Hosting:** URL mode under `/local/hollow-cards/`; copy the local file to
  `/config/www/hollow-cards/` before loading a changed resource URL.

```yaml
type: custom:hollow-entity-status-card
show_header: false
entity_layout: horizontal
metric_layout: vertical
entities:
  - entity: sensor.studio_bathroom_temperature
    label: Temperature
    min: 0
    max: 30
    dot_ranges:
      - { max: 16, max_exclusive: true, tone: blue }
      - { min: 16, max: 18, max_exclusive: true, tone: light-blue }
      - { min: 18, max: 25, max_exclusive: true, tone: green }
      - { min: 25, max: 27, max_exclusive: true, tone: yellow }
      - { min: 27, max: 30, max_exclusive: true, tone: orange }
      - { min: 30, tone: red }
  - entity: sensor.studio_bathroom_th_sensor_humidity
    label: Humidity
    min: 0
    max: 100
  - entity: binary_sensor.studio_bathroom_occupancy
    label: Occupancy
```

- `entities` is required. Strings are accepted as shorthand; objects support
  `entity`, `label`, `unit`, `precision`, `min`, `max`, `zero_below_min`,
  `color_direction`, `dot_ranges`, `dot_color_mode`, `active_state`, and
  `state_map`.
- `min` and `max` determine how many of the five dots are active. `dot_ranges`
  assigns a semantic dot color without replacing proportional fill.
- Set `zero_below_min: true` to leave every dot gray below `min`; this is useful
  for lux metrics where the configured minimum represents detectable light.
- `dot_color_mode: low-to-high` colors filled dots progressively from amber
  through yellow to green, while preserving the proportional dot count.
- `color_direction: high-to-low` inverses the proportional numeric fill so
  lower values activate more dots. Any other value uses the default low-to-high
  fill direction.
- `dot_ranges` evaluates in order. Each range supports `min`, `max`,
  `min_exclusive`, `max_exclusive`, `tone` (`blue`, `light-blue`, `green`,
  `yellow`, `orange`, or `red`), and optional `dots` for an explicit fill count.
- `entity_layout` controls whether metrics are grouped horizontally or
  vertically and defaults to `vertical`.
  `metric_layout: vertical` puts the entity label above bottom-to-top dots and its
  state below; up to six horizontal vertical metrics use equal-width columns.
  `metric_layout: row` is the default compact row presentation.
- Motion, occupancy, and presence binary sensors show gray dots when clear; when
  active, their green dots animate from the outer pair toward the center and back.
- Door, window, garage-door, and opening binary sensors show five green dots when
  open and five gray dots when closed.
  Numeric metric updates animate their active dots once from left to right.
- `show_header` defaults to `true`; set it to `false` to hide the card name and icon.

### Home light card

- **Card type:** `custom:hollow-light-card`
- **Purpose:** Theme-aware single-light control row. It toggles the configured light
  and shows a touch-friendly brightness slider only when the entity's
  `supported_color_modes` contains a mode other than `onoff`.
- **Resource:** `hollow-light-card.js`
- **Resource ID:** `376b336445804f819b97c6b461f530cb`
- **URL:** `/local/hollow-cards/hollow-light-card.js?v=20260819-1214-light-url`

```yaml
type: custom:hollow-light-card
entity: light.livingroom_couch
name: Couch
```

- `entity` is required and `name` is optional. When `name` is omitted, the entity's
  `friendly_name` is used.
- `icon` provides the fallback icon. `icon_on` and `icon_off` override it for
  the respective states.
- `tap_action` defaults to `{ action: more-info }`, so clicking the card's left
  content opens the configured light's Home Assistant more-info dialog.
  `hold_action` and `double_tap_action` default to `{ action: none }`. These
  actions support `toggle`, `more-info`, `perform-action`,
  `call-service`, `navigate`, `url`, `fire-dom-event`, and `none`, using the
  normal Home Assistant action fields. Configured actions apply to the left
  content area; the right-side control always toggles the configured light.
- The card uses the existing `--home-dark-*` theme tokens used by the climate
  card, with the Hollow Cards palette as fallbacks. It does not inherit the generic
  `--ha-card-background` surface from a surrounding popup.
- While dragging or using the keyboard, the slider keeps a local preview instead of
  being overwritten by the previous Home Assistant state. The completed interaction
  sends one `light.turn_on` call with `brightness_pct` from 1% through 100%; the
  slider never dims below 1%, and the separate toggle remains the way to turn the
  light fully off. The preview remains visible
  until the matching Home Assistant state arrives, then reconciles to that state. A
  failed call or five-second timeout falls back to the latest available state.
- Pointer cancellation, lost capture, and window blur cancel the interaction without
  sending a service call. Pointer capture and listeners are cleaned up when the card
  disconnects.

### Home group card

- **Card type:** `custom:hollow-group-card`
- **Purpose:** Expandable Hollow Cards container that creates and hosts configured
  Lovelace child cards. Child cards keep their own controls and styling.
- **Resource:** `hollow-group-card.js`
- **Resource ID:** `e0a94f1cc4cc4b9b95f828176e7c0a57`
- **URL:** `/local/hollow-cards/hollow-group-card.js?v=20260820-1447-persistent-disclosure`

```yaml
type: custom:hollow-group-card
title: Master Bedroom Lights
entity: light.master_bedroom_all # Optional; omit for a title-only group
open: false
cards:
  - type: custom:hollow-light-card
    entity: light.master_bedroom_entry
    name: Entry
  - type: custom:hollow-light-card
    entity: light.master_bedroom_hue_light
    name: Entry (Hue)
```

- `cards` is required and accepts normal Lovelace card configuration objects,
  including every Hollow Cards custom card.
- `entity` is optional. When present, its friendly name supplies the title unless
  `title` or `name` is configured, and its state is shown below the title.
- Without an `entity`, configure `title` or `name`; the card renders the same
  expandable header without entity state.
- `icon` overrides the entity icon; otherwise the header uses the entity icon
  or `mdi:folder-outline`.
- `open` defaults to `false`. `show_entity_state: false` hides the optional
  entity state. Selecting the group header only expands or collapses its child
  cards; it does not open entity more-info.
- `grid_options` is passed through to the sections-view layout. The default is a
  full-width, auto-height card.

### Home switch card

- **Card type:** `custom:hollow-switch-card`
- **Purpose:** Theme-aware control row for switch-like entities. The entity is toggled
  by the right-side switch control, while the left content supports configurable tap,
  hold, and double-tap actions. The selected `switch_type` changes the visual design
  only; it does not change the entity or service behavior.
- **Resource:** `hollow-switch-card.js`
- **Resource ID:** `257d462671f14a0fba4d422931a99f2b`
- **URL:** `/local/hollow-cards/hollow-switch-card.js?v=20260816-switch-card-17`
- **Deployment:** URL mode. Copy the local source to
  `/config/www/hollow-cards/hollow-switch-card.js` before loading the resource.

The three current verified instances are the bathroom fan controls:

```yaml
type: custom:hollow-switch-card
entity: switch.master_bathroom_fan
name: Fan
switch_type: fan
grid_options:
  columns: 12
  rows: auto
```

The other verified entities are `switch.erics_bathroom_fan` and
`switch.studio_bathroom_fan`; each uses the same `switch_type: fan` and full-width
`grid_options`.

- `entity` is required. Current dashboard instances use `switch.*` entities; the
  toggle service domain is derived from the entity ID.
- `name` is optional. When omitted, the entity's `friendly_name` is used.
- `show_state` defaults to `true` and controls the state text in both the
  normal long-row layout and the tall layout. Set `show_state: false` to hide
  it while retaining configured duration or attribute text.
- `switch_type` is optional and defaults to `generic`. Supported visual types are:
  `generic` (`mdi:toggle-switch`), `fan` (`mdi:fan`), `light` (`mdi:lightbulb`),
  `heater` (`mdi:radiator`), `pump` (`mdi:pump`), `outlet`
  (`mdi:power-socket-eu`), and `lock` (`mdi:lock`). An unsupported value falls back
  to `generic`.
- `icon` optionally overrides the icon selected by `switch_type`.
- `tap_action` defaults to `{action: toggle}`. The entity dialog is not opened by
  default.
- `hold_action` defaults to `{action: none}`.
- `double_tap_action` defaults to `{action: none}`.
- Supported configured actions are `toggle`, `more-info`, `perform-action`,
  `call-service`, `navigate`, `url`, `fire-dom-event`, and `none`.
- The right-side toggle button always performs a direct entity toggle. Configured
  actions apply to the left content area.
- A card with numeric `grid_options.rows` greater than `1` uses the tall layout;
  the card remains one row tall within its assigned grid span.
- `state_content` accepts `state`, `last-changed`, `last-updated`,
  `last-reported`, attribute names, or objects such as
  `{attribute: current_speed, name: Speed, unit: rpm}`. Without
  `state_content`, the default is `last-changed`, rendered as `On for 5 minutes`
  or `Off for 2 hours` in a long row. In the tall layout, the complete combined
  status appears below the separator.
- `attribute` and `unit` provide the native entity-card-style single attribute
  display. `attributes` accepts one attribute name or a list of attribute names
  or attribute objects. `show_last_changed: true` adds the duration without
  replacing other configured details.
- `grid_options` is passed through to Home Assistant's grid layout. The card
  implements `getGridOptions()` so values such as `columns: 12` and `rows: auto`
  can make it span the full width of a popup/grid.
- When `grid_options.rows` is greater than `1`, the card applies a full-height
  layout with a `108px` minimum card height so it can visually span the same
  vertical space as a taller sibling card, such as a light card with a slider.
- `on` state uses the accent color and enables type-specific visuals. `fan` icons
  rotate continuously, pump icons rotate more slowly, heater icons pulse, and light
  icons receive an accent glow.
- `off` state uses the muted icon color. `unknown` and `unavailable` states display
  readable status text and disable the toggle.
- `prefers-reduced-motion: reduce` disables the fan, pump, and heater animations.
- The card uses the Home Dark tokens `--home-dark-card-background`,
  `--home-dark-primary-text`, `--home-dark-secondary-text`, `--home-dark-accent`,
  `--home-dark-control-background`, `--home-dark-muted-text`, and
  `--home-dark-page-background`, with fallbacks to `#212c42`, `#f5f7fb`, `#91a2bb`,
  `#ffb340`, `#2b3850`, `#66758f`, and `#1a2433`.

### Current climate split and room popups

The live dashboard has 10 room popups. Eight contain a climate card; Kitchen and
Garage contain no climate entity. The eight climate-enabled popups duplicate the
eight entities shown in the Climate view so both locations remain independently
editable in the dashboard editor.

### Living Room popup

The first room popup is configured in the live dashboard rather than
inside JavaScript. The Living Room room tile has `popup_hash: '#living-room'`, and
the Home view contains a Bubble Card with `card_type: pop-up`, the same hash, a
dark `#1a2433` background, and nested child cards:

```yaml
type: custom:bubble-card
card_type: pop-up
hash: '#living-room'
name: Living Room
icon: mdi:sofa
bg_color: '#1a2433'
bg_opacity: 100
close_on_click: false
button_type: name
show_header: false
card_layout: large
cards:
  - type: heading
    heading: Living Room
    heading_style: title
    icon: mdi:sofa
  - type: custom:hollow-light-card
    entity: light.living_room_all
    name: Room
  - type: custom:hollow-light-card
    entity: light.apartment_balcony
    name: Balcony
  - type: custom:hollow-light-card
    entity: light.livingroom_couch
    name: Couch
  - type: custom:hollow-light-card
    entity: light.livingroom_tv
    name: TV Light
  - type: custom:hollow-climate-card
    entity: climate.living_room
    power_switch: switch.living_room_air_conditioning_knx_switch
    name: Living Room
  - type: custom:hollow-climate-card
    entity: climate.living_room_ac
    power_switch: switch.living_room_air_conditioning_knx_switch
    name: Living Room Air Conditioning
  - type: custom:mediocre-media-player-card
    entity_id: media_player.living_room_soundbar_ma
    name: Living Room Soundbar
    compact: true
  - type: custom:hollow-cover-card
    rooms:
      - name: Shutters
        kind: shutters
        entities:
          - cover.living_room_window_shutter
          - cover.living_room_door_shutter
        names:
          - Window
          - Door
        half_open_position: 50
    show_tilt_buttons: true
```

Cinema and Office are the other two popups with a media card. Their media entries
are `media_player.cinema_ma` (name `Cinema`) and `media_player.heos_office`
(name `Office`), both compact instances of the separately maintained
`custom:mediocre-media-player-card`. The remaining seven popups — Eric's Room,
Master Bedroom, Kitchen, Master Bathroom, Eric's Bathroom, Studio Bathroom, and
Garage — contain no media card.

The popup child-card list, titles, icon, hash, background, and explicit
`close_on_click: false` behavior live in Home Assistant dashboard configuration
and can be edited there without changing this repository's card code. All local
card sources except `hollow-cover-card` use URL-mode resources under
`/local/hollow-cards/` and require copying their files to
`/config/www/hollow-cards/`; resource registration alone does not upload
those files. `hollow-cover-card` is the existing inline-resource exception. A
browser hard refresh is required after updating a resource.

### Home person card

- **Card type:** `custom:hollow-person-card`
- **Purpose:** Responsive presence card with a person avatar, location, optional phone
  battery, and optional distance from `zone.home`.
- **Resource:** `hollow-person-card.js`
- **URL:** `/local/hollow-cards/hollow-person-card.js?v=20260814-2223-no-hover-border`

This is the current verified Andrei configuration:

```yaml
type: custom:hollow-person-card
kind: person
entity: person.andrei
label: Andrei
name: Andrei
show_name: true
show_location: true
show_battery: true
show_proximity: true
comfortable_spacing: true
battery_entity: sensor.andrei_battery_level
```

- `entity` is required and must be a `person` entity.
- `name` overrides the entity friendly name.
- `show_name` and `show_location` default to `true`; set either to `false` to hide it.
- `show_battery` and `show_proximity` default to `false`. Battery display also requires
  `battery_entity`, which must be a sensor entity. The verified battery entity above is
  `sensor.andrei_battery_level`.
- `comfortable_spacing` defaults to compact spacing. Set it to `true` for the
  two-row/taller grid sizing and additional vertical padding; omit it or set it to
  `false` for compact spacing.
- `icon` replaces the avatar image with the configured MDI icon.
- A `home` person receives the explicit navy `#212c42` surface and normal readable
  theme text without a presence-specific border highlight.
- Only the literal `home` person state receives the explicit navy `#212c42` surface
  and normal theme text. Every other state, including `away`, `not_home`, named
  zones, `unknown`, and `unavailable`, receives the mid-dark slate-blue away surface
  (`#3d5270`), light `#f5f7fb` readable text for the name, displayed location/state,
  battery, proximity, and labels/icons, plus a grayscale avatar. Away colors can be
  themed with the card's `--person-away-*` custom properties; explicit fallbacks
  keep the card readable when those properties are absent or invalid.
- `kind` and `label` are present in the current dashboard configuration for consistency
  with other cards, but this source reads `entity`, `name`, and the options listed above.
- The card resolves a named person state against zone friendly names and also
  checks whether person coordinates fall inside a configured zone radius. It
  displays distance from `zone.home` only when `show_proximity` is enabled and
  the person is not in a known zone. The calculation requires valid coordinates
  on the person and `zone.home`; the installation-specific zone entity is
  `[Needs configuration]`.

### Home door security card

- **Card type:** `custom:hollow-door-security-card`
- **Purpose:** Doorbell camera preview with camera/door/ring status, silent-mode control,
  lock control, lock battery text, and an optional in-card lock confirmation dialog.
- **Resource:** `hollow-door-security-card.js`
- **URL:** `/local/hollow-cards/hollow-door-security-card.js?v=20260812-1531-source-sync`

This is the current verified Home view configuration:

```yaml
type: custom:hollow-door-security-card
camera_entity: camera.doorbell
lock_entity: lock.front_door
battery_entity: sensor.front_door_lock_battery
name: Door Security
camera_label: Video doorbell
lock_label: Front door
show_camera: true
show_lock: true
show_lock_name: true
confirm_unlock: true
silent_entity: switch.doorbell_system_sounds
last_ring_entity: sensor.doorbell_last_doorbell_ring
show_silent: true
show_last_ring: true
front_sensor_entity: binary_sensor.front_door
sound_on_label: ON
dnd_label: DND
status_position: bottom
confirm_lock_actions: true
```

- `camera_entity` and `lock_entity` are required.
- `battery_entity` displays the lock battery state when available.
- `silent_entity` must be a switch entity. The card calls `switch.turn_on` or
  `switch.turn_off`; `show_silent` controls whether the sound/DND button is shown.
- `front_sensor_entity` supplies Open/Closed and relative activity text.
- `last_ring_entity` supplies a timestamp state for the Last Ring text;
  `show_last_ring` controls whether it is shown.
- `show_camera`, `show_lock`, and `show_lock_name` default to `true`. Set
  `show_lock_name: false` to display only the lock state in the lock control;
  the lock name remains available in the control's accessible label and dialog text.
- `camera_label`, `sound_on_label`, and `dnd_label` are configurable displayed labels.
  `name` defaults to `Door Security`. `lock_label` is displayed in the lock control
  when `show_lock_name` is enabled and is also used for lock titles and confirmation-dialog text.
- `status_position` accepts `top` or `bottom`; other values use `top`. It controls
  whether the ring/door status overlay appears at the top or bottom of the camera image.
- `confirm_lock_actions` defaults to `false`. When `true`, both lock and unlock actions
  open an in-card confirmation dialog. Confirm calls the corresponding lock service;
  Cancel, Escape, or clicking the dialog backdrop closes it without calling the service.
- `confirm_unlock` is accepted by the current source and is present in the live
  configuration, but `confirm_lock_actions` is the option that currently controls the
  confirmation dialog for both directions.
- Tapping the camera, door status, or Last Ring status opens Home Assistant more-info.
  The current verified entities are `camera.doorbell`, `lock.front_door`,
  `switch.doorbell_system_sounds`, `sensor.doorbell_last_doorbell_ring`, and
  `binary_sensor.front_door`.

### Home status card

- **Card type:** `custom:hollow-status-card`
- **Purpose:** House-mode selector plus PM2.5, PM10, and optional AQI metrics with
  display-only air-quality bands. Metric buttons open entity more-info.
- **Resource:** `hollow-status-card.js`
- **URL:** `/local/hollow-cards/hollow-status-card.js?v=20260812-1531-source-sync`

This is the current verified Home view configuration:

```yaml
type: custom:hollow-status-card
name: Home Status
house_mode_entity: input_select.house_mode
pm25_entity: sensor.home_pm2_5
pm10_entity: sensor.home_pm10
aqi_entity: sensor.air_quality_index
mode_label: House Mode
pm25_label: PM2.5
pm10_label: PM10
aqi_label: Air Quality
grid_options:
  columns: 12
  rows: auto
```

- `house_mode_entity`, `pm25_entity`, and `pm10_entity` are required.
- `aqi_entity` is optional. `show_aqi` defaults to `true`; set it to `false` to hide
  the AQI metric.
- `name` defaults to `House Status`. `name`, `mode_label`, `pm25_label`,
  `pm10_label`, and `aqi_label` customize displayed text.
- `show_metrics` defaults to `false`; set it to `true` to show the PM2.5, PM10,
  and configured AQI metrics when the card loads.
- `clickable` defaults to `false`. Set it to `true` to show a chevron button
  that toggles the metric row. It does not make the entire card clickable.
- `pm25_good_max`, `pm25_moderate_max`, `pm10_good_max`, and `pm10_moderate_max`
  override the display-only thresholds; each value must be a non-negative number.
- PM2.5 display thresholds default to Good `<= 15`, Moderate `<= 35`, High `> 35`.
  PM10 defaults to Good `<= 45`, Moderate `<= 100`, High `> 100`. These are display
  bands only and do not replace the sensor's native classification.
- The house-mode selector and configured metrics share a compact responsive
  status row when metrics are visible. House mode, PM2.5, PM10, and optional
  AQI are readable icon-led one-line controls/items without individual borders.
  The card surface is explicitly dark navy (`#212c42` fallback), distinct from
  the `#1a2433` page/popup background; compact typography, zero-width-safe flex
  children, and narrow-screen wrapping keep controls readable without page-level
  horizontal overflow in the Companion app.
- `house_mode_entity` options are read from the entity. The selector calls
  `input_select.select_option` only when the chosen option is currently exposed by the
  entity. The verified current entity is `input_select.house_mode`; its current
  configured options are `Home`, `Away`, `Night`, `Visitor`, and `Armed`.
- The verified metric entities are `sensor.home_pm2_5`, `sensor.home_pm10`, and
  `sensor.air_quality_index`.

## Adding a card to the dashboard

1. For a URL-mode card, copy the card JavaScript file to Home Assistant:
   `/config/www/hollow-cards/<card-file>.js`.
2. Register or update the matching URL-mode module resource at
   `/local/hollow-cards/<card-file>.js` with a cache-busting query suffix.
   Do not create an inline resource for a new local card. `hollow-cover-card` is
   the existing inline-resource exception and must not be replaced by this
   workflow.
3. Open the dashboard editor, choose the target view, add a card, select
   **Manual**, and paste the relevant YAML example.
4. Save the dashboard and hard-refresh the browser if the resource was newly copied or
   updated.

The `/local/...` URL only works after the JavaScript file has been copied to
`/config/www/hollow-cards/`. This repository contains local source files; the
Home Assistant MCP resource operation registers resources but does not copy files
into `/config/www/`. After any resource update, hard-refresh the browser to load
the new module.

## Registering or updating a resource

Local files are deployed under `/config/www/hollow-cards/` and registered in
Home Assistant as `/local/hollow-cards/*.js` module resources. Future custom
cards belonging to the dashboard must use this URL-mode workflow.
`hollow-cover-card` is the retained inline-resource exception and is not covered
by these URL-resource update steps.

To register or update a live resource, use the Home Assistant dashboard resource API or
the corresponding `user-hass` MCP tool:

1. Place the JavaScript file in `/config/www/hollow-cards/` without changing its
   contents.
2. Use `ha_config_set_dashboard_resource` with the existing resource ID,
   `resource_type: "module"` and the matching `/local/hollow-cards/*.js` URL.
   Add a new cache-busting query when updating a URL-mode file.
3. Confirm the returned resource ID and then reload the dashboard resource in Home Assistant if required.
4. Verify the resource with `ha_config_list_dashboard_resources()` and check the dashboard configuration.

Updating Home Assistant is an explicit remote configuration change; this folder does not
perform it automatically.
