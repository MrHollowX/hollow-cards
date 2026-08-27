# Home Dark JavaScript Card Audit

**Audit date:** 2026-08-27  
**Scope:** All 16 JavaScript sources in `home-dark-cards/`  
**Result:** 0 critical, 1 high, 24 medium, and 17 low findings

## Executive summary

The review covered correctness, Home Assistant integration contracts, component
lifecycle, event and timer cleanup, state synchronization, DOM rendering,
accessibility, and recurring update cost.

No unbounded global-listener or interval leak was confirmed. The only
high-severity issue is an unscoped appliance-card stylesheet that affects
buttons outside the card. The main medium risks are:

- controls remaining actionable for unavailable or unknown entities;
- reconnect state that can leave cards empty, stale, or unable to render;
- complete DOM replacement during active gestures or keyboard interaction;
- stale house-mode, status-age, person, and camera information;
- physical cover actions executing before a pointer gesture can be cancelled;
- repeated full-state scans and unnecessary remounts on common Home Assistant
  updates.

## Verification

- All 16 JavaScript files pass `node --check`.
- `git diff --check` completed successfully at audit time.
- Current Home Assistant frontend contracts were checked through Context7. The
  official `LovelaceCardConstructor` defines `getConfigElement()` and
  `getStubConfig()` on the constructor, while `getCardSize()` and
  `getGridOptions()` are card-instance methods.
- The repository has no local browser runtime, formal test suite, package
  manifest, or application server. Findings are therefore based on source
  behavior and current Home Assistant contracts.
- Conditional findings explicitly state the runtime condition required to
  trigger them.

## Recommended fix order

1. Fix **H-01** to stop document-wide CSS leakage.
2. Fix **M-01**, **M-04**, **M-08**, and **M-15** to prevent stranded cards,
   invalid service calls, unintended physical actions, and broken gestures.
3. Fix climate focus/reconnect behavior (**M-05**, **M-06**, **M-16**).
4. Stabilize vacuum, camera, cover, and navigation rendering (**M-07**,
   **M-20**, **M-21**, **M-22**).
5. Correct stale status/person/camera information (**M-02**, **M-09**,
   **M-17**, **M-18**, **M-24**).
6. Address the remaining accessibility, performance, configuration, and
   low-severity consistency findings.

---

## High severity

### H-01 — Appliance card CSS leaks into every dashboard button

- **Category:** CSS isolation
- **Location:** `home-appliance-card.js:408-415`
- **Evidence:** The card renders a `<style>` element in light DOM. Its stylesheet
  contains unqualified `button`, `button:focus-visible`, and `button:disabled`
  selectors, so those rules are document-wide rather than card-scoped.
- **Impact:** While the card is mounted, unrelated Home Assistant and custom-card
  buttons can inherit its cursor, disabled opacity, font, and focus-outline
  rules. The unresolved card-local focus color can also suppress another
  button's visible outline.
- **Smallest safe remediation:** Prefix every generic selector with
  `home-appliance-card` or `.appliance-card`. Moving the card to shadow DOM
  would also isolate the stylesheet, but selector scoping is the smaller change.

---

## Medium severity

### M-01 — Async reconnect can strand a group card with an empty body

- **Category:** Lifecycle
- **Location:** `home-group-card.js:56-94`
- **Evidence:** Child creation sets `_childrenReady = true` before awaiting
  `loadCardHelpers()` and card creation. Disconnect invalidates `_renderToken`
  but does not reset `_childrenReady`; reconnect then returns immediately from
  `_ensureChildren()`.
- **Impact:** Disconnecting during child creation and reconnecting the same
  element can leave its grouped cards absent for the rest of that element's
  lifetime.
- **Smallest safe remediation:** Set `_childrenReady` only after children are
  committed, or reset it on disconnect whenever no committed child-card set
  exists. Retry `_ensureChildren()` when an open group reconnects.
- **Condition:** Disconnect/reconnect occurs during asynchronous child creation.

### M-02 — Optimistic house mode can mask divergent authoritative state

- **Category:** State synchronization
- **Locations:** `home-status-card.js:156-174`,
  `home-status-card.js:353-358`
- **Evidence:** A rejected service call clears `_pendingMode`, but a successful
  call clears it only when Home Assistant reports the exact requested value.
  Divergent state does not expire it. Calls also lack a generation token, so
  rejection of an older request can clear a newer selection.
