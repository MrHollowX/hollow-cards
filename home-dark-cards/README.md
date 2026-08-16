# Home Dark Cards

This folder contains twelve JavaScript custom cards available to the `home-dark` Home Assistant dashboard. The files are local card sources and are not a generated build. `home-light-card.js`, `home-switch-card.js`, and `home-climate-card.js` are separate, independently registered controls; the legacy light branch in `home-row-card.js` remains for compatibility. `home-cover-card.js` and `home-floating-menu-card.js` are local sources for modular dashboard resources. The floating menu provides fixed bottom navigation across the six dashboard views. Media players are provided by the separately maintained `custom:mediocre-media-player-card` resource.

**Hosting modes, verified against the live resource registry on 2026-08-15.** Three existing cards are registered as inline content: `home-row-card` (`840736a3a49340b59f4d314a3cf80ef2`), `home-light-card` (`376b336445804f819b97c6b461f530cb`), and `home-cover-card` (`264907031d174aae8eaf44caa4dab133`). These are legacy inline resources and must be reported before any related dashboard change. The nine local cards registered as URL-mode resources under `/local/home-dark-cards/` and requiring manual host copying are `home-header-card`, `home-chip-card`, `home-room-tile-card`, `home-person-card`, `home-door-security-card`, `home-status-card`, `home-climate-card`, `home-floating-menu-card` (`f6e3ebca911144e2ab3dc847a082a31e`), and `home-switch-card` (`257d462671f14a0fba4d422931a99f2b`). New or changed cards must use this URL-mode workflow only. Media playback uses a separately registered external card resource.

## Export metadata

- **Source:** Home Assistant dashboard resource registry
- **Home Assistant Core:** `2026.8.1`
- **Exported:** `2026-08-15 20:58 (UTC+03:00)`
- **Dashboard usage:** the live dashboard contains 16 `custom:home-climate-card` references (eight Climate-view cards and eight room-popup cards), three `custom:home-switch-card` references for the bathroom fans, six external media-player-card references (three Media-view cards and three room-popup cards), six floating-menu references (one in each view), and 10 room popups. `home-chip-card` is registered but has no current card instance. `home-cover-card.js` is preserved locally as the source corresponding to its legacy inline resource.
- **Deployment directory:** `/config/www/home-dark-cards/` for URL-mode resources
- **Registered URL prefix:** `/local/home-dark-cards/`
- **Resource type:** JavaScript modules; URL-mode resources require manual copying
  to `/config/www/home-dark-cards/` because MCP cannot upload those files
- **Current resource sync:** the three existing inline card resources are legacy
  exceptions; all new or changed local cards use URL-mode resources
- **Removed legacy resource:** the unused `home-navbar-card` registration was
  removed after a cross-dashboard search found no usages
- **HACS resources:** not included; this folder contains only the local custom-card resources

## Exported resources

| File | Card name | Resource ID |
|---|---|---|
| `home-header-card.js` | `home-header-card` | `f5ede969d4124ec89d4e76d2d2f4ecca` |
| `home-chip-card.js` | `home-chip-card` | `e9296b183aed49a7ba6c3a7af8cfdd81` |
| `home-room-tile-card.js` | `home-room-tile-card` | `02af4e539e264967a4c8b7079075876e` |
| `home-row-card.js` | `home-row-card` | `840736a3a49340b59f4d314a3cf80ef2` |
| `home-light-card.js` | `home-light-card` | `376b336445804f819b97c6b461f530cb` |
| `home-person-card.js` | `home-person-card` | `d655ab1709e94df7be303b4504d5397c` |
| `home-door-security-card.js` | `home-door-security-card` | `fdf4fcf92eee4a61805911ed6fc8a781` |
| `home-status-card.js` | `home-status-card` | `aa8e713224b14feab81eb6aa0586560d` |
| `home-climate-card.js` | `home-climate-card` | `d3ddace99f314afbbbe9ad689d437161` |
| `home-cover-card.js` | `home-cover-card` | `264907031d174aae8eaf44caa4dab133` |
| `home-floating-menu-card.js` | `home-floating-menu-card` | `f6e3ebca911144e2ab3dc847a082a31e` |
| `home-switch-card.js` | `home-switch-card` | `257d462671f14a0fba4d422931a99f2b` |

