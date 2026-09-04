const HOME_VACUUM_FEATURE = Object.freeze({
  pause: 4,
  return_to_base: 16,
  locate: 512,
  start: 8192,
});
const HOME_VACUUM_ISOLATED_EVENTS = Object.freeze([
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'lostpointercapture',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'keydown',
  'keyup',
  'input',
  'change',
  'contextmenu',
  'focusin',
  'focusout',
]);

class HomeVacuumCard extends HTMLElement {
  constructor() {
    super();
    this._wired = false;
    this._shellReady = false;
    this._structureKey = '';
    this._structureDirty = true;
    this._deferredStructure = false;
    this._deferredOptionEntities = new Set();
    this._openMenu = '';
    this._sectionOpen = { settings: false };
    this._mapViewer = this._newMapViewerState();
    this._mapOpener = null;

    this._onClick = this._onClick.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this._onOutsidePointerDown = this._onOutsidePointerDown.bind(this);
    this._onMapPointerDown = this._onMapPointerDown.bind(this);
    this._onMapPointerMove = this._onMapPointerMove.bind(this);
    this._onMapPointerUp = this._onMapPointerUp.bind(this);
    this._onMapLostPointerCapture = this._onMapLostPointerCapture.bind(this);
    this._onFocusOut = this._onFocusOut.bind(this);
    this._isolateChildEvent = this._isolateChildEvent.bind(this);
  }

  _newMapViewerState() {
    return { open: false, scale: 1, x: 0, y: 0, pointers: new Map(), drag: null, pinch: null };
  }

