class HomeStatusCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = null;
    this._hass = null;
    this._renderKey = '';
    this._optionKey = '';
    this._pendingMode = '';
    this._wired = false;
  }

  setConfig(config) {
    if (!config || typeof config.house_mode_entity !== 'string' ||
        typeof config.pm25_entity !== 'string' ||
        typeof config.pm10_entity !== 'string') {
      throw new Error('house_mode_entity, pm25_entity, and pm10_entity are required');
    }
    this._config = {
      house_mode_entity: config.house_mode_entity,
      pm25_entity: config.pm25_entity,
      pm10_entity: config.pm10_entity,
      aqi_entity: typeof config.aqi_entity === 'string' ? config.aqi_entity : '',
      name: typeof config.name === 'string' ? config.name : 'House Status',
      mode_label: typeof config.mode_label === 'string' ? config.mode_label : 'House Mode',
      pm25_label: typeof config.pm25_label === 'string' ? config.pm25_label : 'PM2.5',
      pm10_label: typeof config.pm10_label === 'string' ? config.pm10_label : 'PM10',
      aqi_label: typeof config.aqi_label === 'string' ? config.aqi_label : 'Air Quality',
      pm25_good_max: this._threshold(config.pm25_good_max, 15),
      pm25_moderate_max: this._threshold(config.pm25_moderate_max, 35),
      pm10_good_max: this._threshold(config.pm10_good_max, 45),
      pm10_moderate_max: this._threshold(config.pm10_moderate_max, 100),
      show_aqi: config.show_aqi !== false
    };
    this._renderKey = '';
    this._optionKey = '';
    this._pendingMode = '';
    this._render();
  }

  _threshold(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 1 };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    if (this._wired) return;
    this._wired = true;
    this.shadowRoot.addEventListener('change', event => {
      if (event.target === this._modeSelect) this._selectMode(event.target.value);
    });
    this.shadowRoot.addEventListener('click', event => {
      const metric = event.target.closest('[data-entity]');
      if (metric && metric.dataset.entity) this._moreInfo(metric.dataset.entity);
    });
    this.shadowRoot.addEventListener('keydown', event => {
      const metric = event.target.closest('[data-entity]');
      if (metric && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this._moreInfo(metric.dataset.entity);
      }
    });
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
    this._pendingMode = option;
    Promise.resolve(this._hass.callService('input_select', 'select_option', {
      entity_id: this._config.house_mode_entity,
      option
    })).catch(() => {
      this._pendingMode = '';
      this._renderKey = '';
      this._render();
    });
  }

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
      <style>${this._css()}</style>
      <ha-card class="card">
        <div class="header">
          <div class="heading">
            <ha-icon class="home-icon" icon="mdi:home-heart"></ha-icon>
            <div class="heading-copy">
              <div class="title"></div>
              <div class="subtitle">Live home overview</div>
            </div>
          </div>
          <div class="mode">
            <label class="mode-label"></label>
            <select class="mode-select"></select>
          </div>
        </div>
        <div class="metrics">
          <button class="metric" type="button" data-kind="pm25">
            <ha-icon class="metric-icon" icon="mdi:blur"></ha-icon>
            <span class="metric-copy">
              <span class="metric-label"></span>
              <strong class="metric-value"></strong>
              <span class="metric-status"></span>
            </span>
          </button>
          <button class="metric" type="button" data-kind="pm10">
            <ha-icon class="metric-icon" icon="mdi:blur-radial"></ha-icon>
            <span class="metric-copy">
              <span class="metric-label"></span>
              <strong class="metric-value"></strong>
              <span class="metric-status"></span>
            </span>
          </button>
          <button class="metric aqi" type="button" data-kind="aqi">
            <ha-icon class="metric-icon" icon="mdi:air-filter"></ha-icon>
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
      </ha-card>`;
    this._shell = true;
    this._title = this.shadowRoot.querySelector('.title');
    this._modeLabel = this.shadowRoot.querySelector('.mode-label');
    this._modeSelect = this.shadowRoot.querySelector('.mode-select');
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
    metric.element.style.display = entity ? '' : 'none';
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
      this._modeSelect.replaceChildren();
      if (!safeOptions.length) {
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Unavailable';
        this._modeSelect.append(empty);
      } else {
        safeOptions.forEach(option => {
          const item = document.createElement('option');
          item.value = option;
          item.textContent = option;
          this._modeSelect.append(item);
        });
      }
      this._optionKey = optionKey;
    }
    if (this._pendingMode && modeState === this._pendingMode) this._pendingMode = '';
    const selected = this._pendingMode && safeOptions.includes(this._pendingMode)
      ? this._pendingMode
      : safeOptions.includes(modeState) ? modeState : '';
    this._modeSelect.value = selected;
    const modeEntityState = this._state(this._config.house_mode_entity);
    this._modeSelect.disabled = !safeOptions.length || this._isUnavailable(modeEntityState);
    this._modeSelect.setAttribute('aria-label', this._config.mode_label);
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
    const key = JSON.stringify([
      mode?.state, options, pm25?.state, pm25?.attributes?.unit_of_measurement,
      pm10?.state, pm10?.attributes?.unit_of_measurement, aqi?.state,
      aqi?.attributes?.unit_of_measurement, c.name, c.mode_label, c.pm25_label,
      c.pm10_label, c.aqi_label, c.show_aqi, c.pm25_good_max,
      c.pm25_moderate_max, c.pm10_good_max, c.pm10_moderate_max
    ]);
    if (key === this._renderKey) return;
    this._renderKey = key;

    this._title.textContent = c.name;
    this._modeLabel.textContent = c.mode_label;
    this._updateOptions(options, mode?.state || '');

    const pm25Quality = this._quality(pm25, c.pm25_good_max, c.pm25_moderate_max);
    const pm10Quality = this._quality(pm10, c.pm10_good_max, c.pm10_moderate_max);
    this._updateMetric(this._metrics.pm25, c.pm25_entity, c.pm25_label,
      this._formatValue(pm25, 'ug/m3'), pm25Quality.label, pm25Quality.tone, 'mdi:blur');
    this._updateMetric(this._metrics.pm10, c.pm10_entity, c.pm10_label,
      this._formatValue(pm10, 'ug/m3'), pm10Quality.label, pm10Quality.tone, 'mdi:blur-radial');
    const aqiValue = this._formatValue(aqi, 'CAQI');
    const aqiStatus = !aqi ? 'Not configured' : this._isUnavailable(aqi) ? 'Unavailable' : 'Common Air Quality Index';
    this._updateMetric(this._metrics.aqi, c.aqi_entity, c.aqi_label, aqiValue,
      aqiStatus, 'neutral', 'mdi:air-filter');
    this._updated.textContent = `Updated ${this._relativeTime(pm25 || pm10 || mode)}`;
  }

  _css() {
    return `
      :host{display:block;width:100%;min-width:0;color:#f5f7fb;font-family:-apple-system,'Segoe UI',Helvetica,sans-serif}
      .card{box-sizing:border-box;width:100%;overflow:hidden;padding:16px;background:#212c42;border:1px solid rgba(255,255,255,.1);border-radius:20px;box-shadow:0 4px 14px rgba(0,0,0,.16)}
      .header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
      .heading{display:flex;align-items:center;gap:10px;min-width:0}
      .home-icon{flex:none;color:#ffb340;--mdc-icon-size:27px}
      .heading-copy{min-width:0}
      .title{font-size:16px;font-weight:800;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .subtitle{margin-top:3px;color:#91a2bb;font-size:11px}
      .mode{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:104px}
      .mode-label{color:#91a2bb;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
      .mode-select{box-sizing:border-box;max-width:150px;min-height:34px;padding:5px 25px 5px 9px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:#2b3850;color:#fff;font:inherit;font-size:12px;font-weight:750;cursor:pointer}
      .mode-select:focus-visible{outline:3px solid #3d8bfd;outline-offset:2px}
      .mode-select:disabled{color:#91a2bb;cursor:not-allowed;opacity:.8}
      .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .metric{display:flex;align-items:center;gap:9px;min-width:0;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:#26334b;color:#f5f7fb;text-align:left;cursor:pointer}
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
      @media(max-width:560px){.card{padding:13px}.header{align-items:flex-start;gap:10px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.metric.aqi{grid-column:1/-1}.title{font-size:15px}.mode{min-width:92px}.mode-select{max-width:130px}}
      @media(max-width:380px){.header{display:block}.mode{align-items:flex-start;margin-top:10px}.mode-select{max-width:100%}.metrics{grid-template-columns:1fr}.metric.aqi{grid-column:auto}}
    `;
  }
}

customElements.define('home-status-card', HomeStatusCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-status-card',
  name: 'Home Status',
  description: 'House mode selector with PM2.5, PM10, and optional CAQI status'
});