- **Impact:** The selector can continue showing a requested mode when Home
  Assistant remains in, or returns to, another mode.
- **Smallest safe remediation:** Add a bounded optimistic timeout, reconcile
  divergent post-call state, and use a request token so only the current request
  can clear `_pendingMode`.

### M-03 — Dynamic names, icons, and entity IDs enter HTML unescaped

- **Category:** DOM integrity
- **Locations:** `home-light-card.js:476-477,484-555`,
  `home-room-tile-card.js:65-78`, `home-status-card.js:227-281`
- **Evidence:** The light card interpolates configured or entity-derived names,
  icons, and entity IDs into `_card.innerHTML`. The room tile assigns configured
  `name` directly to `innerHTML`. The status card interpolates icon strings into
  shell attributes without attribute-context escaping.
- **Impact:** Quotes or markup in dashboard configuration or friendly names can
  alter the rendered DOM. No remote attacker path is established, so this is a
  markup-injection and DOM-correctness issue rather than confirmed remote XSS.
- **Smallest safe remediation:** Use `textContent`, DOM properties, and
  `setAttribute()` for dynamic values. Escape text and attribute contexts
  separately wherever templating remains.

### M-04 — Availability and capability gating is inconsistent

- **Category:** Control correctness
- **Locations:** `home-light-card.js:58-65,484-555`,
  `home-climate-card.js:223-235,842-892`,
  `home-appliance-card.js:70-75`, `home-vacuum-card.js:105-108,526-530`,
  `home-cover-card.js:103-119`, `home-switch-card.js:232-239,378-386`
- **Evidence:** Unknown lights render as Off with enabled controls; explicit
  climate power switches are used without checking their state; unavailable
  button entities are treated as available; vacuum actions lack availability
  and feature checks; cover half/tilt buttons omit the existing disabled
  predicate; and the switch row allows `unknown` to trigger its default action.
- **Impact:** Users can receive a false Off state or invoke services against
  unknown, unavailable, or unsupported targets.
- **Smallest safe remediation:** Centralize an `isAvailable(entity)` predicate
  in each card, use it in rendering and handlers, gate capability-specific
  actions with domain attributes, and apply native `disabled` state.

### M-05 — Additional climate controls disappear with an unavailable primary

- **Category:** Climate logic
- **Location:** `home-climate-card.js:1088-1109`
- **Evidence:** `_additionalControls()` is rendered only inside the primary
  climate entity's available branch.
- **Impact:** Independently configured and healthy secondary climate controls
  become unusable whenever the primary climate entity is unavailable.
- **Smallest safe remediation:** Render the primary unavailable message and
  `_additionalControls()` independently, with availability checked per
  additional entry.

### M-06 — Stale climate focus can defer rendering after reconnect

- **Category:** Lifecycle
- **Locations:** `home-climate-card.js:68-78`,
  `home-climate-card.js:107-121`, `home-climate-card.js:569-587`
- **Evidence:** Disconnect does not clear `_focusedControl`,
  `_menuFocusTransition`, or deferred render state. The remembered descendant
  can continue satisfying `_hasTargetInteractionFocus()` after reconnect.
- **Impact:** Subsequent `hass` assignments can remain deferred until another
  focus or blur path clears the stale reference.
- **Smallest safe remediation:** Clear remembered focus and transition flags on
  disconnect, then force one render or flush deferred state on reconnect.
- **Condition:** The card disconnects while an interactive control is remembered.

### M-07 — Vacuum updates replace active menus and map gestures

- **Category:** Interaction performance
- **Locations:** `home-vacuum-card.js:203-225`,
  `home-vacuum-card.js:496-516`
- **Evidence:** A configured entity or map-image change replaces the complete
  card through `innerHTML`, with no guard for open listboxes, focused controls,
  active pointers, or pointer capture.
- **Impact:** An update during menu selection or map pan/pinch can destroy active
  nodes, abort the gesture, drop focus, or reset interaction state.
- **Smallest safe remediation:** Keep a stable shell and patch state nodes. As a
  smaller interim fix, defer full replacement while a menu is open or map
  pointers are active, then flush when interaction ends.

### M-08 — Cover commands execute before a pointer gesture can be cancelled

