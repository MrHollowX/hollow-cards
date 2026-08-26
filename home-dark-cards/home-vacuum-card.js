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
      icon: typeof config.icon === 'string' && config.icon.trim() ? config.icon.trim() : '',
      icons: config.icons && typeof config.icons === 'object' ? config.icons : {},
    };
    this._openMenu = '';
    this._sectionOpen = { settings: false };
    this._mapViewer = { open: false, scale: 1, x: 0, y: 0, pointers: new Map(), drag: null, pinch: null };
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
    this._onMapPointerDown = this._onMapPointerDown.bind(this);
    this._onMapPointerMove = this._onMapPointerMove.bind(this);
    this._onMapPointerUp = this._onMapPointerUp.bind(this);
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeydown);
    this.addEventListener('pointerdown', this._onMapPointerDown);
    this.addEventListener('pointermove', this._onMapPointerMove);
    this.addEventListener('pointerup', this._onMapPointerUp);
    this.addEventListener('pointercancel', this._onMapPointerUp);
    document.addEventListener('pointerdown', this._onOutsidePointerDown);
  }

  disconnectedCallback() {
    if (!this._wired) return;
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeydown);
    this.removeEventListener('pointerdown', this._onMapPointerDown);
    this.removeEventListener('pointermove', this._onMapPointerMove);
    this.removeEventListener('pointerup', this._onMapPointerUp);
    this.removeEventListener('pointercancel', this._onMapPointerUp);
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

  _icon(key, fallback) {
    const configured = key === 'vacuum'
      ? this._config?.icon || this._config?.icons?.[key]
      : this._config?.icons?.[key];
    return typeof configured === 'string' && configured.trim() ? configured.trim() : fallback;
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

  _openMapViewer() {
    if (!this._state(this._config.map_image_entity)?.attributes?.entity_picture) {
      this._moreInfo(this._config.map_image_entity);
      return;
    }
    this._mapViewer = { open: true, scale: 1, x: 0, y: 0, pointers: new Map(), drag: null, pinch: null };
    this._renderKey = '';
    this._render();
    requestAnimationFrame(() => this.querySelector('[data-map-viewer-close]')?.focus());
  }

  _closeMapViewer() {
    if (!this._mapViewer?.open) return;
    this._mapViewer.open = false;
    this._mapViewer.pointers.clear();
    this._renderKey = '';
    this._render();
    requestAnimationFrame(() => this.querySelector('[data-map-image]')?.focus());
  }

  _resetMapViewer() {
    if (!this._mapViewer?.open) return;
    Object.assign(this._mapViewer, { scale: 1, x: 0, y: 0, drag: null, pinch: null });
    this._applyMapTransform();
  }

  _mapPoints() {
    return Array.from(this._mapViewer?.pointers?.values() || []).slice(0, 2);
  }

  _mapDistance(first, second) {
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  _mapMidpoint(first, second) {
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }

  _constrainMapPosition(x, y, scale = this._mapViewer.scale) {
    const viewport = this.querySelector('[data-map-viewport]');
    const maxX = Math.max(0, ((viewport?.clientWidth || 0) * (scale - 1)) / 2);
    const maxY = Math.max(0, ((viewport?.clientHeight || 0) * (scale - 1)) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  _applyMapTransform() {
    const image = this.querySelector('[data-map-zoom-image]');
    if (!image || !this._mapViewer?.open) return;
    const { scale, x, y } = this._mapViewer;
    image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    const reset = this.querySelector('[data-map-viewer-reset]');
    if (reset) reset.disabled = scale === 1 && x === 0 && y === 0;
  }

  _onMapPointerDown(event) {
    const viewport = event.target.closest('[data-map-viewport]');
    if (!viewport || !this._mapViewer?.open) return;
    event.preventDefault();
    event.stopPropagation();
    viewport.setPointerCapture?.(event.pointerId);
    this._mapViewer.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = this._mapPoints();
    if (points.length === 1) {
      this._mapViewer.drag = { point: points[0], x: this._mapViewer.x, y: this._mapViewer.y };
      this._mapViewer.pinch = null;
    } else if (points.length === 2) {
      const midpoint = this._mapMidpoint(points[0], points[1]);
      this._mapViewer.pinch = {
        distance: this._mapDistance(points[0], points[1]) || 1,
        midpoint,
        scale: this._mapViewer.scale,
        x: this._mapViewer.x,
        y: this._mapViewer.y,
      };
      this._mapViewer.drag = null;
    }
  }

  _onMapPointerMove(event) {
    if (!this._mapViewer?.open || !this._mapViewer.pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    this._mapViewer.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = this._mapPoints();
    if (points.length >= 2 && this._mapViewer.pinch) {
      const midpoint = this._mapMidpoint(points[0], points[1]);
      const scale = Math.max(1, Math.min(4, this._mapViewer.pinch.scale * (this._mapDistance(points[0], points[1]) / this._mapViewer.pinch.distance)));
      const position = this._constrainMapPosition(
        this._mapViewer.pinch.x + midpoint.x - this._mapViewer.pinch.midpoint.x,
        this._mapViewer.pinch.y + midpoint.y - this._mapViewer.pinch.midpoint.y,
        scale,
      );
      Object.assign(this._mapViewer, { scale, ...position });
      this._applyMapTransform();
      return;
    }
    if (points.length === 1 && this._mapViewer.drag) {
      const point = points[0];
      const position = this._constrainMapPosition(
        this._mapViewer.drag.x + point.x - this._mapViewer.drag.point.x,
        this._mapViewer.drag.y + point.y - this._mapViewer.drag.point.y,
      );
      Object.assign(this._mapViewer, position);
      this._applyMapTransform();
    }
  }

  _onMapPointerUp(event) {
    if (!this._mapViewer?.open || !this._mapViewer.pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    const viewport = event.target.closest('[data-map-viewport]');
    viewport?.releasePointerCapture?.(event.pointerId);
    this._mapViewer.pointers.delete(event.pointerId);
    const [point] = this._mapPoints();
    if (point) {
      this._mapViewer.drag = { point, x: this._mapViewer.x, y: this._mapViewer.y };
      this._mapViewer.pinch = null;
    } else {
      this._mapViewer.drag = null;
      this._mapViewer.pinch = null;
    }
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
    const mapViewerClose = event.target.closest('[data-map-viewer-close]');
    const mapViewerReset = event.target.closest('[data-map-viewer-reset]');
    if (!control && !trigger && !option && !details && !metric && !map && !sectionToggle && !mapViewerClose && !mapViewerReset) return;
    event.preventDefault();
    event.stopPropagation();
    if (mapViewerClose) {
      this._closeMapViewer();
      return;
    }
    if (mapViewerReset) {
      this._resetMapViewer();
      return;
    }
    if (details) {
      this._moreInfo();
      return;
    }
    if (metric) {
      this._moreInfo(metric.dataset.statusEntity);
      return;
    }
    if (map) {
      this._openMapViewer();
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
    if (this._mapViewer?.open && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._closeMapViewer();
      return;
    }
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
          : `<span class="map-unavailable"><ha-icon icon="${this._escape(this._icon('map_unavailable', 'mdi:map-marker-off-outline'))}"></ha-icon>Map unavailable</span>`}
      </button>` : ''}
    </div>`;
  }

  _mapViewerMarkup() {
    if (!this._mapViewer?.open) return '';
    const picture = this._state(this._config.map_image_entity)?.attributes?.entity_picture || '';
    if (!picture) return '';
    const { scale, x, y } = this._mapViewer;
    const resetDisabled = scale === 1 && x === 0 && y === 0;
    return `<div class="map-viewer" role="dialog" aria-modal="true" aria-label="${this._escape(this._config.map_title)}">
      <button class="map-viewer-backdrop" type="button" data-map-viewer-close aria-label="Close map viewer"></button>
      <div class="map-viewer-panel">
        <div class="map-viewer-header">
          <strong>${this._escape(this._config.map_title)}</strong>
          <span>Pinch to zoom &middot; Drag to pan</span>
          <div class="map-viewer-actions">
            <button type="button" data-map-viewer-reset ${resetDisabled ? 'disabled' : ''}>Reset</button>
            <button type="button" data-map-viewer-close aria-label="Close map viewer"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
        </div>
        <div class="map-viewport" data-map-viewport>
          <img data-map-zoom-image src="${this._escape(picture)}" alt="Live Roborock floor map"
            style="transform:translate3d(${x}px,${y}px,0) scale(${scale})">
        </div>
      </div>
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
      this._mapViewer?.open,
      c.select_entities.map(item => [item.entity, this._value(item.entity, 'Unavailable')]),
      c.status_sections.map(section => (section.entities || []).map(item => [item.entity, this._value(item.entity, 'Unavailable')])),
      this._state(c.map_image_entity)?.attributes?.entity_picture || '',
    ]);
    if (signature === this._renderKey) return;
    this._renderKey = signature;
    const cleaning = ['cleaning', 'paused', 'returning'].includes(vacuumState);
    const stateLabel = vacuumState === 'docked' ? 'Docked' : vacuumState === 'cleaning' ? 'Cleaning'
      : vacuumState === 'paused' ? 'Paused' : vacuumState === 'returning' ? 'Returning' : vacuumState;
    this.innerHTML = `<style>${this._css()}${this._statusCss()}${this._mapCss()}${this._settingsCss()}${this._mapViewerCss()}</style>
      <ha-card class="vacuum-card">
        <div class="hero">
          <button class="summary" type="button" data-details aria-label="Show Roborock details">
            <span class="vacuum-icon ${cleaning ? 'active' : ''}"><ha-icon icon="${this._escape(this._icon('vacuum', 'mdi:robot-vacuum'))}"></ha-icon></span>
            <span class="copy"><strong>${this._escape(c.name)}</strong><span>${this._escape(stateLabel)} &middot; ${this._escape(status)}</span></span>
          </button>
          <span class="battery"><ha-icon icon="${this._escape(this._icon('battery', 'mdi:battery'))}"></ha-icon>${this._escape(battery)}%</span>
        </div>
        <div class="room"><ha-icon icon="${this._escape(this._icon('room', 'mdi:map-marker-outline'))}"></ha-icon><span>Current room</span><strong>${this._escape(room)}</strong></div>
        <div class="controls" role="group" aria-label="Roborock controls">
          <button type="button" data-control="start"><ha-icon icon="${this._escape(this._icon('clean', 'mdi:play'))}"></ha-icon><span>Clean</span></button>
          <button type="button" data-control="pause"><ha-icon icon="${this._escape(this._icon('pause', 'mdi:pause'))}"></ha-icon><span>Pause</span></button>
          <button type="button" data-control="return_to_base"><ha-icon icon="${this._escape(this._icon('dock', 'mdi:home-map-marker'))}"></ha-icon><span>Dock</span></button>
          <button type="button" data-control="locate"><ha-icon icon="${this._escape(this._icon('locate', 'mdi:crosshairs-gps'))}"></ha-icon><span>Locate</span></button>
        </div>
        ${this._mapSection()}
        ${c.status_sections.map((section, index) => this._statusSection(section, index)).join('')}
        ${this._settingsSection()}
      </ha-card>
      ${this._mapViewerMarkup()}`;
  }

  _css() {
    return `
      home-vacuum-card{display:block;min-width:0;width:100%;font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;--bg:var(--card-background-color,var(--ha-card-background,#212c42));--vacuum-card-radius:var(--home-vacuum-card-border-radius,20px);--page:var(--primary-background-color,#1a2433);--text:var(--primary-text-color,#f5f7fb);--secondary:var(--secondary-text-color,#91a2bb);--muted:var(--disabled-text-color,#66758f);--accent:var(--primary-color,#ffb340);--control:var(--secondary-background-color,#2b3850);--divider:var(--divider-color,rgba(255,255,255,.1))}
      home-vacuum-card > ha-card.vacuum-card{box-sizing:border-box;overflow:visible;padding:16px;background:var(--bg)!important;color:var(--text);border:1px solid var(--divider)!important;border-radius:var(--vacuum-card-radius)!important;box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important}
      .vacuum-card,.controls button,.setting-trigger,.status-metric,.map-preview,.map-viewer-panel,.map-viewer-header,.map-viewer-actions button{border-color:var(--divider)}
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

  _mapViewerCss() {
    return `
      .map-viewer{position:fixed;z-index:10000;inset:0;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));color:var(--text)}
      .map-viewer-backdrop{position:absolute;inset:0;border:0;background:rgba(8,13,22,.82);cursor:default}
      .map-viewer-panel{position:relative;z-index:1;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(100%,920px);height:min(100%,760px);min-height:0;overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:20px;background:var(--bg);box-shadow:0 22px 58px rgba(0,0,0,.58)}
      .map-viewer-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 12px;padding:13px 14px;border-bottom:1px solid rgba(255,255,255,.1)}
      .map-viewer-header strong{min-width:0;overflow:hidden;font-size:15px;text-overflow:ellipsis;white-space:nowrap}
      .map-viewer-header>span{grid-column:1;color:var(--secondary);font-size:11px;font-weight:650}
      .map-viewer-actions{grid-column:2;grid-row:1 / span 2;display:flex;align-items:center;gap:5px}
      .map-viewer-actions button{display:grid;place-items:center;min-width:36px;min-height:36px;padding:6px 9px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:var(--control);color:var(--text);font:inherit;font-size:11px;font-weight:750;cursor:pointer}
      .map-viewer-actions button:disabled{cursor:default;opacity:.5}
      .map-viewer-actions button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .map-viewer-actions ha-icon{--mdc-icon-size:20px}
      .map-viewport{display:grid;place-items:center;min-width:0;min-height:0;overflow:hidden;background:var(--page);touch-action:none;user-select:none;cursor:grab}
      .map-viewport:active{cursor:grabbing}
      .map-viewport img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;transform-origin:center;transition:transform .05s linear;will-change:transform;pointer-events:none}
      @media (max-width:480px){.map-viewer{padding:0}.map-viewer-panel{width:100%;height:100%;border:0;border-radius:0}.map-viewer-header{padding:12px}.map-viewer-header>span{font-size:10px}.map-viewer-actions button{min-height:38px}}
      @media (prefers-reduced-motion:reduce){.map-viewport img{transition:none}}
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
