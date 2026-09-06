class HomePersonCard extends HTMLElement {
  static _zoneIndexes = new WeakMap();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._wired = false;
    this._shellReady = false;
  }

  setConfig(config) {
    if (!config || typeof config.entity !== 'string' || !config.entity.startsWith('person.')) {
      throw new Error('hollow-person-card requires a person entity');
    }
    if (config.battery_entity != null && (typeof config.battery_entity !== 'string' || !config.battery_entity.startsWith('sensor.'))) {
      throw new Error('battery_entity must be a sensor entity');
    }
    this._config = {
      entity: config.entity,
      name: typeof config.name === 'string' ? config.name : '',
      show_name: config.show_name !== false,
      show_location: config.show_location !== false,
      show_battery: config.show_battery === true,
      show_proximity: config.show_proximity === true,
      battery_entity: config.battery_entity || '',
      icon: typeof config.icon === 'string' ? config.icon.trim() : '',
      comfortable_spacing: config.comfortable_spacing === true
    };
    this._render();
  }

  getCardSize() { return this._config?.comfortable_spacing === true ? 3 : 2; }

  getGridOptions() {
    const comfortable = this._config?.comfortable_spacing === true;
    return { rows: comfortable ? 2 : 1, columns: 6, min_rows: comfortable ? 2 : 1, min_columns: 3 };
  }

  set hass(value) {
    this._hass = value;
    this._render();
  }

  connectedCallback() {
    if (!this._wired) {
      this._wired = true;
      this.shadowRoot.addEventListener('click', (event) => {
        if (event.target.closest('button') && this._config?.entity) {
          this.dispatchEvent(new CustomEvent('hass-more-info', {
            detail: { entityId: this._config.entity }, bubbles: true, composed: true
          }));
        }
      });
    }
    this._render();
  }

  _state(entity) {
    return entity && this._hass && this._hass.states[entity] ? this._hass.states[entity] : null;
  }

  _normalize(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  _zoneIndex() {
    const states = this._hass?.states;
    if (!states || typeof states !== 'object') {
      return { zones: [], byName: new Map(), home: null };
    }

    const cached = HomePersonCard._zoneIndexes.get(states);
    if (cached) return cached;

    const zones = [];
    const byName = new Map();
    let home = null;
    Object.keys(states).forEach((entityId) => {
      if (!entityId.startsWith('zone.')) return;
      const zone = states[entityId];
      if (!zone || typeof zone !== 'object') return;

      zones.push(zone);
      const objectId = entityId.slice(5);
      const friendlyName = zone.attributes?.friendly_name;
      [entityId, objectId, objectId.replace(/_/g, ' '), friendlyName].forEach((key) => {
        const normalized = this._normalize(key);
        if (normalized && !byName.has(normalized)) byName.set(normalized, zone);
      });
      if (entityId === 'zone.home') home = zone;
    });

    const index = { zones, byName, home };
    HomePersonCard._zoneIndexes.set(states, index);
    return index;
  }

  _location(state) {
    const normalized = this._normalize(state);
    if (!normalized || normalized === 'unknown' || normalized === 'unavailable') return 'Location unavailable';
    if (state === 'home') return 'Home';
    if (normalized === 'not_home' || normalized === 'away') return 'Away';
    return state;
  }

  _presence(state) {
    return state === 'home' ? 'home' : 'away';
  }

  _zoneForState(state) {
    if (state === 'home') return this._state('zone.home');
    const normalized = this._normalize(state);
    if (!normalized ||
        normalized === 'home' ||
        ['not_home', 'away', 'unknown', 'unavailable'].includes(normalized)) {
      return null;
    }
    return this._zoneIndex().byName.get(normalized) || null;
  }

  _zoneAtCoordinates(personState) {
    const matches = this._zoneIndex().zones.map((zone) => {
      const radius = Number(zone.attributes?.radius);
      const distance = Number.isFinite(radius) && radius >= 0
        ? this._distanceKm(personState, zone)
        : null;
      return { zone, radius, distance };
    }).filter(({ zone, radius, distance }) =>
      zone.attributes?.friendly_name &&
      distance != null &&
      distance * 1000 <= radius
    );
    matches.sort((left, right) => left.radius - right.radius);
    return matches[0]?.zone || null;
  }

  _distanceKm(personState, homeState) {
    const lat1 = Number(personState && personState.attributes.latitude);
    const lon1 = Number(personState && personState.attributes.longitude);
    const lat2 = Number(homeState && homeState.attributes.latitude);
    const lon2 = Number(homeState && homeState.attributes.longitude);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite) || Math.abs(lat1) > 90 || Math.abs(lat2) > 90 || Math.abs(lon1) > 180 || Math.abs(lon2) > 180) return null;
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }

  _battery() {
    if (!this._config.show_battery || !this._config.battery_entity) return null;
    const state = this._state(this._config.battery_entity);
    const value = state ? Number(state.state) : NaN;
    if (!state ||
        ['unknown', 'unavailable', 'none'].includes(this._normalize(state.state)) ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100) {
      return { text: 'Unavailable', ariaLabel: 'Battery unavailable', unavailable: true };
    }
    const percent = `${Math.round(value)}%`;
    return { text: percent, ariaLabel: `Battery ${percent}`, unavailable: false };
  }

  _proximity(distanceKm) {
    if (distanceKm == null) return null;
    const useMiles = this._hass?.config?.unit_system?.length === 'mi';
    const value = useMiles ? distanceKm * 0.621371192237334 : distanceKm;
    return `${value.toFixed(1)} ${useMiles ? 'mi' : 'km'} from Home`;
  }

  _ensureShell() {
    if (this._shellReady) return;
    this.shadowRoot.innerHTML = `<style>${this._css()}</style>
      <button class="card compact" data-presence="away" type="button">
        <span class="avatar fallback" role="img">
          <img class="avatar-image" alt="" hidden>
          <ha-icon class="avatar-icon" icon="mdi:account" aria-hidden="true"></ha-icon>
        </span>
        <span class="copy">
          <span class="header">
            <span class="name"></span>
            <span class="detail-item battery" hidden>
              <ha-icon icon="mdi:battery" aria-hidden="true"></ha-icon>
              <span class="battery-value"></span>
            </span>
          </span>
          <span class="details" hidden>
            <span class="status">
              <ha-icon class="status-icon" icon="mdi:map-marker" aria-hidden="true"></ha-icon>
              <span class="status-value"></span>
            </span>
          </span>
        </span>
      </button>`;
    this._nodes = {
      button: this.shadowRoot.querySelector('.card'),
      avatar: this.shadowRoot.querySelector('.avatar'),
      avatarImage: this.shadowRoot.querySelector('.avatar-image'),
      avatarIcon: this.shadowRoot.querySelector('.avatar-icon'),
      name: this.shadowRoot.querySelector('.name'),
      battery: this.shadowRoot.querySelector('.battery'),
      batteryIcon: this.shadowRoot.querySelector('.battery ha-icon'),
      batteryValue: this.shadowRoot.querySelector('.battery-value'),
      details: this.shadowRoot.querySelector('.details'),
      statusIcon: this.shadowRoot.querySelector('.status-icon'),
      statusValue: this.shadowRoot.querySelector('.status-value')
    };
    this._shellReady = true;
  }

  _render() {
    if (!this._hass || !this._config) return;
    this._ensureShell();

    const person = this._state(this._config.entity);
    const name = this._config.name || person?.attributes?.friendly_name || 'Person';
    const picture = person?.attributes?.entity_picture || '';
    const state = person?.state;
    const normalizedState = this._normalize(state);
    const hasAuthoritativeState = Boolean(normalizedState);
    let resolvedZone = null;
    if (person && (this._config.show_location || this._config.show_proximity)) {
      resolvedZone = this._zoneForState(state);
      if (!hasAuthoritativeState) resolvedZone = this._zoneAtCoordinates(person);
    }
    const namedState = hasAuthoritativeState &&
      !['home', 'not_home', 'away', 'unknown', 'unavailable'].includes(normalizedState);
    const knownLocation = state === 'home' || Boolean(resolvedZone) || namedState;
    const locationName = !person
      ? 'Person unavailable'
      : resolvedZone?.attributes?.friendly_name || this._location(state);
    const location = !person
      ? locationName
      : this._config.show_location ? locationName : '';
    const battery = this._battery();
    const proximityState = !hasAuthoritativeState;
    const distance = person &&
      this._config.show_proximity &&
      !knownLocation &&
      proximityState
      ? this._distanceKm(person, this._state('zone.home'))
      : null;
    const proximity = this._proximity(distance);
    const presence = this._presence(state);
    const spacingClass = this._config.comfortable_spacing ? 'comfortable' : 'compact';
    const status = proximity || location;
    const statusIcon = proximity ? 'mdi:map-marker-distance' : 'mdi:map-marker';
    const ariaDetails = [status, battery ? battery.ariaLabel : ''].filter(Boolean);
    const label = `${name}${ariaDetails.length ? `, ${ariaDetails.join(', ')}` : ''}`;

    this._nodes.button.className = `card ${presence === 'home' ? 'active' : 'away'} ${spacingClass}`;
    this._nodes.button.dataset.presence = presence;
    this._nodes.button.setAttribute('aria-label', label);

    const usePicture = !this._config.icon && Boolean(picture);
    this._nodes.avatar.classList.toggle('fallback', !usePicture);
    this._nodes.avatar.setAttribute(
      'aria-label',
      `${name} avatar${usePicture ? '' : this._config.icon ? ' icon' : ' unavailable'}`
    );
    this._nodes.avatarImage.hidden = !usePicture;
    if (usePicture) {
      this._nodes.avatarImage.src = picture;
      this._nodes.avatarImage.alt = `${name} avatar`;
    } else {
      this._nodes.avatarImage.removeAttribute('src');
      this._nodes.avatarImage.alt = '';
    }
    this._nodes.avatarIcon.hidden = usePicture;
    this._nodes.avatarIcon.setAttribute('icon', this._config.icon || 'mdi:account');

    this._nodes.name.hidden = !this._config.show_name;
    this._nodes.name.textContent = name;

    this._nodes.battery.hidden = !battery;
    this._nodes.battery.classList.toggle('unavailable', Boolean(battery?.unavailable));
    this._nodes.battery.setAttribute('aria-label', battery?.ariaLabel || '');
    this._nodes.batteryValue.textContent = battery?.text || '';
    this._nodes.batteryIcon.setAttribute('title', battery?.ariaLabel || '');

    this._nodes.details.hidden = !status;
    this._nodes.statusIcon.setAttribute('icon', statusIcon);
    this._nodes.statusValue.textContent = status || '';
    this._nodes.statusValue.setAttribute('title', status || '');
  }

  _css() {
    return `
      :host { display: block; min-width: 0; width: 100%; height: 100%; --person-surface:var(--card-background-color,var(--ha-card-background,#212c42)); --person-card-radius:var(--hollow-person-card-border-radius,20px); color: var(--primary-text-color, #f5f7fb); }
      .card { box-sizing: border-box; width: 100%; height: 100%; min-height: 66px; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--divider-color, rgba(255,255,255,.10)) !important; border-radius: var(--person-card-radius) !important; color: var(--primary-text-color, #f5f7fb); text-align: left; cursor: pointer; background: var(--person-surface) !important; box-shadow:var(--ha-card-box-shadow, 0 4px 14px rgba(0,0,0,.16)) !important; font: inherit; }
      .card.comfortable { padding-block: 9px; }
      .card:focus-visible { outline: 3px solid var(--primary-color, #3d8bfd); outline-offset: 2px; }
      .card.card[data-presence="home"] { background: var(--person-surface) !important; background-color: var(--person-surface) !important; color: var(--primary-text-color, #f5f7fb); }
      .card.card[data-presence="away"] { background: var(--person-away-background, #3d5270) !important; background-color: var(--person-away-background, #3d5270) !important; color: var(--person-away-color, #f5f7fb) !important; border-color: var(--person-away-border-color, rgba(255,255,255,.35)); }
      .card[data-presence="away"]:focus-visible { outline-color: var(--person-away-focus-color, #f5f7fb); }
      [hidden] { display: none !important; }
      .avatar { width: 44px; height: 44px; flex: 0 0 44px; display: grid; place-items: center; overflow: hidden; border-radius: 50%; background: var(--secondary-background-color, #3d4a66); color: var(--secondary-text-color, #aebbd0); }
      .avatar-image { width: 100%; height: 100%; display: block; border-radius: inherit; object-fit: cover; }
      .card[data-presence="away"] .avatar { background: var(--person-away-avatar-background, #4a6382) !important; background-color: var(--person-away-avatar-background, #4a6382) !important; color: var(--person-away-color, #f5f7fb) !important; border: 1px solid var(--person-away-avatar-border-color, rgba(255,255,255,.42)); }
      .card[data-presence="away"] .avatar-image { filter: grayscale(1) contrast(1.05); }
      .fallback ha-icon { --mdc-icon-size: 22px; }
      .copy { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; gap: 3px; overflow: hidden; }
      .header { min-width: 0; display: flex; align-items: center; gap: 6px; }
      .name { display: block; min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(13px, 2.2vw, 16px); font-weight: 750; }
      .status { min-width: 0; max-width: 66%; flex: 0 1 auto; display: inline-flex; align-items: center; gap: 3px; min-height: 20px; padding: 1px 7px; border-radius: 999px; background: var(--hollow-person-status-background,var(--secondary-background-color, #2b3850)); color: var(--secondary-text-color, #91a2bb); font-size: clamp(10px, 1.8vw, 12px); font-weight: 650; line-height: 1.2; }
      .status ha-icon { flex: 0 0 auto; --mdc-icon-size: 13px; }
      .status > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .details { min-width: 0; display: flex; align-items: center; gap: 6px; color: var(--secondary-text-color, #91a2bb); font-size: clamp(10px, 1.8vw, 12px); font-weight: 650; line-height: 1.2; }
      .details .status { width: 100%; max-width: 100%; min-height: 0; padding: 0; border-radius: 0; background: transparent; }
      .details .status > span { overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; }
      .card[data-presence="away"] .name, .card[data-presence="away"] .status, .card[data-presence="away"] .status ha-icon, .card[data-presence="away"] .details, .card[data-presence="away"] .detail-item, .card[data-presence="away"] .detail-item ha-icon, .card[data-presence="away"] .fallback, .card[data-presence="away"] .fallback ha-icon { color: var(--person-away-color, #f5f7fb) !important; }
      .card[data-presence="away"] .status { background: transparent; }
      .detail-item { min-width: 0; flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; }
      .detail-item ha-icon { flex: 0 0 auto; --mdc-icon-size: 14px; }
      .detail-item > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .detail-item.unavailable { color: var(--secondary-text-color, #91a2bb); }
      @media (max-width: 360px) {
        .card { min-height: 62px; gap: 8px; padding-inline: 8px; border-radius: 16px; }
        .card.comfortable { padding-block: 8px; }
        .avatar { width: 38px; height: 38px; flex-basis: 38px; }
        .name { font-size: 13px; }
        .status, .details { font-size: 10px; }
      }
    `;
  }
}
if (!customElements.get('hollow-person-card')) {
  customElements.define('hollow-person-card', HomePersonCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'hollow-person-card')) {
  window.customCards.push({ type: 'hollow-person-card', name: 'Hollow Person', description: 'Responsive person presence card with optional battery, Home distance, and comfortable vertical spacing' });
}
