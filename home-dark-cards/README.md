# Home Dark Cards

This folder contains nine JavaScript custom cards available to the `home-dark` Home Assistant dashboard. The files are local card sources and are not a generated build.

## Export metadata

- **Source:** Home Assistant dashboard resource registry
- **Home Assistant Core:** `2026.7.4`
- **Exported:** `2026-08-01 21:20 (UTC+03:00)`
- **Dashboard usage:** eight of the nine local resources below are referenced by the `home-dark` dashboard; `home-chip-card` is registered but has no current card instance
- **Deployment directory:** `/config/www/home-dark-cards/`
- **Registered URL prefix:** `/local/home-dark-cards/`
- **Resource type:** external JavaScript module registered in URL mode
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
- **URL:** `/local/home-dark-cards/home-header-card.js`

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
- Enabled daily forecasts use Home Assistant's `weather.get_forecasts` service with
  `type: daily`. Results are cached and refreshed at most every 30 minutes.

### Home chip card

- **Card type:** `custom:home-chip-card`
- **Purpose:** Compact, tappable status chip for a person, lock, light group, or generic
  entity. Tapping opens the entity's Home Assistant more-info dialog.
- **Resource:** `home-chip-card.js`
- **URL:** `/local/home-dark-cards/home-chip-card.js`

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
- **URL:** `/local/home-dark-cards/home-room-tile-card.js`

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
  available. Installation-specific alternatives are `[Needs configuration]`.
- `popup_hash` is optional. The card normalizes a missing leading `#` and navigates
  to that hash so a Bubble Card `card_type: pop-up` with the same hash can open.
  Popup contents are configured in the Home Assistant dashboard, not in this resource.

### Home row card

- **Card type:** `custom:home-row-card`
- **Purpose:** Single-entity control row for covers, media players, vacuums,
  and the Tesla quick-device summary. Its existing `kind: light` branch remains
  supported for compatibility; new light rows use `home-light-card`.
- **Resource:** `home-row-card.js`
- **URL:** `/local/home-dark-cards/home-row-card.js`

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
- Media rows call `media_player.media_play_pause`.
- Vacuum rows call `vacuum.start` or `vacuum.return_to_base`; the verified current
  vacuum entity is `vacuum.roborock`.
- The verified current light example is:

```yaml
type: custom:home-row-card
kind: light
entity: light.apartment_balcony
name: Balcony
```


### Home climate card

- **Card type:** `custom:home-climate-card`
- **Purpose:** Dedicated climate control card for both heating and cooling entities.
  It reads the live climate entity attributes and renders only the controls exposed by
  that entity.
- **Resource:** `home-climate-card.js`
- **Resource ID:** `d3ddace99f314afbbbe9ad689d437161`
- **URL:** `/local/home-dark-cards/home-climate-card.js?v=20260802-1257-climate-reconcile`

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
- Fan, preset, swing, and horizontal swing controls are rendered only when their
  corresponding mode arrays are present and call the matching climate service.
- Mode controls use themed in-card listbox menus rather than native HTML
  `<select>` elements, so mobile browsers do not replace them with an Android/iOS
  picker. Menus support touch and keyboard operation, outside-click/Escape close,
  focus-visible styling, and accessible listbox/option roles.
- Current humidity is shown whenever `current_humidity` is available.
- Current HVAC action is shown when `hvac_action` is exposed. No heating/AC options are
  hardcoded in the card source.
- The card uses `getCardSize()` and `getGridOptions()` for sections-view layout,
  `hass.callService` calls with `entity_id`, keyboard-selectable buttons, and theme
  variables with dark fallbacks.
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
- **URL:** `/local/home-dark-cards/home-light-card.js?v=20260802-1002-light-events`

```yaml
type: custom:home-light-card
entity: light.livingroom_couch
name: Couch
```

- `entity` is required and `name` is optional. When `name` is omitted, the entity's
  `friendly_name` is used.
- The card uses Home Assistant theme variables with dark fallbacks, including
  `--ha-card-background`, `--card-background-color`, `--primary-text-color`,
  `--secondary-text-color`, and `--primary-color`.
- While dragging or using the keyboard, the slider keeps a local preview instead of
  being overwritten by the previous Home Assistant state. The completed interaction
  sends one `light.turn_on` call with `brightness_pct`; the preview remains visible
  until the matching Home Assistant state arrives, then reconciles to that state. A
  failed call or five-second timeout falls back to the latest available state.