  setConfig(config) {
    if (!config || typeof config.entity !== 'string') throw new Error('entity required');
    const selectEntities = Array.isArray(config.select_entities)
      ? config.select_entities
        .filter(item => item && typeof item.entity === 'string' && item.entity.startsWith('select.'))
        .map(item => ({
          entity: item.entity,
          name: typeof item.name === 'string' ? item.name : '',
        }))
      : [];
    const statusSections = Array.isArray(config.status_sections)
      ? config.status_sections
        .filter(section => section && typeof section === 'object')
        .map(section => ({
          ...section,
          entities: Array.isArray(section.entities)
            ? section.entities.filter(item => item && typeof item.entity === 'string')
            : [],
        }))
        .filter(section => section.entities.length)
      : [];
    this._config = {
      ...config,
      name: config.name || 'Roborock',
      status_entity: config.status_entity || '',
      battery_entity: config.battery_entity || '',
      room_entity: config.room_entity || '',
      select_entities: selectEntities,
      status_sections: statusSections,
      map_image_entity: typeof config.map_image_entity === 'string' ? config.map_image_entity : '',
      map_title: typeof config.map_title === 'string' && config.map_title ? config.map_title : 'Roborock map',
      icon: typeof config.icon === 'string' && config.icon.trim() ? config.icon.trim() : '',
      icons: config.icons && typeof config.icons === 'object' ? config.icons : {},
    };
    (Array.isArray(config.collapsed_sections) ? config.collapsed_sections : [])
      .filter(key => typeof key === 'string')
      .forEach(key => { this._sectionOpen[key] = false; });
    this._structureDirty = this._structureSignature() !== this._structureKey;
    this._deferredStructure = this._deferredStructure || this._structureDirty;
    this._render();
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
    HOME_VACUUM_ISOLATED_EVENTS.forEach(type => this.addEventListener(type, this._isolateChildEvent));
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeydown);
    this.addEventListener('pointerdown', this._onMapPointerDown);
    this.addEventListener('pointermove', this._onMapPointerMove);
    this.addEventListener('pointerup', this._onMapPointerUp);
    this.addEventListener('pointercancel', this._onMapPointerUp);
    this.addEventListener('lostpointercapture', this._onMapLostPointerCapture);
    this.addEventListener('focusout', this._onFocusOut);
    document.addEventListener('pointerdown', this._onOutsidePointerDown);
    this._render();
  }

  disconnectedCallback() {
    if (!this._wired) return;
    HOME_VACUUM_ISOLATED_EVENTS.forEach(type => this.removeEventListener(type, this._isolateChildEvent));
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeydown);
    this.removeEventListener('pointerdown', this._onMapPointerDown);
    this.removeEventListener('pointermove', this._onMapPointerMove);
    this.removeEventListener('pointerup', this._onMapPointerUp);
    this.removeEventListener('pointercancel', this._onMapPointerUp);
    this.removeEventListener('lostpointercapture', this._onMapLostPointerCapture);
    this.removeEventListener('focusout', this._onFocusOut);
    document.removeEventListener('pointerdown', this._onOutsidePointerDown);
    this._cleanupMapPointers();
    Object.assign(this._mapViewer, { open: false, scale: 1, x: 0, y: 0, drag: null, pinch: null });
    this._applyMapTransform();
    this._mapOpener = null;
    this._openMenu = '';
    if (this._card) {
      this._card.inert = false;
      this._card.removeAttribute('aria-hidden');
    }
    if (this._mapDialog) {
      this._mapDialog.hidden = true;
      this._mapDialog.setAttribute('aria-hidden', 'true');
    }
    this._wired = false;
  }

  _isolateChildEvent(event) {
    if (event.composedPath().includes(this)) event.stopPropagation();
  }

  _onFocusOut() {
    queueMicrotask(() => {
      if (!this.isConnected || this.contains(this._activeElement())) return;
      this._flushDeferredStructure();
    });
  }

  _activeElement() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }

  _state(entity) {
    return entity && this._hass && this._hass.states[entity]
      ? this._hass.states[entity]
      : null;
  }

  _value(entity, fallback) {
    const state = this._state(entity);
    return this._isAvailable(state) ? state.state : fallback;
  }

  _isAvailable(state) {
    return Boolean(
      state
      && typeof state.state === 'string'
      && state.state.length
      && !['unknown', 'unavailable'].includes(state.state),
    );
  }

  _isVacuumTarget(entity = this._config?.entity) {
    return typeof entity === 'string' && entity.startsWith('vacuum.');
  }

  _vacuumSupports(service, vacuum = this._state(this._config?.entity)) {
    const feature = HOME_VACUUM_FEATURE[service];
    const supported = Number(vacuum?.attributes?.supported_features);
    return this._isVacuumTarget()
      && this._isAvailable(vacuum)
      && Number.isFinite(supported)
      && Boolean(supported & feature);
  }

  _configuredSelect(entity) {
    return this._config?.select_entities?.find(item => item.entity === entity) || null;
  }

  _selectData(entity) {
    const configured = this._configuredSelect(entity);
    const state = configured ? this._state(entity) : null;
    const stateAvailable = Boolean(configured && this._isAvailable(state));
    const options = stateAvailable && Array.isArray(state.attributes?.options)
      ? Array.from(new Set(state.attributes.options.filter(value => typeof value === 'string')))
      : [];
    return {
      configured,
      state,
      options,
      stateAvailable,
      available: stateAvailable && options.length > 0,
    };
  }

  _percentValue(value) {
    if (value == null) return null;
    const normalized = typeof value === 'string' ? value.trim().replace(/%$/, '').trim() : value;
    if (normalized === '') return null;
    const number = Number(normalized);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
  }

  _battery(vacuum) {
    const configured = this._state(this._config?.battery_entity);
    const configuredValue = this._isAvailable(configured) ? this._percentValue(configured.state) : null;
    const vacuumValue = this._isAvailable(vacuum) ? this._percentValue(vacuum.attributes?.battery_level) : null;
    const value = configuredValue ?? vacuumValue;
    return value == null
      ? { text: 'Unavailable', available: false }
      : {
        text: `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
        available: true,
      };
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
    const vacuum = this._state(this._config?.entity);
    if (!this._hass || !this._vacuumSupports(service, vacuum)) return false;
    this._hass.callService('vacuum', service, { entity_id: this._config.entity });
    return true;
  }

  _toggleMenu(entity) {
    if (this._openMenu === entity) {
      this._closeMenu(true);
      return;
    }
    const data = this._selectData(entity);
    if (!data.available) return;
    this._openMenu = entity;
    this._syncOptionStructure(entity, data.options, true);
    this._patchSettings();
    requestAnimationFrame(() => {
      if (!this.isConnected || this._openMenu !== entity) return;
      const options = this._optionButtons(entity);
      (options.find(option => option.getAttribute('aria-selected') === 'true') || options[0])?.focus();
    });
  }

  _closeMenu(focusTrigger = false) {
    if (!this._openMenu) return;
    const entity = this._openMenu;
    const row = this._settingRow(entity);
    const active = this._activeElement();
    const activeInRow = Boolean(row?.contains(active));
    const restoreTrigger = focusTrigger || activeInRow;
    const canForceRebuild = activeInRow && !this._mapViewer?.open && !this._mapViewer?.pointers?.size;
    this._openMenu = '';
    this._patchSettings();
    if (activeInRow) active?.blur?.();
    this._flushDeferredStructure(canForceRebuild);
    if (restoreTrigger) {
      requestAnimationFrame(() => {
        if (!this.isConnected) return;
        const replacementTrigger = this._settingRow(entity)?.querySelector('[data-menu-trigger]');
        if (replacementTrigger && !replacementTrigger.disabled) replacementTrigger.focus({ preventScroll: true });
      });
    }
  }

  _sectionIsOpen(key, defaultOpen = true) {
    return Object.prototype.hasOwnProperty.call(this._sectionOpen, key)
      ? this._sectionOpen[key]
      : defaultOpen;
  }

  _toggleSection(key) {
    const closingSettings = key === 'settings' && this._sectionIsOpen('settings', false);
    const active = this._activeElement();
    const activeInSettings = Boolean(closingSettings && this._settingsSection?.contains(active));
    const restoreSettingsFocus = Boolean(closingSettings && (this._openMenu || activeInSettings));
    const canForceRebuild = activeInSettings && !this._mapViewer?.open && !this._mapViewer?.pointers?.size;
    if (closingSettings) this._openMenu = '';
    this._sectionOpen[key] = !this._sectionIsOpen(key);
    this._patchSectionVisibility();
    if (activeInSettings) active?.blur?.();
    this._flushDeferredStructure(canForceRebuild);
    if (restoreSettingsFocus) {
      requestAnimationFrame(() => {
        if (!this.isConnected) return;
        const replacementToggle = this._settingsSection?.querySelector('[data-section-toggle]');
        replacementToggle?.focus({ preventScroll: true });
      });
    }
  }

  _openMapViewer(opener) {
    if (!this._mapPicture()) {
      if (this._config.map_image_entity) this._moreInfo(this._config.map_image_entity);
      return;
    }
    this._cleanupMapPointers();
    this._mapViewer = { ...this._newMapViewerState(), open: true };
    this._mapOpener = opener instanceof HTMLElement ? opener : null;
    this._patchMapViewer();
    requestAnimationFrame(() => {
      if (this.isConnected && this._mapViewer.open) this._mapDialog?.querySelector('[data-map-viewer-close-button]')?.focus();
    });
  }

  _closeMapViewer({ restoreFocus = true } = {}) {
    if (!this._mapViewer?.open) return;
    const opener = this._mapOpener;
    this._cleanupMapPointers();
    this._mapViewer.open = false;
    Object.assign(this._mapViewer, { scale: 1, x: 0, y: 0, drag: null, pinch: null });
    this._mapOpener = null;
    this._patchMapViewer();
    this._flushDeferredStructure();
    if (restoreFocus && opener?.isConnected) {
      requestAnimationFrame(() => {
        if (this.isConnected && opener.isConnected) opener.focus({ preventScroll: true });
      });
    }
  }

  _resetMapViewer() {
    if (!this._mapViewer?.open) return;
    this._cleanupMapPointers();
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
    const viewport = this._mapViewport || this.querySelector('[data-map-viewport]');
    const maxX = Math.max(0, ((viewport?.clientWidth || 0) * (scale - 1)) / 2);
    const maxY = Math.max(0, ((viewport?.clientHeight || 0) * (scale - 1)) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  _applyMapTransform() {
    const image = this._mapZoomImage || this.querySelector('[data-map-zoom-image]');
    if (!image || !this._mapViewer) return;
    const { scale, x, y } = this._mapViewer;
    image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    const reset = this._mapReset || this.querySelector('[data-map-viewer-reset]');
    if (reset) reset.disabled = scale === 1 && x === 0 && y === 0;
  }

  _onMapPointerDown(event) {
    const viewport = event.target instanceof Element ? event.target.closest('[data-map-viewport]') : null;
    if (!viewport || !this._mapViewer?.open) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!this._mapViewer.pointers.has(event.pointerId) && this._mapViewer.pointers.size >= 2) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      viewport.setPointerCapture?.(event.pointerId);
    } catch (_error) {
      // Pointer capture can fail if the pointer ended before this event was handled.
    }
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
    const viewport = this._mapViewport || (event.target instanceof Element
      ? event.target.closest('[data-map-viewport]')
      : null);
    try {
      if (viewport?.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // Lost capture and disconnect races are safe to ignore.
    }
    this._finishMapPointer(event.pointerId);
  }

  _onMapLostPointerCapture(event) {
    if (!this._mapViewer?.pointers.has(event.pointerId)) return;
    event.stopPropagation();
    this._finishMapPointer(event.pointerId);
  }

  _finishMapPointer(pointerId) {
    if (!this._mapViewer.pointers.has(pointerId)) return;
    this._mapViewer.pointers.delete(pointerId);
    const [point] = this._mapPoints();
    if (point) {
      this._mapViewer.drag = { point, x: this._mapViewer.x, y: this._mapViewer.y };
      this._mapViewer.pinch = null;
    } else {
      this._mapViewer.drag = null;
      this._mapViewer.pinch = null;
      this._flushDeferredStructure();
    }
  }

  _cleanupMapPointers() {
    const viewport = this._mapViewport || this.querySelector?.('[data-map-viewport]');
    for (const pointerId of this._mapViewer?.pointers?.keys?.() || []) {
      try {
        if (viewport?.hasPointerCapture?.(pointerId)) viewport.releasePointerCapture(pointerId);
      } catch (_error) {
        // The browser may already have released capture.
      }
    }
    this._mapViewer?.pointers?.clear?.();
    if (this._mapViewer) {
      this._mapViewer.drag = null;
      this._mapViewer.pinch = null;
    }
  }

  _selectOption(entity, option) {
    const data = this._selectData(entity);
    if (!this._hass || !data.available || typeof option !== 'string' || !data.options.includes(option)) return false;
    this._hass.callService('select', 'select_option', { entity_id: entity, option });
    this._closeMenu();
    return true;
  }

  _onOutsidePointerDown(event) {
    if (this._openMenu && !event.composedPath().includes(this)) this._closeMenu();
  }

  _onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest('[data-control]');
    const trigger = target?.closest('[data-menu-trigger]');
    const option = target?.closest('[data-option]');
    const details = target?.closest('[data-details]');
    const metric = target?.closest('[data-status-entity]');
    const map = target?.closest('[data-map-image]');
    const sectionToggle = target?.closest('[data-section-toggle]');
    const mapViewerClose = target?.closest('[data-map-viewer-close]');
    const mapViewerReset = target?.closest('[data-map-viewer-reset]');
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
      this._openMapViewer(map);
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
    if (this._mapViewer?.open) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this._closeMapViewer();
        return;
      }
      if (event.key === 'Tab') {
        this._trapMapFocus(event);
        return;
      }
    }
    const target = event.target instanceof Element ? event.target : null;
    const trigger = target?.closest('[data-menu-trigger]');
    const option = target?.closest('[data-option]');
    if (trigger && ['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') this._closeMenu(true);
      else this._toggleMenu(trigger.dataset.menuTrigger);
      return;
    }
    if (!option) return;
    const entity = option.dataset.option;
    const options = this._optionButtons(entity);
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

  _mapFocusableElements() {
    if (!this._mapDialog || this._mapDialog.hidden) return [];
    return Array.from(this._mapDialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => element.tabIndex >= 0 && !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  }

  _trapMapFocus(event) {
    const focusable = this._mapFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      this._mapDialog?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this._activeElement();
    if (!this._mapDialog.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  _ensureShell() {
    if (this._shellReady && this._card && this.contains(this._card)) return;
    this.innerHTML = `<style>${this._css()}${this._statusCss()}${this._mapCss()}${this._settingsCss()}${this._mapViewerCss()}</style>
      <ha-card class="vacuum-card">
        <div class="hero">
          <button class="summary" type="button" data-details>
            <span class="vacuum-icon" data-vacuum-icon><ha-icon data-vacuum-icon-glyph></ha-icon></span>
            <span class="copy"><strong data-vacuum-name></strong><span data-vacuum-state></span></span>
          </button>
          <span class="battery" data-battery><ha-icon data-battery-icon></ha-icon><span data-battery-value></span></span>
        </div>
        <div class="room"><ha-icon data-room-icon></ha-icon><span>Current room</span><strong data-room-value></strong></div>
        <div class="controls" role="group">
          <button type="button" data-control="start"><ha-icon></ha-icon><span>Clean</span></button>
          <button type="button" data-control="pause"><ha-icon></ha-icon><span>Pause</span></button>
          <button type="button" data-control="return_to_base"><ha-icon></ha-icon><span>Dock</span></button>
          <button type="button" data-control="locate"><ha-icon></ha-icon><span>Locate</span></button>
        </div>
        <div class="map-section" data-map-section hidden>
          <button class="section-toggle" type="button" data-section-toggle="map">
            <span data-map-section-title></span>
            <ha-icon aria-hidden="true"></ha-icon>
          </button>
          <div data-section-content="map">
            <button class="map-preview" type="button" data-map-image>
              <img data-map-preview-image alt="Live Roborock floor map" hidden>
              <span class="map-unavailable" data-map-preview-unavailable>
                <ha-icon></ha-icon><span>Map unavailable</span>
              </span>
            </button>
          </div>
        </div>
        <div data-status-sections></div>
        <div class="settings" data-settings-section hidden>
          <button class="section-toggle" type="button" data-section-toggle="settings">
            <span>Cleaning settings</span>
            <ha-icon aria-hidden="true"></ha-icon>
          </button>
          <div class="settings-content" data-settings-content></div>
        </div>
      </ha-card>
      <div class="map-viewer" data-map-viewer role="dialog" aria-modal="true" aria-hidden="true" tabindex="-1" hidden>
        <button class="map-viewer-backdrop" type="button" data-map-viewer-close
          aria-label="Close map viewer" tabindex="-1"></button>
        <div class="map-viewer-panel">
          <div class="map-viewer-header">
            <strong data-map-viewer-title></strong>
            <span>Pinch to zoom &middot; Drag to pan</span>
            <div class="map-viewer-actions">
              <button type="button" data-map-viewer-reset>Reset</button>
              <button type="button" data-map-viewer-close data-map-viewer-close-button
                aria-label="Close map viewer"><ha-icon icon="mdi:close"></ha-icon></button>
            </div>
          </div>
          <div class="map-viewport" data-map-viewport>
            <img data-map-zoom-image alt="Live Roborock floor map" hidden>
            <span class="map-unavailable" data-map-viewer-unavailable>
              <ha-icon></ha-icon><span>Map unavailable</span>
            </span>
          </div>
        </div>
      </div>`;
    this._card = this.querySelector('ha-card.vacuum-card');
    this._statusSectionsHost = this.querySelector('[data-status-sections]');
    this._settingsSection = this.querySelector('[data-settings-section]');
    this._settingsContent = this.querySelector('[data-settings-content]');
    this._mapSectionElement = this.querySelector('[data-map-section]');
    this._mapDialog = this.querySelector('[data-map-viewer]');
    this._mapViewport = this.querySelector('[data-map-viewport]');
    this._mapZoomImage = this.querySelector('[data-map-zoom-image]');
    this._mapReset = this.querySelector('[data-map-viewer-reset]');
    this._shellReady = true;
    this._structureKey = '';
    this._structureDirty = true;
  }

  _structureSignature() {
    return JSON.stringify({
      select_entities: this._config?.select_entities || [],
      status_sections: this._config?.status_sections || [],
    });
  }

  _hasProtectedInteraction() {
    if (this._openMenu || this._mapViewer?.open || this._mapViewer?.pointers?.size) return true;
    const active = this._activeElement();
    return Boolean(active && this.contains(active));
  }

  _flushDeferredStructure(force = false) {
    if (!this._shellReady || !this._config) return false;
    let changed = false;
    const nextKey = this._structureSignature();
    if (nextKey !== this._structureKey) this._structureDirty = true;
    if (this._structureDirty) {
      if (!force && this._hasProtectedInteraction()) {
        this._deferredStructure = true;
        return false;
      }
      this._syncStructure(nextKey);
      changed = true;
    }
    for (const entity of Array.from(this._deferredOptionEntities)) {
      const row = this._settingRow(entity);
      if (!force && (this._openMenu === entity || row?.contains(this._activeElement()))) continue;
      changed = this._syncOptionStructure(entity, this._selectData(entity).options, true) || changed;
    }
    this._deferredStructure = this._structureDirty || this._deferredOptionEntities.size > 0;
    if (changed) this._patchState();
    return !this._deferredStructure;
  }

  _syncStructure(nextKey = this._structureSignature()) {
    const c = this._config;
    if (this._openMenu && !c.select_entities.some(item => item.entity === this._openMenu)) this._openMenu = '';
    this._statusSectionsHost.innerHTML = c.status_sections
      .map((section, index) => this._statusSectionShell(section, index))
      .join('');
    this._settingsContent.innerHTML = c.select_entities.map(item => this._settingShell(item)).join('');
    this._renderedStatusSections = c.status_sections;
    this._renderedSelectEntities = c.select_entities;
    this._structureKey = nextKey;
    this._structureDirty = false;
    this._deferredStructure = false;
    this._deferredOptionEntities.clear();
    c.select_entities.forEach(item => this._syncOptionStructure(item.entity, this._selectData(item.entity).options, true));
  }

  _settingShell(config) {
    const id = config.entity.replace(/[^a-z0-9_-]/gi, '-');
    return `<div class="setting" data-setting-entity="${this._escape(config.entity)}">
      <button class="setting-trigger" type="button" data-menu-trigger="${this._escape(config.entity)}"
        aria-expanded="false" aria-controls="menu-${id}">
        <span class="setting-label"></span>
        <span class="setting-value"></span>
        <ha-icon icon="mdi:chevron-down" aria-hidden="true"></ha-icon>
      </button>
      <div class="menu" id="menu-${id}" role="listbox" hidden></div>
    </div>`;
  }

  _settingRow(entity) {
    return Array.from(this._settingsContent?.querySelectorAll('[data-setting-entity]') || [])
      .find(row => row.dataset.settingEntity === entity) || null;
  }

  _optionButtons(entity) {
    const row = this._settingRow(entity);
    return Array.from(row?.querySelectorAll('[data-option]') || []);
  }

  _syncOptionStructure(entity, options, force = false) {
    const row = this._settingRow(entity);
    const menu = row?.querySelector('.menu');
    if (!menu) return false;
    const signature = JSON.stringify(options);
    if (menu.dataset.optionsSignature === signature) {
      this._deferredOptionEntities.delete(entity);
      return true;
    }
    if (!force && (this._openMenu === entity || row.contains(this._activeElement()))) {
      this._deferredOptionEntities.add(entity);
      this._deferredStructure = true;
      return false;
    }
    menu.innerHTML = options.map(value => `<button type="button" role="option"
      data-option="${this._escape(entity)}" data-value="${this._escape(value)}"
      aria-selected="false">${this._escape(value)}</button>`).join('');
    menu.dataset.optionsSignature = signature;
    this._deferredOptionEntities.delete(entity);
    return true;
  }

  _metricValue(config) {
    const state = this._state(config.entity);
    if (!this._isAvailable(state)) return 'Unavailable';
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

  _statusSectionShell(section, index) {
    const metrics = section.entities;
    const title = typeof section.title === 'string' && section.title ? section.title : 'Status';
    const key = `status-${index}`;
    return `<div class="status-section" data-status-section="${index}">
      <button class="section-toggle" type="button" data-section-toggle="${this._escape(key)}">
        <span>${this._escape(title)}</span>
        <ha-icon icon="mdi:chevron-down" aria-hidden="true"></ha-icon>
      </button>
      <div class="status-grid" data-section-content="${this._escape(key)}">
        ${metrics.map((metric, metricIndex) => `<button class="status-metric" type="button"
            data-status-index="${metricIndex}"
            data-status-entity="${this._escape(metric.entity)}"
            aria-label="Show details for ${this._escape(metric.label || metric.entity)}">
            <ha-icon icon="${this._escape(metric.icon || 'mdi:information-outline')}"></ha-icon>
            <span>${this._escape(metric.label || metric.entity)}</span>
            <strong>Unavailable</strong>
          </button>`).join('')}
      </div>
    </div>`;
  }

  _stateLabel(state) {
    const labels = {
      docked: 'Docked',
      cleaning: 'Cleaning',
      paused: 'Paused',
      returning: 'Returning',
      idle: 'Idle',
      error: 'Error',
      unavailable: 'Unavailable',
      unknown: 'Unknown',
    };
    return labels[state] || String(state || 'Unavailable');
  }

  _setIcon(element, icon) {
    if (element && element.getAttribute('icon') !== icon) element.setAttribute('icon', icon);
  }

  _patchHero() {
    const c = this._config;
    const vacuum = this._state(c.entity);
    const vacuumAvailable = this._isVacuumTarget() && this._isAvailable(vacuum);
    const vacuumState = vacuumAvailable ? vacuum.state : 'unavailable';
    const status = this._value(c.status_entity, vacuumState);
    const room = this._value(c.room_entity, 'Unavailable');
    const battery = this._battery(vacuum);
    const stateLabel = this._stateLabel(vacuumState);
    const cleaning = vacuumAvailable && ['cleaning', 'paused', 'returning'].includes(vacuumState);
    const summary = this.querySelector('[data-details]');
    summary?.setAttribute('aria-label', `Show ${c.name} details`);
    const icon = this.querySelector('[data-vacuum-icon]');
    icon?.classList.toggle('active', cleaning);
    this._setIcon(this.querySelector('[data-vacuum-icon-glyph]'), this._icon('vacuum', 'mdi:robot-vacuum'));
    const name = this.querySelector('[data-vacuum-name]');
    if (name) name.textContent = c.name;
    const stateText = this.querySelector('[data-vacuum-state]');
    if (stateText) stateText.textContent = `${stateLabel} · ${status}`;
    const batteryHost = this.querySelector('[data-battery]');
    batteryHost?.classList.toggle('unavailable', !battery.available);
    this._setIcon(this.querySelector('[data-battery-icon]'), this._icon('battery', 'mdi:battery'));
    const batteryValue = this.querySelector('[data-battery-value]');
    if (batteryValue) batteryValue.textContent = battery.text;
    this._setIcon(this.querySelector('[data-room-icon]'), this._icon('room', 'mdi:map-marker-outline'));
    const roomValue = this.querySelector('[data-room-value]');
    if (roomValue) roomValue.textContent = room;
    const controls = this.querySelector('.controls');
    controls?.setAttribute('aria-label', `${c.name} controls`);
  }

  _patchControls() {
    const icons = {
      start: this._icon('clean', 'mdi:play'),
      pause: this._icon('pause', 'mdi:pause'),
      return_to_base: this._icon('dock', 'mdi:home-map-marker'),
      locate: this._icon('locate', 'mdi:crosshairs-gps'),
    };
    this.querySelectorAll('[data-control]').forEach(button => {
      const supported = this._vacuumSupports(button.dataset.control);
      button.disabled = !supported;
      button.setAttribute('aria-disabled', String(!supported));
      this._setIcon(button.querySelector('ha-icon'), icons[button.dataset.control]);
    });
  }

  _mapPicture() {
    const mapState = this._state(this._config.map_image_entity);
    return this._isAvailable(mapState) && typeof mapState.attributes?.entity_picture === 'string'
      ? mapState.attributes.entity_picture
      : '';
  }

  _patchMapSection() {
    const entity = this._config.map_image_entity;
    const section = this._mapSectionElement;
    if (!section) return;
    section.hidden = !entity;
    const open = this._sectionIsOpen('map');
    const toggle = section.querySelector('[data-section-toggle]');
    toggle?.setAttribute('aria-expanded', String(open));
    this._setIcon(toggle?.querySelector('ha-icon'), `mdi:chevron-${open ? 'up' : 'down'}`);
    const title = section.querySelector('[data-map-section-title]');
    if (title) title.textContent = this._config.map_title;
    const content = section.querySelector('[data-section-content]');
    if (content) content.hidden = !open;
    const preview = section.querySelector('[data-map-image]');
    preview?.setAttribute('aria-label', `Show ${this._config.map_title} details`);
    const picture = this._mapPicture();
    const image = section.querySelector('[data-map-preview-image]');
    if (image) {
      if (picture && image.getAttribute('src') !== picture) image.setAttribute('src', picture);
      if (!picture) image.removeAttribute('src');
      image.hidden = !picture;
    }
    const unavailable = section.querySelector('[data-map-preview-unavailable]');
    if (unavailable) unavailable.hidden = Boolean(picture);
    this._setIcon(unavailable?.querySelector('ha-icon'), this._icon('map_unavailable', 'mdi:map-marker-off-outline'));
  }

  _patchMapViewer() {
    if (!this._mapDialog || !this._card) return;
    const open = Boolean(this._mapViewer?.open);
    this._mapDialog.hidden = !open;
    this._mapDialog.setAttribute('aria-hidden', String(!open));
    this._mapDialog.setAttribute('aria-label', this._config.map_title);
    this._card.inert = open;
    if (open) this._card.setAttribute('aria-hidden', 'true');
    else this._card.removeAttribute('aria-hidden');
    const title = this._mapDialog.querySelector('[data-map-viewer-title]');
    if (title) title.textContent = this._config.map_title;
    const picture = this._mapPicture();
    if (this._mapZoomImage) {
      if (picture && this._mapZoomImage.getAttribute('src') !== picture) this._mapZoomImage.setAttribute('src', picture);
      if (!picture) this._mapZoomImage.removeAttribute('src');
      this._mapZoomImage.hidden = !picture;
    }
    const unavailable = this._mapDialog.querySelector('[data-map-viewer-unavailable]');
    if (unavailable) unavailable.hidden = Boolean(picture);
    this._setIcon(unavailable?.querySelector('ha-icon'), this._icon('map_unavailable', 'mdi:map-marker-off-outline'));
    this._applyMapTransform();
  }

  _patchStatusSections() {
    const sections = this._renderedStatusSections || [];
    this._statusSectionsHost?.querySelectorAll('[data-status-section]').forEach(sectionElement => {
      const sectionIndex = Number(sectionElement.dataset.statusSection);
      const section = sections[sectionIndex];
      if (!section) return;
      const key = `status-${sectionIndex}`;
      const open = this._sectionIsOpen(key);
      const toggle = sectionElement.querySelector('[data-section-toggle]');
      toggle?.setAttribute('aria-expanded', String(open));
      this._setIcon(toggle?.querySelector('ha-icon'), `mdi:chevron-${open ? 'up' : 'down'}`);
      const content = sectionElement.querySelector('[data-section-content]');
      if (content) content.hidden = !open;
      sectionElement.querySelectorAll('[data-status-index]').forEach(metricElement => {
        const metric = section.entities[Number(metricElement.dataset.statusIndex)];
        if (!metric) return;
        const state = this._state(metric.entity);
        const alert = this._isAvailable(state)
          && Array.isArray(metric.alert_states)
          && metric.alert_states.includes(state.state);
        metricElement.classList.toggle('is-alert', alert);
        metricElement.dataset.statusEntity = metric.entity;
        const label = metric.label || metric.entity;
        metricElement.setAttribute('aria-label', `Show details for ${label}`);
        this._setIcon(metricElement.querySelector('ha-icon'), metric.icon || 'mdi:information-outline');
        const labelElement = metricElement.querySelector('span');
        if (labelElement) labelElement.textContent = label;
        const valueElement = metricElement.querySelector('strong');
        if (valueElement) valueElement.textContent = this._metricValue(metric);
      });
    });
  }

  _patchSettings() {
    const items = this._renderedSelectEntities || [];
    if (!this._settingsSection || !this._settingsContent) return;
    this._settingsSection.hidden = !items.length;
    const sectionOpen = this._sectionIsOpen('settings', false);
    const sectionToggle = this._settingsSection.querySelector('[data-section-toggle]');
    sectionToggle?.setAttribute('aria-expanded', String(sectionOpen));
    this._setIcon(sectionToggle?.querySelector('ha-icon'), `mdi:chevron-${sectionOpen ? 'up' : 'down'}`);
    this._settingsContent.hidden = !sectionOpen;
    items.forEach(item => {
      const row = this._settingRow(item.entity);
      if (!row) return;
      const data = this._selectData(item.entity);
      this._syncOptionStructure(item.entity, data.options);
      const label = item.name || data.state?.attributes?.friendly_name || item.entity;
      const trigger = row.querySelector('[data-menu-trigger]');
      const menu = row.querySelector('.menu');
      if (!trigger || !menu) return;
      const open = this._openMenu === item.entity;
      trigger.disabled = !data.available;
      trigger.setAttribute('aria-expanded', String(open));
      trigger.setAttribute('aria-disabled', String(!data.available));
      const labelElement = row.querySelector('.setting-label');
      if (labelElement) labelElement.textContent = label;
      const valueElement = row.querySelector('.setting-value');
      if (valueElement) valueElement.textContent = data.stateAvailable ? data.state.state : 'Unavailable';
      this._setIcon(trigger.querySelector('ha-icon'), `mdi:chevron-${open ? 'up' : 'down'}`);
      menu.hidden = !open;
      menu.setAttribute('aria-label', label);
      this._optionButtons(item.entity).forEach(option => {
        const valid = data.available && data.options.includes(option.dataset.value);
        option.setAttribute('aria-disabled', String(!valid));
        option.setAttribute('aria-selected', String(valid && option.dataset.value === data.state.state));
      });
    });
  }

  _patchSectionVisibility() {
    if (!this._shellReady) return;
    this._patchMapSection();
    this._patchStatusSections();
    this._patchSettings();
  }

  _patchState() {
    if (!this._shellReady || !this._hass || !this._config) return;
    this._patchHero();
    this._patchControls();
    this._patchSectionVisibility();
    this._patchMapViewer();
  }

  _render() {
    if (!this._hass || !this._config) return;
    this._ensureShell();
    if (this._structureSignature() !== this._structureKey) {
      this._structureDirty = true;
      this._deferredStructure = true;
    }
    this._flushDeferredStructure();
    this._patchState();
  }

  _css() {
    return `
      home-vacuum-card{display:block;min-width:0;width:100%;font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;--bg:var(--card-background-color,var(--ha-card-background,#212c42));--vacuum-card-radius:var(--home-vacuum-card-border-radius,20px);--page:var(--primary-background-color,#1a2433);--text:var(--primary-text-color,#f5f7fb);--secondary:var(--secondary-text-color,#91a2bb);--muted:var(--disabled-text-color,#66758f);--accent:var(--primary-color,#ffb340);--control:var(--secondary-background-color,#2b3850);--divider:var(--divider-color,rgba(255,255,255,.1))}
      home-vacuum-card [hidden]{display:none!important}
      home-vacuum-card > ha-card.vacuum-card{box-sizing:border-box;overflow:visible;padding:16px;background:var(--bg)!important;color:var(--text);border:1px solid var(--divider)!important;border-radius:var(--vacuum-card-radius)!important;box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important}
      .vacuum-card,.controls button,.setting-trigger,.status-metric,.map-preview,.map-viewer-panel,.map-viewer-header,.map-viewer-actions button{border-color:var(--divider)}
      .hero{display:flex;align-items:center;justify-content:space-between;gap:12px}.summary{display:flex;align-items:center;gap:11px;min-width:0;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.summary:focus-visible,.controls button:focus-visible,.setting-trigger:focus-visible,.menu button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.vacuum-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:14px;background:var(--control);color:var(--accent)}.vacuum-icon ha-icon{--mdc-icon-size:26px}.vacuum-icon.active{animation:vacuum-pulse 1.8s ease-in-out infinite}.copy{display:grid;min-width:0;gap:3px}.copy strong{overflow:hidden;font-size:16px;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.copy span{overflow:hidden;color:var(--secondary);font-size:11.5px;text-overflow:ellipsis;white-space:nowrap}.battery{display:flex;align-items:center;gap:4px;flex:none;color:var(--accent);font-size:13px;font-weight:800}.battery.unavailable{color:var(--secondary);font-size:11px;font-weight:700}.battery ha-icon{--mdc-icon-size:19px}.room{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;margin-top:14px;padding:10px 11px;border-radius:12px;background:rgba(43,56,80,.58);font-size:11px}.room ha-icon{color:var(--secondary);--mdc-icon-size:18px}.room span{color:var(--secondary);font-weight:700}.room strong{min-width:0;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px}.controls button{display:grid;place-items:center;gap:4px;min-width:0;min-height:54px;padding:7px 4px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:var(--control);color:var(--text);font:inherit;font-size:10px;font-weight:750;cursor:pointer}.controls button:active:not(:disabled){transform:scale(.96)}.controls button:disabled{cursor:not-allowed;opacity:.48}.controls ha-icon{color:var(--accent);--mdc-icon-size:20px}.controls button:disabled ha-icon{color:var(--muted)}.settings{display:grid;gap:7px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.09)}.section-label{color:var(--secondary);font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.setting{position:relative}.setting-trigger{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:9px;width:100%;min-height:42px;padding:9px 10px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}.setting-trigger:disabled{cursor:not-allowed;opacity:.65}.setting-label{overflow:hidden;color:var(--secondary);font-size:12px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.setting-value{max-width:42vw;overflow:hidden;color:var(--text);font-size:12px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.setting-trigger ha-icon{color:var(--secondary);--mdc-icon-size:18px}.menu{display:grid;position:relative;z-index:2;max-height:min(220px,36vh);margin-top:5px;overflow-y:auto;overscroll-behavior:contain;padding:4px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:var(--control);box-shadow:0 12px 28px rgba(0,0,0,.35)}.menu button{min-height:38px;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:var(--text);font:inherit;font-size:12px;font-weight:650;text-align:left;cursor:pointer}.menu button[aria-selected="true"]{color:var(--accent);background:rgba(255,255,255,.1)}.menu button[aria-disabled="true"]{color:var(--muted);cursor:not-allowed}.menu button:hover{background:rgba(255,255,255,.1)}@keyframes vacuum-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}@media (prefers-reduced-motion:reduce){.vacuum-icon.active{animation:none}}@media (max-width:360px){.vacuum-card{padding:14px}.controls{gap:5px}.controls button{font-size:9px}.setting-value{max-width:36vw}}`;
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

if (!customElements.get('home-vacuum-card')) {
  customElements.define('home-vacuum-card', HomeVacuumCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'home-vacuum-card')) {
  window.customCards.push({
    type: 'home-vacuum-card',
    name: 'Home Vacuum',
    description: 'Home Dark Roborock control card with actions and cleaning settings',
  });
}