### Home floating menu card

- **Card type:** `custom:home-floating-menu-card`
- **Purpose:** Fixed, safe-area-aware bottom navigation that remains visible while
  the dashboard view scrolls. The live `home-dark` dashboard places one instance
  in each of its six views and uses `view_path` to avoid duplicate fixed menus
  when inactive views remain mounted.
- **Resource:** `home-floating-menu-card.js`
- **Resource ID:** `f6e3ebca911144e2ab3dc847a082a31e`

```yaml
type: custom:home-floating-menu-card
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

- `tabs` is required only when overriding the six built-in `home-dark` tabs.
- `view_path` is the current view slug (`home`, `lights`, `climate`, `blinds`,
  `media`, or `vacuum`) for instances repeated across views.
- `show_labels` defaults to `false`; labels remain available through button
  tooltips and accessible names.
- **Deployment:** Copy `home-floating-menu-card.js` to
  `/config/www/home-dark-cards/` before loading the dashboard. Its resource is
  registered as `/local/home-dark-cards/home-floating-menu-card.js`.

## Card usage

Each example below uses the card type, source filename, and deployed resource URL.
Entity IDs marked as verified were present in the current `home-dark` configuration or
were verified in Home Assistant's entity registry. `[Needs configuration]` means the
card supports the option, but this repository does not confirm an installation-specific
value.

### Home header card

- **Card type:** `custom:home-header-card`
- **Purpose:** Displays the current time, date, current weather, humidity, feels-like
  temperature, and an optional daily forecast.
- **Resource:** `home-header-card.js`
- **URL:** `/local/home-dark-cards/home-header-card.js?v=20260812-1531-source-sync`

```yaml
type: custom:home-header-card
weather_entity: weather.openweathermap
forecast_days: 5
show_forecast: false
```

- `weather_entity` is optional. The current `home-dark` dashboard uses the verified
  `weather.openweathermap` entity.
- `forecast_days` accepts a number and is rounded and clamped to `1`–`5`; the default is
  `3`. The current dashboard sets it to `5`.
- `show_forecast` defaults to `true`. Set it to `false` to hide forecast UI and disable
  forecast requests and refresh timers. The current dashboard sets it to `false`.
- Current humidity comes from the weather entity's `humidity` attribute.
- The feels-like value comes from `apparent_temperature` and is displayed with the
  entity's `temperature_unit`. The metrics row is hidden when both values are missing.
- The clock/date remain at the top while the current weather summary and forecast
  share a compact horizontal row. Current weather details and each forecast day are
  readable icon-led one-line items without nested forecast boxes or item borders.
  The forecast list uses a horizontally scrollable flex layout when its items cannot
  fit, including on the narrowest mobile widths, so the card avoids unnecessary
  vertical growth and page-level horizontal overflow.
- Enabled daily forecasts use Home Assistant's `weather.get_forecasts` service with
  `type: daily`. Results are cached and refreshed at most every 30 minutes.

### Home chip card

- **Card type:** `custom:home-chip-card`
- **Purpose:** Compact, tappable status chip for a person, lock, light group, or generic
  entity. Tapping opens the entity's Home Assistant more-info dialog.
- **Resource:** `home-chip-card.js`
- **URL:** `/local/home-dark-cards/home-chip-card.js?v=20260812-1531-source-sync`

The current `home-dark` configuration does not contain a `home-chip-card` instance. The
following example uses the verified `person.andrei` entity:

```yaml
type: custom:home-chip-card
kind: person
entity: person.andrei
label: Andrei
```

- `entity` is required.
- `kind` supports `person`, `lock`, `light-group`, and `entity`; the default is `entity`.
- `label` supplies the displayed text. For a generic `entity`, `icon` optionally sets
  the icon; otherwise it defaults to `mdi:circle`.
- `person` uses the `home` state and an `entity_picture` attribute when available.
- `lock` uses `locked` as the active state.
- `light-group` counts member entities from the group's `entity_id` attribute. Its
  installation-specific group entity is `[Needs configuration]`.

### Home room tile card

- **Card type:** `custom:home-room-tile-card`
- **Purpose:** Room summary tile showing the configured room icon, climate readings,
  configured domain icons, and an `on` indicator when the light group is on. Tapping
  opens a configured URL hash when `popup_hash` is set; otherwise it opens more-info
  for the light group, or the climate entity when no light group is set.
- **Resource:** `home-room-tile-card.js`
- **URL:** `/local/home-dark-cards/home-room-tile-card.js?v=20260812-1531-source-sync`

This is the current verified Living Room configuration:

```yaml
type: custom:home-room-tile-card
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

