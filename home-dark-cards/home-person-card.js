class HomePersonCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._wired = false;
    this._lastRenderKey = null;
  }

  setConfig(config) {
    if (!config || typeof config.entity !== 'string' || !config.entity.startsWith('person.')) {
      throw new Error('home-person-card requires a person entity');
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
    this._lastRenderKey = null;
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
    if (this._wired) return;
    this._wired = true;
    this.shadowRoot.addEventListener('click', (event) => {
      if (event.target.closest('button')) {
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          detail: { entityId: this._config.entity }, bubbles: true, composed: true
        }));
      }
    });
  }

  _state(entity) {
    return entity && this._hass && this._hass.states[entity] ? this._hass.states[entity] : null;
  }

  _attr(entity, key, fallback = null) {
    const state = this._state(entity);
    return state && state.attributes[key] != null ? state.attributes[key] : fallback;
  }

  _text(value) {
    return String(value == null ? '' : value).replace(/[&<>\"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
    }[char]));
  }

  _location(state) {
    const normalized = typeof state === 'string' ? state.trim().toLowerCase() : '';
    if (!normalized || normalized === 'unknown' || normalized === 'unavailable') return 'Location unavailable';
    if (normalized === 'home') return 'Home';
    if (normalized === 'not_home' || normalized === 'away') return 'Away';
    return state;
  }

  _presence(state) {
    return state === 'home' ? 'home' : 'away';
  }

  _zoneForState(state) {
    const normalized = typeof state === 'string' ? state.trim().toLowerCase() : '';
    if (!normalized || normalized === 'not_home' || normalized === 'away' || normalized === 'unknown' || normalized === 'unavailable') return null;
    return Object.entries(this._hass?.states || {}).find(([entityId, zone]) =>
      (normalized === 'home' && entityId === 'zone.home') ||
      (entityId.startsWith('zone.') &&
      typeof zone.attributes?.friendly_name === 'string' &&
      zone.attributes.friendly_name.trim().toLowerCase() === normalized)
    )?.[1] || null;
  }

  _zoneAtCoordinates(personState) {
    const matches = Object.entries(this._hass?.states || {}).map(([entityId, zone]) => {
      const radius = Number(zone.attributes?.radius);
      const distance = entityId.startsWith('zone.') && Number.isFinite(radius) && radius >= 0
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
    if (!Number.isFinite(value) || value < 0 || value > 100) return null;
    const percent = `${Math.round(value)}%`;
    return { percent, ariaLabel: `Battery ${percent}` };
  }

  _render() {
    if (!this._hass || !this._config) return;
    const person = this._state(this._config.entity);
    if (!person) return;
    const name = this._config.name || this._attr(this._config.entity, 'friendly_name', 'Person');
    const picture = this._attr(this._config.entity, 'entity_picture', '');
    const state = person.state;
    const resolvedZone = this._zoneForState(state) || this._zoneAtCoordinates(person);
    const knownLocation = resolvedZone || (typeof state === 'string' && state.trim().toLowerCase() === 'home');
    const locationName = resolvedZone?.attributes?.friendly_name || this._location(state);
    const location = this._config.show_location ? locationName : '';
    const battery = this._battery();
    const outsideKnownZone = !knownLocation;
    const distance = this._config.show_proximity && outsideKnownZone ? this._distanceKm(person, this._state('zone.home')) : null;
    const proximity = distance == null ? null : `${distance.toFixed(1)} km from Home`;
    const presence = this._presence(state);
    const active = presence === 'home';
    const away = presence === 'away';
    const presenceClass = active ? 'active' : away ? 'away' : '';
    const spacingClass = this._config.comfortable_spacing ? 'comfortable' : 'compact';
    const renderKey = JSON.stringify([name, picture, state, location, battery?.percent || '', proximity || '', active, away, spacingClass, this._config.show_name, this._config.icon]);
    if (renderKey === this._lastRenderKey) return;
    this._lastRenderKey = renderKey;
    const status = proximity || location;
    const statusIcon = proximity ? 'mdi:map-marker-distance' : 'mdi:map-marker';
    const ariaDetails = [status, battery ? battery.ariaLabel : ''].filter(Boolean);
    const avatar = this._config.icon
      ? `<span class="avatar fallback" role="img" aria-label="${this._text(name)} avatar icon"><ha-icon icon="${this._text(this._config.icon)}"></ha-icon></span>`
      : picture
      ? `<img class="avatar" src="${this._text(picture)}" alt="${this._text(name)} avatar">`
      : `<span class="avatar fallback" role="img" aria-label="${this._text(name)} avatar unavailable"><ha-icon icon="mdi:account"></ha-icon></span>`;
    const label = `${name}${ariaDetails.length ? `, ${ariaDetails.join(', ')}` : ''}`;
    const statusItem = status
      ? `<span class="status"><ha-icon icon="${statusIcon}" aria-hidden="true"></ha-icon><span title="${this._text(status)}">${this._text(status)}</span></span>`
      : '';
    const batteryItem = battery
      ? `<span class="detail-item"><ha-icon icon="mdi:battery" title="${this._text(battery.ariaLabel)}" aria-label="${this._text(battery.ariaLabel)}"></ha-icon><span>${this._text(battery.percent)}</span></span>`
      : '';
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><button class="card ${presenceClass}${presenceClass ? ' ' : ''}${spacingClass}" data-presence="${presence}" type="button" aria-label="${this._text(label)}">${avatar}<span class="copy"><span class="header">${this._config.show_name ? `<span class="name">${this._text(name)}</span>` : ''}${batteryItem}</span>${statusItem ? `<span class="details">${statusItem}</span>` : ''}</span></button>`;
  }

  _css() {
    return `
      :host { display: block; min-width: 0; width: 100%; height: 100%; --person-surface:var(--card-background-color,var(--ha-card-background,#212c42)); --person-card-radius:var(--home-person-card-border-radius,20px); color: var(--primary-text-color, #f5f7fb); }
      .card { box-sizing: border-box; width: 100%; height: 100%; min-height: 66px; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--divider-color, rgba(255,255,255,.10)) !important; border-radius: var(--person-card-radius) !important; color: var(--primary-text-color, #f5f7fb); text-align: left; cursor: pointer; background: var(--person-surface) !important; box-shadow:var(--ha-card-box-shadow, 0 4px 14px rgba(0,0,0,.16)) !important; font: inherit; }
      .card.comfortable { padding-block: 9px; }
      .card:focus-visible { outline: 3px solid var(--primary-color, #3d8bfd); outline-offset: 2px; }
      .card.card[data-presence="home"] { background: var(--person-surface) !important; background-color: var(--person-surface) !important; color: var(--primary-text-color, #f5f7fb); }
      .card.card[data-presence="away"] { background: var(--person-away-background, #3d5270) !important; background-color: var(--person-away-background, #3d5270) !important; color: var(--person-away-color, #f5f7fb) !important; border-color: var(--person-away-border-color, rgba(255,255,255,.35)); }
      .card[data-presence="away"]:focus-visible { outline-color: var(--person-away-focus-color, #f5f7fb); }
      .avatar { width: 44px; height: 44px; flex: 0 0 44px; display: grid; place-items: center; border-radius: 50%; object-fit: cover; background: var(--secondary-background-color, #3d4a66); color: var(--secondary-text-color, #aebbd0); }
      .card[data-presence="away"] .avatar { background: var(--person-away-avatar-background, #4a6382) !important; background-color: var(--person-away-avatar-background, #4a6382) !important; color: var(--person-away-color, #f5f7fb) !important; border: 1px solid var(--person-away-avatar-border-color, rgba(255,255,255,.42)); }
      .card[data-presence="away"] .avatar:not(.fallback) { filter: grayscale(1) contrast(1.05); }
      .fallback ha-icon { --mdc-icon-size: 22px; }
      .copy { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; gap: 3px; overflow: hidden; }
      .header { min-width: 0; display: flex; align-items: center; gap: 6px; }
      .name { display: block; min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(13px, 2.2vw, 16px); font-weight: 750; }
      .status { min-width: 0; max-width: 66%; flex: 0 1 auto; display: inline-flex; align-items: center; gap: 3px; min-height: 20px; padding: 1px 7px; border-radius: 999px; background: var(--home-person-status-background,var(--secondary-background-color, #2b3850)); color: var(--secondary-text-color, #91a2bb); font-size: clamp(10px, 1.8vw, 12px); font-weight: 650; line-height: 1.2; }
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
customElements.define('home-person-card', HomePersonCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'home-person-card', name: 'Home Person', description: 'Responsive person presence card with optional battery, Home distance, and comfortable vertical spacing' });
