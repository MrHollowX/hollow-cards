class HomeHeaderCard extends HTMLElement {
  static FORECAST_REFRESH_MS = 30 * 60 * 1000;

  setConfig(c) {
    const previous = this._c || {};
    this._c = c || {};
    this._forecastDays = this._clampForecastDays(this._c.forecast_days);
    this._showForecast = this._c.show_forecast !== false;
    if (previous.weather_entity && previous.weather_entity !== this._c.weather_entity) {
      this._forecastCache = null;
    }
    this._forecastSignature = '';
    if (this._el && !this._showForecast) this._renderForecast([], '');
  }

  getCardSize() { return 3; }

  set hass(h) {
    this._hass = h;
    this._render();
    this._ensureForecast();
  }

  disconnectedCallback() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
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
    return String(value || 'Unavailable').replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  _conditionIcon(value) {
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
      hail: 'mdi:weather-hail'
    };
    return icons[value] || 'mdi:weather-partly-cloudy';
  }

  _dayKey(date = new Date()) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  _forecastKey() {
    const entity = this._c.weather_entity || '';
    return `${entity}|${this._dayKey()}|${this._forecastDays}|${this._showForecast}`;
  }

  _createShell() {
    this.innerHTML = `
      <style>${this._css()}</style>
      <ha-card class="hh" role="region" aria-label="Weather and time">
        <div class="topbar">
          <div>
            <div class="clock"></div>
            <div class="date"></div>
          </div>
          <div class="weather">
            <ha-icon class="weather-icon" aria-hidden="true"></ha-icon>
            <div>
              <div class="temp"></div>
              <div class="cond"></div>
            </div>
          </div>
        </div>
        <div class="metrics" aria-label="Current weather details">
          <span class="humidity"></span>
          <span class="feels"></span>
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
      icon: this.querySelector('.weather-icon'),
      temp: this.querySelector('.temp'),
      cond: this.querySelector('.cond'),
      metrics: this.querySelector('.metrics'),
      humidity: this.querySelector('.humidity'),
      feels: this.querySelector('.feels'),
      forecastSection: this.querySelector('.forecast-section'),
      forecastTitle: this.querySelector('.forecast-title'),
      forecastStatus: this.querySelector('.forecast-status'),
      forecastList: this.querySelector('.forecast-list')
    };
    this._forecastNodes = new Map();
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
    const attributes = state ? state.attributes : {};
    const unit = attributes.temperature_unit || '';
    const condition = state ? state.state : 'unavailable';
    const temperature = this._formatTemperature(attributes.temperature, unit);
    const apparent = this._formatTemperature(attributes.apparent_temperature, unit);
    const humidity = this._number(attributes.humidity);

    this._el.icon.setAttribute('icon', this._conditionIcon(condition));
    this._el.icon.setAttribute('aria-label', this._formatCondition(condition));
    this._el.temp.textContent = temperature;
    this._el.cond.textContent = this._formatCondition(condition);
    this._el.humidity.textContent = humidity == null ? '' : `Humidity ${Math.round(humidity)}%`;
    this._el.feels.textContent = apparent === '--' ? '' : `Feels like ${apparent}`;
    this._el.metrics.hidden = !this._el.humidity.textContent && !this._el.feels.textContent;
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
    const signature = JSON.stringify(visible);
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

    const promise = this._requestForecast(entity);
    this._forecastPromise = {key, promise};
    promise.then(items => {
      if (this._forecastKey() !== key) {
        if (this._forecastPromise && this._forecastPromise.key === key) this._forecastPromise = null;
        return;
      }
      this._forecastCache = {key, entity, items, fetchedAt: Date.now()};
      this._forecastPromise = null;
      this._renderForecast(items);
    }).catch(() => {
      if (this._forecastKey() !== key) {
        if (this._forecastPromise && this._forecastPromise.key === key) this._forecastPromise = null;
        return;
      }
      this._forecastPromise = null;
      if (!this._forecastCache || this._forecastCache.entity !== entity) {
        this._renderForecast([], 'Forecast unavailable');
      }
    });
  }

  _render() {
    if (!this._hass || !this._c) return;
    if (!this._shell) this._createShell();
    this._updateClock();
    this._renderCurrentWeather();
    this._renderForecast(this._forecastCache ? this._forecastCache.items : [], 'Loading forecast…');
    if (!this._timer) {
      this._timer = setInterval(() => {
        if (!this._hass) return;
        this._updateClock();
        this._ensureForecast();
      }, 30000);
    }
  }

  _css() {
    return `
    :host{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;display:block}
    .hh{background:#1a2433;color:#fff;border-radius:20px;padding:16px 18px}
    .topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .clock{font-size:40px;font-weight:800;line-height:1}
    .date{font-size:14px;font-weight:700;color:#c8d2e2;margin-top:4px}
    .weather{display:flex;gap:8px;align-items:center;min-width:0}
    .weather-icon{--mdc-icon-size:28px;flex:none}
    .temp{font-size:18px;font-weight:700;white-space:nowrap}
    .cond{font-size:12px;color:#9fb0c8;text-transform:capitalize;white-space:nowrap}
    .metrics{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:12px;color:#c8d2e2;font-size:12px;font-weight:600}
    .metrics[hidden],.forecast-section[hidden]{display:none}
    .forecast-section{border-top:1px solid rgba(200,210,226,.18);margin-top:14px;padding-top:12px}
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
    @media(max-width:520px){.forecast-list{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:360px){.clock{font-size:34px}.forecast-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
  }
}
customElements.define('home-header-card', HomeHeaderCard);
window.customCards = window.customCards || [];
window.customCards.push({type:'home-header-card', name:'Home Header', description:'Clock, date, current weather, and cached daily forecast'});