### Home row card

- **Card type:** `custom:home-row-card`
- **Purpose:** Single-entity control row for covers, media players, vacuums,
  and the Tesla quick-device summary. Its existing `kind: light` branch remains
  supported for compatibility; new light rows use `home-light-card`.
- **Resource:** `home-row-card.js`
- **URL:** `/local/home-dark-cards/home-row-card.js?v=20260812-1531-source-sync`

This is the current verified Tesla row used on the Home view:

```yaml
type: custom:home-row-card
kind: tesla
battery_entity: sensor.storm_trooper_battery_level
charge_switch: switch.storm_trooper_charge
name: Storm Trooper
```

- `kind` is required and supports `light`, `cover`, `media`, `vacuum`, and
  `tesla`.
- `entity` is used by `light`, `cover`, `media`, and `vacuum` rows. The
  Tesla row uses `battery_entity` and `charge_switch` instead; its entity value is
  `[Needs configuration]` because the current card does not require one.
- `name` is optional and supplies the displayed name.
- Existing light rows toggle the light and show a brightness slider only when
  `supported_color_modes` contains a mode other than `onoff`. New light rows should
  use `custom:home-light-card` so the light-specific implementation is independently
  configurable.
- Cover rows use `current_position` and call `cover.set_cover_position`.
- Media rows call `media_player.media_play_pause`. The branch remains in the
  source, but no card on the live `home-dark` dashboard uses `kind: media` any
  more; media players use the separately maintained
  `custom:mediocre-media-player-card` resource.
- Vacuum rows call `vacuum.start` or `vacuum.return_to_base`; the verified current
  vacuum entity is `vacuum.roborock`.
- The verified current light example is:

```yaml
type: custom:home-row-card
kind: light
entity: light.apartment_balcony
name: Balcony
```


### Home cover card

- **Card type:** `custom:home-cover-card`
- **Purpose:** Dark modular control card for blinds and shutters, including
  capability-aware open, stop, close, position, discrete slat-tilt, and shutter
  light-position controls.
- **Resource:** `home-cover-card.js`
- **Resource ID:** `264907031d174aae8eaf44caa4dab133`
- **Hosting:** The registered resource is a legacy inline Home Assistant module.
  Do not update it inline. The local file is retained as the source for future
  migration to URL mode if explicitly requested.

```yaml
type: custom:home-cover-card
kind: blinds
entities:
  - cover.living_room_window_shutter
name: Blinds
half_open_position: 50
```

- `kind` is required and accepts `blinds` or `shutters`.
- `entity` or `entities` is required. Values must be `cover.*` entity IDs.
- `name` is optional. For multiple entities, each entity's `friendly_name` is used.
- `half_open_position` is clamped to `0`–`100` and is used for the shutters
  light-position action.
- `show_tilt_buttons` is optional and defaults to `true` for backward
  compatibility. When enabled, covers that expose live tilt-position support
  show four discrete `set_cover_tilt_position` actions at exactly `0%`, `25%`,
  `75%`, and `100%`, labelled `Fully closed`, `Slightly open`, `Mostly open`,
  and `Fully open`. Set it to `false` to hide the tilt controls and related
  unavailable notice for every room/entity in the card.