- **Category:** Physical control safety
- **Location:** `home-cover-card.js:32-63`
- **Evidence:** Physical actions execute on primary `pointerdown`, without a
  movement threshold, `pointercancel` rollback, or pointer-up confirmation.
  Pointer, click, input, and change events are not isolated from ancestor popup
  handlers.
- **Impact:** Beginning a touch scroll or cancelling a press can still move a
  blind. The same event can also reach an enclosing interactive card or popup.
- **Smallest safe remediation:** Use semantic `click` activation, or track
  pointer-up with cancellation and a movement threshold. Stop propagation for
  confirmed control activation.

### M-09 — Security camera preview can remain stale

- **Category:** Camera freshness
- **Locations:** `home-door-security-card.js:38-44`,
  `home-camera-grid-card.js:86-89,123-130`
- **Evidence:** The door card changes `img.src` only when `entity_picture`
  changes although its alt text calls it a live preview. The camera grid has no
  snapshot refresh clock and rebuilds only when state, name, or token changes.
- **Impact:** Integrations with stable state and picture/token URLs can leave an
  old frame on screen.
- **Smallest safe remediation:** Use Home Assistant's camera stream/card
  mechanism for live preview. For snapshots, add a configurable cache-busting
  refresh while connected and visible, and stop it on disconnect.
- **Condition:** The camera integration keeps state and picture/token attributes
  stable between frames.

### M-10 — Room tiles are mouse-only interactive divs

- **Category:** Accessibility
- **Location:** `home-room-tile-card.js:65-78`
- **Evidence:** The clickable tile is a plain `div` with only a click listener.
  It has no native button semantics, role, tab stop, keyboard activation, or
  focus-visible behavior.
- **Impact:** Keyboard and switch-device users cannot activate room navigation
  or more-info.
- **Smallest safe remediation:** Use `<button type="button">`. If the container
  must remain a div, add `role="button"`, `tabindex="0"`, Enter/Space handling,
  an accessible name, and visible focus styling.

### M-11 — Modal dialogs do not contain keyboard focus

- **Category:** Accessibility
- **Locations:** `home-door-security-card.js:17,32`,
  `home-vacuum-card.js:331-336,467-475`
- **Evidence:** Both dialogs move initial focus and support local Escape handling
  but do not trap Tab focus, make outside content inert, or guarantee Escape
  handling after focus leaves the host.
- **Impact:** Focus can move behind an open modal and users can activate hidden
  controls or lose the local close shortcut.
- **Smallest safe remediation:** Contain focus while open, make non-dialog
  content inert, handle Escape at an appropriate connected scope, and restore
  focus to the invoking control.

### M-12 — Unavailable silent mode displays as Do Not Disturb

- **Category:** State presentation
- **Location:** `home-door-security-card.js:42-46`
- **Evidence:** Every silent-entity state other than exact `on` receives the DND
  label and class, including unknown and unavailable.
- **Impact:** The security card reports a definite mode when Home Assistant has
  no authoritative value.
- **Smallest safe remediation:** Render unknown/unavailable as a separate neutral
  state and reserve DND for exact `off`.

### M-13 — Person cards scan the entire state registry before short-circuiting

- **Category:** Performance
- **Location:** `home-person-card.js:81-105,128-149`
- **Evidence:** Both zone-resolution paths call `Object.entries(hass.states)`
  before display-option checks and before the render-key equality return.
- **Impact:** Every relevant `hass` assignment enumerates the complete registry
  even when location/proximity is hidden or visible output has not changed.
- **Smallest safe remediation:** Skip zone work unless needed, pre-index
  `zone.*` entities, and invalidate that index only when zone inputs change.

### M-14 — Cover editor is undiscoverable and remounts on every update

- **Category:** Editor lifecycle
- **Location:** `home-cover-card.js:24-27,149-183`
- **Evidence:** `getConfigElement()` and `getStubConfig()` are instance methods
  although Home Assistant reads them from the constructor. The editor's `hass`
  setter also replaces `<ha-form>` and binds a fresh listener on every update.
- **Impact:** The normal graphical editor cannot be discovered. Once registration
  is corrected, frequent `hass` assignments would wipe editor focus and
  in-progress interaction.
