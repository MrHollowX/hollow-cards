class HomeClimateCard extends HTMLElement {
  constructor() {
    super();
    this._onClick = this._onClick.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this._onFocusIn = this._onFocusIn.bind(this);
    this._onFocusOut = this._onFocusOut.bind(this);
    this._onWindowBlur = this._onWindowBlur.bind(this);
    this._onViewportChange = this._onViewportChange.bind(this);
    this._onDocumentPointerDown = this._onDocumentPointerDown.bind(this);
  }

  setConfig(config) {
    if (!config || typeof config.entity !== 'string' || !config.entity.startsWith('climate.')) {
      throw new Error('A climate entity is required');
    }
    if (config.power_switch != null &&
      (typeof config.power_switch !== 'string' || !config.power_switch.startsWith('switch.'))) {
      throw new Error('power_switch must be a switch entity');
    }
    if (this._config && (
      this._config.entity !== config.entity ||
      this._config.power_switch !== config.power_switch
    )) {
      this._clearPending();
      this._clearPowerPreview();
    }
    const additionalSectionKey = JSON.stringify({
      entities: config.additional_entities || [],
      collapsible: config.additional_entities_collapsible !== false,
      collapsed: config.additional_entities_collapsed !== false,
      showTitle: config.show_additional_title !== false,
    });
    const additionalSectionChanged = this._additionalSectionKey !== additionalSectionKey;
    this._config = {
      ...config,
      additional_entities: this._additionalEntities(config.additional_entities),
      show_power_toggle: config.show_power_toggle === true,
      additional_entities_collapsible: config.additional_entities_collapsible !== false,
      additional_entities_collapsed: config.additional_entities_collapsed !== false,
      show_additional_title: config.show_additional_title !== false,
    };
    if (additionalSectionChanged) {
      this._additionalExpanded = !this._config.additional_entities_collapsed;
      this._additionalSectionKey = additionalSectionKey;
    }
    this._lastRenderSignature = null;
  }

  _additionalEntities(value) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error('additional_entities must be an array');
    return value.map((entry, index) => {
      const entity = typeof entry === 'string' ? entry : entry?.entity;
      if (typeof entity !== 'string' || !entity.startsWith('climate.')) {
        throw new Error(`additional_entities[${index}] requires a climate entity`);
      }
      const powerSwitch = typeof entry === 'object' ? entry.power_switch : null;
      if (powerSwitch != null && (typeof powerSwitch !== 'string' || !powerSwitch.startsWith('switch.'))) {
        throw new Error(`additional_entities[${index}].power_switch must be a switch entity`);
      }
      return {
        entity,
        name: typeof entry === 'object' && typeof entry.name === 'string' ? entry.name.trim() : '',
        power_switch: powerSwitch || '',
        show_power_toggle: typeof entry !== 'object' || entry.show_power_toggle !== false,
      };
    });
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto' };
  }

  set hass(hass) {
    this._hass = hass;
    // Only a target-value control can defer a state refresh. A menu trigger
    // remains focused after selection so it can be restored, but it must not
    // hide unrelated authoritative attribute changes such as a new target
    // temperature reported by an HVAC/preset selection.
    if (this._menuFocusTransition || this._hasTargetInteractionFocus()) {
      this._deferredRender = true;
      return;
    }
    this._render();
  }

  connectedCallback() {
    if (this._wired) return;
    this._wired = true;
    if (!this._instanceId) {
      HomeClimateCard._nextId = (HomeClimateCard._nextId || 0) + 1;
      this._instanceId = `hollow-climate-${HomeClimateCard._nextId}`;
    }
    this.addEventListener('pointerdown', this._onPointerDown, true);
    this.addEventListener('click', this._onClick, true);
    this.addEventListener('keydown', this._onKeydown);
    this.addEventListener('focusin', this._onFocusIn);
    this.addEventListener('focusout', this._onFocusOut);
    window.addEventListener('blur', this._onWindowBlur);
    window.addEventListener('resize', this._onViewportChange);
    document.addEventListener('scroll', this._onViewportChange, true);
    document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
    if (this._hass && this._config) this._render(true);
  }

  disconnectedCallback() {
    if (!this._wired) return;
    this._clearPending();
    this._clearPowerPreview();
    this.removeEventListener('pointerdown', this._onPointerDown, true);
    this.removeEventListener('click', this._onClick, true);
    this.removeEventListener('keydown', this._onKeydown);
    this.removeEventListener('focusin', this._onFocusIn);
    this.removeEventListener('focusout', this._onFocusOut);
    window.removeEventListener('blur', this._onWindowBlur);
    window.removeEventListener('resize', this._onViewportChange);
    document.removeEventListener('scroll', this._onViewportChange, true);
    document.removeEventListener('pointerdown', this._onDocumentPointerDown, true);
    this._focusedControl = null;
    this._menuFocusTransition = false;
    this._menuRenderAllowed = false;
    this._openMenu = null;
    this._menuIndex = 0;
    this._deferredRender = false;
    this._queuedFocusMenu = null;
    this._interactionRenderQueued = false;
    this._pointerFocusControl = null;
    this._queuedFocusFlushIdentity = null;
    this._lastRenderSignature = null;
    this._wired = false;
  }

  _state(entity = this._config?.entity) {
    return this._hass && entity ? this._hass.states[entity] || null : null;
  }

  _isUnavailableState(state) {
    return !state || ['unknown', 'unavailable'].includes(String(state.state).toLowerCase());
  }

  _attrs(entity = this._config?.entity) {
    const state = this._state(entity);
    return state && state.attributes ? state.attributes : {};
  }

  _icon() {
    const configured = this._config?.icon;
    if (typeof configured === 'string' && configured.trim()) return configured.trim();
    const entityIcon = this._attrs().icon;
    return typeof entityIcon === 'string' && entityIcon.trim()
      ? entityIcon.trim()
      : 'mdi:thermostat';
  }

  _number(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  _array(value) {
    return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.length > 0) : [];
  }

  _call(service, data, entity = this._config?.entity) {
    if (!this._hass || !entity || this._isUnavailableState(this._state(entity))) return null;
    return this._hass.callService(
      'climate',
      service,
      Object.assign({ entity_id: entity }, data || {}),
    );
  }

  _powerSwitchEntity() {
    return this._config && typeof this._config.power_switch === 'string'
      ? this._config.power_switch
      : null;
  }

  _powerSwitchState() {
    const entity = this._powerSwitchEntity();
    return entity && this._hass ? this._hass.states[entity] : null;
  }

  _nativePowerCapabilities() {
    const supported = Number(this._attrs().supported_features) || 0;
    return {
      turnOn: (supported & 256) !== 0,
      turnOff: (supported & 128) !== 0,
    };
  }

  _powerControl() {
    const switchEntity = this._powerSwitchEntity();
    if (switchEntity) return { type: 'switch', entity: switchEntity };
    const native = this._nativePowerCapabilities();
    return native.turnOn && native.turnOff
      ? { type: 'climate', entity: this._config.entity }
      : null;
  }

  _powerTargetAvailable(control) {
    return Boolean(control && !this._isUnavailableState(this._state(control.entity)));
  }

  _renderAfterInteraction(render) {
    if (!render) return;
    if (this._openMenu || this._menuFocusTransition || this._hasTargetInteractionFocus()) {
      this._deferredRender = true;
      return;
    }
    this._render(true);
  }

  _clearPowerPreview(render) {
    if (this._powerPreviewTimer) clearTimeout(this._powerPreviewTimer);
    this._powerPreviewTimer = null;
    this._powerPreview = null;
    this._renderAfterInteraction(render);
  }

  _powerOn() {
    const control = this._powerControl();
    if (!this._powerTargetAvailable(control)) return false;
    const state = control.type === 'switch' ? this._powerSwitchState() : this._state();
    const preview = this._powerPreview &&
      this._powerPreview.entity === control.entity &&
      this._powerPreview.type === control.type
      ? this._powerPreview
      : null;
    if (preview) {
      const stateOn = control.type === 'switch'
        ? Boolean(state && state.state === 'on')
        : Boolean(state && !this._isUnavailableState(state) && state.state !== 'off');
      const stateAvailable = state && !this._isUnavailableState(state);
      if (stateAvailable && stateOn === preview.on) {
        this._clearPowerPreview();
      } else {
        return preview.on;
      }
    }
    return control.type === 'switch'
      ? Boolean(state && state.state === 'on')
      : Boolean(state && !this._isUnavailableState(state) && state.state !== 'off');
  }

  _togglePower() {
    const control = this._powerControl();
    if (!this._hass || !this._powerTargetAvailable(control)) return null;
    const nextOn = !this._powerOn();
    this._powerPreview = { entity: control.entity, type: control.type, on: nextOn };
    if (this._powerPreviewTimer) clearTimeout(this._powerPreviewTimer);
    this._powerPreviewTimer = setTimeout(() => this._clearPowerPreview(true), 5000);
    let result;
    try {
      result = control.type === 'switch'
        ? this._hass.callService('switch', nextOn ? 'turn_on' : 'turn_off', {
          entity_id: control.entity,
        })
        : this._call(nextOn ? 'turn_on' : 'turn_off');
      if (result && typeof result.catch === 'function') {
        result.catch(() => this._clearPowerPreview(true));
      }
    } catch (error) {
      this._clearPowerPreview(true);
      return null;
    }
    this._queueInteractionRender();
    return result;
  }

  _moreInfo() {
    if (!this._config) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: this._config.entity },
      bubbles: true,
      composed: true,
    }));
  }

  _esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  }

  _label(value) {
    return String(value)
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  _precision(value) {
    const text = String(value);
    if (text.toLowerCase().includes('e-')) {
      const parts = text.toLowerCase().split('e-');
      return Number(parts[1]) || 0;
    }
    const decimal = text.split('.')[1];
    return decimal ? decimal.length : 0;
  }

  _formatNumber(value, precision) {
    if (value == null || !Number.isFinite(Number(value))) return '--';
    const text = Number(value).toFixed(precision);
    return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
  }

  _temperatureUnit() {
    const attrUnit = this._attrs().temperature_unit;
    return attrUnit || (this._hass && this._hass.config && this._hass.config.unit_system
      ? this._hass.config.unit_system.temperature || ''
      : '');
  }

  _formatTemperature(value, precision) {
    const number = this._formatNumber(value, precision);
    return number === '--' ? number : `${number}${this._temperatureUnit() ? ` ${this._esc(this._temperatureUnit())}` : ''}`;
  }

  _roundToStep(value, min, max, step, explicitPrecision) {
    const safeStep = step > 0 ? step : 1;
    const base = min == null ? 0 : min;
    const snapped = base + Math.round((value - base) / safeStep) * safeStep;
    const precision = Math.max(
      explicitPrecision == null ? 0 : this._precision(explicitPrecision),
      this._precision(safeStep),
      min == null ? 0 : this._precision(min),
      max == null ? 0 : this._precision(max),
    );
    const bounded = Math.max(min == null ? -Infinity : min, Math.min(max == null ? Infinity : max, snapped));
    return Number(bounded.toFixed(precision));
  }

  _rangeConfig() {
    const attributes = this._attrs();
    if (this._number(attributes.temperature) != null) return null;
    const supported = Number(attributes.supported_features) || 0;
    const hasRangeAttributes = attributes.target_temp_low != null &&
      attributes.target_temp_high != null;
    if ((supported & 2) === 0 && !hasRangeAttributes) return null;
    const low = this._number(attributes.target_temp_low);
    const high = this._number(attributes.target_temp_high);
    if (low == null || high == null) return null;
    const min = this._number(attributes.min_temp);
    const max = this._number(attributes.max_temp);
    const precision = this._number(attributes.precision) ??
      this._number(attributes.target_temp_precision);
    const step = this._number(attributes.target_temp_step) || precision || 1;
    return { low, high, min, max, step, precision };
  }

  _fieldConfig(field) {
    const attributes = this._attrs();
    if (field === 'temperature') {
      const value = this._number(attributes.temperature);
      if (value == null) return null;
      const min = this._number(attributes.min_temp);
      const max = this._number(attributes.max_temp);
      const precision = this._number(attributes.precision) ?? this._number(attributes.target_temp_precision);
      const step = this._number(attributes.target_temp_step) || precision || 1;
      return { field, value, min, max, step, precision, service: 'set_temperature', dataKey: 'temperature' };
    }
    if (field === 'target_temp_low' || field === 'target_temp_high') {
      const range = this._rangeConfig();
      if (!range) return null;
      return {
        field,
        value: field === 'target_temp_low' ? range.low : range.high,
        min: range.min,
        max: range.max,
        step: range.step,
        precision: range.precision,
        service: 'set_temperature',
        dataKey: field,
        range,
      };
    }
    if (field === 'humidity') {
      const value = this._number(attributes.target_humidity);
      const min = this._number(attributes.min_humidity);
      const max = this._number(attributes.max_humidity);
      const supported = (Number(attributes.supported_features) || 0) & 4;
      if (value == null || (!supported && (min == null || max == null))) return null;
      return { field, value, min, max, step: 1, service: 'set_humidity', dataKey: 'humidity' };
    }
    return null;
  }

  _displayValue(field, fallback) {
    const pending = this._pending && this._pending.entity === this._config.entity
      ? this._pending
      : null;
    if (pending?.field === 'temperature_range' &&
      Object.prototype.hasOwnProperty.call(pending.values || {}, field)) {
      return pending.values[field];
    }
    return pending?.field === field && pending.value != null ? pending.value : fallback;
  }

  _setPending(field, value) {
    if (this._pendingTimer) clearTimeout(this._pendingTimer);
    const token = (this._pendingGeneration || 0) + 1;
    this._pendingGeneration = token;
    const state = this._state();
    this._pending = {
      entity: this._config.entity,
      field,
      value,
      baselineValue: this._authoritativeValue(field, state),
      token,
    };
    this._pendingTimer = setTimeout(() => this._clearPending(true, token), 5000);
    return token;
  }

  _setRangePending(low, high) {
    if (this._pendingTimer) clearTimeout(this._pendingTimer);
    const token = (this._pendingGeneration || 0) + 1;
    this._pendingGeneration = token;
    this._pending = {
      entity: this._config.entity,
      field: 'temperature_range',
      values: {
        target_temp_low: low,
        target_temp_high: high,
      },
      token,
    };
    this._pendingTimer = setTimeout(() => this._clearPending(true, token), 5000);
    return token;
  }

  _clearPending(render, token) {
    if (token != null && this._pending?.token !== token) return;
    if (this._pendingTimer) clearTimeout(this._pendingTimer);
    this._pendingTimer = null;
    this._pending = null;
    this._renderAfterInteraction(render);
  }

  _closeMenu(render, focusMenuKey) {
    const wasOpen = Boolean(this._openMenu);
    this._openMenu = null;
    this._menuIndex = 0;
    if (render && wasOpen) {
      if (focusMenuKey) {
        this._queueInteractionRender(focusMenuKey);
      } else {
        this._render(true);
        this._flushDeferredRender();
      }
    }
  }

  _menuOptions(key) {
    if (!this._card) return [];
    return Array.from(this._card.querySelectorAll('button[data-menu-option]'))
      .filter(option => option.dataset.menuOption === key);
  }

  _focusMenuOption(key, index) {
    const options = this._menuOptions(key);
    if (!options.length) return;
    const nextIndex = Math.max(0, Math.min(options.length - 1, index));
    this._menuIndex = nextIndex;
    options[nextIndex].focus();
  }

  _focusMenuTrigger(key) {
    if (!this._card) return;
    const trigger = Array.from(this._card.querySelectorAll('button[data-menu-trigger]'))
      .find(button => button.dataset.menuTrigger === key);
    if (trigger) trigger.focus();
  }

  _positionOpenMenu(key) {
    if (!this._card || !this._openMenu || key !== this._openMenu) return;
    const trigger = Array.from(this._card.querySelectorAll('button[data-menu-trigger]'))
      .find(button => button.dataset.menuTrigger === key);
    const menu = Array.from(this._card.querySelectorAll('.menu-options'))
      .find(options => options.id === `${this._instanceId}-${key}-menu`);
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = 8;
    const below = Math.max(0, viewportHeight - rect.bottom - gap);
    const above = Math.max(0, rect.top - gap);
    const openAbove = above > below && above >= 48;
    const available = openAbove ? above : below;
    const maxHeight = Math.max(48, Math.min(220, available || 48));
    menu.classList.toggle('above', openAbove);
    menu.style.maxHeight = `${maxHeight}px`;
  }

  _onViewportChange() {
    if (this._openMenu) this._positionOpenMenu(this._openMenu);
  }

  _openMenuFor(key, index) {
    this._openMenu = key;
    this._menuIndex = index;
    this._menuFocusTransition = true;
    try {
      this._menuRenderAllowed = true;
      this._render(true);
      this._focusMenuOption(key, index);
      this._positionOpenMenu(key);
    } finally {
      this._menuRenderAllowed = false;
      Promise.resolve().then(() => {
        this._menuFocusTransition = false;
        this._flushDeferredRender();
      });
    }
  }

  _queueInteractionRender(focusMenuKey) {
    if (focusMenuKey) this._queuedFocusMenu = focusMenuKey;
    if (this._interactionRenderQueued) return;
    this._interactionRenderQueued = true;
    Promise.resolve().then(() => {
      this._interactionRenderQueued = false;
      const queuedFocusMenu = this._queuedFocusMenu;
      this._queuedFocusMenu = null;
      if (!this.isConnected) return;
      if (this._openMenu) {
        this._deferredRender = true;
        this._queuedFocusMenu = queuedFocusMenu;
        return;
      }
      this._render(true);
      if (queuedFocusMenu) this._focusMenuTrigger(queuedFocusMenu);
    });
  }

  _flushDeferredRender(force = false, focusIdentity = null) {
    if (!this.isConnected || this._openMenu || this._menuFocusTransition || !this._deferredRender) {
      return;
    }
    this._deferredRender = false;
    this._render(force, focusIdentity);
  }

  _authoritativeValue(field, state) {
    if (!state) return null;
    if (field === 'hvac_mode') return state.state;
    const key = field === 'humidity' ? 'target_humidity' : field;
    return state.attributes && state.attributes[key] != null ? state.attributes[key] : null;
  }

  _pendingMatches(actual, expected, field) {
    if (actual == null || expected == null) return false;
    const config = this._fieldConfig(field);
    if (config) {
      const actualNumber = this._number(actual);
      const expectedNumber = this._number(expected);
      const tolerance = Math.max(config.step / 4, 0.01);
      return actualNumber != null && expectedNumber != null &&
        Math.abs(actualNumber - expectedNumber) <= tolerance;
    }
    return String(actual) === String(expected);
  }

  _pendingStatus() {
    if (!this._pending || !this._hass || this._pending.entity !== this._config.entity) {
      return null;
    }
    const state = this._state();
    if (this._isUnavailableState(state)) return 'waiting';
    if (this._pending.field === 'temperature_range') {
      const expected = this._pending.values || {};
      const lowReached = this._pendingMatches(
        this._authoritativeValue('target_temp_low', state),
        expected.target_temp_low,
        'target_temp_low',
      );
      const highReached = this._pendingMatches(
        this._authoritativeValue('target_temp_high', state),
        expected.target_temp_high,
        'target_temp_high',
      );
      return lowReached && highReached ? 'reached' : 'waiting';
    }
    const actual = this._authoritativeValue(this._pending.field, state);
    if (this._pendingMatches(actual, this._pending.value, this._pending.field)) {
      return 'reached';
    }
    const baselineMatches = actual == null && this._pending.baselineValue == null
      ? true
      : this._pendingMatches(actual, this._pending.baselineValue, this._pending.field);
    return baselineMatches ? 'waiting' : 'rejected';
  }

  _eventControl(event, selector) {
    if (!event) return null;
    if (typeof event.composedPath === 'function') {
      for (const node of event.composedPath()) {
        if (node === this) break;
        if (node && typeof node.matches === 'function' && node.matches(selector)) return node;
      }
    }
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return null;
    const control = target.closest(selector);
    return control && this.contains(control) ? control : null;
  }

  _onPointerDown(event) {
    const control = this._interactiveControl(event);
    if (control) {
      this._pointerFocusControl = control;
      // Capture before Bubble Card's ancestor handlers. Do not preventDefault:
      // the browser must still move focus to the button/option normally.
      event.stopPropagation();
    }
  }

  _onDocumentPointerDown(event) {
    if (!this._openMenu) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const insideCard = path.includes(this) || this.contains(event.target);
    if (!insideCard) {
      this._closeMenu(true);
      return;
    }
    const insideMenu = path.some(node => (
      node && typeof node.matches === 'function' &&
      node.matches('.menu-options, [data-menu-trigger], [data-menu-option]')
    ));
    if (!insideMenu) this._closeMenu(true);
  }

  _onWindowBlur() {
    const focusIdentity = this._focusedControlIdentity();
    const hadDeferredRender = this._deferredRender;
    const menuWasOpen = Boolean(this._openMenu);
    this._pointerFocusControl = null;
    this._queuedFocusFlushIdentity = null;
    if (this._openMenu) this._closeMenu(true);
    this._focusedControl = null;
    if (hadDeferredRender && !menuWasOpen) {
      this._deferredRender = false;
      this._render(true, focusIdentity);
    }
  }

  _finishPointerFocusTransition() {
    const focusIdentity = this._queuedFocusFlushIdentity;
    this._queuedFocusFlushIdentity = null;
    this._pointerFocusControl = null;
    if (focusIdentity && this._deferredRender) {
      this._flushDeferredRender(true, focusIdentity);
    }
  }

  _interactiveControl(event) {
    return this._eventControl(event, 'button,[data-menu-option],[data-menu-trigger],[data-more]');
  }

  _activeElement() {
    let root = this.getRootNode && this.getRootNode();
    let active = root && root.activeElement ? root.activeElement : document.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  _controlFocusIdentity(element) {
    if (!this._isInteractiveElement(element)) return null;
    if (element.matches('button[data-step-field]')) {
      return {
        type: 'step',
        field: element.dataset.stepField || '',
        direction: element.dataset.direction || '',
      };
    }
    if (element.matches('button[data-power-switch]')) return { type: 'power' };
    if (element.matches('button[data-additional-power-index]')) {
      return {
        type: 'additional-power',
        index: element.dataset.additionalPowerIndex || '',
      };
    }
    if (element.matches('button[data-menu-trigger]')) {
      return {
        type: 'menu-trigger',
        key: element.dataset.menuTrigger || '',
      };
    }
    if (element.matches('button[data-menu-option]')) {
      return {
        type: 'menu-option',
        key: element.dataset.menuOption || '',
        value: element.dataset.menuValue || '',
      };
    }
    if (element.matches('button[data-additional-controls-toggle]')) {
      return { type: 'additional-toggle' };
    }
    if (element.matches('[data-more]')) return { type: 'more' };
    return null;
  }

  _focusedControlIdentity() {
    const active = this._activeElement();
    return this._controlFocusIdentity(active) ||
      this._controlFocusIdentity(this._focusedControl);
  }

  _restoreFocusedControl(identity) {
    if (!identity || !this._card) return;
    let control = null;
    if (identity.type === 'step') {
      control = Array.from(this._card.querySelectorAll('button[data-step-field]')).find(button => (
        button.dataset.stepField === identity.field &&
        button.dataset.direction === identity.direction
      ));
    } else if (identity.type === 'power') {
      control = this._card.querySelector('button[data-power-switch]');
    } else if (identity.type === 'additional-power') {
      control = Array.from(this._card.querySelectorAll('button[data-additional-power-index]'))
        .find(button => button.dataset.additionalPowerIndex === identity.index);
    } else if (identity.type === 'menu-trigger') {
      control = Array.from(this._card.querySelectorAll('button[data-menu-trigger]'))
        .find(button => button.dataset.menuTrigger === identity.key);
    } else if (identity.type === 'menu-option') {
      control = Array.from(this._card.querySelectorAll('button[data-menu-option]')).find(button => (
        button.dataset.menuOption === identity.key &&
        button.dataset.menuValue === identity.value
      ));
    } else if (identity.type === 'additional-toggle') {
      control = this._card.querySelector('button[data-additional-controls-toggle]');
    } else if (identity.type === 'more') {
      control = this._card.querySelector('[data-more]');
    }
    if (control && !control.disabled) {
      control.focus();
      this._focusedControl = control;
    } else if (this._focusedControl && !this.contains(this._focusedControl)) {
      this._focusedControl = null;
    }
  }

  _isInteractiveElement(element) {
    return Boolean(
      element &&
      this.contains(element) &&
      typeof element.matches === 'function' &&
      element.matches('button,[data-menu-option],[data-menu-trigger],[data-more]'),
    );
  }

  _hasTargetInteractionFocus() {
    const active = this._activeElement();
    if (this._isTargetInteractionElement(active)) {
      this._focusedControl = active;
      return true;
    }
    return Boolean(
      this._focusedControl &&
      this._isTargetInteractionElement(this._focusedControl),
    );
  }

  _isTargetInteractionElement(element) {
    return Boolean(
      element &&
      this.contains(element) &&
      typeof element.matches === 'function' &&
      element.matches('button[data-step-field],button[data-power-switch]'),
    );
  }

  _onFocusIn(event) {
    const control = this._interactiveControl(event);
    if (control) this._focusedControl = control;
  }

  _onFocusOut(event) {
    // Opening a menu replaces the trigger before focusing the new option.
    // Ignore that synchronous removal; the microtask in _openMenuFor clears
    // this guard after the option has received focus.
    if (this._menuFocusTransition) return;
    const previous = event && event.target;
    const related = event && event.relatedTarget;
    const active = this._activeElement();
    const next = this._isInteractiveElement(related)
      ? related
      : active !== previous && this._isInteractiveElement(active)
        ? active
        : null;
    if (next) {
      this._focusedControl = next;
      if (this._deferredRender && previous !== next &&
        this._isTargetInteractionElement(previous)) {
        const focusIdentity = this._controlFocusIdentity(next);
        if (this._pointerFocusControl === next) {
          this._queuedFocusFlushIdentity = focusIdentity;
        } else {
          this._flushDeferredRender(true, focusIdentity);
        }
      }
      return;
    }
    this._focusedControl = null;
    if (this._openMenu) this._closeMenu(true);
    this._flushDeferredRender();
  }

  _chooseMenuOption(option) {
    if (!option) return;
    const service = option.dataset.menuService;
    const key = option.dataset.menuKey;
    const value = option.dataset.menuValue;
    const menuKey = option.dataset.menuOption;
    const entity = option.dataset.menuEntity || this._config.entity;
    if (!service || !key || value == null || !menuKey || this._isUnavailableState(this._state(entity))) return;
    const pendingToken = entity === this._config.entity
      ? this._setPending(key, value)
      : null;
    this._closeMenu(true, menuKey);
    let result;
    try {
      result = this._call(service, { [key]: value }, entity);
    } catch (error) {
      if (pendingToken != null) this._clearPending(false, pendingToken);
      return;
    }
    if (pendingToken != null && result && typeof result.catch === 'function') {
      result.catch(() => this._clearPending(true, pendingToken));
    }
  }

  _onClick(event) {
    try {
      this._handleClick(event);
    } finally {
      this._finishPointerFocusTransition();
    }
  }

  _handleClick(event) {
    const option = this._eventControl(event, 'button[data-menu-option]');
    if (option) {
      event.preventDefault();
      event.stopPropagation();
      this._chooseMenuOption(option);
      return;
    }
    const trigger = this._eventControl(event, 'button[data-menu-trigger]');
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      const key = trigger.dataset.menuTrigger;
      if (!key) return;
      if (this._openMenu === key) {
        this._closeMenu(true);
        this._focusMenuTrigger(key);
      } else {
        const options = this._array(trigger.dataset.menuValues ? JSON.parse(trigger.dataset.menuValues) : []);
        const currentIndex = Math.max(0, options.indexOf(trigger.dataset.menuCurrent));
        this._openMenuFor(key, currentIndex);
      }
      return;
    }
    const additionalToggle = this._eventControl(event, 'button[data-additional-controls-toggle]');
    if (additionalToggle) {
      event.preventDefault();
      event.stopPropagation();
      this._additionalExpanded = !this._additionalExpanded;
      this._render(true);
      queueMicrotask(() => this.querySelector('button[data-additional-controls-toggle]')?.focus());
      return;
    }
    const additionalPowerButton = this._eventControl(event, 'button[data-additional-power-index]');
    if (additionalPowerButton) {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(additionalPowerButton.dataset.additionalPowerIndex);
      if (!Number.isInteger(index)) return;
      const result = this._toggleAdditionalPower(index);
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return;
    }
    const powerButton = this._eventControl(event, 'button[data-power-switch]');
    if (powerButton) {
      event.preventDefault();
      event.stopPropagation();
      const result = this._togglePower();
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return;
    }
    const button = this._eventControl(event, 'button[data-step-field]');
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      const field = button.dataset.stepField;
      if (this._isUnavailableState(this._state())) return;
      const config = this._fieldConfig(field);
      if (!config) return;
      const raw = this._number(this._authoritativeValue(field, this._state()));
      if (raw == null) return;
      const displayed = this._number(this._displayValue(field, raw));
      if (displayed == null) return;
      let minimum = config.min;
      let maximum = config.max;
      let serviceData;
      let rangeLow;
      let rangeHigh;
      if (config.range) {
        rangeLow = this._number(this._displayValue('target_temp_low', config.range.low));
        rangeHigh = this._number(this._displayValue('target_temp_high', config.range.high));
        if (rangeLow == null || rangeHigh == null) return;
        if (field === 'target_temp_low') {
          maximum = maximum == null ? rangeHigh : Math.min(maximum, rangeHigh);
        } else {
          minimum = minimum == null ? rangeLow : Math.max(minimum, rangeLow);
        }
      }
      const next = this._roundToStep(
        displayed + Number(button.dataset.direction) * config.step,
        minimum,
        maximum,
        config.step,
        config.precision,
      );
      if (config.range) {
        serviceData = {
          target_temp_low: field === 'target_temp_low' ? next : rangeLow,
          target_temp_high: field === 'target_temp_high' ? next : rangeHigh,
        };
      } else {
        serviceData = { [config.dataKey]: next };
      }
      const pendingToken = config.range
        ? this._setRangePending(serviceData.target_temp_low, serviceData.target_temp_high)
        : this._setPending(field, next);
      let result;
      try {
        result = this._call(config.service, serviceData);
      } catch (error) {
        this._clearPending(true, pendingToken);
        return;
      }
      this._queueInteractionRender();
      if (result && typeof result.catch === 'function') {
        result.catch(() => this._clearPending(true, pendingToken));
      }
      return;
    }
    const more = this._eventControl(event, '[data-more]');
    if (more) {
      event.preventDefault();
      event.stopPropagation();
      this._moreInfo();
    }
  }

  _onKeydown(event) {
    const trigger = this._eventControl(event, 'button[data-menu-trigger]');
    if (trigger) {
      const key = trigger.dataset.menuTrigger;
      if (event.key === 'Escape' && this._openMenu === key) {
        event.preventDefault();
        event.stopPropagation();
        this._closeMenu(true);
        this._focusMenuTrigger(key);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ' ||
        event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const options = this._array(trigger.dataset.menuValues ? JSON.parse(trigger.dataset.menuValues) : []);
        if (!options.length) return;
        const currentIndex = options.indexOf(trigger.dataset.menuCurrent);
        this._openMenuFor(key, event.key === 'ArrowUp'
          ? options.length - 1
          : Math.max(0, currentIndex));
        return;
      }
    }
    const option = this._eventControl(event, 'button[data-menu-option]');
    if (option) {
      const key = option.dataset.menuOption;
      const options = this._menuOptions(key);
      const currentIndex = options.indexOf(option);
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this._closeMenu(true);
        this._focusMenuTrigger(key);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        this._chooseMenuOption(option);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' ||
        event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        event.stopPropagation();
        const nextIndex = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : currentIndex + (event.key === 'ArrowDown' ? 1 : -1);
        this._focusMenuOption(key, (nextIndex + options.length) % options.length);
        return;
      }
    }
    const more = this._eventControl(event, '[data-more]');
    if (more && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      this._moreInfo();
    }
  }

  _menu(label, values, current, service, key, entity = this._config.entity, menuIdKey = key) {
    const options = this._array(values);
    if (!options.length) return '';
    const open = this._openMenu === menuIdKey;
    const menuId = `${this._instanceId}-${menuIdKey}-menu`;
    const labelId = `${this._instanceId}-${menuIdKey}-label`;
    const currentIndex = Math.max(0, options.indexOf(current));
    return `<div class="control menu-control">
      <span class="control-label" id="${labelId}">${this._esc(label)}</span>
      <button class="menu-trigger" type="button" data-menu-trigger="${this._esc(menuIdKey)}"
        data-menu-current="${this._esc(current || '')}"
        data-menu-values="${this._esc(JSON.stringify(options))}"
        aria-haspopup="listbox" aria-expanded="${open}" aria-controls="${menuId}"
        aria-labelledby="${labelId}">
        <span class="menu-trigger-value">${this._esc(current ? this._label(current) : 'Select')}</span>
        <ha-icon icon="mdi:chevron-down" aria-hidden="true" style="--mdc-icon-size:18px"></ha-icon>
      </button>
      ${open ? `<div class="menu-options" id="${menuId}" role="listbox" tabindex="-1"
        aria-labelledby="${labelId}">
        ${options.map((value, index) => `<button class="menu-option${value === current ? ' selected' : ''}"
          type="button" role="option" data-menu-option="${this._esc(menuIdKey)}"
          data-menu-key="${this._esc(key)}" data-menu-service="${this._esc(service)}"
          data-menu-entity="${this._esc(entity)}"
          data-menu-value="${this._esc(value)}" aria-selected="${value === current}"
          tabindex="${index === currentIndex ? '0' : '-1'}">${this._esc(this._label(value))}</button>`).join('')}
      </div>` : ''}
    </div>`;
  }

  _temperatureControl(config, name) {
    const value = this._displayValue('temperature', config.value);
    const precision = Math.max(
      this._precision(config.step),
      config.precision == null ? 0 : this._precision(config.precision),
      this._precision(value),
    );
    const powerToggle = this._config.additional_entities.length
      ? ''
      : this._powerToggle(name);
    return `<div class="value-control">
      <div class="temperature-control-header">
        <span class="control-label">Target temperature</span>
        <div class="temperature-controls">
          ${powerToggle}
          <div class="stepper temperature-stepper" role="group" aria-label="Target temperature controls">
            <button type="button" data-step-field="temperature" data-direction="-1" aria-label="Decrease target temperature">&minus;</button>
            <strong class="target-value">${this._formatTemperature(value, precision)}</strong>
            <button type="button" data-step-field="temperature" data-direction="1" aria-label="Increase target temperature">+</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  _rangeStepper(field, label, value, config) {
    const displayed = this._displayValue(field, value);
    const precision = Math.max(
      this._precision(config.step),
      config.precision == null ? 0 : this._precision(config.precision),
      this._precision(displayed),
    );
    return `<div class="range-stepper-control">
      <span class="range-label">${this._esc(label)}</span>
      <div class="stepper temperature-stepper" role="group" aria-label="${this._esc(label)} target temperature controls">
        <button type="button" data-step-field="${this._esc(field)}" data-direction="-1"
          aria-label="Decrease ${this._esc(label.toLowerCase())} target temperature">&minus;</button>
        <strong class="target-value">${this._formatTemperature(displayed, precision)}</strong>
        <button type="button" data-step-field="${this._esc(field)}" data-direction="1"
          aria-label="Increase ${this._esc(label.toLowerCase())} target temperature">+</button>
      </div>
    </div>`;
  }

  _rangeTemperatureControl(config, name) {
    const powerToggle = this._config.additional_entities.length
      ? ''
      : this._powerToggle(name);
    return `<div class="value-control range-value-control">
      <div class="temperature-control-header">
        <span class="control-label">Target temperature range</span>
        <div class="temperature-controls range-temperature-controls">
          ${powerToggle}
          <div class="range-steppers">
            ${this._rangeStepper('target_temp_low', 'Low', config.low, config)}
            ${this._rangeStepper('target_temp_high', 'High', config.high, config)}
          </div>
        </div>
      </div>
    </div>`;
  }

  _powerToggle(name) {
    const powerControl = this._config.show_power_toggle ? this._powerControl() : null;
    if (!powerControl) return '';
    const available = this._powerTargetAvailable(powerControl);
    const powerOn = available && this._powerOn();
    const label = available ? `A/C ${powerOn ? 'ON' : 'OFF'}` : 'A/C unavailable';
    return `<button class="power-toggle temperature-power ${powerOn ? 'on' : 'off'}" data-power-switch type="button"
      aria-label="${available ? `${powerOn ? 'Turn off' : 'Turn on'} A/C in ${this._esc(name)}` : `A/C power in ${this._esc(name)} is unavailable`}"
      aria-pressed="${powerOn}" ${available ? '' : 'disabled'}>
      <ha-icon icon="mdi:power" aria-hidden="true" style="--mdc-icon-size:16px"></ha-icon>
      <span class="power-label">${label}</span>
    </button>`;
  }

  _additionalPowerControl(entry) {
    if (!entry.show_power_toggle) return null;
    if (entry.power_switch) return { type: 'switch', entity: entry.power_switch };
    const supported = Number(this._attrs(entry.entity).supported_features) || 0;
    return (supported & 256) !== 0 && (supported & 128) !== 0
      ? { type: 'climate', entity: entry.entity }
      : null;
  }

  _additionalPowerOn(control) {
    if (!this._powerTargetAvailable(control)) return false;
    const state = this._state(control.entity);
    return control.type === 'switch'
      ? Boolean(state && state.state === 'on')
      : Boolean(state && !this._isUnavailableState(state) && state.state !== 'off');
  }

  _toggleAdditionalPower(index) {
    const entry = this._config.additional_entities[index];
    if (!entry || !this._hass) return null;
    const control = this._additionalPowerControl(entry);
    if (!this._powerTargetAvailable(control)) return null;
    const nextOn = !this._additionalPowerOn(control);
    const result = control.type === 'switch'
      ? this._hass.callService('switch', nextOn ? 'turn_on' : 'turn_off', { entity_id: control.entity })
      : this._call(nextOn ? 'turn_on' : 'turn_off', {}, entry.entity);
    this._queueInteractionRender();
    return result;
  }

  _additionalPowerToggle(entry, index, name) {
    const control = this._additionalPowerControl(entry);
    if (!control) return '';
    const available = this._powerTargetAvailable(control);
    const powerOn = available && this._additionalPowerOn(control);
    const label = available ? `A/C ${powerOn ? 'ON' : 'OFF'}` : 'A/C unavailable';
    return `<button class="power-toggle additional-power ${powerOn ? 'on' : 'off'}" data-additional-power-index="${index}" type="button"
      aria-label="${available ? `${powerOn ? 'Turn off' : 'Turn on'} ${this._esc(name)}` : `${this._esc(name)} power is unavailable`}"
      aria-pressed="${powerOn}" ${available ? '' : 'disabled'}>
      <ha-icon icon="mdi:power" aria-hidden="true" style="--mdc-icon-size:16px"></ha-icon>
      <span class="power-label">${label}</span>
    </button>`;
  }

  _additionalEntityControls(entry, index) {
    const state = this._state(entry.entity);
    const attributes = state?.attributes || {};
    const name = entry.name || attributes.friendly_name || entry.entity;
    if (this._isUnavailableState(state)) {
      return `<section class="additional-entity is-unavailable" aria-label="${this._esc(name)}">
        <div class="additional-entity-heading"><ha-icon icon="${this._esc(attributes.icon || 'mdi:air-conditioner')}" aria-hidden="true"></ha-icon><span>${this._esc(name)}</span></div>
        <span class="additional-unavailable">Unavailable</span>
      </section>`;
    }
    const menus = [
      this._menu('HVAC mode', this._array(attributes.hvac_modes), state.state, 'set_hvac_mode', 'hvac_mode', entry.entity, `additional-${index}-hvac_mode`),
      this._menu('Fan mode', this._array(attributes.fan_modes), attributes.fan_mode, 'set_fan_mode', 'fan_mode', entry.entity, `additional-${index}-fan_mode`),
      this._menu('Vertical swing', this._array(attributes.swing_modes), attributes.swing_mode, 'set_swing_mode', 'swing_mode', entry.entity, `additional-${index}-swing_mode`),
      this._menu('Horizontal swing', this._array(attributes.swing_horizontal_modes), attributes.swing_horizontal_mode, 'set_swing_horizontal_mode', 'swing_horizontal_mode', entry.entity, `additional-${index}-swing_horizontal_mode`),
    ].filter(Boolean).join('');
    return `<section class="additional-entity" aria-label="${this._esc(name)}">
      <div class="additional-entity-heading"><span class="additional-entity-name"><ha-icon icon="${this._esc(attributes.icon || 'mdi:air-conditioner')}" aria-hidden="true"></ha-icon><span>${this._esc(name)}</span></span>${this._additionalPowerToggle(entry, index, name)}</div>
      ${menus ? `<div class="control-grid additional-control-grid">${menus}</div>` : '<span class="additional-unavailable">No compatible A/C controls are available.</span>'}
    </section>`;
  }

  _additionalControls() {
    const entities = this._config.additional_entities;
    if (!entities.length) return '';
    const collapsible = this._config.additional_entities_collapsible;
    const expanded = !collapsible || this._additionalExpanded === true;
    const showTitle = this._config.show_additional_title;
    const toggle = collapsible
      ? `<button class="additional-controls-heading" data-additional-controls-toggle type="button"
          aria-label="${expanded ? 'Collapse' : 'Expand'} air conditioning controls"
          aria-expanded="${expanded}">
          ${showTitle ? '<span>Air conditioning</span>' : ''}
          <ha-icon icon="mdi:chevron-${expanded ? 'up' : 'down'}" aria-hidden="true"></ha-icon>
        </button>`
      : (showTitle ? '<div class="additional-controls-heading"><span>Air conditioning</span></div>' : '');
    return `<section class="additional-controls" aria-label="Air conditioning controls">
      ${toggle}
      ${expanded ? `<div class="additional-entities">${entities.map((entry, index) => this._additionalEntityControls(entry, index)).join('')}</div>` : ''}
    </section>`;
  }

  _humidityControl(config, name, currentHumidity) {
    const value = this._displayValue('humidity', config.value);
    return `<div class="value-control">
      <div class="value-control-header">
        <div class="value-copy">
          <span class="control-label">Target humidity</span>
          <div class="value-reading">
            <strong>${this._formatNumber(value, 0)}%</strong>
            <span class="current-value">Current ${this._formatNumber(currentHumidity, 0)}%</span>
          </div>
        </div>
        <div class="stepper" role="group" aria-label="Target humidity controls">
        <button type="button" data-step-field="humidity" data-direction="-1" aria-label="Decrease target humidity">&minus;</button>
        <button type="button" data-step-field="humidity" data-direction="1" aria-label="Increase target humidity">+</button>
        </div>
      </div>
    </div>`;
  }

  _render(force, preferredFocusIdentity = null) {
    if (!this._hass || !this._config) return;
    if (this._openMenu && !this._menuRenderAllowed) {
      this._deferredRender = true;
      return;
    }
    if (!force && this._hasTargetInteractionFocus()) {
      this._deferredRender = true;
      return;
    }
    const focusIdentity = preferredFocusIdentity || this._focusedControlIdentity();
    this._deferredRender = false;
    const pendingStatus = this._pendingStatus();
    if (pendingStatus === 'reached' || pendingStatus === 'rejected') this._clearPending();
    const state = this._state();
    const available = !this._isUnavailableState(state);
    const attributes = this._attrs();
    const name = this._config.name || attributes.friendly_name || this._config.entity;
    const hvacModes = this._array(attributes.hvac_modes);
    const fanModes = this._array(attributes.fan_modes);
    const presetModes = this._array(attributes.preset_modes);
    const swingModes = this._array(attributes.swing_modes);
    const horizontalSwingModes = this._array(attributes.swing_horizontal_modes);
    const temperature = this._number(attributes.current_temperature);
    const targetConfig = this._fieldConfig('temperature');
    const rangeConfig = targetConfig ? null : this._rangeConfig();
    const humidityConfig = this._fieldConfig('humidity');
    const currentHumidity = this._number(attributes.current_humidity);
    const currentMode = this._displayValue('hvac_mode', state ? state.state : 'unavailable');
    const fanMode = this._displayValue('fan_mode', attributes.fan_mode);
    const presetMode = this._displayValue('preset_mode', attributes.preset_mode);
    const swingMode = this._displayValue('swing_mode', attributes.swing_mode);
    const horizontalSwingMode = this._displayValue(
      'swing_horizontal_mode',
      attributes.swing_horizontal_mode,
    );
    const temperatureConfig = targetConfig || rangeConfig;
    const temperaturePrecision = temperatureConfig
      ? Math.max(this._precision(temperatureConfig.step), temperature == null ? 0 : this._precision(temperature))
      : 0;
    const currentAction = attributes.hvac_action;
    const displayedTemperature = targetConfig
      ? this._displayValue('temperature', targetConfig.value)
      : '';
    const displayedHumidity = humidityConfig
      ? this._displayValue('humidity', humidityConfig.value)
      : '';
    const displayedRangeLow = rangeConfig
      ? this._displayValue('target_temp_low', rangeConfig.low)
      : '';
    const displayedRangeHigh = rangeConfig
      ? this._displayValue('target_temp_high', rangeConfig.high)
      : '';
    const powerControl = available ? this._powerControl() : null;
    const powerAvailable = this._powerTargetAvailable(powerControl);
    const powerOn = powerAvailable ? this._powerOn() : false;
    const pending = this._pending && this._pending.entity === this._config.entity
      ? this._pending
      : null;
    const powerPreview = this._powerPreview;
    const additionalEntities = this._config.additional_entities.map(entry => {
      const extraState = this._state(entry.entity);
      const extraAttributes = extraState?.attributes || {};
      return [
        entry.entity,
        entry.name,
        entry.power_switch,
        entry.show_power_toggle,
        this._state(entry.power_switch)?.state || '',
        extraState?.state || 'unavailable',
        extraAttributes.hvac_modes,
        extraAttributes.fan_modes,
        extraAttributes.fan_mode,
        extraAttributes.swing_modes,
        extraAttributes.swing_mode,
        extraAttributes.swing_horizontal_modes,
        extraAttributes.swing_horizontal_mode,
        extraAttributes.icon,
        extraAttributes.friendly_name,
        extraAttributes.supported_features,
      ];
    });
    const renderSignature = [
      this._config.entity,
      this._config.power_switch || '',
      name,
      available,
      state ? state.state : 'unavailable',
      currentMode,
      currentAction || '',
      temperature,
      this._temperatureUnit(),
      temperaturePrecision,
      currentHumidity,
      hvacModes.join(','),
      fanModes.join(','),
      presetModes.join(','),
      swingModes.join(','),
      horizontalSwingModes.join(','),
      fanMode || '',
      presetMode || '',
      swingMode || '',
      horizontalSwingMode || '',
      targetConfig
        ? [targetConfig.value, targetConfig.min, targetConfig.max, targetConfig.step, targetConfig.precision].join(',')
        : '',
      rangeConfig
        ? [rangeConfig.low, rangeConfig.high, rangeConfig.min, rangeConfig.max, rangeConfig.step, rangeConfig.precision].join(',')
        : '',
      humidityConfig
        ? [humidityConfig.value, humidityConfig.min, humidityConfig.max].join(',')
        : '',
      displayedTemperature,
      displayedHumidity,
      displayedRangeLow,
      displayedRangeHigh,
      attributes.target_temp_low,
      attributes.target_temp_high,
      attributes.min_temp,
      attributes.max_temp,
      attributes.target_temp_step,
      attributes.precision,
      attributes.target_humidity,
      attributes.min_humidity,
      attributes.max_humidity,
      attributes.supported_features,
      powerControl ? `${powerControl.type}:${powerControl.entity}` : '',
      powerAvailable,
      powerOn,
      powerPreview ? `${powerPreview.entity}:${powerPreview.type}:${powerPreview.on}` : '',
      pending
        ? pending.field === 'temperature_range'
          ? `${pending.field}:${pending.values?.target_temp_low}:${pending.values?.target_temp_high}`
          : `${pending.field}:${pending.value}`
        : '',
      this._openMenu || '',
      JSON.stringify(additionalEntities),
      this._config.additional_entities_collapsible,
      this._config.additional_entities_collapsed,
      this._config.show_additional_title,
      this._additionalExpanded,
    ].join('|');
    if (!force && this._shell && renderSignature === this._lastRenderSignature) return;
    this._lastRenderSignature = renderSignature;

    const menus = [
      this._menu('HVAC mode', hvacModes, currentMode, 'set_hvac_mode', 'hvac_mode'),
      this._menu('Fan mode', fanModes, fanMode, 'set_fan_mode', 'fan_mode'),
      this._menu('Preset', presetModes, presetMode, 'set_preset_mode', 'preset_mode'),
      this._menu('Swing', swingModes, swingMode, 'set_swing_mode', 'swing_mode'),
      this._menu('Horizontal swing', horizontalSwingModes, horizontalSwingMode, 'set_swing_horizontal_mode', 'swing_horizontal_mode'),
    ].filter(Boolean).join('');

    const primaryHtml = available ? `<div class="card-row">
      <div class="row-left" data-more role="button" tabindex="0" aria-label="Show details for ${this._esc(name)}">
        <ha-icon icon="${this._esc(this._icon())}" class="climate-icon" style="--mdc-icon-size:26px"></ha-icon>
        <div><div class="row-name">${this._esc(name)}</div>
          <div class="row-sub">${this._esc(this._label(currentMode))}${currentAction ? ` &middot; ${this._esc(this._label(currentAction))}` : ''}</div>
        </div>
      </div>
      <div class="summary-actions">
        <div class="current-reading">
          <strong>${this._formatTemperature(temperature, temperaturePrecision)}</strong>
          <span>Current</span>
        </div>
      </div>
    </div>
    <div class="status-line">
      ${currentHumidity != null ? `<span>Humidity ${this._formatNumber(currentHumidity, 0)}%</span>` : ''}
    </div>
    ${menus ? `<div class="control-grid">${menus}</div>` : ''}
    ${targetConfig ? this._temperatureControl(targetConfig, name) : ''}
    ${rangeConfig ? this._rangeTemperatureControl(rangeConfig, name) : ''}
    ${humidityConfig ? this._humidityControl(humidityConfig, name, currentHumidity) : ''}`
      : `<div class="unavailable">Climate entity ${this._esc(this._config.entity)} is unavailable.</div>`;
    const html = `${primaryHtml}${this._additionalControls()}`;

    if (!this._shell) {
      this.innerHTML = `<style>${this._css()}</style><ha-card class="climate-card" style="background:var(--climate-bg)!important;background-color:var(--climate-bg)!important;border:1px solid var(--climate-divider)!important;border-radius:var(--climate-card-radius)!important;box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important"></ha-card>`;
      this._shell = true;
      this._card = this.querySelector('.climate-card');
    }
    this._card.innerHTML = html;
    this._restoreFocusedControl(focusIdentity);
  }

  _css() {
    return `
      hollow-climate-card {
        display:block;
        width:100%;
        min-width:0;
        font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;
        --climate-bg:var(--card-background-color,var(--ha-card-background,#212c42));
        --climate-card-radius:var(--hollow-climate-card-border-radius,20px);
        --climate-page-bg:var(--primary-background-color,#1a2433);
        --climate-primary:var(--primary-text-color,#f5f7fb);
        --climate-secondary:var(--secondary-text-color,#91a2bb);
        --climate-accent:var(--primary-color,var(--accent-color,#ffb340));
        --climate-focus:var(--primary-color,#3d8bfd);
        --climate-control-bg:var(--secondary-background-color,#2b3850);
        --climate-muted:var(--disabled-text-color,#66758f);
        --climate-divider:var(--divider-color,rgba(255,255,255,.14));
      }
      hollow-climate-card > ha-card.climate-card {
        box-sizing:border-box;
        width:100%;
        min-width:0;
        background:var(--climate-bg) !important;
        background-color:var(--climate-bg) !important;
        color:var(--climate-primary);
        border-radius:var(--climate-card-radius) !important;
        border:1px solid var(--climate-divider) !important;
        box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16)) !important;
        padding:14px 16px;
      }
      .climate-card * { box-sizing:border-box; }
      .climate-card .card-row,.climate-card .row-left,.climate-card .value-control-header,.climate-card .temperature-control-header,.climate-card .value-reading,.climate-card .status-line {
        display:flex;
        align-items:center;
      }
      .climate-card .card-row { justify-content:space-between; gap:12px; }
      .climate-card .row-left { gap:10px; min-width:0; cursor:pointer; outline:none; }
      .climate-card .row-left:focus-visible { outline:2px solid var(--climate-accent); outline-offset:3px; border-radius:6px; }
      .climate-card .climate-icon { color:var(--climate-accent); flex:none; }
      .climate-card .row-name { font-size:14px; font-weight:700; }
      .climate-card .row-sub,.climate-card .current-reading span,.climate-card .status-line,.climate-card .control-label { color:var(--climate-secondary); }
      .climate-card .row-sub { font-size:11.5px; margin-top:2px; }
      .climate-card .current-reading { text-align:right; flex:none; }
      .climate-card .current-reading strong { display:block; font-size:20px; color:var(--climate-accent); }
      .climate-card .current-reading span { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.06em; }
      .climate-card .summary-actions { display:flex; align-items:center; justify-content:flex-end; flex:none; }
      .climate-card .power-toggle {
        all:unset; box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:5px;
        min-height:32px; min-width:78px; padding:5px 9px; border:1px solid var(--climate-divider);
        border-radius:10px; background:var(--climate-control-bg); color:var(--climate-secondary);
        cursor:pointer; font-size:10px; font-weight:800; letter-spacing:.03em;
      }
      .climate-card .power-toggle.on { border-color:transparent; background:var(--climate-accent); color:var(--climate-page-bg); }
      .climate-card .power-toggle.off { color:var(--climate-secondary); }
      .climate-card .power-toggle:focus-visible { outline:3px solid var(--climate-focus); outline-offset:2px; }
      .climate-card .power-toggle:disabled,.climate-card .menu-trigger:disabled,
      .climate-card .stepper button:disabled { cursor:not-allowed; opacity:.45; }
      .climate-card .status-line { flex-wrap:wrap; gap:8px 16px; font-size:11.5px; margin-top:10px; }
      .climate-card .control-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(125px,1fr)); gap:8px; margin-top:12px; }
      .climate-card .additional-controls { display:grid; gap:12px; margin-top:16px; padding-top:14px; border-top:1px solid var(--climate-divider); }
      .climate-card .additional-controls-heading { all:unset; box-sizing:border-box; display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; min-width:0; color:var(--climate-secondary); font-size:10px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
      .climate-card button.additional-controls-heading { cursor:pointer; min-height:28px; }
      .climate-card .additional-controls-heading ha-icon { flex:none; --mdc-icon-size:18px; }
      .climate-card button.additional-controls-heading:focus-visible { outline:3px solid var(--climate-focus); outline-offset:2px; border-radius:6px; }
      .climate-card .additional-entities { display:grid; gap:12px; }
      .climate-card .additional-entity { display:grid; gap:2px; min-width:0; }
      .climate-card .additional-entity + .additional-entity { padding-top:12px; border-top:1px solid var(--climate-divider); }
      .climate-card .additional-entity-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; color:var(--climate-primary); font-size:12px; font-weight:750; }
      .climate-card .additional-entity-name { display:flex; align-items:center; gap:7px; min-width:0; }
      .climate-card .additional-entity-name ha-icon { flex:none; color:var(--climate-accent); --mdc-icon-size:18px; }
      .climate-card .additional-entity-name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .climate-card .additional-power { flex:none; text-transform:none; }
      .climate-card .additional-control-grid { margin-top:8px; }
      .climate-card .additional-unavailable { color:var(--climate-secondary); font-size:11px; }
      .climate-card .control { display:flex; flex-direction:column; gap:4px; min-width:0; }
      .climate-card .control-label { font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
      .climate-card .menu-control { position:relative; }
      .climate-card .menu-trigger {
        box-sizing:border-box; min-height:34px; width:100%; padding:5px 8px 5px 9px;
        display:flex; align-items:center; justify-content:space-between; gap:6px;
        border:1px solid var(--climate-divider); border-radius:9px;
        background:var(--climate-control-bg); color:var(--climate-primary);
        font:inherit; font-size:12px; font-weight:750; text-align:left; cursor:pointer;
      }
      .climate-card .menu-trigger ha-icon { color:var(--climate-secondary); flex:none; }
      .climate-card .menu-trigger-value { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .climate-card .menu-options {
        position:absolute; z-index:20; top:calc(100% + 5px); left:0; right:0;
        max-height:min(220px,calc(100vh - 16px)); max-height:min(220px,calc(100dvh - 16px));
        overflow-y:auto; overscroll-behavior:contain; padding:4px;
        border:1px solid var(--climate-divider); border-radius:10px;
        background:var(--climate-control-bg); box-shadow:0 12px 28px rgba(0,0,0,.35);
      }
      .climate-card .menu-options.above { top:auto; bottom:calc(100% + 5px); }
      .climate-card .menu-option {
        all:unset; box-sizing:border-box; display:block; width:100%; padding:8px 9px;
        border-radius:7px; color:var(--climate-primary); cursor:pointer;
        font:inherit; font-size:12px; font-weight:650; line-height:1.25;
      }
      .climate-card .menu-option:hover,.climate-card .menu-option:focus-visible,
      .climate-card .menu-option.selected {
        background:rgba(255,255,255,.1); color:var(--climate-primary);
      }
      .climate-card .menu-option.selected { color:var(--climate-accent); }
      .climate-card .menu-trigger:focus-visible,.climate-card .menu-option:focus-visible,
      .climate-card .stepper button:focus-visible {
        outline:3px solid var(--climate-focus); outline-offset:2px;
      }
      .climate-card .value-control { margin-top:13px; }
      .climate-card .value-control-header { justify-content:space-between; gap:12px; min-width:0; }
      .climate-card .temperature-control-header { flex-direction:column; justify-content:center; gap:7px; min-width:0; }
      .climate-card .temperature-controls { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; min-width:0; }
      .climate-card .temperature-power { flex:0 1 auto; }
      .climate-card .range-temperature-controls { align-items:flex-start; }
      .climate-card .range-steppers { display:grid; gap:7px; min-width:0; }
      .climate-card .range-stepper-control { display:flex; align-items:center; justify-content:flex-end; gap:8px; min-width:0; }
      .climate-card .range-label { width:2.25rem; flex:none; color:var(--climate-secondary); font-size:10px; font-weight:750; text-align:right; text-transform:uppercase; }
      .climate-card .value-copy { flex:1 1 auto; min-width:0; }
      .climate-card .value-reading { align-items:baseline; flex-wrap:wrap; gap:4px 9px; margin-top:3px; }
      .climate-card .value-reading strong { color:var(--climate-accent); font-size:15px; line-height:1.2; }
      .climate-card .current-value { color:var(--climate-secondary); font-size:11px; white-space:nowrap; }
      .climate-card .stepper { display:flex; flex:0 0 auto; gap:7px; }
      .climate-card .temperature-stepper { display:grid; grid-template-columns:30px minmax(4.5rem,auto) 30px; align-items:center; gap:10px; flex:0 1 auto; }
      .climate-card .target-value { min-width:0; color:var(--climate-accent); font-size:17px; line-height:1.2; text-align:center; white-space:nowrap; }
      .climate-card .stepper button {
        all:unset; box-sizing:border-box; width:30px; height:30px; border-radius:50%; display:flex; align-items:center;
        justify-content:center; background:var(--climate-control-bg); color:var(--climate-primary);
        cursor:pointer; font-size:18px; font-weight:700;
      }
      .climate-card .unavailable { color:var(--climate-secondary); font-size:13px; }
      @media(max-width:380px) {
        .climate-card { padding:13px; }
        .climate-card .card-row { align-items:flex-start; flex-wrap:wrap; }
        .climate-card .value-control-header { align-items:stretch; flex-direction:column; gap:8px; }
        .climate-card .temperature-control-header { align-items:center; }
        .climate-card .temperature-controls { gap:6px; }
        .climate-card .temperature-power { min-width:72px; padding-inline:7px; }
        .climate-card .temperature-stepper { grid-template-columns:28px minmax(3.5rem,auto) 28px; gap:6px; }
        .climate-card .range-temperature-controls { flex-wrap:wrap; }
        .climate-card .range-steppers { width:100%; }
        .climate-card .range-stepper-control { justify-content:center; }
        .climate-card .control-grid { grid-template-columns:minmax(0,1fr); }
      }
    `;
  }
}

if (!customElements.get('hollow-climate-card')) {
  customElements.define('hollow-climate-card', HomeClimateCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'hollow-climate-card')) {
  window.customCards.push({
    type: 'hollow-climate-card',
    name: 'Hollow Climate',
    description: 'Dynamic climate controls for heating and cooling entities',
  });
}