- The card's editor exposes `kind`, a multi-select cover entity selector, `name`,
  `half_open_position`, and `show_tilt_buttons`. The main Open/Stop/Close
  commands and the continuous cover-position slider remain available; the old
  position presets and tilt slider are not rendered.

### Home climate card

- **Card type:** `custom:home-climate-card`
- **Purpose:** Dedicated climate control card for both heating and cooling entities.
  It reads the live climate entity attributes and renders only the controls exposed by
  that entity.
- **Resource:** `home-climate-card.js`
- **Resource ID:** `d3ddace99f314afbbbe9ad689d437161`
- **URL:** `/local/home-dark-cards/home-climate-card.js?v=20260814-climate-render-skip`

The current `home-dark` dashboard uses this card for all eight climate entities:
`climate.living_room`, `climate.cinema`, `climate.office_ac`, `climate.erics_room`,
`climate.master_bedroom`, `climate.master_bathroom`, `climate.erics_bathroom`, and
`climate.studio_bathroom`.

```yaml
type: custom:home-climate-card
entity: climate.cinema
name: Cinema
power_switch: switch.cinema_air_conditioning_knx_switch
```

- `entity` is required and must be a climate entity. `name` is optional; the entity
  `friendly_name` is used when it is omitted.
- `power_switch` is optional and must be a confirmed `switch.*` entity for the
  room's A/C power circuit. When configured, the card displays a labeled A/C
  On/Off button on the left side of the bottom target-temperature stepper and
  explicitly calls `switch.turn_on` or `switch.turn_off` for that switch. The
  displayed state uses a local optimistic preview until Home Assistant confirms
  the switch state; failed calls and a five-second timeout fall back to the latest
  Home Assistant state.
- When `power_switch` is omitted, the card uses a native climate fallback only
  when the live entity exposes both `climate.turn_on` and `climate.turn_off`
  capability bits (`supported_features` 256 and 128). It derives native power
  from the climate state (`off` means off) and calls the matching native
  climate service. It does not guess a switch entity or show a power control
  for entities without that capability. The current Office entity is the
  verified native-capability case.
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
- The live `home-dark` dashboard uses 16 climate-card instances: eight in the
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

### Home light card

- **Card type:** `custom:home-light-card`
- **Purpose:** Theme-aware single-light control row. It toggles the configured light
  and shows a touch-friendly brightness slider only when the entity's
  `supported_color_modes` contains a mode other than `onoff`.
- **Resource:** `home-light-card.js`
- **Resource ID:** `376b336445804f819b97c6b461f530cb`
- **Deployment:** The existing resource ID is managed as an inline Home Assistant
  module containing the exact validated local source. This avoids relying on an
  unverified `/config/www` URL file and makes the deployed content inspectable
  through the resource registry.

```yaml
type: custom:home-light-card
entity: light.livingroom_couch
name: Couch
```

- `entity` is required and `name` is optional. When `name` is omitted, the entity's
  `friendly_name` is used.
- The card uses the existing `--home-dark-*` theme tokens used by the climate
  card, with the Home Dark palette as fallbacks. It does not inherit the generic
  `--ha-card-background` surface from a surrounding popup.
- While dragging or using the keyboard, the slider keeps a local preview instead of
  being overwritten by the previous Home Assistant state. The completed interaction
  sends one `light.turn_on` call with `brightness_pct`; the preview remains visible
  until the matching Home Assistant state arrives, then reconciles to that state. A
  failed call or five-second timeout falls back to the latest available state.
- Pointer cancellation, lost capture, and window blur cancel the interaction without
  sending a service call. Pointer capture and listeners are cleaned up when the card
  disconnects.

### Home switch card

- **Card type:** `custom:home-switch-card`
- **Purpose:** Theme-aware control row for switch-like entities. The entity is toggled
  by the right-side switch control, while the left content supports configurable tap,
  hold, and double-tap actions. The selected `switch_type` changes the visual design
  only; it does not change the entity or service behavior.
- **Resource:** `home-switch-card.js`
- **Resource ID:** `257d462671f14a0fba4d422931a99f2b`
- **URL:** `/local/home-dark-cards/home-switch-card.js?v=20260816-switch-card-14`
- **Deployment:** URL mode. Copy the local source to
  `/config/www/home-dark-cards/home-switch-card.js` before loading the resource.