- **Smallest safe remediation:** Make both hooks `static`. Build `<ha-form>` once,
  bind one stored handler, and update its `hass`, `data`, and `schema` properties
  in place.

### M-15 — Drag-off hold gestures can swallow the next tap

- **Category:** Gesture lifecycle
- **Locations:** `home-light-card.js:202-234`,
  `home-switch-card.js:296-317`
- **Evidence:** The hold timer is cleared on pointer-up only if release remains
  inside the action row. Dragging off leaves it running. Its callback sets
  `_suppressNextClick` before checking whether hold action is `none`.
- **Impact:** A touch press that slides off can later suppress the next legitimate
  tap even though no hold action ran.
- **Smallest safe remediation:** Track the initiating pointer and clear the timer
  on every pointer-up, pointer-cancel, lost capture, and blur path. Suppress the
  synthetic click only when a real hold action ran.

### M-16 — Climate force-renders destroy focused controls

- **Category:** Keyboard interaction
- **Locations:** `home-climate-card.js:343-360,438-454`,
  `home-climate-card.js:657-715,962-965`
- **Evidence:** Stepper and power actions queue `_render(true)`, replacing the
  card body. Only menu focus is restored. Pending-timeout cleanup also
  force-renders while target controls can remain focused.
- **Impact:** Keyboard users lose focus after activation and must navigate back
  for repeated temperature or power changes.
- **Smallest safe remediation:** Preserve a stable control identifier and restore
  focus, patch affected values in place, and defer timeout renders while a
  control is focused.

### M-17 — Status-card relative update time freezes

- **Category:** Freshness
- **Location:** `home-status-card.js:214-225,499-525`
- **Evidence:** The footer uses `Date.now()` and `last_updated`, but the render key
  contains only watched states and mode options. Stable values return before the
  relative string is updated.
- **Impact:** A footer first rendered as "Updated just now" can remain unchanged
  for hours or days.
- **Smallest safe remediation:** Add a minute time bucket or computed relative
  string to the key, or update only the footer from a lightweight interval.

### M-18 — Missing person entity leaves blank or stale presence

- **Category:** Unavailable handling
- **Location:** `home-person-card.js:128-131,166`
- **Evidence:** If the configured entity is absent from `hass.states`, `_render()`
  returns without clearing or replacing previous shadow DOM.
- **Impact:** First paint can remain blank; a later rename, unload, or temporary
  absence can continue showing the last avatar and Home/Away state.
- **Smallest safe remediation:** Render an explicit unavailable state with a
  fallback avatar and its own render key.

### M-19 — Appliance card discards updates while its menu is open

- **Category:** Deferred updates
- **Location:** `home-appliance-card.js:229-235,308-314,357-360`
- **Evidence:** `_render()` returns while the program menu is open unless forced
  and does not record a deferred update for application on close.
- **Impact:** Connectivity, power, progress, remaining time, and program options
  can remain stale for the entire time the listbox is open.
- **Smallest safe remediation:** Mark skipped renders as deferred and flush the
  latest state when the menu closes, or update non-menu nodes in place.

### M-20 — One camera change remounts every grid snapshot

- **Category:** Render performance
- **Location:** `home-camera-grid-card.js:86-90,123-147`
- **Evidence:** A combined signature covers every camera. Any state, name, or
  access-token change replaces the complete host HTML and every image node.
- **Impact:** One camera update drops focus and makes every tile reload or
  revalidate its image, producing avoidable flicker and cache/network work.
- **Smallest safe remediation:** Create tiles once and update only the changed
  tile's label, availability class, and `img.src`.

### M-21 — Floating menus rebuild on every route, hash, and resize

- **Category:** Navigation performance
- **Locations:** `home-floating-menu-card.js:14-16,56-69`,
  `home-floating-menu-card.js:142-183,376-387`
- **Evidence:** One handler calls `_render()` and an eight-frame positioning
  retry sequence for location changes, popstate, hashchange, and resize.
- **Impact:** Opening a hash-based room popup and mobile viewport changes recreate
  navigation, drop tab focus, and briefly hide the menu. Every mounted view
  instance receives the global events.
- **Smallest safe remediation:** Separate active-tab updates from layout. On
  resize, schedule one position update; ignore hash changes that do not alter
  the dashboard view.

### M-22 — Cover state updates can reset an active slider drag

