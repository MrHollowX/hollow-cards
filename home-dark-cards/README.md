# Home Dark Cards

This folder contains seven JavaScript custom cards available to the `home-dark` Home Assistant dashboard. The files are local card sources and are not a generated build.

## Export metadata

- **Source:** Home Assistant dashboard resource registry
- **Home Assistant Core:** `2026.7.4`
- **Exported:** `2026-08-01 21:20 (UTC+03:00)`
- **Dashboard usage:** six of the seven resources below are currently referenced by the `home-dark` dashboard; `home-chip-card` is registered but has no current card instance
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
| `home-person-card.js` | `home-person-card` | `d655ab1709e94df7be303b4504d5397c` |
| `home-door-security-card.js` | `home-door-security-card` | `fdf4fcf92eee4a61805911ed6fc8a781` |
| `home-status-card.js` | `home-status-card` | `aa8e713224b14feab81eb6aa0586560d` |

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
  opens more-info for the light group, or the climate entity when no light group is set.
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
```

- `name` is required.
- `icon` defaults to `mdi:home`.
- `light_group_entity`, `climate_entity`, `cover_entity`, `media_entity`, and
  `motion_entity` are optional. Each configured field adds its domain icon; the
  `motion_entity` value is used for the motion icon and does not add a motion status.
- The climate entity supplies `current_temperature` and `current_humidity` when
  available. Installation-specific alternatives are `[Needs configuration]`.

### Home row card

- **Card type:** `custom:home-row-card`
- **Purpose:** Single-entity control row for lights, covers, climate, media players,
  vacuums, and the Tesla quick-device summary.
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

- `kind` is required and supports `light`, `cover`, `climate`, `media`, `vacuum`, and
  `tesla`.
- `entity` is used by `light`, `cover`, `climate`, `media`, and `vacuum` rows. The
  Tesla row uses `battery_entity` and `charge_switch` instead; its entity value is
  `[Needs configuration]` because the current card does not require one.
- `name` is optional and supplies the displayed name.
- Light rows toggle the light and show a brightness slider only when
  `supported_color_modes` contains a mode other than `onoff`.
- Cover rows use `current_position` and call `cover.set_cover_position`.
- Climate rows show current/target temperature and adjust the target by `0.5` degrees
  per step.
- Media rows call `media_player.media_play_pause`.
- Vacuum rows call `vacuum.start` or `vacuum.return_to_base`; the verified current
  vacuum entity is `vacuum.roborock`.
- The verified current light and climate examples are:

```yaml
type: custom:home-row-card
kind: light
entity: light.apartment_balcony
name: Balcony
```

```yaml
type: custom:home-row-card
kind: climate
entity: climate.office_ac
name: Office
```

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
export time for the six original exported files. The new `home-status-card.js` is a local
source file registered as a `/local/` resource, not an inline export.

| File | Bytes | Lines |
|---|---:|---:|
| `home-header-card.js` | 2,367 | 41 |
| `home-chip-card.js` | 3,208 | 60 |
| `home-room-tile-card.js` | 3,157 | 49 |
| `home-row-card.js` | 10,123 | 156 |
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