The three current verified instances are the bathroom fan controls:

```yaml
type: custom:home-switch-card
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
- `expanded: true` enables configurable entity information in the single
  secondary-text row. A card with numeric `grid_options.rows` greater than `1`
  is also treated as expanded automatically; the card remains one row tall.
- `state_content` accepts `state`, `last-changed`, `last-updated`,
  `last-reported`, attribute names, or objects such as
  `{attribute: current_speed, name: Speed, unit: rpm}`. If `expanded` is enabled
  without `state_content`, the default is `last-changed`, rendered as
  `On for 5 minutes` or `Off for 2 hours`.
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

The first room popup is configured in the live `home-dark` dashboard rather than
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
  - type: custom:home-light-card
    entity: light.living_room_all
    name: Room
  - type: custom:home-light-card
    entity: light.apartment_balcony
    name: Balcony
  - type: custom:home-light-card
    entity: light.livingroom_couch
    name: Couch
  - type: custom:home-light-card
    entity: light.livingroom_tv
    name: TV Light
  - type: custom:home-climate-card
    entity: climate.living_room
    power_switch: switch.living_room_air_conditioning_knx_switch
    name: Living Room
  - type: custom:home-climate-card
    entity: climate.living_room_ac
    power_switch: switch.living_room_air_conditioning_knx_switch
    name: Living Room Air Conditioning
  - type: custom:mediocre-media-player-card
    entity_id: media_player.living_room_soundbar_ma
    name: Living Room Soundbar
    compact: true
  - type: custom:home-cover-card
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
`close_on_click: false` behavior live in Home Assistant dashboard configuration and
can be edited there without changing this repository's card code. The light-card
source is published inline through the existing resource ID. URL-mode cards still
require copying their local source files to `/config/www/home-dark-cards/`;
resource registration alone does not upload those files. A browser hard refresh is
required after updating a resource.

### Home person card

- **Card type:** `custom:home-person-card`
- **Purpose:** Responsive presence card with a person avatar, location, optional phone
  battery, and optional distance from `zone.home`.
- **Resource:** `home-person-card.js`
- **URL:** `/local/home-dark-cards/home-person-card.js?v=20260814-2223-no-hover-border`

This is the current verified Andrei configuration:

```yaml
type: custom:home-person-card
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
- The proximity calculation requires valid coordinates on the person and `zone.home`;
  the installation-specific zone entity is `[Needs configuration]`.

### Home door security card

- **Card type:** `custom:home-door-security-card`
- **Purpose:** Doorbell camera preview with camera/door/ring status, silent-mode control,
  lock control, lock battery text, and an optional in-card lock confirmation dialog.
- **Resource:** `home-door-security-card.js`
- **URL:** `/local/home-dark-cards/home-door-security-card.js?v=20260812-1531-source-sync`

This is the current verified Home view configuration:

```yaml
type: custom:home-door-security-card
camera_entity: camera.doorbell
lock_entity: lock.front_door
battery_entity: sensor.front_door_lock_battery
name: Door Security
camera_label: Video doorbell
lock_label: Front door
show_camera: true
show_lock: true
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
- `show_camera` and `show_lock` default to `true`.
- `camera_label`, `sound_on_label`, and `dnd_label` are configurable displayed labels.
  `name` defaults to `Door Security`. `lock_label` is accepted and present in the live
  configuration, but the current source uses the literal `Front door` text for lock
  titles and confirmation-dialog text, so changing `lock_label` currently has no visible
  effect.
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

- **Card type:** `custom:home-status-card`
- **Purpose:** House-mode selector plus PM2.5, PM10, and optional AQI metrics with
  display-only air-quality bands. Metric buttons open entity more-info.
- **Resource:** `home-status-card.js`
- **URL:** `/local/home-dark-cards/home-status-card.js?v=20260812-1531-source-sync`

This is the current verified Home view configuration:

```yaml
type: custom:home-status-card
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
- `name`, `mode_label`, `pm25_label`, `pm10_label`, and `aqi_label` customize displayed
  text.
