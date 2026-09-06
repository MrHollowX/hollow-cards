class HomeStatusCard extends HTMLElement {
  static MODE_REQUEST_TIMEOUT_MS = 8000;
  static RELATIVE_AGE_REFRESH_MS = 30000;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = null;
    this._hass = null;
    this._renderKey = '';
    this._optionKey = '';
    this._pendingMode = '';
    this._pendingModeOrigin = '';
    this._modeRequestToken = 0;
    this._pendingModeTimer = null;
    this._ageTimer = null;
    this._ageState = null;
    this._clickable = false;
    this._showMetrics = true;
    this._modeMenuOpen = false;
    this._modeMenuIndex = 0;
    this._globalEventsWired = false;
    this._wired = false;
  }

  setConfig(config) {
    if (!config || typeof config.house_mode_entity !== 'string' ||
        typeof config.pm25_entity !== 'string' ||
        typeof config.pm10_entity !== 'string') {
      throw new Error('house_mode_entity, pm25_entity, and pm10_entity are required');
    }
    this._closeModeMenu(true);
    this._invalidateModeRequest();
    this._config = {
      house_mode_entity: config.house_mode_entity,
      pm25_entity: config.pm25_entity,
      pm10_entity: config.pm10_entity,
      aqi_entity: typeof config.aqi_entity === 'string' ? config.aqi_entity : '',
      name: typeof config.name === 'string' ? config.name : 'House Status',
      icon: this._configuredIcon(config.icon, 'mdi:home-heart'),
      pm25_icon: this._configuredIcon(config.pm25_icon, 'mdi:blur'),
      pm10_icon: this._configuredIcon(config.pm10_icon, 'mdi:blur-radial'),
      aqi_icon: this._configuredIcon(config.aqi_icon, 'mdi:air-filter'),
      mode_label: typeof config.mode_label === 'string' ? config.mode_label : 'House Mode',
      pm25_label: typeof config.pm25_label === 'string' ? config.pm25_label : 'PM2.5',
      pm10_label: typeof config.pm10_label === 'string' ? config.pm10_label : 'PM10',
      aqi_label: typeof config.aqi_label === 'string' ? config.aqi_label : 'Air Quality',
      pm25_good_max: this._threshold(config.pm25_good_max, 15),
      pm25_moderate_max: this._threshold(config.pm25_moderate_max, 35),
      pm10_good_max: this._threshold(config.pm10_good_max, 45),
      pm10_moderate_max: this._threshold(config.pm10_moderate_max, 100),
      show_aqi: config.show_aqi !== false,
      clickable: config.clickable === true,
      show_metrics: config.show_metrics === true,
      grid_options: config.grid_options && typeof config.grid_options === 'object'
        ? { ...config.grid_options }
        : null
    };
    this._clickable = this._config.clickable;
    this._showMetrics = this._config.show_metrics;
    this._renderKey = '';
    this._optionKey = '';
    this._render();
  }

  _configuredIcon(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  _threshold(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return this._config?.grid_options ||
      { columns: 12, rows: 'auto', min_columns: 6, min_rows: 1 };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    if (!this._wired) {
      this._wired = true;
      this.shadowRoot.addEventListener('pointerdown', event => {
        if (event.target.closest('button,.mode-control')) event.stopPropagation();
      });
      this.shadowRoot.addEventListener('click', event => {
        if (event.target.closest('button')) event.stopPropagation();
        const trigger = event.target.closest('.mode-trigger');
        if (trigger) {
          event.preventDefault();
          event.stopPropagation();
          if (this._modeMenuOpen) {
            this._closeModeMenu(true);
          } else {
            const options = this._modeOptionButtons();
            const currentIndex = Math.max(0, options.findIndex(option => option.dataset.modeValue === this._modeCurrent));
            this._openModeMenu(currentIndex);
          }
          return;
        }
        const option = event.target.closest('[data-mode-option]');
        if (option && !option.disabled) {
          event.preventDefault();
          event.stopPropagation();
          this._selectMode(option.dataset.modeValue);
          return;
        }
        const metric = event.target.closest('[data-entity]');
        if (metric && metric.dataset.entity) this._moreInfo(metric.dataset.entity);
      });
      this.shadowRoot.addEventListener('keydown', event => {
        const metric = event.target.closest('[data-entity]');
        if (metric && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          event.stopPropagation();
          this._moreInfo(metric.dataset.entity);
          return;
        }
        this._handleModeMenuKeydown(event);
      });
      this.shadowRoot.addEventListener('focusout', event => {
        if (!this._modeMenuOpen) return;
        const next = event.relatedTarget;
        if (next && this.shadowRoot.contains(next)) return;
        Promise.resolve().then(() => {
          const active = this.shadowRoot.activeElement;
          if (!active || !this.shadowRoot.contains(active)) this._closeModeMenu();
        });
      });
    }
    if (!this._globalEventsWired) {
      this._globalEventsWired = true;
      document.addEventListener('pointerdown', this._onDocumentPointerDown);
      window.addEventListener('blur', this._onWindowBlur);
      window.addEventListener('resize', this._onViewportChange);
    }
    this._startAgeTimer();
    this._render();
    this._updateRelativeAge();
  }

  disconnectedCallback() {
    this._closeModeMenu();
    this._invalidateModeRequest();
    this._renderKey = '';
    this._restoreAuthoritativeModeDisplay();
    this._stopAgeTimer();
    if (this._globalEventsWired) {
      this._globalEventsWired = false;
      document.removeEventListener('pointerdown', this._onDocumentPointerDown);
      window.removeEventListener('blur', this._onWindowBlur);
      window.removeEventListener('resize', this._onViewportChange);
    }
  }

  _state(entity) {
    return entity && this._hass ? this._hass.states[entity] || null : null;
  }

  _attribute(state, key, fallback = '') {
    return state && state.attributes && state.attributes[key] != null
      ? state.attributes[key]
      : fallback;
  }

  _moreInfo(entity) {
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: entity },
      bubbles: true,
      composed: true
    }));
  }

  _selectMode(option) {
    const state = this._state(this._config.house_mode_entity);
    const options = this._attribute(state, 'options', []);
    if (!state || !Array.isArray(options) || !options.includes(option) ||
        !this._hass || typeof this._hass.callService !== 'function') {
      this._render();
      return;
    }
    this._closeModeMenu(true);
    this._invalidateModeRequest();
    const token = this._modeRequestToken;
    const hass = this._hass;
    const entityId = this._config.house_mode_entity;
    this._pendingMode = option;
    this._pendingModeOrigin = state.state;
    this._pendingModeTimer = setTimeout(() => {
      if (token !== this._modeRequestToken) return;
      this._invalidateModeRequest();
      this._renderKey = '';
      this._render();
    }, HomeStatusCard.MODE_REQUEST_TIMEOUT_MS);
    this._setModeDisplay(option);
    Promise.resolve()
      .then(() => {
        if (token !== this._modeRequestToken || !this.isConnected) return;
        return hass.callService('input_select', 'select_option', {
          entity_id: entityId,
          option
        });
      })
      .then(() => {
        if (token !== this._modeRequestToken) return;
        const authoritative = this._state(entityId);
        if (this._reconcilePendingMode(authoritative)) {
          this._renderKey = '';
          this._render();
        }
      })
      .catch(() => {
        if (token !== this._modeRequestToken) return;
        this._invalidateModeRequest();
        this._renderKey = '';
        this._render();
      });
  }

  _invalidateModeRequest() {
    this._modeRequestToken += 1;
    if (this._pendingModeTimer) clearTimeout(this._pendingModeTimer);
    this._pendingModeTimer = null;
    this._pendingMode = '';
    this._pendingModeOrigin = '';
  }

  _reconcilePendingMode(state) {
    if (!this._pendingMode) return false;
    const authoritative = this._isUnavailable(state) ? '' : String(state.state);
    const accepted = authoritative === this._pendingMode;
    const diverged = authoritative && authoritative !== this._pendingModeOrigin;
    if (!accepted && !diverged) return false;
    this._invalidateModeRequest();
    return true;
  }

  _restoreAuthoritativeModeDisplay() {
    if (!this._config || !this._hass) return;
    const state = this._state(this._config.house_mode_entity);
    const options = this._attribute(state, 'options', []);
    const authoritative = !this._isUnavailable(state) &&
      Array.isArray(options) && options.includes(state.state)
      ? state.state
      : '';
    this._modeCurrent = authoritative;
    this._setModeDisplay(authoritative || 'Unavailable');
  }

  _startAgeTimer() {
    if (this._ageTimer) return;
    this._ageTimer = setInterval(
      () => this._updateRelativeAge(),
      HomeStatusCard.RELATIVE_AGE_REFRESH_MS
    );
  }

  _stopAgeTimer() {
    if (!this._ageTimer) return;
    clearInterval(this._ageTimer);
    this._ageTimer = null;
  }

  _updateRelativeAge() {
    if (this._updated) {
      this._updated.textContent = `Updated ${this._relativeTime(this._ageState)}`;
    }
  }

  _onDocumentPointerDown = event => {
    if (!this._modeMenuOpen) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (!path.includes(this)) this._closeModeMenu();
  };

  _onWindowBlur = () => this._closeModeMenu();

  _onViewportChange = () => {
    if (this._modeMenuOpen) this._positionModeMenu();
  };

  _isUnavailable(state) {
    return !state || ['unknown', 'unavailable', 'none'].includes(String(state.state).toLowerCase());
  }

  _number(state) {
    if (this._isUnavailable(state)) return null;
    const value = Number(state.state);
    return Number.isFinite(value) ? value : null;
  }

  _formatValue(state, fallbackUnit) {
    const value = this._number(state);
    if (value == null) return 'Unavailable';
    const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${formatted} ${this._attribute(state, 'unit_of_measurement', fallbackUnit)}`.trim();
  }

  _quality(state, goodMax, moderateMax) {
    const value = this._number(state);
    if (value == null) return { label: 'Unavailable', tone: 'neutral' };
    if (value <= goodMax) return { label: 'Good', tone: 'good' };
    if (value <= moderateMax) return { label: 'Moderate', tone: 'moderate' };
    return { label: 'High', tone: 'high' };
  }

  _relativeTime(state) {
    if (!state || !state.last_updated) return 'Unavailable';
    const timestamp = new Date(state.last_updated).getTime();
    if (!Number.isFinite(timestamp)) return 'Unavailable';
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  _ensureShell() {
    if (this._shell) return;
    this.shadowRoot.innerHTML = `
      <style>${this._css()}
        .details-toggle,.mode-trigger,.mode-options,.metric{background:var(--status-control);color:var(--status-primary);border-color:var(--status-divider)}
        .mode-label,.mode-trigger ha-icon,.metric-icon,.subtitle{color:var(--status-secondary)}
        .details-toggle.clickable:hover,.mode-option:hover,.mode-option:focus-visible,.mode-option.selected{background:color-mix(in srgb,var(--status-control) 72%,var(--status-surface));color:var(--status-primary)}
        .mode-option.selected{color:var(--status-accent)}
        .details-toggle:focus-visible,.mode-trigger:focus-visible,.mode-option:focus-visible,.metric:focus-visible{outline-color:var(--status-accent)}
      </style>
      <ha-card class="card">
        <div class="header">
          <div class="heading">
            <ha-icon class="hollow-icon"></ha-icon>
            <div class="heading-copy">
              <div class="title"></div>
              <div class="subtitle">Live home overview</div>
            </div>
          </div>
          <div class="header-actions">
            <div class="mode">
              <span class="mode-label"></span>
              <div class="mode-control">
                <button class="mode-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
                  <span class="mode-value"></span>
                  <ha-icon icon="mdi:chevron-down" aria-hidden="true"></ha-icon>
                </button>
                <div class="mode-options" role="listbox" tabindex="-1"></div>
              </div>
            </div>
            <button class="details-toggle" type="button">
              <ha-icon class="details-icon" aria-hidden="true"></ha-icon>
            </button>
          </div>
        </div>
        <div class="details">
          <div class="metrics">
            <button class="metric" type="button" data-kind="pm25">
              <ha-icon class="metric-icon"></ha-icon>
              <span class="metric-copy">
                <span class="metric-label"></span>
                <strong class="metric-value"></strong>
                <span class="metric-status"></span>
              </span>
            </button>
            <button class="metric" type="button" data-kind="pm10">
              <ha-icon class="metric-icon"></ha-icon>
              <span class="metric-copy">
                <span class="metric-label"></span>
                <strong class="metric-value"></strong>
                <span class="metric-status"></span>
              </span>
            </button>
            <button class="metric aqi" type="button" data-kind="aqi">
              <ha-icon class="metric-icon"></ha-icon>
              <span class="metric-copy">
                <span class="metric-label"></span>
                <strong class="metric-value"></strong>
                <span class="metric-status">Common Air Quality Index</span>
              </span>
            </button>
          </div>
          <div class="footer">
            <ha-icon icon="mdi:update"></ha-icon>
            <span class="updated"></span>
          </div>
        </div>
      </ha-card>`;
    this._shell = true;
    this._card = this.shadowRoot.querySelector('.card');
    this._homeIcon = this.shadowRoot.querySelector('.hollow-icon');
    this._title = this.shadowRoot.querySelector('.title');
    this._modeLabel = this.shadowRoot.querySelector('.mode-label');
    this._modeTrigger = this.shadowRoot.querySelector('.mode-trigger');
    this._modeValue = this.shadowRoot.querySelector('.mode-value');
    this._modeOptionsPanel = this.shadowRoot.querySelector('.mode-options');
    this._detailsToggle = this.shadowRoot.querySelector('.details-toggle');
    this._detailsIcon = this.shadowRoot.querySelector('.details-icon');
    this._details = this.shadowRoot.querySelector('.details');
    this._detailsToggle.addEventListener('click', event => {
      event.stopPropagation();
      this._toggleMetrics();
    });
    this._metricsContainer = this.shadowRoot.querySelector('.metrics');
    this._metrics = {
      pm25: this._metric(this.shadowRoot.querySelector('[data-kind="pm25"]')),
      pm10: this._metric(this.shadowRoot.querySelector('[data-kind="pm10"]')),
      aqi: this._metric(this.shadowRoot.querySelector('[data-kind="aqi"]'))
    };
    this._updated = this.shadowRoot.querySelector('.updated');
  }

  _metric(element) {
    return {
      element,
      label: element.querySelector('.metric-label'),
      value: element.querySelector('.metric-value'),
      status: element.querySelector('.metric-status'),
      icon: element.querySelector('.metric-icon')
    };
  }

  _updateMetric(metric, entity, label, value, status, tone, icon) {
    metric.element.dataset.entity = entity || '';
    metric.element.hidden = !entity;
    metric.element.setAttribute('aria-label', `${label}: ${value}. ${status}`);
    metric.label.textContent = label;
    metric.value.textContent = value;
    metric.status.textContent = status;
    metric.element.classList.remove('good', 'moderate', 'high', 'neutral');
    metric.element.classList.add(tone);
    metric.icon.setAttribute('icon', icon);
  }

  _updateOptions(options, modeState) {
    const safeOptions = Array.isArray(options) ? options.filter(option => typeof option === 'string') : [];
    const optionKey = JSON.stringify(safeOptions);
    if (optionKey !== this._optionKey) {
      this._modeOptionsPanel.replaceChildren();
      safeOptions.forEach(option => {
        const item = document.createElement('button');
        item.className = 'mode-option';
        item.type = 'button';
        item.dataset.modeOption = '';
        item.dataset.modeValue = option;
        item.setAttribute('role', 'option');
        item.textContent = option;
        this._modeOptionsPanel.append(item);
      });
      this._optionKey = optionKey;
    }
    this._reconcilePendingMode(this._state(this._config.house_mode_entity));
    const selected = this._pendingMode && safeOptions.includes(this._pendingMode)
      ? this._pendingMode
      : safeOptions.includes(modeState) ? modeState : '';
    this._modeCurrent = selected;
    this._setModeDisplay(selected || 'Unavailable');
    const modeEntityState = this._state(this._config.house_mode_entity);
    const disabled = !safeOptions.length || this._isUnavailable(modeEntityState);
    this._modeTrigger.disabled = disabled;
    this._modeTrigger.setAttribute('aria-label', this._config.mode_label);
    this._modeOptionButtons().forEach(option => {
      option.classList.toggle('selected', option.dataset.modeValue === selected);
      option.setAttribute('aria-selected', String(option.dataset.modeValue === selected));
    });
    if (disabled) this._closeModeMenu();
  }

  _setModeDisplay(value) {
    if (this._modeValue) this._modeValue.textContent = value;
  }

  _modeOptionButtons() {
    return this._modeOptionsPanel
      ? Array.from(this._modeOptionsPanel.querySelectorAll('[data-mode-option]'))
      : [];
  }

  _openModeMenu(index = 0) {
    const options = this._modeOptionButtons();
    if (!options.length || this._modeTrigger.disabled) return;
    this._modeMenuOpen = true;
    this._modeMenuIndex = Math.max(0, Math.min(options.length - 1, index));
    this._card.classList.add('mode-menu-open');
    this._modeOptionsPanel.classList.add('open');
    this._modeTrigger.setAttribute('aria-expanded', 'true');
    this._positionModeMenu();
    options[this._modeMenuIndex].focus();
  }

  _closeModeMenu(focusTrigger = false) {
    if (!this._modeMenuOpen && !this._modeOptionsPanel) return;
    this._modeMenuOpen = false;
    this._modeMenuIndex = 0;
    if (this._card) this._card.classList.remove('mode-menu-open');
    if (this._modeOptionsPanel) this._modeOptionsPanel.classList.remove('open', 'above');
    if (this._modeTrigger) this._modeTrigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger && this._modeTrigger) this._modeTrigger.focus();
  }

  _positionModeMenu() {
    if (!this._modeMenuOpen || !this._modeTrigger || !this._modeOptionsPanel) return;
    const rect = this._modeTrigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = 8;
    const below = Math.max(0, viewportHeight - rect.bottom - gap);
    const above = Math.max(0, rect.top - gap);
    const openAbove = above > below && above >= 48;
    const available = openAbove ? above : below;
    this._modeOptionsPanel.classList.toggle('above', openAbove);
    this._modeOptionsPanel.style.maxHeight = `${Math.max(48, Math.min(220, available || 48))}px`;
  }

  _handleModeMenuKeydown(event) {
    const trigger = event.target.closest('.mode-trigger');
    if (trigger) {
      if (event.key === 'Escape' && this._modeMenuOpen) {
        event.preventDefault();
        event.stopPropagation();
        this._closeModeMenu(true);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ' ||
          event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const options = this._modeOptionButtons();
        const currentIndex = Math.max(0, options.findIndex(option => option.dataset.modeValue === this._modeCurrent));
        this._openModeMenu(event.key === 'ArrowUp' ? options.length - 1 : currentIndex);
        return;
      }
    }
    const option = event.target.closest('[data-mode-option]');
    if (!option) return;
    const options = this._modeOptionButtons();
    const currentIndex = options.indexOf(option);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._closeModeMenu(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this._selectMode(option.dataset.modeValue);
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
      this._modeMenuIndex = (nextIndex + options.length) % options.length;
      options[this._modeMenuIndex].focus();
    }
  }

  _toggleMetrics() {
    if (!this._clickable) return;
    this._closeModeMenu();
    this._showMetrics = !this._showMetrics;
    this._renderKey = '';
    this._updateDetailsToggle();
  }

  _updateDetailsToggle() {
    if (!this._detailsToggle || !this._details || !this._detailsIcon) return;
    const expanded = this._showMetrics;
    this._details.hidden = !expanded;
    this._card.classList.toggle('collapsed', !expanded);
    this._detailsToggle.disabled = !this._clickable;
    this._detailsToggle.classList.toggle('clickable', this._clickable);
    this._detailsToggle.setAttribute('aria-expanded', String(expanded));
    this._detailsToggle.setAttribute(
      'aria-label',
      this._clickable
        ? `${expanded ? 'Hide' : 'Show'} home status details`
        : 'Home status'
    );
    this._detailsIcon.setAttribute('icon', expanded ? 'mdi:chevron-up' : 'mdi:chevron-down');
    this._detailsToggle.hidden = !this._clickable;
  }

  _render() {
    if (!this._hass || !this._config) return;
    this._ensureShell();
    const c = this._config;
    const mode = this._state(c.house_mode_entity);
    const pm25 = this._state(c.pm25_entity);
    const pm10 = this._state(c.pm10_entity);
    const aqi = c.show_aqi && c.aqi_entity ? this._state(c.aqi_entity) : null;
    const options = this._attribute(mode, 'options', []);
    this._ageState = pm25 || pm10 || mode;
    const key = JSON.stringify([
      mode?.state, options, pm25?.state, pm25?.attributes?.unit_of_measurement,
      pm10?.state, pm10?.attributes?.unit_of_measurement, aqi?.state,
      aqi?.attributes?.unit_of_measurement, c.name, c.mode_label, c.pm25_label,
      c.pm10_label, c.aqi_label, c.icon, c.pm25_icon, c.pm10_icon, c.aqi_icon, c.show_aqi, c.pm25_good_max,
      c.pm25_moderate_max, c.pm10_good_max, c.pm10_moderate_max,
      this._clickable, this._showMetrics
    ]);
    if (key === this._renderKey) {
      this._updateRelativeAge();
      return;
    }
    this._renderKey = key;

    this._title.textContent = c.name;
    this._homeIcon.setAttribute('icon', c.icon);
    this._modeLabel.textContent = c.mode_label;
    this._updateDetailsToggle();
    this._updateOptions(options, mode?.state || '');

    const pm25Quality = this._quality(pm25, c.pm25_good_max, c.pm25_moderate_max);
    const pm10Quality = this._quality(pm10, c.pm10_good_max, c.pm10_moderate_max);
    this._updateMetric(this._metrics.pm25, c.pm25_entity, c.pm25_label,
      this._formatValue(pm25, 'ug/m3'), pm25Quality.label, pm25Quality.tone, c.pm25_icon);
    this._updateMetric(this._metrics.pm10, c.pm10_entity, c.pm10_label,
      this._formatValue(pm10, 'ug/m3'), pm10Quality.label, pm10Quality.tone, c.pm10_icon);
    const aqiEntity = c.show_aqi ? c.aqi_entity : '';
    const aqiValue = this._formatValue(aqi, 'CAQI');
    const aqiStatus = !aqi ? 'Not configured' : this._isUnavailable(aqi) ? 'Unavailable' : 'Common Air Quality Index';
    this._updateMetric(this._metrics.aqi, aqiEntity, c.aqi_label, aqiValue,
      aqiStatus, 'neutral', c.aqi_icon);
    this._metricsContainer.style.gridTemplateColumns =
      `repeat(${aqiEntity ? 3 : 2},minmax(0,1fr))`;
    this._updateRelativeAge();
  }

  _css() {
    return `
      :host{display:block;width:100%;min-width:0;color:var(--primary-text-color,#f5f7fb);font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;--status-surface:var(--card-background-color,var(--ha-card-background,#212c42));--status-card-radius:var(--hollow-status-card-border-radius,20px);--status-control:var(--secondary-background-color,#2b3850);--status-primary:var(--primary-text-color,#f5f7fb);--status-secondary:var(--secondary-text-color,#91a2bb);--status-accent:var(--primary-color,var(--accent-color,#ffb340));--status-divider:var(--divider-color,rgba(255,255,255,.1))}
      .card{box-sizing:border-box;width:100%;overflow:hidden;padding:16px;background:var(--status-surface)!important;border:1px solid var(--status-divider)!important;border-radius:var(--status-card-radius)!important;box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important;container:status-card / inline-size}
      .card.mode-menu-open{position:relative;z-index:20;overflow:visible}
      .header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;min-height:52px;margin-bottom:14px}
      .heading{display:flex;align-items:center;gap:10px;min-width:0}
      .hollow-icon{flex:none;color:var(--status-accent);--mdc-icon-size:27px}
      .heading-copy{min-width:0}
      .title{font-size:16px;font-weight:800;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .subtitle{margin-top:3px;color:var(--status-secondary);font-size:11px}
      .header-actions{display:flex;align-items:center;gap:8px;min-width:0}
      .details-toggle{display:grid;place-items:center;flex:none;width:32px;height:32px;padding:0;border:0;border-radius:9px;background:rgba(43,56,80,.58);color:#91a2bb}
      .details-toggle.clickable{cursor:pointer;-webkit-tap-highlight-color:transparent}
      .details-toggle.clickable:hover{background:#2b3850;color:#f5f7fb}
      .details-toggle.clickable:active{transform:scale(.94)}
      .details-toggle:focus-visible{outline:3px solid #3d8bfd;outline-offset:2px}
      .details-toggle[hidden],.details[hidden]{display:none}
      .details-icon{--mdc-icon-size:20px}
      .mode{display:grid;gap:4px;min-width:104px;width:clamp(104px,31cqw,130px)}
      .mode-label{color:#91a2bb;font-size:10px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:.05em}
      .mode-control{position:relative}
      .mode-trigger{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;min-height:36px;padding:5px 8px 5px 10px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:#2b3850;color:#f5f7fb;font:inherit;font-size:12px;font-weight:750;text-align:left;cursor:pointer}
      .mode-trigger ha-icon{flex:none;color:#91a2bb;--mdc-icon-size:19px}
      .mode-trigger:focus-visible,.mode-option:focus-visible{outline:3px solid #3d8bfd;outline-offset:2px}
      .mode-trigger:disabled{color:#91a2bb;cursor:not-allowed;opacity:.8}
      .mode-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .mode-options{display:none;position:absolute;z-index:20;top:calc(100% + 5px);right:0;left:0;overflow-y:auto;overscroll-behavior:contain;padding:4px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:#2b3850;box-shadow:0 12px 28px rgba(0,0,0,.35)}
      .mode-options.open{display:block}
      .mode-options.above{top:auto;bottom:calc(100% + 5px)}
      .mode-option{box-sizing:border-box;display:block;width:100%;padding:8px 9px;border:0;border-radius:7px;background:transparent;color:#f5f7fb;font:inherit;font-size:12px;font-weight:650;line-height:1.25;text-align:left;cursor:pointer}
      .mode-option:hover,.mode-option:focus-visible,.mode-option.selected{background:rgba(255,255,255,.1);color:#f5f7fb}
      .mode-option.selected{color:#ffb340}
      .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .metric{display:flex;align-items:center;gap:9px;min-width:0;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:#26334b;color:#f5f7fb;text-align:left;cursor:pointer}
      .metric[hidden]{display:none}
      .metric:focus-visible{outline:3px solid #3d8bfd;outline-offset:2px}
      .metric-icon{flex:none;color:#91a2bb;--mdc-icon-size:22px}
      .metric.good .metric-icon,.metric.good .metric-status{color:#53d38a}
      .metric.moderate .metric-icon,.metric.moderate .metric-status{color:#ffb340}
      .metric.high .metric-icon,.metric.high .metric-status{color:#ff6b6b}
      .metric.neutral .metric-icon,.metric.neutral .metric-status{color:#91a2bb}
      .metric-copy{display:flex;flex-direction:column;min-width:0}
      .metric-label{color:#91a2bb;font-size:10px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .metric-value{margin-top:3px;font-size:14px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .metric-status{margin-top:4px;font-size:10px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .footer{display:flex;align-items:center;gap:5px;margin-top:11px;color:#74859e;font-size:10px}
      .footer ha-icon{--mdc-icon-size:13px}
      @container status-card (max-width:560px){.card{padding:13px}.header{gap:12px;min-height:50px}.title{font-size:15px}.metrics{gap:6px}.metric{gap:5px;padding:7px;border-radius:11px}.metric-icon{--mdc-icon-size:18px}.metric-value{font-size:12px}.metric-status{margin-top:3px;font-size:9px}}
      @container status-card (max-width:310px){.header{grid-template-columns:minmax(0,1fr);grid-template-areas:"heading" "actions";gap:10px}.heading{grid-area:heading}.header-actions{grid-area:actions;justify-content:space-between;width:100%}.mode{width:clamp(104px,50cqw,150px);min-width:0}.details-toggle{justify-self:end}}
      .card.collapsed{padding-bottom:10px}
      .card.collapsed .header{margin-bottom:0}
    `;
  }
}

if (!customElements.get('hollow-status-card')) {
  customElements.define('hollow-status-card', HomeStatusCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'hollow-status-card')) {
  window.customCards.push({
    type: 'hollow-status-card',
    name: 'Hollow Status',
    description: 'House mode selector with PM2.5, PM10, and optional CAQI status'
  });
}