- **Category:** Gesture lifecycle
- **Location:** `home-cover-card.js:28-31,52-63,130-146`
- **Evidence:** The card has no dragging guard. A signature change from any
  configured cover replaces the full shadow DOM and all range inputs.
- **Impact:** A drag can jump or terminate when the same cover, or another
  grouped cover, reports a new state or position.
- **Smallest safe remediation:** Track active slider pointers/focus and defer
  rebuilds until interaction ends. Prefer a stable shell with in-place updates.

### M-23 — Person and entity-status updates replace focused controls

- **Category:** Accessibility performance
- **Locations:** `home-person-card.js:148-166`,
  `home-entity-status-card.js:238-286`
- **Evidence:** Every changed signature replaces the complete shadow tree without
  preserving focused control identity.
- **Impact:** A person, battery, or sensor update can remove the focused button or
  metric and return keyboard users to the document.
- **Smallest safe remediation:** Build a shell once and patch text, classes,
  icons, and ARIA state. If replacement remains, restore focus by stable control
  identity.

### M-24 — GPS-derived location can contradict person state

- **Category:** Presence logic
- **Location:** `home-person-card.js:81-105,135-143`
- **Evidence:** Explicit `not_home`, `away`, `unknown`, and `unavailable` states
  can still fall through to coordinate-based zone resolution, while presence
  styling remains based on exact person state.
- **Impact:** A card can show the away surface and grayscale avatar while its
  location says Home; proximity can also be hidden by the GPS-derived zone.
- **Smallest safe remediation:** Do not override explicit away/unknown/unavailable
  states with coordinate zones. Use GPS fallback only when person state has no
  authoritative semantic value.

---

## Low severity

> The missing L-03 and L-04 identifiers are intentional. Those findings were
> promoted to M-13 and M-14 during reconciliation.

### L-01 — Appliance pending text can survive reconnect indefinitely

- **Category:** Lifecycle
- **Location:** `home-appliance-card.js:54-63,166-172`
- **Evidence:** Disconnect clears `_pendingTimer` but leaves `_pending`; the
  cancelled timeout is the only automatic clearing path.
- **Impact:** Reconnecting during the pending period can retain stale pending
  text until another action changes it.
- **Smallest safe remediation:** Clear both `_pendingTimer` and `_pending` on
  disconnect and invalidate the render signature.

### L-02 — Six cards repeatedly bind already-bound handlers

- **Category:** Lifecycle performance
- **Locations:** `home-camera-grid-card.js:48-57`,
  `home-appliance-card.js:38-63`, `home-light-card.js:124-168`,
  `home-climate-card.js:81-120`, `home-switch-card.js:27-62`,
  `home-vacuum-card.js:39-66`
- **Evidence:** Every reconnect overwrites handler fields with
  `this._handler.bind(this)`, even when those fields already hold bound
  functions. Cleanup removes active listeners correctly.
- **Impact:** This is not a duplicate-listener leak, but each same-instance
  reconnect adds another wrapper and retains the previous wrapper chain.
- **Smallest safe remediation:** Bind once in the constructor or behind a
  `_handlersBound` flag.

### L-05 — Several parsed or documented options have no effect

- **Category:** Configuration consistency
- **Locations:** `home-status-card.js:324-326,497-524`,
  `home-door-security-card.js:3-6,30-32`, `README.md:190-218`,
  `home-header-card.js:224-239`
- **Evidence:** `show_aqi: false` leaves the configured AQI tile visible;
  `lock_label` and `confirm_unlock` are stored but ignored; the README promises
  `apparent_temperature`, while the header renders temperature and humidity only.
- **Impact:** Dashboard authors can configure behavior that is silently ignored,
  and documentation describes output that is not implemented.
- **Smallest safe remediation:** Implement each option or remove it from parsing
  and documentation, with one regression check per documented option.

### L-06 — Header clock restart depends on a later hass assignment

- **Category:** Lifecycle
- **Location:** `home-header-card.js:26-37,400-414`
- **Evidence:** Disconnect clears the interval. No `connectedCallback()` exists;
  only `_render()` through the `hass` setter starts another interval.
- **Impact:** Reattaching the same element without an immediate `hass` assignment
  leaves the clock static.
