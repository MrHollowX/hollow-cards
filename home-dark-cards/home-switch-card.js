class HomeSwitchCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) throw new Error('entity required');
    this._c = {
      ...config,
      switch_type: config.switch_type || 'generic',
      tap_action: config.tap_action || { action: 'toggle' },
      hold_action: config.hold_action || { action: 'none' },
      double_tap_action: config.double_tap_action || { action: 'none' },
    };
    this._lastRenderSignature = null;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return this._c && this._c.grid_options ? this._c.grid_options : {};
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
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
    this._onWindowBlur = this._onWindowBlur.bind(this);
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeydown);
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('pointerup', this._onPointerUp);
    this.addEventListener('pointercancel', this._onPointerCancel);
    window.addEventListener('blur', this._onWindowBlur);
    this._durationTimer = setInterval(() => {
      if (!this._hass || !this._c) return;
      const items = this._detailItems();
      if (!this._hasRelativeDetail(items)) return;
      this._lastRenderSignature = null;
      this._render();
    }, 30000);
  }

  disconnectedCallback() {
    if (!this._wired) return;
    this._clearGestureTimers();
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeydown);
    this.removeEventListener('pointerdown', this._onPointerDown);
    this.removeEventListener('pointerup', this._onPointerUp);
    this.removeEventListener('pointercancel', this._onPointerCancel);
    window.removeEventListener('blur', this._onWindowBlur);
    if (this._durationTimer) clearInterval(this._durationTimer);
    this._durationTimer = null;
    this._wired = false;
  }

  _state(entity) {
    if (!entity || !this._hass) return 'unavailable';
    const state = this._hass.states[entity];
    return state ? state.state : 'unavailable';
  }

  _attr(entity, attribute, fallback) {
    const state = entity && this._hass && this._hass.states[entity];
    return state && state.attributes[attribute] != null
      ? state.attributes[attribute]
      : fallback;
  }

  _stateObject(entity) {
    return entity && this._hass && this._hass.states[entity]
      ? this._hass.states[entity]
      : null;
  }

  _detailItems() {
    const configured = this._c && this._c.state_content;
    const gridRows = Number(this._c && this._c.grid_options && this._c.grid_options.rows);
    const expanded = this._c && this._c.expanded
      || (Number.isFinite(gridRows) && gridRows > 1);
    const items = configured == null
      ? (expanded ? ['last-changed'] : [])
      : Array.isArray(configured) ? [...configured] : [configured];

    if (this._c && this._c.attribute) {
      items.push({
        attribute: this._c.attribute,
        name: this._c.attribute_name,
        unit: this._c.unit,
      });
    }
    if (this._c && this._c.attributes) {
      const attributes = Array.isArray(this._c.attributes)
        ? this._c.attributes
        : [this._c.attributes];
      attributes.forEach((attribute) => {
        items.push(typeof attribute === 'string' ? { attribute } : attribute);
      });
    }
    if (this._c && this._c.show_last_changed
      && !items.some((item) => item === 'last-changed' || item === 'last_changed')) {
      items.push('last-changed');
    }
    return items.filter((item) => item != null && item !== '');
  }

  _hasRelativeDetail(items) {
    return items.some((item) => {
      const token = typeof item === 'string' ? item : item && item.type;
      return ['last-changed', 'last_changed', 'last-updated', 'last_updated',
        'last-reported', 'last_reported'].includes(token);
    });
  }

  _formatDuration(timestamp) {
    const changed = new Date(timestamp).getTime();
    if (!Number.isFinite(changed)) return 'Unavailable';
    const minutes = Math.max(0, Math.floor((Date.now() - changed) / 60000));
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? '' : 's'}${
        remainingMinutes ? ` ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}` : ''
      }`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} day${days === 1 ? '' : 's'}${
      remainingHours ? ` ${remainingHours} hour${remainingHours === 1 ? '' : 's'}` : ''
    }`;
  }

  _prettyAttribute(attribute) {
    return String(attribute)
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  _formatAttributeValue(value, unit) {
    if (value == null) return 'Unavailable';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `${text}${unit ? ` ${unit}` : ''}`;
  }

  _showState() {
    return !this._c || this._c.show_state !== false;
  }

  _detailSignature(stateObject, items) {
    return JSON.stringify(items.map((item) => {
      if (typeof item === 'string') {
        const key = item.replace(/-/g, '_');
        const value = ['state', 'last_changed', 'last_updated', 'last_reported'].includes(key)
          ? stateObject && stateObject[key]
          : stateObject && stateObject.attributes
            ? stateObject.attributes[key]
            : null;
        return [item, value];
      }
      const attribute = item && (item.attribute || item.key);
      return [item, attribute && stateObject && stateObject.attributes
        ? stateObject.attributes[attribute]
        : null];
    }));
  }

  _renderDetails(stateObject, items) {
    if (!items.length || !stateObject) return '';
    const attributes = stateObject.attributes || {};
    return items.map((item) => {
      const token = typeof item === 'string' ? item : item && item.type;
      const attribute = typeof item === 'string'
        ? item
        : item && (item.attribute || item.key);

      if (token === 'state') {
        return this._showState() ? this._titleCase(stateObject.state) : '';
      }
      if (token === 'last-changed' || token === 'last_changed') {
        const duration = this._formatDuration(stateObject.last_changed);
        return this._showState()
          ? `${this._titleCase(stateObject.state)} for ${duration}`
          : duration;
      }
      if (token === 'last-updated' || token === 'last_updated') {
        return `Updated ${this._formatDuration(stateObject.last_updated)} ago`;
      }
      if (token === 'last-reported' || token === 'last_reported') {
        return `Reported ${this._formatDuration(stateObject.last_reported)} ago`;
      }
      if (attribute) {
        const label = (typeof item === 'object' && item.name)
          || this._prettyAttribute(attribute);
        const value = this._formatAttributeValue(
          attributes[attribute],
          typeof item === 'object' ? item.unit : undefined,
        );
        return `${label}: ${value}`;
      }
      return '';
    }).filter(Boolean).join(' \u00b7 ');
  }

  _callToggle(entity) {
    if (!this._hass || !entity) return;
    const domain = entity.split('.')[0];
    this._hass.callService(domain, 'toggle', { entity_id: entity });
  }

  _moreInfo(entity) {
    if (!entity) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: entity },
      bubbles: true,
      composed: true,
    }));
  }

  _actionConfig(kind) {
    const configured = this._c && this._c[`${kind}_action`];
    if (typeof configured === 'string') return { action: configured };
    return configured || { action: kind === 'tap' ? 'toggle' : 'none' };
  }

  _runAction(kind) {
    const actionConfig = this._actionConfig(kind);
    const action = actionConfig.action || 'none';
    const entity = actionConfig.entity || this._c.entity;
    if (action === 'none') return;
    if (action === 'toggle') {
      if (this._state(entity) !== 'unavailable') this._callToggle(entity);
      return;
    }
    if (action === 'more-info') {
      this._moreInfo(entity);
      return;
    }
    if (action === 'perform-action' || action === 'call-service') {
      const serviceName = actionConfig.perform_action || actionConfig.service;
      if (!this._hass || !serviceName) return;
      const [domain, service] = serviceName.split('.', 2);
      if (!domain || !service) return;
      this._hass.callService(
        domain,
        service,
        actionConfig.data || actionConfig.service_data || {},
        actionConfig.target,
      );
      return;
    }
    if (action === 'navigate' && actionConfig.navigation_path) {
      window.history.pushState({}, '', actionConfig.navigation_path);
      window.dispatchEvent(new Event('location-changed'));
      return;
    }
    if (action === 'url' && actionConfig.url_path) {
      window.open(actionConfig.url_path, '_blank', 'noopener');
      return;
    }
    if (action === 'fire-dom-event') {
      this.dispatchEvent(new CustomEvent('ll-custom', {
        detail: actionConfig,
        bubbles: true,
        composed: true,
      }));
    }
  }

  _clearGestureTimers() {
    if (this._tapTimer) clearTimeout(this._tapTimer);
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._tapTimer = null;
    this._holdTimer = null;
  }

  _queueTap() {
    if (this._tapTimer) {
      clearTimeout(this._tapTimer);
      this._tapTimer = null;
      this._runAction('double_tap');
      return;
    }
    this._tapTimer = setTimeout(() => {
      this._tapTimer = null;
      this._runAction('tap');
    }, 260);
  }

  _onPointerDown(event) {
    const more = event.target.closest && event.target.closest('[data-more]');
    if (!more || event.target.closest('[data-toggle]')) return;
    event.stopPropagation();
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdTimer = null;
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      this._suppressNextClick = true;
      this._runAction('hold');
    }, 550);
  }

  _onPointerUp(event) {
    const more = event.target.closest && event.target.closest('[data-more]');
    if (!more || event.target.closest('[data-toggle]')) return;
    event.stopPropagation();
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _onPointerCancel() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _onWindowBlur() {
    this._clearGestureTimers();
  }

  _escape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _visualType() {
    const type = String(this._c.switch_type || 'generic').toLowerCase();
    return HomeSwitchCard.TYPES[type] ? type : 'generic';
  }

  _icon() {
    return this._c.icon || HomeSwitchCard.TYPES[this._visualType()].icon;
  }

  _onClick(event) {
    const toggle = event.target.closest && event.target.closest('[data-toggle]');
    const more = event.target.closest && event.target.closest('[data-more]');
    if (!toggle && !more) return;
    event.stopPropagation();
    if (toggle) {
      event.preventDefault();
      if (this._state(this._c.entity) !== 'unavailable') this._callToggle(this._c.entity);
      return;
    }
    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      return;
    }
    this._queueTap();
  }

  _onKeydown(event) {
    const more = event.target.closest && event.target.closest('[data-more]');
    if (!more || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    event.stopPropagation();
    this._clearGestureTimers();
    this._suppressNextClick = true;
    this._runAction('tap');
    setTimeout(() => {
      this._suppressNextClick = false;
    }, 0);
  }

  _render() {
    if (!this._hass || !this._c) return;
    const entity = this._c.entity;
    const state = this._state(entity);
    const unavailable = state === 'unavailable' || state === 'unknown';
    const on = state === 'on';
    const type = this._visualType();
    const name = this._c.name || this._attr(entity, 'friendly_name', 'Switch');
    const stateLabel = unavailable ? this._titleCase(state) : on ? 'On' : 'Off';
    const stateObject = this._stateObject(entity);
    const detailItems = this._detailItems();
    const gridRows = Number(this._c.grid_options && this._c.grid_options.rows);
    const tall = Number.isFinite(gridRows) && gridRows > 1;
    const relativeTick = this._hasRelativeDetail(detailItems)
      ? Math.floor(Date.now() / 30000)
      : '';
    const signature = [
      entity, name, state, type, this._icon(), tall,
      this._detailSignature(stateObject, detailItems), relativeTick,
    ].join('|');

    if (signature === this._lastRenderSignature) return;
    this._lastRenderSignature = signature;

    const safeName = this._escape(name);
    const safeIcon = this._escape(this._icon());
    const iconClasses = `switch-icon type-${type}${on ? ' is-on' : ''}${unavailable ? ' is-unavailable' : ''}`;
    const detailSummary = this._renderDetails(stateObject, detailItems);
    const summary = detailSummary || (this._showState() ? stateLabel : '');
    const safeSummary = this._escape(summary);
    const tallCopy = tall && summary
      ? `<div class="tall-copy" data-more role="button" tabindex="0"
          aria-label="${safeName}">
          <div class="row-sub">${safeSummary}</div>
        </div>`
      : '';

    if (!this._shell) {
      this.innerHTML = `<style>${this._css()}</style><ha-card class="switch-card"></ha-card>`;
      this._shell = true;
      this._card = this.querySelector('.switch-card');
    }
    this.classList.toggle('rows-tall', tall);
    this._card.classList.toggle('rows-tall', tall);

    this._card.innerHTML = `
      <div class="row-top">
        <div class="row-left" data-more role="button" tabindex="0"
          aria-label="${safeName}">
          <ha-icon class="${iconClasses}" icon="${safeIcon}"
            style="--mdc-icon-size:32px"></ha-icon>
          <div class="copy">
            <div class="row-name">${safeName}</div>
            ${tall || !summary ? '' : `<div class="row-sub">${safeSummary}</div>`}
          </div>
        </div>
        <button class="toggle ${on ? 'on' : ''}" data-toggle type="button"
          aria-label="${on ? 'Turn off' : 'Turn on'} ${safeName}"
          aria-pressed="${on}" ${unavailable ? 'disabled' : ''}>
          <span class="knob"></span>
        </button>
      </div>
      ${tallCopy}
    `;
  }

  _titleCase(value) {
    return String(value).replace(/(^|[\s_-])\w/g, match => match.toUpperCase());
  }

  _css() {
    return `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif;
        --switch-card-bg: var(--home-dark-card-background, #212c42);
        --switch-primary-text: var(--home-dark-primary-text, #f5f7fb);
        --switch-secondary-text: var(--home-dark-secondary-text, #91a2bb);
        --switch-accent: var(--home-dark-accent, var(--accent-color, #ffb340));
        --switch-track: var(--home-dark-control-background, #2b3850);
        --switch-muted: var(--home-dark-muted-text, #66758f);
        --switch-page-bg: var(--home-dark-page-background, #1a2433);
      }
      :host(.rows-tall) {
        height: 100%;
      }
      .switch-card {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        background: var(--switch-card-bg) !important;
        color: var(--switch-primary-text);
        border-radius: var(--ha-card-border-radius, 20px);
        border: 1px solid rgba(255, 255, 255, .1);
        padding: 14px 16px;
        color-scheme: dark;
      }
      .switch-card.rows-tall {
        height: 100%;
        min-height: 108px;
      }
      .row-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .row-left {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        flex: 1;
        min-width: 0;
        outline: none;
      }
      .switch-card.rows-tall .tall-copy {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, .08);
        cursor: pointer;
      }
      .switch-card.rows-tall .tall-copy .row-name,
      .switch-card.rows-tall .tall-copy .row-sub {
        width: 100%;
      }
      .row-left:focus-visible {
        outline: none;
        background: transparent;
      }
      .switch-icon {
        display: block;
        width: 32px;
        height: 32px;
        flex: none;
        color: var(--switch-muted);
        transform-origin: center center;
      }
      .switch-icon.is-on { color: var(--switch-accent); }
      .type-fan.is-on {
        animation: fan-spin 1.8s linear infinite;
        transform-origin: center;
      }
      .type-pump.is-on {
        animation: fan-spin 2.4s linear infinite;
        transform-origin: center;
      }
      .type-heater.is-on {
        animation: heater-pulse 1.2s ease-in-out infinite;
      }
      .type-light.is-on {
        filter: drop-shadow(0 0 4px var(--switch-accent));
      }
      .is-unavailable {
        opacity: .65;
      }
      .copy {
        min-width: 0;
      }
      .row-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        font-weight: 700;
      }
      .row-sub {
        overflow: hidden;
        color: var(--switch-secondary-text);
        font-size: 11.5px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .toggle {
        all: unset;
        cursor: pointer;
        width: 44px;
        height: 26px;
        border-radius: 999px;
        background: var(--switch-track);
        position: relative;
        flex: none;
      }
      .toggle.on {
        background: var(--switch-accent);
      }
      .toggle:disabled {
        cursor: not-allowed;
        opacity: .55;
      }
      .toggle:focus-visible {
        outline: 2px solid var(--switch-accent);
        outline-offset: 3px;
      }
      .toggle .knob {
        position: absolute;
        left: 3px;
        top: 3px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--switch-muted);
        transition: left .15s, background .15s;
      }
      .toggle.on .knob {
        left: 21px;
        background: var(--switch-page-bg);
      }
      @keyframes fan-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes heater-pulse {
        0%, 100% { opacity: .65; transform: scale(.92); }
        50% { opacity: 1; transform: scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .type-fan.is-on,
        .type-pump.is-on,
        .type-heater.is-on {
          animation: none;
        }
      }
    `;
  }
}

HomeSwitchCard.TYPES = {
  generic: { icon: 'mdi:toggle-switch' },
  fan: { icon: 'mdi:fan' },
  light: { icon: 'mdi:lightbulb' },
  heater: { icon: 'mdi:radiator' },
  pump: { icon: 'mdi:pump' },
  outlet: { icon: 'mdi:power-socket-eu' },
  lock: { icon: 'mdi:lock' },
};

customElements.define('home-switch-card', HomeSwitchCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-switch-card',
  name: 'Home Switch',
  description: 'Theme-aware switch control with configurable visual type',
});
