class HomeSwitchCard extends HTMLElement {
  constructor() {
    super();
    this._onClick = this._onClick.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
    this._onLostPointerCapture = this._onLostPointerCapture.bind(this);
    this._onWindowBlur = this._onWindowBlur.bind(this);
    this._onWindowHoldEnd = this._onWindowHoldEnd.bind(this);
  }

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
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeydown);
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('pointerup', this._onPointerUp);
    this.addEventListener('pointercancel', this._onPointerCancel);
    this.addEventListener('lostpointercapture', this._onLostPointerCapture);
    window.addEventListener('blur', this._onWindowBlur);
    this._durationTimer = setInterval(() => {
      if (!this._hass || !this._c) return;
      const items = this._detailItems();
      if (!this._hasRelativeDetail(items)) return;
      this._patchRelativeDetails();
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
    this.removeEventListener('lostpointercapture', this._onLostPointerCapture);
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

  _available(entity) {
    const state = this._state(entity);
    return state !== 'unknown' && state !== 'unavailable';
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
    const items = configured == null
      ? ['last-changed']
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

  _patchRelativeDetails() {
    if (!this._card || !this._hass || !this._c) return;
    const state = this._state(this._c.entity);
    const unavailable = state === 'unavailable' || state === 'unknown';
    const stateLabel = unavailable ? this._titleCase(state) : state === 'on' ? 'On' : 'Off';
    const stateObject = this._stateObject(this._c.entity);
    const detailItems = this._detailItems();
    const detailSummary = this._renderDetails(stateObject, detailItems);
    const summary = detailSummary || (this._showState() ? stateLabel : '');
    this._card.querySelectorAll('[data-detail-summary]').forEach((node) => {
      if (node.textContent !== summary) node.textContent = summary;
    });
  }

  _callToggle(entity) {
    if (!this._hass || !entity || !this._available(entity)) return false;
    const domain = entity.split('.')[0];
    this._hass.callService(domain, 'toggle', { entity_id: entity });
    return true;
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
    if (action === 'none') return false;
    if (action === 'toggle') {
      return this._callToggle(entity);
    }
    if (action === 'more-info') {
      if (!entity) return false;
      this._moreInfo(entity);
      return true;
    }
    if (action === 'perform-action' || action === 'call-service') {
      const serviceName = actionConfig.perform_action || actionConfig.service;
      if (!this._hass || !serviceName) return false;
      const [domain, service] = serviceName.split('.', 2);
      if (!domain || !service) return false;
      this._hass.callService(
        domain,
        service,
        actionConfig.data || actionConfig.service_data || {},
        actionConfig.target,
      );
      return true;
    }
    if (action === 'navigate' && actionConfig.navigation_path) {
      window.history.pushState({}, '', actionConfig.navigation_path);
      window.dispatchEvent(new Event('location-changed'));
      return true;
    }
    if (action === 'url' && actionConfig.url_path) {
      window.open(actionConfig.url_path, '_blank', 'noopener');
      return true;
    }
    if (action === 'fire-dom-event') {
      this.dispatchEvent(new CustomEvent('ll-custom', {
        detail: actionConfig,
        bubbles: true,
        composed: true,
      }));
      return true;
    }
    return false;
  }

  _clearHoldGesture() {
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdTimer = null;
    const target = this._holdPointerTarget;
    const pointerId = this._holdPointerId;
    this._holdPointerTarget = null;
    this._holdPointerId = null;
    this._holdActionRan = false;
    this._holdGestureToken = null;
    window.removeEventListener('pointerup', this._onWindowHoldEnd, true);
    window.removeEventListener('pointercancel', this._onWindowHoldEnd, true);
    if (target && pointerId != null) {
      try {
        if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      } catch (error) {
        // Capture can already be gone after cancellation or DOM replacement.
      }
    }
  }

  _finishHoldGesture(cancelled) {
    const actionRan = this._holdActionRan;
    this._clearHoldGesture();
    if (!actionRan) return;
    if (cancelled) {
      this._clearSuppressNextClick();
      return;
    }
    this._scheduleSuppressNextClickReset();
  }

  _scheduleSuppressNextClickReset() {
    if (this._suppressNextClickTimer) clearTimeout(this._suppressNextClickTimer);
    this._suppressNextClickTimer = setTimeout(() => {
      this._suppressNextClick = false;
      this._suppressNextClickTimer = null;
    }, 0);
  }

  _clearSuppressNextClick() {
    if (this._suppressNextClickTimer) clearTimeout(this._suppressNextClickTimer);
    this._suppressNextClickTimer = null;
    this._suppressNextClick = false;
  }

  _clearGestureTimers() {
    if (this._tapTimer) clearTimeout(this._tapTimer);
    this._tapTimer = null;
    this._clearHoldGesture();
    this._clearSuppressNextClick();
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
    if (!more || event.target.closest('[data-toggle]') ||
        event.button !== 0 || event.isPrimary === false) return;
    event.stopPropagation();
    this._clearHoldGesture();
    this._holdPointerId = event.pointerId;
    this._holdPointerTarget = more;
    this._holdActionRan = false;
    const gestureToken = {};
    const pointerId = event.pointerId;
    this._holdGestureToken = gestureToken;
    window.addEventListener('pointerup', this._onWindowHoldEnd, true);
    window.addEventListener('pointercancel', this._onWindowHoldEnd, true);
    try {
      more.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is best-effort; normal in-card pointer paths still clean up.
    }
    this._holdTimer = setTimeout(() => {
      if (!this._isCurrentHoldGesture(gestureToken, pointerId, more)) {
        if (this._holdGestureToken === gestureToken) this._clearHoldGesture();
        return;
      }
      this._holdTimer = null;
      const actionRan = this._runAction('hold');
      if (!this._isCurrentHoldGesture(gestureToken, pointerId, more)) {
        if (this._holdGestureToken === gestureToken) this._clearHoldGesture();
        return;
      }
      this._holdActionRan = actionRan;
      if (actionRan) this._suppressNextClick = true;
    }, 550);
  }

  _isCurrentHoldGesture(token, pointerId, target) {
    return this._holdGestureToken === token
      && this._holdPointerId === pointerId
      && this._holdPointerTarget === target
      && this.isConnected
      && this.contains(target);
  }

  _onPointerUp(event) {
    if (event.pointerId !== this._holdPointerId) return;
    event.stopPropagation();
    this._finishHoldGesture(false);
  }

  _onPointerCancel(event) {
    if (event.pointerId !== this._holdPointerId) return;
    event.stopPropagation();
    this._finishHoldGesture(true);
  }

  _onLostPointerCapture(event) {
    if (event.pointerId === this._holdPointerId) this._finishHoldGesture(true);
  }

  _onWindowBlur() {
    this._clearGestureTimers();
  }

  _onWindowHoldEnd(event) {
    if (event.pointerId !== this._holdPointerId) return;
    Promise.resolve().then(() => {
      if (event.pointerId === this._holdPointerId) this._finishHoldGesture(true);
    });
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
      this._callToggle(this._c.entity);
      return;
    }
    if (this._suppressNextClick) {
      this._clearSuppressNextClick();
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
    if (this._runAction('tap')) {
      this._suppressNextClick = true;
      this._scheduleSuppressNextClickReset();
    }
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
    const signature = [
      entity, name, state, type, this._icon(), tall,
      this._detailSignature(stateObject, detailItems),
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
          <div class="row-sub" data-detail-summary>${safeSummary}</div>
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
            ${tall || !summary ? '' : `<div class="row-sub" data-detail-summary>${safeSummary}</div>`}
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
      hollow-switch-card {
        display: block;
        width: 100%;
        min-width: 0;
        font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif;
        --switch-card-bg: var(--card-background-color, var(--ha-card-background, #212c42));
        --switch-card-radius: var(--hollow-switch-card-border-radius, 20px);
        --switch-primary-text: var(--primary-text-color, #f5f7fb);
        --switch-secondary-text: var(--secondary-text-color, #91a2bb);
        --switch-accent: var(--primary-color, var(--accent-color, #ffb340));
        --switch-track: var(--secondary-background-color, #2b3850);
        --switch-muted: var(--disabled-text-color, #66758f);
        --switch-page-bg: var(--primary-background-color, #1a2433);
        --switch-divider: var(--divider-color, rgba(255, 255, 255, .1));
      }
      hollow-switch-card > ha-card.switch-card {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        background: var(--switch-card-bg) !important;
        color: var(--switch-primary-text);
        border-radius: var(--switch-card-radius) !important;
        border: 1px solid var(--switch-divider) !important;
        box-shadow: var(--ha-card-box-shadow, 0 4px 14px rgba(0,0,0,.16)) !important;
        padding: 14px 16px;
      }
      .switch-card.rows-tall {
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
        border-top: 1px solid var(--switch-divider);
        cursor: pointer;
      }
      .switch-card.rows-tall .tall-copy .row-name,
      .switch-card.rows-tall .tall-copy .row-sub {
        width: 100%;
      }
      .row-left:focus-visible,
      .tall-copy:focus-visible {
        outline: 2px solid var(--switch-accent);
        outline-offset: 3px;
        border-radius: 6px;
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

if (!customElements.get('hollow-switch-card')) {
  customElements.define('hollow-switch-card', HomeSwitchCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'hollow-switch-card')) {
  window.customCards.push({
    type: 'hollow-switch-card',
    name: 'Hollow Switch',
    description: 'Theme-aware switch control with configurable visual type',
  });
}