- **Smallest safe remediation:** Add an idempotent `connectedCallback()` that
  updates the clock and starts the interval when state/config already exist.

### L-07 — Switch time updates remount the control every 30 seconds

- **Category:** Periodic rendering
- **Location:** `home-switch-card.js:42-48,391-441`
- **Evidence:** Default last-changed content enables the interval, which
  invalidates the signature and replaces `_card.innerHTML`.
- **Impact:** Focused rows lose focus and type-specific animations restart twice
  per minute across current switch cards.
- **Smallest safe remediation:** Update only the relative-time node on timer
  ticks.

### L-08 — A previous cover error can remain after success

- **Category:** Error state
- **Location:** `home-cover-card.js:76-85,130-146`
- **Evidence:** `_call()` clears `_error`, but only rejection triggers a render.
  A successful no-op with no signature change leaves the old alert in DOM.
- **Impact:** The card can continue reporting "Command failed" after a successful
  command.
- **Smallest safe remediation:** Clear the rendered error immediately or render
  when `_error` changes from non-empty to empty.

### L-09 — Some icons remain stale or imply a valid state

- **Category:** Icon state
- **Locations:** `home-status-card.js:227-240,491-508`,
  `home-header-card.js:71-89,233`
- **Evidence:** The status header icon is written only during shell creation.
  Unknown/unavailable weather falls through to a partly-cloudy icon.
- **Impact:** Editor changes can leave an old icon, and unavailable weather can
  visually resemble a valid condition.
- **Smallest safe remediation:** Update the status icon during relevant renders
  and map unavailable weather to an alert icon or hidden state.

### L-10 — Person details hide failures and hard-code metric distance

- **Category:** Person fallbacks
- **Location:** `home-person-card.js:108-126,139-142`
- **Evidence:** A configured but unavailable battery is omitted. Proximity always
  displays kilometres without consulting Home Assistant's unit system.
- **Impact:** Battery failure looks like a disabled option, and imperial
  installations receive the wrong distance unit.
- **Smallest safe remediation:** Show an explicit battery fallback and format
  proximity using `hass.config.unit_system.length`.

### L-11 — Person and door cards do not render from setConfig

- **Category:** Configuration updates
- **Locations:** `home-person-card.js:9-28`,
  `home-door-security-card.js:3-9`
- **Evidence:** Both replace configuration and invalidate a key but wait for a
  later `hass` assignment before reflecting the change.
- **Impact:** Editor changes can remain visually stale until another frontend
  state assignment arrives.
- **Smallest safe remediation:** Call the guarded render method at the end of
  `setConfig()`.

### L-12 — Entity-status column count is capped below item count

- **Category:** Layout
- **Location:** `home-entity-status-card.js:237,284-285,346-348`
- **Evidence:** The CSS count is `Math.min(6, metrics.length)` while every
  configured metric is rendered.
- **Impact:** Configurations with seven or more metrics produce unintended
  wrapping and inconsistent sizing.
- **Smallest safe remediation:** Use the real item count or implement explicit
  pagination/wrapping.

### L-13 — Door security duplicates icon work on every hass update

- **Category:** Per-update work
- **Location:** `home-door-security-card.js:28,39-46`
- **Evidence:** `_applyIcons()` runs synchronously and again in a queued microtask
  before the render-key return.
- **Impact:** Unrelated updates cause avoidable DOM work, and configured icons
  can briefly return to defaults.
- **Smallest safe remediation:** Apply final configured icons once after state
  classes are updated and skip unchanged keys.

### L-14 — Missing vacuum battery is formatted as `--%`

- **Category:** Formatting
- **Location:** `home-vacuum-card.js:502-503,523`
- **Evidence:** The fallback is `--`, then `%` is appended unconditionally.
- **Impact:** Optional or unavailable battery data produces a misleading chip.
- **Smallest safe remediation:** Append the unit only for finite numeric values;
  otherwise show `Unavailable`, `--`, or omit the chip.

### L-15 — Floating-menu defaults and event isolation mismatch the dashboard

- **Category:** Navigation configuration
- **Location:** `home-floating-menu-card.js:1-8,18-20,63,94-113`
- **Evidence:** Defaults contain Cameras instead of the live Blinds view. The
  host pointer handler cannot identify retargeted shadow buttons. Configured
  `current` also overrides route resolution used for instance visibility.
