class HomeVacuumCard extends HTMLElement {
  setConfig(config) {
    if (!config || typeof config.entity !== 'string') throw new Error('entity required');
    this._config = {
      ...config,
      name: config.name || 'Roborock',
      status_entity: config.status_entity || '',
      battery_entity: config.battery_entity || '',
      room_entity: config.room_entity || '',
      select_entities: Array.isArray(config.select_entities) ? config.select_entities : [],
      status_sections: Array.isArray(config.status_sections) ? config.status_sections : [],
      map_image_entity: typeof config.map_image_entity === 'string' ? config.map_image_entity : '',
      map_title: typeof config.map_title === 'string' && config.map_title ? config.map_title : 'Roborock map',
    };
    this._openMenu = '';
    this._sectionOpen = { settings: false };
    (Array.isArray(config.collapsed_sections) ? config.collapsed_sections : [])
      .filter(key => typeof key === 'string')
      .forEach(key => { this._sectionOpen[key] = false; });
    this._renderKey = '';
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto' };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    if (this._wired) return;
    this._wired = true;
    this._onClick = this._onClick.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this._onOutsidePointerDown = this._onOutsidePointerDown.bind(this);
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeydown);
    document.addEventListener('pointerdown', this._onOutsidePointerDown);
  }

  disconnectedCallback() {
    if (!this._wired) return;
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('pointerdown', this._onOutsidePointerDown);
    this._wired = false;
  }

  _state(entity) {
    return entity && this._hass && this._hass.states[entity]
      ? this._hass.states[entity]
      : null;
  }

  _value(entity, fallback) {
    const state = this._state(entity);
    return state && !['unknown', 'unavailable'].includes(state.state) ? state.state : fallback;
  }

  _escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  }

  _moreInfo(entity = this._config.entity) {
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: entity },
      bubbles: true,
      composed: true,
    }));
  }

  _call(service) {
    if (!this._hass) return;
    this._hass.callService('vacuum', service, { entity_id: this._config.entity });
  }

  _toggleMenu(entity) {
    this._openMenu = this._openMenu === entity ? '' : entity;
    this._renderKey = '';
    this._render();
    if (this._openMenu) {
      requestAnimationFrame(() => {
        const selected = this.querySelector(`[data-option="${this._openMenu}"][aria-selected="true"]`);
        const first = this.querySelector(`[data-option="${this._openMenu}"]`);
        (selected || first)?.focus();
      });
    }
  }

  _closeMenu(focusTrigger = false) {
    if (!this._openMenu) return;
    const entity = this._openMenu;
    this._openMenu = '';
    this._renderKey = '';
    this._render();
    if (focusTrigger) {
      requestAnimationFrame(() => this.querySelector(`[data-menu-trigger="${entity}"]`)?.focus());
    }
  }

  _sectionIsOpen(key, defaultOpen = true) {
    return Object.prototype.hasOwnProperty.call(this._sectionOpen, key)
      ? this._sectionOpen[key]
      : defaultOpen;
  }

  _toggleSection(key) {
    this._sectionOpen[key] = !this._sectionIsOpen(key);
    this._renderKey = '';
    this._render();
  }

  _selectOption(entity, option) {
    if (!this._hass || !entity || !option) return;
    this._hass.callService('select', 'select_option', { entity_id: entity, option });
    this._closeMenu();
  }

  _onOutsidePointerDown(event) {
    if (this._openMenu && !event.composedPath().includes(this)) this._closeMenu();
  }

  _onClick(event) {
    const control = event.target.closest('[data-control]');
    const trigger = event.target.closest('[data-menu-trigger]');
    const option = event.target.closest('[data-option]');
    const details = event.target.closest('[data-details]');
    const metric = event.target.closest('[data-status-entity]');
    const map = event.target.closest('[data-map-image]');
    const sectionToggle = event.target.closest('[data-section-toggle]');
    if (!control && !trigger && !option && !details && !metric && !map && !sectionToggle) return;
    event.preventDefault();
    event.stopPropagation();
    if (details) {
      this._moreInfo();
      return;
    }
    if (metric) {
      this._moreInfo(metric.dataset.statusEntity);
      return;
    }
    if (map) {
      this._moreInfo(this._config.map_image_entity);
      return;
    }
    if (sectionToggle) {
      this._toggleSection(sectionToggle.dataset.sectionToggle);
      return;
    }
    if (control) {
      this._call(control.dataset.control);
      return;
    }
    if (trigger) {
      this._toggleMenu(trigger.dataset.menuTrigger);
      return;
    }
    this._selectOption(option.dataset.option, option.dataset.value);
  }

  _onKeydown(event) {
    const trigger = event.target.closest('[data-menu-trigger]');
    const option = event.target.closest('[data-option]');
    if (trigger && ['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') this._closeMenu(true);
      else this._toggleMenu(trigger.dataset.menuTrigger);
      return;
    }
    if (!option) return;
    const entity = option.dataset.option;
    const options = Array.from(this.querySelectorAll(`[data-option="${entity}"]`));
    const index = options.indexOf(option);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._closeMenu(true);
      return;
    }
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      this._selectOption(entity, option.dataset.value);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    }
  }

  _setting(config) {
    const state = this._state(config.entity);
    const unavailable = !state || ['unknown', 'unavailable'].includes(state.state);
    const label = config.name || state?.attributes?.friendly_name || config.entity;
    const open = this._openMenu === config.entity;
    const options = Array.isArray(state?.attributes?.options) ? state.attributes.options : [];
    const id = config.entity.replace(/[^a-z0-9_-]/gi, '-');
    return `<div class="setting">
      <button class="setting-trigger" type="button" data-menu-trigger="${this._escape(config.entity)}"
        aria-expanded="${open}" aria-controls="menu-${id}" ${unavailable || !options.length ? 'disabled' : ''}>
        <span class="setting-label">${this._escape(label)}</span>
        <span class="setting-value">${this._escape(unavailable ? 'Unavailable' : state.state)}</span>
        <ha-icon icon="mdi:chevron-${open ? 'up' : 'down'}" aria-hidden="true"></ha-icon>
      </button>
      ${open ? `<div class="menu" id="menu-${id}" role="listbox" aria-label="${this._escape(label)}">
        ${options.map(value => `<button type="button" role="option" data-option="${this._escape(config.entity)}"
          data-value="${this._escape(value)}" aria-selected="${value === state.state}">${this._escape(value)}</button>`).join('')}
      </div>` : ''}
    </div>`;
  }

  _metricValue(config) {
    const state = this._state(config.entity);
    if (!state || ['unknown', 'unavailable'].includes(state.state)) return 'Unavailable';
    const mapped = config.state_map && typeof config.state_map === 'object'
      ? config.state_map[state.state]
      : null;
    if (typeof mapped === 'string') return mapped;
    if (config.format === 'duration-minutes') {
      const seconds = Number(state.state);
      return Number.isFinite(seconds) ? `${Math.round(seconds / 60)} min` : 'Unavailable';
    }
    if (config.format === 'date-time') {
      const date = new Date(state.state);
      return Number.isFinite(date.getTime())
        ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Unavailable';
    }
    const suffix = typeof config.suffix === 'string' ? config.suffix : '';
    return `${state.state}${suffix}`;
  }

  _sectionHeader(key, label, defaultOpen = true) {
    const open = this._sectionIsOpen(key, defaultOpen);
    return `<button class="section-toggle" type="button" data-section-toggle="${this._escape(key)}" aria-expanded="${open}">
      <span>${this._escape(label)}</span>
      <ha-icon icon="mdi:chevron-${open ? 'up' : 'down'}" aria-hidden="true"></ha-icon>
    </button>`;
  }

  _statusSection(section, index) {
    const metrics = Array.isArray(section.entities) ? section.entities : [];
    if (!metrics.length) return '';
    const title = typeof section.title === 'string' && section.title ? section.title : 'Status';
    const key = `status-${index}`;
    const open = this._sectionIsOpen(key);
    return `<div class="status-section">
      ${this._sectionHeader(key, title)}
      ${open ? `<div class="status-grid">
        ${metrics.map(metric => {
          const state = this._state(metric.entity)?.state;
          const alert = Array.isArray(metric.alert_states) && metric.alert_states.includes(state);
          return `<button class="status-metric${alert ? ' is-alert' : ''}" type="button"
            data-status-entity="${this._escape(metric.entity)}"
            aria-label="Show details for ${this._escape(metric.label || metric.entity)}">
            <ha-icon icon="${this._escape(metric.icon || 'mdi:information-outline')}"></ha-icon>
            <span>${this._escape(metric.label || metric.entity)}</span>
            <strong>${this._escape(this._metricValue(metric))}</strong>
          </button>`;
        }).join('')}
      </div>` : ''}
    </div>`;
  }

  _mapSection() {
    const entity = this._config.map_image_entity;
    if (!entity) return '';
    const picture = this._state(entity)?.attributes?.entity_picture || '';
    const open = this._sectionIsOpen('map');
    return `<div class="map-section">
      ${this._sectionHeader('map', this._config.map_title)}
      ${open ? `<button class="map-preview" type="button" data-map-image aria-label="Show ${this._escape(this._config.map_title)} details">
        ${picture
          ? `<img src="${this._escape(picture)}" alt="Live Roborock floor map">`
          : `<span class="map-unavailable"><ha-icon icon="mdi:map-marker-off-outline"></ha-icon>Map unavailable</span>`}
      </button>` : ''}
    </div>`;
  }

  _settingsSection() {
    const entities = this._config.select_entities;
    if (!entities.length) return '';
    const open = this._sectionIsOpen('settings', false);
    return `<div class="settings">
      ${this._sectionHeader('settings', 'Cleaning settings', false)}
      ${open ? `<div class="settings-content">${entities.map(item => this._setting(item)).join('')}</div>` : ''}
    </div>`;
  }

  _render() {
    if (!this._hass || !this._config) return;
    const c = this._config;
    const vacuum = this._state(c.entity);
    const vacuumState = vacuum?.state || 'unavailable';
    const status = this._value(c.status_entity, vacuumState);
    const battery = this._value(c.battery_entity, '--');
    const room = this._value(c.room_entity, 'Unavailable');
    const signature = JSON.stringify([
      vacuumState, status, battery, room, this._openMenu, this._sectionOpen,
      c.select_entities.map(item => [item.entity, this._value(item.entity, 'Unavailable')]),
      c.status_sections.map(section => (section.entities || []).map(item => [item.entity, this._value(item.entity, 'Unavailable')])),
      this._state(c.map_image_entity)?.attributes?.entity_picture || '',
    ]);
    if (signature === this._renderKey) return;
    this._renderKey = signature;
    const cleaning = ['cleaning', 'paused', 'returning'].includes(vacuumState);
    const stateLabel = vacuumState === 'docked' ? 'Docked' : vacuumState === 'cleaning' ? 'Cleaning'
      : vacuumState === 'paused' ? 'Paused' : vacuumState === 'returning' ? 'Returning' : vacuumState;
    this.innerHTML = `<style>${this._css()}${this._statusCss()}${this._mapCss()}${this._settingsCss()}</style>
      <ha-card class="vacuum-card">
        <div class="hero">
          <button class="summary" type="button" data-details aria-label="Show Roborock details">
            <span class="vacuum-icon ${cleaning ? 'active' : ''}"><ha-icon icon="mdi:robot-vacuum"></ha-icon></span>
            <span class="copy"><strong>${this._escape(c.name)}</strong><span>${this._escape(stateLabel)} &middot; ${this._escape(status)}</span></span>
          </button>
          <span class="battery"><ha-icon icon="mdi:battery"></ha-icon>${this._escape(battery)}%</span>
        </div>
        <div class="room"><ha-icon icon="mdi:map-marker-outline"></ha-icon><span>Current room</span><strong>${this._escape(room)}</strong></div>
        <div class="controls" role="group" aria-label="Roborock controls">
          <button type="button" data-control="start"><ha-icon icon="mdi:play"></ha-icon><span>Clean</span></button>
          <button type="button" data-control="pause"><ha-icon icon="mdi:pause"></ha-icon><span>Pause</span></button>
          <button type="button" data-control="return_to_base"><ha-icon icon="mdi:home-map-marker"></ha-icon><span>Dock</span></button>
          <button type="button" data-control="locate"><ha-icon icon="mdi:crosshairs-gps"></ha-icon><span>Locate</span></button>
        </div>
        ${this._mapSection()}
        ${c.status_sections.map((section, index) => this._statusSection(section, index)).join('')}
        ${this._settingsSection()}
      </ha-card>`;
  }

  _css() {
    return `
      :host{display:block;min-width:0;width:100%;font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;--bg:var(--home-dark-card-background,#212c42);--page:var(--home-dark-page-background,#1a2433);--text:var(--home-dark-primary-text,#f5f7fb);--secondary:var(--home-dark-secondary-text,#91a2bb);--muted:var(--home-dark-muted-text,#66758f);--accent:var(--home-dark-accent,#ffb340);--control:var(--home-dark-control-background,#2b3850)}
      .vacuum-card{box-sizing:border-box;overflow:visible;padding:16px;background:var(--bg);color:var(--text);border:1px solid rgba(255,255,255,.1);border-radius:var(--ha-card-border-radius,20px);box-shadow:0 4px 14px rgba(0,0,0,.16)}
      .hero{display:flex;align-items:center;justify-content:space-between;gap:12px}.summary{display:flex;align-items:center;gap:11px;min-width:0;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.summary:focus-visible,.controls button:focus-visible,.setting-trigger:focus-visible,.menu button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.vacuum-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:14px;background:var(--control);color:var(--accent)}.vacuum-icon ha-icon{--mdc-icon-size:26px}.vacuum-icon.active{animation:vacuum-pulse 1.8s ease-in-out infinite}.copy{display:grid;min-width:0;gap:3px}.copy strong{overflow:hidden;font-size:16px;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.copy span{overflow:hidden;color:var(--secondary);font-size:11.5px;text-overflow:ellipsis;white-space:nowrap}.battery{display:flex;align-items:center;gap:4px;flex:none;color:var(--accent);font-size:13px;font-weight:800}.battery ha-icon{--mdc-icon-size:19px}.room{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;margin-top:14px;padding:10px 11px;border-radius:12px;background:rgba(43,56,80,.58);font-size:11px}.room ha-icon{color:var(--secondary);--mdc-icon-size:18px}.room span{color:var(--secondary);font-weight:700}.room strong{min-width:0;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px}.controls button{display:grid;place-items:center;gap:4px;min-width:0;min-height:54px;padding:7px 4px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:var(--control);color:var(--text);font:inherit;font-size:10px;font-weight:750;cursor:pointer}.controls button:active{transform:scale(.96)}.controls ha-icon{color:var(--accent);--mdc-icon-size:20px}.settings{display:grid;gap:7px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.09)}.section-label{color:var(--secondary);font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.setting{position:relative}.setting-trigger{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:9px;width:100%;min-height:42px;padding:9px 10px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}.setting-trigger:disabled{cursor:not-allowed;opacity:.65}.setting-label{overflow:hidden;color:var(--secondary);font-size:12px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.setting-value{max-width:42vw;overflow:hidden;color:var(--text);font-size:12px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.setting-trigger ha-icon{color:var(--secondary);--mdc-icon-size:18px}.menu{display:grid;position:relative;z-index:2;max-height:min(220px,36vh);margin-top:5px;overflow-y:auto;overscroll-behavior:contain;padding:4px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:var(--control);box-shadow:0 12px 28px rgba(0,0,0,.35)}.menu button{min-height:38px;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:var(--text);font:inherit;font-size:12px;font-weight:650;text-align:left;cursor:pointer}.menu button[aria-selected="true"]{color:var(--accent);background:rgba(255,255,255,.1)}.menu button:hover{background:rgba(255,255,255,.1)}@keyframes vacuum-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}@media (prefers-reduced-motion:reduce){.vacuum-icon.active{animation:none}}@media (max-width:360px){.vacuum-card{padding:14px}.controls{gap:5px}.controls button{font-size:9px}.setting-value{max-width:36vw}}`;
  }

  _statusCss() {
    return `
      .status-section{display:grid;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.09)}
      .status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .status-metric{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"icon label" "icon value";align-items:center;column-gap:8px;row-gap:3px;min-width:0;min-height:57px;padding:9px 10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:var(--control);color:var(--text);font:inherit;text-align:left;cursor:pointer}
      .status-metric:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      .status-metric ha-icon{grid-area:icon;color:var(--accent);--mdc-icon-size:20px}
      .status-metric span{grid-area:label;min-width:0;overflow:hidden;color:var(--secondary);font-size:10px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
      .status-metric strong{grid-area:value;min-width:0;overflow:hidden;color:var(--text);font-size:13px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}
      .status-metric.is-alert{border-color:rgba(240,76,86,.62);background:rgba(240,76,86,.14)}
      .status-metric.is-alert ha-icon,.status-metric.is-alert strong{color:#f04c56}
    `;
  }

  _mapCss() {
    return `
      .map-section{display:grid;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.09)}
      .map-preview{display:grid;place-items:center;overflow:hidden;width:100%;min-height:190px;padding:0;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:var(--page);cursor:pointer}
      .map-preview:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      .map-preview img{display:block;width:100%;height:auto;max-height:440px;object-fit:contain}
      .map-unavailable{display:flex;align-items:center;gap:8px;color:var(--secondary);font:inherit;font-size:12px;font-weight:700}
      .map-unavailable ha-icon{color:var(--muted);--mdc-icon-size:25px}
    `;
  }

  _settingsCss() {
    return `
      .section-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:40px;padding:4px 0;border:0;background:transparent;color:var(--secondary);font:inherit;font-size:10px;font-weight:800;letter-spacing:.07em;text-align:left;text-transform:uppercase;cursor:pointer}
      .section-toggle ha-icon{color:var(--secondary);--mdc-icon-size:19px}
      .section-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      .settings-content{display:grid;gap:7px}
    `;
  }
}

customElements.define('home-vacuum-card', HomeVacuumCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-vacuum-card',
  name: 'Home Vacuum',
  description: 'Home Dark Roborock control card with actions and cleaning settings',
});
