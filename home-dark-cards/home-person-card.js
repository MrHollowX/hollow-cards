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
    const location = this._config.show_location ? this._location(state) : '';
    const battery = this._battery();
    const distance = this._config.show_proximity ? this._distanceKm(person, this._state('zone.home')) : null;
    const proximity = distance == null ? null : `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} km from Home`;
    const presence = this._presence(state);
    const active = presence === 'home';
    const away = presence === 'away';
    const presenceClass = active ? 'active' : away ? 'away' : '';
    const spacingClass = this._config.comfortable_spacing ? 'comfortable' : 'compact';
    const renderKey = JSON.stringify([name, picture, state, location, battery?.percent || '', proximity || '', active, away, spacingClass, this._config.show_name]);
    if (renderKey === this._lastRenderKey) return;
    this._lastRenderKey = renderKey;
    const ariaDetails = [location, battery ? battery.ariaLabel : '', proximity].filter(Boolean);
    const avatar = picture
      ? `<img class="avatar" src="${this._text(picture)}" alt="${this._text(name)} avatar">`
      : `<span class="avatar fallback" role="img" aria-label="${this._text(name)} avatar unavailable"><ha-icon icon="mdi:account"></ha-icon></span>`;
    const label = `${name}${ariaDetails.length ? `, ${ariaDetails.join(', ')}` : ''}`;
    const detailItems = [
      location ? `<span class="detail-item"><ha-icon icon="mdi:map-marker" title="Location" aria-label="Location"></ha-icon><span>${this._text(location)}</span></span>` : '',
      battery ? `<span class="detail-item"><ha-icon icon="mdi:battery" title="${this._text(battery.ariaLabel)}" aria-label="${this._text(battery.ariaLabel)}"></ha-icon><span>${this._text(battery.percent)}</span></span>` : '',
      proximity ? `<span class="detail-item"><ha-icon icon="mdi:map-marker-distance" title="Proximity" aria-label="Proximity"></ha-icon><span>${this._text(proximity)}</span></span>` : ''
    ].filter(Boolean).join('');
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><button class="card ${presenceClass}${presenceClass ? ' ' : ''}${spacingClass}" data-presence="${presence}" type="button" aria-label="${this._text(label)}">${avatar}<span class="copy">${this._config.show_name ? `<span class="name">${this._text(name)}</span>` : ''}${detailItems ? `<span class="details">${detailItems}</span>` : ''}</span></button>`;
  }

  _css() {
    return `
      :host { display: block; min-width: 0; width: 100%; height: 100%; color: var(--primary-text-color, #f5f7fb); }
      .card { box-sizing: border-box; width: 100%; height: 100%; min-height: 76px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--divider-color, rgba(255,255,255,.10)); border-radius: 16px; color: var(--primary-text-color, #f5f7fb); text-align: left; cursor: pointer; background: #212c42; box-shadow: 0 4px 14px rgba(0,0,0,.16); font: inherit; }
      .card.comfortable { padding-block: 8px; }
      .card:focus-visible { outline: 3px solid var(--primary-color, #3d8bfd); outline-offset: 2px; }
      .card.card[data-presence="home"] { background: #212c42 !important; background-color: #212c42 !important; color: var(--primary-text-color, #f5f7fb); }
      .card.card[data-presence="away"] { background: var(--person-away-background, #3d5270) !important; background-color: var(--person-away-background, #3d5270) !important; color: var(--person-away-color, #f5f7fb) !important; border-color: var(--person-away-border-color, rgba(255,255,255,.35)); }
      .card[data-presence="away"]:focus-visible { outline-color: var(--person-away-focus-color, #f5f7fb); }
      .avatar { width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center; border-radius: 50%; object-fit: cover; background: var(--secondary-background-color, #3d4a66); color: var(--secondary-text-color, #aebbd0); }
      .card[data-presence="away"] .avatar { background: var(--person-away-avatar-background, #4a6382) !important; background-color: var(--person-away-avatar-background, #4a6382) !important; color: var(--person-away-color, #f5f7fb) !important; border: 1px solid var(--person-away-avatar-border-color, rgba(255,255,255,.42)); }
      .card[data-presence="away"] .avatar:not(.fallback) { filter: grayscale(1) contrast(1.05); }
      .fallback ha-icon { --mdc-icon-size: 22px; }
      .copy { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
      .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(13px, 2.2vw, 16px); font-weight: 750; }
      .details { min-width: 0; max-width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; color: var(--secondary-text-color, #9fb0c8); font-size: clamp(10px, 1.8vw, 12px); line-height: 1.25; }
      .card[data-presence="away"] .name, .card[data-presence="away"] .details, .card[data-presence="away"] .detail-item, .card[data-presence="away"] .detail-item ha-icon, .card[data-presence="away"] .fallback, .card[data-presence="away"] .fallback ha-icon { color: var(--person-away-color, #f5f7fb) !important; }
      .detail-item { min-width: 0; max-width: 100%; display: flex; align-items: center; gap: 4px; }
      .detail-item ha-icon { flex: 0 0 auto; --mdc-icon-size: 14px; }
      .detail-item > span { min-width: 0; overflow-wrap: anywhere; }
      @media (max-width: 360px) {
        .card { gap: 6px; padding: 0 8px; border-radius: 14px; }
        .card.comfortable { padding-block: 6px; }
        .avatar { width: 34px; height: 34px; flex-basis: 34px; }
        .name { font-size: 13px; }
        .details { font-size: 10px; }
      }
    `;
  }
}
customElements.define('home-person-card', HomePersonCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'home-person-card', name: 'Home Person', description: 'Responsive person presence card with optional battery, Home distance, and comfortable vertical spacing' });