- Pointer cancellation, lost capture, and window blur cancel the interaction without
  sending a service call. Pointer capture and listeners are cleaned up when the card
  disconnects.

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
close_on_click: false
cards:
  - type: heading
    heading: Living Room
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
  - type: custom:home-row-card
    kind: cover
    entity: cover.living_room_window_shutter
    name: Blinds
  - type: custom:home-row-card
    kind: media
    entity: media_player.living_room_soundbar_ma
```

The popup child-card list, titles, icon, hash, background, and explicit
`close_on_click: false` behavior live in Home Assistant dashboard configuration and
can be edited there without changing this repository's card code. Copy both
`home-dark-cards/home-light-card.js` and
`home-dark-cards/home-climate-card.js` to `/config/www/home-dark-cards/`; the
resource URLs register the files but do not upload them. A browser hard refresh is
required after copying or updating either file.

### Home person card

- **Card type:** `custom:home-person-card`
- **Purpose:** Responsive presence card with a person avatar, location, optional phone
  battery, and optional distance from `zone.home`.
- **Resource:** `home-person-card.js`
- **URL:** `/local/home-dark-cards/home-person-card.js`

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
- `kind` and `label` are present in the current dashboard configuration for consistency
  with other cards, but this source reads `entity`, `name`, and the options listed above.
- The proximity calculation requires valid coordinates on the person and `zone.home`;
  the installation-specific zone entity is `[Needs configuration]`.

### Home door security card

- **Card type:** `custom:home-door-security-card`
- **Purpose:** Doorbell camera preview with camera/door/ring status, silent-mode control,
  lock control, lock battery text, and an optional in-card lock confirmation dialog.
- **Resource:** `home-door-security-card.js`
- **URL:** `/local/home-dark-cards/home-door-security-card.js`

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
- **URL:** `/local/home-dark-cards/home-status-card.js`

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
- `house_mode_entity` options are read from the entity. The selector calls
  `input_select.select_option` only when the chosen option is currently exposed by the
  entity. The verified current entity is `input_select.house_mode`; its current
  configured options are `Home`, `Away`, `Night`, `Visitor`, and `Armed`.
- The verified metric entities are `sensor.home_pm2_5`, `sensor.home_pm10`, and
  `sensor.air_quality_index`.

## Adding a card to `home-dark`

1. Copy the card JavaScript file to Home Assistant:
   `/config/www/home-dark-cards/<card-file>.js`.
2. Register the matching module resource URL
   `/local/home-dark-cards/<card-file>.js` in Home Assistant's dashboard resources.
   Existing resource IDs and URLs are listed in the export metadata and examples above.
3. Open the `home-dark` dashboard editor, choose the target view, add a card, select
   **Manual**, and paste the relevant YAML example.
4. Save the dashboard and hard-refresh the browser if the resource was newly copied or
   updated.

The `/local/...` URL only works after the JavaScript file has been copied to
`/config/www/home-dark-cards/`. This repository contains local source files; it does not
copy files to Home Assistant or change the remote dashboard automatically.

## Export inventory

The byte sizes below are the decoded inline-content sizes reported by Home Assistant at
export time for the original exported files. The local `/local/` resources are deployed
from this folder and are not inline exports.

| File | Bytes | Lines |
|---|---:|---:|
| `home-header-card.js` | 2,367 | 41 |
| `home-chip-card.js` | 3,208 | 60 |
| `home-room-tile-card.js` | 3,157 | 49 |
| `home-row-card.js` | 10,123 | 156 |
| `home-light-card.js` | [Source file] | [Source file] |
| `home-person-card.js` | 8,566 | 153 |
| `home-door-security-card.js` | 17,326 | 37 |

## Registering or updating a resource

These files are deployed under `/config/www/home-dark-cards/` and registered in Home
Assistant as `/local/home-dark-cards/*.js` module resources. Future custom cards belonging
to `home-dark` must be added to this folder.

To register or update a live resource, use the Home Assistant dashboard resource API or
the corresponding `user-hass` MCP tool:

1. Place the JavaScript file in `/config/www/home-dark-cards/` without changing its contents.
2. Use `ha_config_set_dashboard_resource` with the existing resource ID,
   `resource_type: "module"`, and the matching `/local/home-dark-cards/*.js` URL.
3. Confirm the returned resource ID and then reload the dashboard resource in Home Assistant if required.
4. Verify the resource with `ha_config_list_dashboard_resources()` and check the `home-dark` dashboard configuration.

Updating Home Assistant is an explicit remote configuration change; this folder does not
perform it automatically.
