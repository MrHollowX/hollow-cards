class HomeEntityStatusCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._numericValues = new Map();
    this._renderKey = '';
  }

  setConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const entities = Array.isArray(source.entities) ? source.entities
      .map(entry => typeof entry === 'string' ? { entity: entry } : entry)
      .filter(entry => entry && typeof entry.entity === 'string' && entry.entity.includes('.'))
      : [];
    if (!entities.length) throw new Error('At least one entity is required');

    this._config = {
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Status',
      icon: typeof source.icon === 'string' && source.icon ? source.icon : 'mdi:chart-box-outline',
      show_header: source.show_header !== false,
      entity_layout: ['horizontal', 'vertical'].includes(source.entity_layout)
        ? source.entity_layout
        : 'vertical',
      metric_layout: source.metric_layout === 'vertical' ? 'vertical' : 'row',
      entities: entities.map(entry => Object.assign({}, entry)),
    };
    this._numericValues = new Map();
    this._renderKey = '';
    this._render();
  }

  getCardSize() {
    return 3;
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
    this.shadowRoot.addEventListener('click', event => {
      const metric = event.target.closest('[data-entity]');
      if (!metric || !metric.dataset.entity) return;
      event.preventDefault();
      event.stopPropagation();
      this._moreInfo(metric.dataset.entity);
    });
    this.shadowRoot.addEventListener('keydown', event => {
      const metric = event.target.closest('[data-entity]');
      if (!metric || !metric.dataset.entity || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      this._moreInfo(metric.dataset.entity);
    });
  }

  _state(entity) {
    return this._hass && entity ? this._hass.states[entity] || null : null;
  }

  _number(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  _isUnavailable(state) {
    return !state || ['unknown', 'unavailable', 'none'].includes(String(state.state).toLowerCase());
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

  _friendlyState(state, metric) {
    if (this._isUnavailable(state)) return 'Unavailable';
    const raw = String(state.state);
    const mapped = metric.state_map && typeof metric.state_map === 'object'
      ? metric.state_map[raw]
      : null;
    if (typeof mapped === 'string' && mapped) return mapped;
    if (!metric.entity.startsWith('binary_sensor.')) return raw;

    const active = this._isActive(raw, metric);
    const deviceClass = String(state.attributes?.device_class || '').toLowerCase();
    if (['motion', 'occupancy', 'presence', 'sound', 'smoke', 'gas', 'safety', 'tamper', 'vibration'].includes(deviceClass)) {
      return active ? 'Detected' : 'Clear';
    }
    if (['door', 'window', 'garage_door', 'opening'].includes(deviceClass)) {
      return active ? 'Open' : 'Closed';
    }
    if (['moisture', 'problem'].includes(deviceClass)) return active ? 'Detected' : 'Clear';
    if (['battery', 'connectivity'].includes(deviceClass)) return active ? 'Problem' : 'Normal';
    return active ? 'On' : 'Off';
  }

  _isActive(value, metric) {
    const activeStates = Array.isArray(metric.active_state)
      ? metric.active_state
      : [metric.active_state == null ? 'on' : metric.active_state];
    return activeStates.map(item => String(item).toLowerCase()).includes(String(value).toLowerCase());
  }

  _formatNumber(value, precision) {
    const digits = Number.isInteger(Number(precision)) && Number(precision) >= 0
      ? Number(precision)
      : 1;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }

  _dotRange(value, ranges) {
    if (!Array.isArray(ranges)) return null;
    for (const range of ranges) {
      if (!range || typeof range !== 'object') continue;
      const min = range.min == null ? null : this._number(range.min);
      const max = range.max == null ? null : this._number(range.max);
      const belowMin = min != null && (value < min || (range.min_exclusive === true && value === min));
      const aboveMax = max != null && (value > max || (range.max_exclusive === true && value === max));
      if (belowMin || aboveMax) continue;
      const tone = ['blue', 'light-blue', 'green', 'yellow', 'orange', 'red'].includes(range.tone)
        ? range.tone
        : '';
      const configuredDots = this._number(range.dots);
      const dots = configuredDots == null
        ? null
        : Math.max(1, Math.min(5, Math.round(configuredDots)));
      return { dots, tone };
    }
    return null;
  }

  _metric(metric) {
    const state = this._state(metric.entity);
    const unavailable = this._isUnavailable(state);
    const numericValue = this._number(state?.state);
    const isNumeric = numericValue != null;
    const deviceClass = String(state?.attributes?.device_class || '').toLowerCase();
    const isMotionSensor = metric.entity.startsWith('binary_sensor.') &&
      ['motion', 'occupancy', 'presence'].includes(deviceClass);
    const isContactSensor = metric.entity.startsWith('binary_sensor.') &&
      ['door', 'window', 'garage_door', 'opening'].includes(deviceClass);
    const isActive = !unavailable && !isNumeric && this._isActive(state.state, metric);
    const min = this._number(metric.min);
    const max = this._number(metric.max);
    const validRange = min != null && max != null && max > min;
    const normalized = validRange && isNumeric
      ? Math.max(0, Math.min(1, (numericValue - min) / (max - min)))
      : null;
    const dotRange = isNumeric ? this._dotRange(numericValue, metric.dot_ranges) : null;
    const hideDotsBelowMinimum = isNumeric && metric.zero_below_min === true &&
      min != null && numericValue < min;
    const activeDots = unavailable || hideDotsBelowMinimum
      ? 0
      : isNumeric
        ? dotRange && dotRange.dots != null
          ? dotRange.dots
          : normalized == null
          ? 0
          : Math.max(1, Math.min(5, Math.ceil(
            (metric.color_direction === 'high-to-low' ? 1 - normalized : normalized) * 5
          )))
        : isActive
          ? Math.max(1, Math.min(5, Number(metric.active_dots) || 5))
          : Math.max(0, Math.min(5, Number(metric.inactive_dots) || 0));
    const label = typeof metric.label === 'string' && metric.label
      ? metric.label
      : state?.attributes?.friendly_name || metric.entity;
    const unit = typeof metric.unit === 'string'
      ? metric.unit
      : state?.attributes?.unit_of_measurement || '';
    const value = unavailable
      ? '--'
      : isNumeric
        ? this._formatNumber(numericValue, metric.precision)
        : this._friendlyState(state, metric);
    const detail = unavailable
      ? 'Unavailable'
      : isNumeric
        ? unit
        : state?.attributes?.device_class || '';
    return {
      activeDots,
      detail,
      dotColorMode: metric.dot_color_mode === 'low-to-high' ? 'low-to-high' : '',
      isMotionActive: isMotionSensor && isActive,
      isNumeric,
      label,
      state,
      stateValue: state?.state ?? '',
      tone: metric.preserve_dot_colors === true
        ? ''
        : dotRange?.tone || (isContactSensor && isActive ? 'green' : ''),
      unavailable,
      unit,
      value,
    };
  }

  _moreInfo(entity) {
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: entity },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    if (!this._hass || !this._config) return;
    const previousNumericValues = this._numericValues || new Map();
    const metrics = this._config.entities.map(metric => {
      const value = this._metric(metric);
      return {
        config: metric,
        value,
        valueUpdated: value.isNumeric &&
          previousNumericValues.has(metric.entity) &&
          previousNumericValues.get(metric.entity) !== value.stateValue,
      };
    });
    this._numericValues = new Map(metrics
      .filter(({ value }) => value.isNumeric)
      .map(({ config, value }) => [config.entity, value.stateValue]));
    const metricCount = Math.max(1, Math.min(6, metrics.length));
    const renderKey = JSON.stringify({
      name: this._config.name,
      icon: this._config.icon,
      showHeader: this._config.show_header,
      layout: this._config.entity_layout,
      metricLayout: this._config.metric_layout,
      metrics: metrics.map(({ config, value }) => [
        config.entity,
        config.label,
        config.min,
        config.max,
        config.color_direction,
        config.active_state,
        value.state?.state,
        value.state?.attributes?.unit_of_measurement,
        value.state?.attributes?.device_class,
      ]),
    });
    if (renderKey === this._renderKey) return;
    this._renderKey = renderKey;

    const content = metrics.map(({ config, value, valueUpdated }) => {
      const dotOrder = this._config.metric_layout === 'vertical'
        ? [4, 3, 2, 1, 0]
        : [0, 1, 2, 3, 4];
      const dots = dotOrder.map(index =>
        `<span class="dot dot-${index}${index < value.activeDots ? ' active' : ''}" aria-hidden="true"></span>`
      ).join('');
      const valueText = value.unit && !value.unavailable && this._number(value.state?.state) != null
        ? `${value.value} ${value.unit}`
        : value.value;
      return `<button class="metric${value.unavailable ? ' unavailable' : ''}${value.isMotionActive ? ' motion-active' : ''}${valueUpdated ? ' value-updated' : ''}${value.dotColorMode ? ` dot-color-${value.dotColorMode}` : ''}${value.tone ? ` dot-tone-${value.tone}` : ''}" type="button"
        data-entity="${this._escape(config.entity)}"
        aria-label="Show details for ${this._escape(value.label)}: ${this._escape(valueText)}">
        <span class="dots" aria-hidden="true">${dots}</span>
        <span class="metric-label">${this._escape(value.label)}</span>
        <strong>${this._escape(valueText)}</strong>
      </button>`;
    }).join('');

    this.shadowRoot.innerHTML = `<style>${this._css()}</style>
      <ha-card class="card${this._config.show_header ? '' : ' header-hidden'}">
        ${this._config.show_header ? `<div class="header">
          <ha-icon icon="${this._escape(this._config.icon)}"></ha-icon>
          <span>${this._escape(this._config.name)}</span>
        </div>` : ''}
        <div class="metrics ${this._config.entity_layout} metric-${this._config.metric_layout}"
          style="--metric-count:${metricCount}">${content}</div>
      </ha-card>`;
  }

  _css() {
    return `
      :host {
        display:block;
        min-width:0;
        width:100%;
        font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;
        --status-background:var(--card-background-color,var(--ha-card-background,#212c42));
        --status-card-radius:var(--home-entity-status-card-border-radius,20px);
        --status-primary:var(--primary-text-color,#f5f7fb);
        --status-secondary:var(--secondary-text-color,#91a2bb);
        --status-muted:var(--disabled-text-color,#66758f);
        --status-accent:var(--primary-color,#ffb340);
        --status-divider:var(--divider-color,rgba(255,255,255,.08));
      }
      .card {
        box-sizing:border-box;
        min-width:0;
        padding:18px 17px 13px;
        overflow:hidden;
        background:var(--status-background);
        color:var(--status-primary);
        border:1px solid var(--status-divider);
        border-radius:var(--status-card-radius);
        box-shadow:0 4px 14px rgba(0,0,0,.16);
      }
      .card * { box-sizing:border-box; }
      .header { display:flex; align-items:center; gap:9px; min-width:0; font-size:16px; font-weight:750; line-height:1.2; }
      .header ha-icon { color:var(--status-accent); --mdc-icon-size:21px; }
      .header span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .metrics { display:flex; gap:0; margin-top:8px; }
      .header-hidden .metrics { margin-top:0; }
      .card.header-hidden { padding:11px 13px; }
      .metrics.vertical { flex-direction:column; }
      .metrics.horizontal { flex-direction:row; }
      .metric {
        display:grid;
        grid-template-columns:66px minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        min-width:0;
        min-height:51px;
        padding:12px 0;
        border:0;
        border-radius:0;
        background:transparent;
        color:var(--status-primary);
        cursor:pointer;
        font:inherit;
        text-align:left;
      }
      .metrics.vertical .metric + .metric { border-top:1px solid var(--status-divider); }
      .metrics.horizontal.metric-row .metric { flex:1 1 0; grid-template-columns:1fr; text-align:center; }
      .metrics.horizontal.metric-row .metric + .metric { border-left:1px solid var(--status-divider); }
      .metric:focus-visible { outline:2px solid var(--status-accent); outline-offset:3px; }
      .dots { display:flex; gap:5px; }
      .metrics.horizontal.metric-row .dots { flex-direction:column; justify-self:center; }
      .metrics.horizontal.metric-vertical {
        display:grid;
        grid-template-columns:repeat(var(--metric-count),minmax(0,1fr));
      }
      .metrics.metric-vertical .metric {
        flex:1 1 0;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:flex-start;
        min-height:103px;
        gap:4px;
        padding:5px 3px;
        text-align:center;
      }
      .metrics.metric-vertical .metric-label {
        order:1;
        max-width:100%;
      }
      .metrics.metric-vertical .dots {
        order:2;
        flex-direction:column;
        gap:6px;
        min-height:49px;
        justify-content:center;
      }
      .metrics.metric-vertical .metric strong {
        order:3;
        margin-top:6px;
        max-width:100%;
        font-size:13px;
        font-weight:500;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .metrics.horizontal.metric-vertical .metric + .metric { position:relative; }
      .metrics.horizontal.metric-vertical .metric + .metric::before {
        content:'';
        position:absolute;
        top:50%;
        left:0;
        width:1px;
        height:58px;
        background:rgba(255,255,255,.09);
        transform:translateY(-50%);
      }
      .dot { width:6px; height:6px; border-radius:50%; background:var(--status-secondary); box-shadow:0 0 0 1px color-mix(in srgb,var(--status-secondary) 55%,var(--status-primary)); opacity:1; }
      .dot-0 { --dot-color:#1f7a45; }
      .dot-1 { --dot-color:#8ed45b; }
      .dot-2 { --dot-color:#f2d33f; }
      .dot-3 { --dot-color:#ff9c32; }
      .dot-4 { --dot-color:#f04c56; }
      .dot.active { background:var(--dot-color); box-shadow:0 0 0 1px var(--status-background),0 0 0 2px var(--dot-color); opacity:1; }
      .metric.dot-tone-blue .dot.active { --dot-color:#3d8bfd; }
      .metric.dot-tone-light-blue .dot.active { --dot-color:#67c8ff; }
      .metric.dot-tone-light-blue strong { color:#67c8ff; }
      .metric.dot-tone-green .dot.active { --dot-color:#53d38a; }
      .metric.dot-tone-yellow .dot.active { --dot-color:#ffb340; }
      .metric.dot-tone-orange .dot.active { --dot-color:#ff8c42; }
      .metric.dot-tone-red .dot.active { --dot-color:#f04c56; }
      .metric.dot-color-low-to-high .dot-0.active { --dot-color:#ff8c42; }
      .metric.dot-color-low-to-high .dot-1.active { --dot-color:#ffb340; }
      .metric.dot-color-low-to-high .dot-2.active { --dot-color:#f2d33f; }
      .metric.dot-color-low-to-high .dot-3.active { --dot-color:#8ed45b; }
      .metric.dot-color-low-to-high .dot-4.active { --dot-color:#53d38a; }
      .metric.value-updated .dot.active {
        animation:metric-update-sweep .56s ease-out both;
        transform-origin:center;
      }
      .metric.value-updated .dot-0 { animation-delay:0s; }
      .metric.value-updated .dot-1 { animation-delay:.07s; }
      .metric.value-updated .dot-2 { animation-delay:.14s; }
      .metric.value-updated .dot-3 { animation-delay:.21s; }
      .metric.value-updated .dot-4 { animation-delay:.28s; }
      @keyframes metric-update-sweep {
        0% { opacity:.38; transform:scale(.76); }
        50% { opacity:1; transform:scale(1.42); }
        100% { opacity:1; transform:scale(1); }
      }
      .metric.motion-active .dot.active {
        background:#53d38a;
        box-shadow:0 0 0 1px var(--status-background),0 0 0 2px #53d38a;
        transform-origin:center;
      }
      .metric.motion-active .dot-0,
      .metric.motion-active .dot-4 { animation:motion-wave-outer 1.8s ease-in-out infinite; }
      .metric.motion-active .dot-1,
      .metric.motion-active .dot-3 { animation:motion-wave-inner 1.8s ease-in-out infinite; }
      .metric.motion-active .dot-2 { animation:motion-wave-center 1.8s ease-in-out infinite; }
      @keyframes motion-wave-outer {
        0%, 7%, 63%, 70% { opacity:1; transform:scale(1.38); }
        15%, 55%, 80%, 100% { opacity:.38; transform:scale(.82); }
      }
      @keyframes motion-wave-inner {
        0%, 8%, 25%, 42%, 58%, 100% { opacity:.38; transform:scale(.82); }
        13%, 20%, 46%, 53% { opacity:1; transform:scale(1.38); }
      }
      @keyframes motion-wave-center {
        0%, 25%, 42%, 100% { opacity:.38; transform:scale(.82); }
        29%, 37% { opacity:1; transform:scale(1.38); }
      }
      @media (prefers-reduced-motion:reduce) {
        .metric.motion-active .dot.active,
        .metric.value-updated .dot.active { animation:none; opacity:1; transform:none; }
      }
      .metric-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--status-secondary); font-size:12px; font-weight:700; }
      .metric strong { min-width:0; color:var(--status-primary); font-size:15px; font-weight:650; line-height:1.15; white-space:nowrap; }
      .metric.unavailable strong { color:var(--status-secondary); }
      @media (max-width:380px) {
        .card { padding:15px 13px 11px; }
        .metric { grid-template-columns:56px minmax(0,1fr) auto; gap:7px; }
        .metric-label { font-size:11px; }
        .metric strong { font-size:14px; }
        .metrics.horizontal { flex-direction:column; }
        .metrics.horizontal.metric-row .metric { grid-template-columns:auto minmax(0,1fr); text-align:left; }
        .metrics.horizontal.metric-row .dots { flex-direction:row; justify-self:auto; }
        .metrics.horizontal.metric-row .metric + .metric { border-left:0; border-top:1px solid rgba(255,255,255,.09); }
        .metrics.horizontal.metric-vertical .metric + .metric { border-left:0; border-top:1px solid rgba(255,255,255,.09); }
      }
    `;
  }
}

customElements.define('home-entity-status-card', HomeEntityStatusCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-entity-status-card',
  name: 'Home Entity Status',
  description: 'Dot-based status groups for numeric sensors and binary entities',
});