- **Impact:** Omitted tabs, ancestor pointer handlers, or per-view `current`
  values can produce wrong navigation or instance arbitration.
- **Smallest safe remediation:** Align or remove defaults, use
  `event.composedPath()`, and separate route-derived visibility from optional
  highlighting.
- **Condition:** Current live configuration supplies explicit tabs.

### L-16 — Same-session resource reloads are not registration-safe

- **Category:** Module registration
- **Locations:** Registration footer in every JavaScript source; specifically
  `home-appliance-card.js:433-435`, `home-camera-grid-card.js:161-163`,
  `home-climate-card.js:1257-1259`, `home-door-security-card.js:50`,
  `home-energy-overview-card.js:192-194`,
  `home-entity-status-card.js:469-471`,
  `home-floating-menu-card.js:402-404`, `home-group-card.js:263-265`,
  `home-header-card.js:504-506`, `home-light-card.js:644-646`,
  `home-person-card.js:206-207`, `home-room-tile-card.js:91-93`,
  `home-status-card.js:583-585`, `home-switch-card.js:616-618`,
  `home-vacuum-card.js:603-605`, and `home-cover-card.js:186-188`
- **Evidence:** Fifteen modules call `customElements.define()` without checking
  the registry, and all modules append picker metadata without de-duplication.
- **Impact:** Loading another cache-busted module URL in the same page can throw
  or duplicate picker entries. A full refresh is still required to replace an
  already-defined custom-element constructor.
- **Smallest safe remediation:** Guard `define()` and de-duplicate
  `window.customCards` by type. Retain the documented hard-refresh deployment
  step because guards cannot hot-replace constructors.

### L-17 — Appliance remaining time ignores timestamp states

- **Category:** Sensor parsing
- **Location:** `home-appliance-card.js:141-147`
- **Evidence:** `remaining_entity` is parsed only with `Number(state)`. ISO
  timestamps become `NaN`; date parsing exists only for `finish_time_entity`.
- **Impact:** A configuration supplying only a timestamp-style remaining sensor
  displays no remaining duration.
- **Smallest safe remediation:** If numeric parsing fails, parse a valid
  timestamp and subtract `Date.now()`.
- **Condition:** The current documented configuration also supplies finish time,
  so it retains a fallback.

### L-18 — Range climates and legacy dimmable lights lack fallback controls

- **Category:** Capability coverage
- **Locations:** `home-climate-card.js:315-325,1056-1057`,
  `home-light-card.js:112-115`
- **Evidence:** Climate range attributes are included in the signature but are
  never rendered as low/high controls. Light dimming depends only on
  `supported_color_modes`.
- **Impact:** Entities exposing only these capability shapes can lose controls.
- **Smallest safe remediation:** Render paired range setpoint controls. When
  color modes are absent, accept finite brightness or the relevant feature bit
  as a dimming fallback.

### L-19 — Switch row removes its visible focus outline

- **Category:** Keyboard styling
- **Location:** `home-switch-card.js:504-507`
- **Evidence:** Keyboard-operable `.row-left` uses `outline: none` for
  `:focus-visible`, unlike the light and climate cards.
- **Impact:** Keyboard users can activate the row but cannot see which control
  owns focus.
- **Smallest safe remediation:** Apply the same accent outline used by the other
  Home Dark controls.

---

## Memory-leak and performance conclusion

Persistent `document` and `window` listeners inspected in the status, appliance,
climate, floating-menu, switch, light, camera, and vacuum cards have matching
removal paths. No unbounded global-listener or interval leak was confirmed.
Several bounded deferred callbacks can outlive disconnect, and reconnect state
handling is inconsistent.

The handler rebinding described in **L-02** is retained wrapper work, not a set
of simultaneously registered duplicate listeners. The clearest recurring
costs are:

- full zone-registry scans in **M-13**;
- vacuum and camera subtree replacement in **M-07** and **M-20**;
- floating-menu route/resize rebuilding in **M-21**;
- cover remounts during gestures in **M-22**;
- switch remounts every 30 seconds in **L-07**.

## Maintenance

Update this audit when findings are fixed, when card lifecycle/rendering changes,
or when Home Assistant custom-card contracts change. Remove resolved findings
only after source verification and the available syntax/runtime checks pass.
