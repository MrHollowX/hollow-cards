class HomeHeaderCard extends HTMLElement {
  static FORECAST_REFRESH_MS = 30 * 60 * 1000;

  constructor() {
    super();
    this._timer = null;
    this._shell = false;
    this._forecastCache = null;
    this._forecastPromise = null;
    this._forecastSignature = '';
    this._forecastGeneration = 0;
  }

  setConfig(c) {
    const previous = this._c || {};
    const previousForecastDays = this._forecastDays;
    const previousShowForecast = this._showForecast;
    this._c = c && typeof c === 'object' ? { ...c } : {};
    this._clickable = this._c.clickable === true;
    this._forecastDays = this._clampForecastDays(this._c.forecast_days);
    this._showForecast = this._c.show_forecast !== false;
    if (previous.weather_entity !== this._c.weather_entity ||
        previousForecastDays !== this._forecastDays ||
        previousShowForecast !== this._showForecast) {
      this._invalidateForecastRequest();
    }
    if (previous.weather_entity !== this._c.weather_entity) {
      this._forecastCache = null;
    }
    this._forecastSignature = '';
    if (this._el) {
      this._renderGreeting();
      this._updateHeaderInteraction();
      if (this._hass) this._renderCurrentWeather();
      this._renderForecast(
        this._forecastCache ? this._forecastCache.items : [],
        this._showForecast ? 'Loading forecast…' : ''
      );
      this._ensureForecast();
    }
  }

  getCardSize() { return 3; }

  set hass(h) {
    this._hass = h;
    this._render();
    this._ensureForecast();
  }

  connectedCallback() {
    this._render();
    this._ensureForecast();
  }

  disconnectedCallback() {
    this._stopTimer();
  }

  _clampForecastDays(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 3;
    return Math.min(5, Math.max(1, Math.round(parsed)));
  }

  _st(e) {
    if (!e || !this._hass) return 'unavailable';
    const state = this._hass.states[e];
    return state ? state.state : 'unavailable';
  }

  _attr(e, a, d) {
    if (!e || !this._hass) return d;
    const state = this._hass.states[e];
    return state && state.attributes[a] != null ? state.attributes[a] : d;
  }

  _number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  _formatTemperature(value, unit) {
    const parsed = this._number(value);
    return parsed == null || !unit ? '--' : `${Math.round(parsed)} ${unit}`;
  }

  _formatCondition(value) {
    const condition = String(value || '').toLowerCase();
    if (['', 'unknown', 'unavailable', 'none'].includes(condition)) {
      return 'Weather unavailable';
    }
    return condition.replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  _conditionIcon(value) {
    const condition = String(value || '').toLowerCase();
    const icons = {
      clear: 'mdi:weather-sunny',
      'clear-night': 'mdi:weather-night',
      sunny: 'mdi:weather-sunny',
      cloudy: 'mdi:weather-cloudy',
      partlycloudy: 'mdi:weather-partly-cloudy',
      rainy: 'mdi:weather-rainy',
      pouring: 'mdi:weather-pouring',
      snowy: 'mdi:weather-snowy',
      'snowy-rainy': 'mdi:weather-snowy-rainy',
      lightning: 'mdi:weather-lightning',
      'lightning-rainy': 'mdi:weather-lightning-rainy',
      windy: 'mdi:weather-windy',
      'windy-variant': 'mdi:weather-windy-variant',
      fog: 'mdi:weather-fog',
      hail: 'mdi:weather-hail',
      unknown: 'mdi:weather-cloudy-alert',
      unavailable: 'mdi:weather-cloudy-alert',
      none: 'mdi:weather-cloudy-alert'
    };
    return icons[condition] || 'mdi:weather-partly-cloudy';
  }

  _weatherIcon(condition) {
    const icon = this._c && this._c.icon;
    return typeof icon === 'string' && icon.trim()
      ? icon.trim()
      : this._conditionIcon(condition);
  }

  _dayKey(date = new Date()) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  _forecastKey() {
    const entity = this._c.weather_entity || '';
    return `${entity}|${this._dayKey()}|${this._forecastDays}|${this._showForecast}`;
  }

  _invalidateForecastRequest() {
    this._forecastGeneration += 1;
    this._forecastPromise = null;
  }

  _isCurrentForecastRequest(request) {
    return this._forecastPromise === request &&
      request.generation === this._forecastGeneration &&
      this._forecastKey() === request.key;
  }

  _createShell() {
    this.innerHTML = `
      <style>${this._css()}</style>
      <ha-card class="hh" role="region" aria-label="Weather and time">
        <div class="topbar">
          <div class="welcome-block">
            <div class="greeting" hidden></div>
            <div class="time-row">
              <div class="clock"></div>
              <span class="time-separator" aria-hidden="true">&middot;</span>
              <div class="date"></div>
            </div>
          </div>
          <div class="weather-block">
            <div class="weather">
              <div class="weather-copy">
                <div class="weather-metrics">
                  <div class="temp"></div>
                  <div class="humidity" aria-label="Current humidity">
                    <ha-icon class="humidity-icon" aria-hidden="true"></ha-icon>
                    <span class="humidity-value"></span>
                  </div>
                </div>
                <div class="cond"></div>
              </div>
              <ha-icon class="weather-icon" aria-hidden="true"></ha-icon>
            </div>
          </div>
        </div>
        <section class="forecast-section" aria-label="Weather forecast">
          <div class="forecast-heading">
            <span class="forecast-title"></span>
            <span class="forecast-status" aria-live="polite"></span>
          </div>
          <div class="forecast-list" role="list"></div>
        </section>
      </ha-card>`;
    this._shell = true;
    this._el = {
      clock: this.querySelector('.clock'),
      date: this.querySelector('.date'),
      greeting: this.querySelector('.greeting'),
      icon: this.querySelector('.weather-icon'),
      temp: this.querySelector('.temp'),
      cond: this.querySelector('.cond'),
      humidity: this.querySelector('.humidity'),
      humidityIcon: this.querySelector('.humidity-icon'),
      humidityValue: this.querySelector('.humidity-value'),
      forecastSection: this.querySelector('.forecast-section'),
      forecastTitle: this.querySelector('.forecast-title'),
      forecastStatus: this.querySelector('.forecast-status'),
      forecastList: this.querySelector('.forecast-list')
    };
    this._card = this.querySelector('.hh');
    this._card.addEventListener('pointerdown', event => event.stopPropagation());
    this._card.addEventListener('click', event => {
      event.stopPropagation();
      this._toggleForecast();
    });
    this._card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      this._toggleForecast();
    });
    this._forecastNodes = new Map();
  }

  _renderGreeting() {
    if (!this._el || !this._el.greeting) return;
    const userName = typeof this._hass?.user?.name === 'string'
      ? this._hass.user.name.trim()
      : '';
    const displayName = userName || 'there';
    this._el.greeting.textContent = `Welcome, ${displayName} ${String.fromCodePoint(0x1F44B)}`;
    this._el.greeting.hidden = false;
  }

  _updateHeaderInteraction() {
    if (!this._card) return;
    this._card.classList.toggle('clickable', this._clickable);
    if (this._clickable) {
      this._card.setAttribute('tabindex', '0');
      this._card.setAttribute('role', 'button');
      this._card.setAttribute(
        'aria-label',
        this._showForecast ? 'Hide weather forecast' : 'Show weather forecast'
      );
    } else {
      this._card.removeAttribute('tabindex');
      this._card.setAttribute('role', 'region');
      this._card.setAttribute('aria-label', 'Weather and time');
    }
  }

  _toggleForecast() {
    if (!this._clickable) return;
    this._invalidateForecastRequest();
    this._showForecast = !this._showForecast;
    this._forecastSignature = '';
    this._updateHeaderInteraction();
    if (this._showForecast) {
      this._renderForecast(
        this._forecastCache ? this._forecastCache.items : [],
        'Loading forecast…'
      );
      this._ensureForecast();
    } else {
      this._renderForecast([], '');
    }
  }

  _updateClock() {
    const now = new Date();
    this._el.clock.textContent = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
    this._el.date.textContent = now.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }

  _renderCurrentWeather() {
    const entity = this._c.weather_entity;
    const state = entity && this._hass.states[entity];
    const unavailable = !state ||
      ['unknown', 'unavailable', 'none'].includes(String(state.state).toLowerCase());
    const attributes = unavailable ? {} : state.attributes || {};
    const unit = attributes.temperature_unit || '';
    const condition = unavailable ? 'unavailable' : state.state;
    const temperature = this._formatTemperature(attributes.temperature, unit);
    const humidity = this._number(attributes.humidity);

    this._el.icon.setAttribute('icon', this._weatherIcon(condition));
    this._el.icon.setAttribute('aria-label', this._formatCondition(condition));
    this._el.temp.textContent = temperature;
    this._el.cond.textContent = this._formatCondition(condition);
    this._el.humidity.hidden = humidity == null;
    this._el.humidityIcon.setAttribute('icon', 'mdi:water-percent');
    this._el.humidityValue.textContent = humidity == null ? '' : `${Math.round(humidity)}%`;
  }

  _forecastDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Unavailable'
      : date.toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric'});
  }

  _forecastNode(item, key) {
    const node = document.createElement('div');
    node.className = 'forecast-item';
    node.dataset.key = key;
    node.setAttribute('role', 'listitem');
    node.innerHTML = `
      <ha-icon class="forecast-icon" aria-hidden="true"></ha-icon>
      <span class="forecast-day"></span>
      <span class="forecast-condition"></span>
      <span class="forecast-temperature"></span>
      <span class="forecast-meta"></span>`;
    return {
      node,
      icon: node.querySelector('.forecast-icon'),
      day: node.querySelector('.forecast-day'),
      condition: node.querySelector('.forecast-condition'),
      temperature: node.querySelector('.forecast-temperature'),
      meta: node.querySelector('.forecast-meta')
    };
  }

  _updateForecast(items) {
    const entity = this._c.weather_entity;
    const unit = this._attr(entity, 'temperature_unit', '');
    const visible = Array.isArray(items) ? items.slice(0, this._forecastDays) : [];
    const nextNodes = new Map();

    visible.forEach((item, index) => {
      const key = item && item.datetime ? item.datetime : `forecast-${index}`;
      const refs = this._forecastNodes.get(key) || this._forecastNode(item, key);
      const high = this._formatTemperature(item && item.temperature, unit);
      const low = this._formatTemperature(item && item.templow, unit);
      const humidity = this._number(item && item.humidity);
      const precipitation = this._number(item && item.precipitation_probability);
      const condition = item && item.condition ? item.condition : 'unavailable';
      const meta = [
        low === '--' ? '' : `Low ${low}`,
        humidity == null ? '' : `H ${Math.round(humidity)}%`,
        precipitation == null ? '' : `${Math.round(precipitation)}% rain`
      ].filter(Boolean).join(' · ');

      refs.icon.setAttribute('icon', this._conditionIcon(condition));
      refs.day.textContent = this._forecastDate(item && item.datetime);
      refs.condition.textContent = this._formatCondition(condition);
      refs.temperature.textContent = high;
      refs.meta.textContent = meta;
      refs.node.setAttribute(
        'aria-label',
        `${refs.day.textContent}: ${refs.condition.textContent}, ${high}${meta ? `, ${meta}` : ''}`
      );
      this._el.forecastList.appendChild(refs.node);
      nextNodes.set(key, refs);
    });

    this._forecastNodes.forEach((refs, key) => {
      if (!nextNodes.has(key)) refs.node.remove();
    });
    this._forecastNodes = nextNodes;
  }

  _renderForecast(items, status = '') {
    if (!this._showForecast || !this._c.weather_entity) {
      this._el.forecastSection.hidden = true;
      return;
    }
    this._el.forecastSection.hidden = false;
    this._el.forecastTitle.textContent = `Forecast · ${this._forecastDays} day${this._forecastDays === 1 ? '' : 's'}`;
    const visible = Array.isArray(items) ? items.slice(0, this._forecastDays) : [];
    const unit = this._attr(this._c.weather_entity, 'temperature_unit', '');
    const signature = JSON.stringify([unit, visible]);
    if (signature !== this._forecastSignature) {
      this._updateForecast(items);
      this._forecastSignature = signature;
    }
    this._el.forecastStatus.textContent = visible.length ? '' : status;
  }

  async _requestForecast(entity) {
    const message = {
      type: 'call_service',
      domain: 'weather',
      service: 'get_forecasts',
      target: {entity_id: entity},
      service_data: {type: 'daily'},
      return_response: true
    };
    let result;
    if (typeof this._hass.callService === 'function') {
      result = await this._hass.callService(
        'weather',
        'get_forecasts',
        {type: 'daily'},
        {entity_id: entity},
        false,
        true
      );
    } else if (typeof this._hass.callWS === 'function') {
      result = await this._hass.callWS(message);
    } else if (this._hass.connection && typeof this._hass.connection.sendMessagePromise === 'function') {
      result = await this._hass.connection.sendMessagePromise(message);
    } else {
      throw new Error('Home Assistant WebSocket API unavailable');
    }
    const response = result && (
      result.response ||
      result.service_response ||
      (result.result && (result.result.response || result.result.service_response))
    );
    const forecast = response && response[entity] && response[entity].forecast;
    if (!Array.isArray(forecast)) throw new Error('Weather forecast response was empty');
    return forecast;
  }

  _ensureForecast() {
    const entity = this._c && this._c.weather_entity;
    if (!this._showForecast || !entity || !this._hass || !this._el) return;

    const key = this._forecastKey();
    const cache = this._forecastCache;
    const cacheIsCurrent = cache && cache.key === key;
    if (cache && cacheIsCurrent) {
      this._renderForecast(cache.items);
      if (Date.now() - cache.fetchedAt < HomeHeaderCard.FORECAST_REFRESH_MS) return;
    } else if (cache && cache.entity === entity && cache.items) {
      this._renderForecast(cache.items);
    } else {
      this._renderForecast([], 'Loading forecast…');
    }
    if (this._forecastPromise && this._forecastPromise.key === key) return;

    const request = {
      key,
      entity,
      generation: ++this._forecastGeneration,
      promise: this._requestForecast(entity)
    };
    this._forecastPromise = request;
    const promise = request.promise;
    promise.then(items => {
      if (!this._isCurrentForecastRequest(request)) return;
      this._forecastCache = {key, entity, items, fetchedAt: Date.now()};
      this._forecastPromise = null;
      this._renderForecast(items);
    }).catch(() => {
      if (!this._isCurrentForecastRequest(request)) return;
      this._forecastPromise = null;
      if (!this._forecastCache || this._forecastCache.entity !== entity) {
        this._renderForecast([], 'Forecast unavailable');
      }
    });
  }

  _render() {
    if (!this._hass || !this._c) return;
    if (!this._shell) this._createShell();
    this._renderGreeting();
    this._updateHeaderInteraction();
    this._updateClock();
    this._renderCurrentWeather();
    this._renderForecast(this._forecastCache ? this._forecastCache.items : [], 'Loading forecast…');
    this._startTimer();
  }

  _startTimer() {
    if (this._timer || !this.isConnected) return;
    this._timer = setInterval(() => {
      if (!this._hass) return;
      this._updateClock();
      this._ensureForecast();
    }, 30000);
  }

  _stopTimer() {
    if (!this._timer) return;
    clearInterval(this._timer);
    this._timer = null;
  }

  _css() {
    return `
    hollow-header-card{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;display:block;min-width:0;--header-surface:var(--card-background-color,var(--ha-card-background,#212c42));--header-card-radius:var(--hollow-header-card-border-radius,20px);--header-primary:var(--primary-text-color,#f5f7fb);--header-secondary:var(--secondary-text-color,#9fb0c8);--header-accent:var(--primary-color,#8fb3ff);--header-divider:var(--divider-color,rgba(200,210,226,.18))}
    hollow-header-card > .hh{background:var(--header-surface)!important;color:var(--header-primary);border:1px solid var(--header-divider)!important;border-radius:var(--header-card-radius)!important;box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important;padding:16px 18px;box-sizing:border-box;min-width:0;overflow:hidden;container:hh-card / inline-size}
    .hh.clickable{cursor:pointer}
    .hh.clickable:focus-visible{outline:2px solid var(--header-accent);outline-offset:3px}
    .topbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,auto);align-items:start;gap:clamp(10px,2.5cqw,18px);min-width:0}
    .welcome-block{min-width:0;text-align:left}
    .greeting{font-size:clamp(18px,3.5cqw,26px);font-weight:800;line-height:1.05;letter-spacing:-.02em;color:var(--header-primary);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .time-row{display:flex;align-items:baseline;gap:8px;min-width:0;white-space:nowrap}
    .clock{font-size:clamp(24px,5cqw,32px);font-weight:800;line-height:1;margin-top:6px;white-space:nowrap;flex:none}
    .time-separator{font-size:clamp(16px,3cqw,21px);font-weight:800;line-height:1;color:#8f9eb4;flex:none}
    .date{font-size:clamp(17px,4.5cqw,28px);font-weight:700;color:var(--header-primary);white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
    .forecast-section[hidden]{display:none}
    .weather-block{min-width:0;max-width:100%;display:flex;flex-direction:column;align-items:flex-end;text-align:right}
    .weather{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;min-width:0;max-width:100%;text-align:right}
    .weather-icon{--mdc-icon-size:35px;flex:none}
    .weather-copy{min-width:0;max-width:100%;display:flex;flex-direction:column;align-items:flex-end;gap:2px}
    .weather-metrics{display:flex;align-items:baseline;justify-content:flex-end;gap:clamp(5px,1.5cqw,8px);min-width:0;max-width:100%}
    .temp{font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cond{font-size:14px;color:var(--header-secondary);text-transform:capitalize;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .humidity{display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:18px;color:#c8d2e2;font-weight:700;white-space:nowrap;flex:none}
    .humidity[hidden]{display:none}
    .humidity-icon{--mdc-icon-size:18px;flex:none;color:var(--header-accent)}
    .forecast-section{border-top:1px solid var(--header-divider);margin-top:14px;padding-top:12px}
    .forecast-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
    .forecast-title{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c8d2e2}
    .forecast-status{font-size:11px;color:#9fb0c8}
    .forecast-list{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
    .forecast-item{min-width:0;background:rgba(255,255,255,.06);border-radius:12px;padding:8px 5px;display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center}
    .forecast-icon{--mdc-icon-size:22px;color:#c8d2e2;margin-bottom:1px}
    .forecast-day{font-size:11px;font-weight:800;color:#fff}
    .forecast-condition{font-size:10px;color:#9fb0c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
    .forecast-temperature{font-size:13px;font-weight:800;color:#fff;white-space:nowrap}
    .forecast-meta{font-size:9px;color:#9fb0c8;line-height:1.25;min-height:11px}
    @container hh-card (max-width:560px){
      .topbar{gap:8px}
      .greeting{font-size:clamp(18px,3.5cqw,24px)}
      .clock{font-size:clamp(23px,5cqw,30px)}
      .time-row{gap:6px}
      .time-separator{font-size:18px}
      .weather-icon{--mdc-icon-size:31.25px}
      .temp{font-size:16px}
      .date{font-size:clamp(16px,4.5cqw,25px)}
      .cond{font-size:13px}
      .humidity{font-size:16px}
      .humidity-icon{--mdc-icon-size:16px}
      .forecast-section{margin-top:10px;padding-top:10px}
      .forecast-heading{margin-bottom:6px}
      .forecast-list{grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:5px}
      .forecast-item{padding:6px 4px;border-radius:10px;gap:2px}
      .forecast-icon{--mdc-icon-size:18px;margin-bottom:0}
      .forecast-day{font-size:10px}
      .forecast-condition{font-size:9px}
      .forecast-temperature{font-size:12px}
      .forecast-meta{font-size:8px;line-height:1.1;min-height:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}
    }
    @container hh-card (max-width:420px){
      .topbar{grid-template-columns:minmax(0,1fr) auto;gap:7px}
      .greeting{font-size:clamp(17px,5cqw,22px)}
      .clock{font-size:clamp(22px,6cqw,28px)}
      .time-row{gap:5px}
      .time-separator{font-size:16px}
      .weather{gap:4px}
      .weather-metrics{gap:5px}
      .weather-icon{--mdc-icon-size:27.5px}
      .temp{font-size:15px}
      .date{font-size:clamp(15px,4.5cqw,21px)}
      .cond{font-size:12px}
      .humidity{font-size:15px}
      .humidity-icon{--mdc-icon-size:15px}
      .forecast-list{grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:5px}
      .forecast-item{padding:5px 3px}
      .forecast-icon{--mdc-icon-size:17px}
      .forecast-day{font-size:10px}
      .forecast-condition{font-size:8px}
      .forecast-temperature{font-size:11px}
      .forecast-meta{font-size:7px}
    }
    @container hh-card (max-width:280px){
      .topbar{grid-template-columns:minmax(0,1fr);grid-template-areas:"welcome" "weather"}
      .welcome-block{grid-area:welcome}
      .weather-block{grid-area:weather;justify-content:flex-end}
    }
    `;
  }
}
if (!customElements.get('hollow-header-card')) {
  customElements.define('hollow-header-card', HomeHeaderCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'hollow-header-card')) {
  window.customCards.push({
    type: 'hollow-header-card',
    name: 'Hollow Header',
    description: 'Clock, date, current weather, and cached daily forecast'
  });
}