- `pm25_good_max`, `pm25_moderate_max`, `pm10_good_max`, and `pm10_moderate_max`
  override the display-only thresholds; each value must be a non-negative number.
- PM2.5 display thresholds default to Good `<= 15`, Moderate `<= 35`, High `> 35`.
  PM10 defaults to Good `<= 45`, Moderate `<= 100`, High `> 100`. These are display
  bands only and do not replace the sensor's native classification.
- The house-mode selector and configured metrics share a compact responsive status row.
  House mode, PM2.5, PM10, and optional AQI are readable icon-led one-line
  controls/items without individual borders. The card surface is explicitly dark navy
  (`#212c42` fallback), distinct from the `#1a2433` page/popup background; compact
  typography, zero-width-safe flex children, and narrow-screen wrapping keep controls
  readable without page-level horizontal overflow in the Companion app.
- `house_mode_entity` options are read from the entity. The selector calls
  `input_select.select_option` only when the chosen option is currently exposed by the
  entity. The verified current entity is `input_select.house_mode`; its current
  configured options are `Home`, `Away`, `Night`, `Visitor`, and `Armed`.
- The verified metric entities are `sensor.home_pm2_5`, `sensor.home_pm10`, and
  `sensor.air_quality_index`.

## Adding a card to `home-dark`

1. Copy the card JavaScript file to Home Assistant:
   `/config/www/home-dark-cards/<card-file>.js`.
2. Register or update the matching URL-mode module resource at
   `/local/home-dark-cards/<card-file>.js`. Never create or update an inline
   resource for a local card. Existing inline resources are legacy exceptions;
   report them before changing the related dashboard card.
3. Open the `home-dark` dashboard editor, choose the target view, add a card, select
   **Manual**, and paste the relevant YAML example.
4. Save the dashboard and hard-refresh the browser if the resource was newly copied or
   updated.

The `/local/...` URL only works after the JavaScript file has been copied to
`/config/www/home-dark-cards/`. This repository contains local source files; the
Home Assistant MCP resource operation registers resources but does not copy files
into `/config/www/`. After any resource update, hard-refresh the browser to load
the new module.

## Export inventory

The byte sizes below are local JavaScript source sizes. URL-mode resources are
deployed from this folder; existing inline resources are legacy exceptions and
are not the deployment pattern for new or changed cards.

| File | Bytes | Lines |
|---|---:|---:|
| `home-header-card.js` | 2,367 | 41 |
| `home-chip-card.js` | 3,208 | 60 |
| `home-room-tile-card.js` | 3,157 | 49 |
| `home-row-card.js` | 10,123 | 156 |
| `home-light-card.js` | 15,928 | 440 |
| `home-person-card.js` | 8,566 | 153 |
| `home-door-security-card.js` | 17,326 | 37 |
| `home-cover-card.js` | 16,026 | 173 |
| `home-floating-menu-card.js` | 10,514 | 348 |
| `home-switch-card.js` | [local source] | 621 |

## Registering or updating a resource

Local files are deployed under `/config/www/home-dark-cards/` and registered in
Home Assistant as `/local/home-dark-cards/*.js` module resources. Future custom
cards belonging to `home-dark` must use this URL-mode workflow.

To register or update a live resource, use the Home Assistant dashboard resource API or
the corresponding `user-hass` MCP tool:

1. Place the JavaScript file in `/config/www/home-dark-cards/` without changing its
   contents.
2. Use `ha_config_set_dashboard_resource` with the existing resource ID,
   `resource_type: "module"` and the matching `/local/home-dark-cards/*.js` URL.
   Add a new cache-busting query when updating a URL-mode file.
3. Confirm the returned resource ID and then reload the dashboard resource in Home Assistant if required.
4. Verify the resource with `ha_config_list_dashboard_resources()` and check the `home-dark` dashboard configuration.

Updating Home Assistant is an explicit remote configuration change; this folder does not
perform it automatically.
