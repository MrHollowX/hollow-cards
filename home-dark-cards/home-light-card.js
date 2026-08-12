class HomeLightCard extends HTMLElement {
  setConfig(c) {
    if (!c.entity) throw new Error('entity required');
    if (this._c && this._c.entity !== c.entity) {
      this._clearPendingSlider();
      this._sliderPreview = null;
    }
    this._c = c;
  }

  getCardSize() {
    return 1;
  }

  set hass(h) {
    this._hass = h;
    this._render();
  }

  _st(e) {
    if (!e) return 'unavailable';
    const s = this._hass.states[e];
    return s ? s.state : 'unavailable';
  }

  _attr(e, a, d) {
    if (!e) return d;
    const s = this._hass.states[e];
    return s && s.attributes[a] != null ? s.attributes[a] : d;
  }

  _call(domain, service, entity, data) {
    return this._hass.callService(domain, service, Object.assign({ entity_id: entity }, data || {}));
  }

  _more(e) {
    if (!e) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: e },
      bubbles: true,
      composed: true,
    }));
  }

  _dimmable() {
    const modes = this._attr(this._c.entity, 'supported_color_modes', []);
    return Array.isArray(modes) && modes.some(m => m !== 'onoff');
  }

  connectedCallback() {
    if (this._wired) return;
    this._wired = true;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
    this._onLostPointerCapture = this._onLostPointerCapture.bind(this);
    this._onSliderInput = this._onSliderInput.bind(this);
    this._onSliderChange = this._onSliderChange.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this._onWindowBlur = this._onWindowBlur.bind(this);

    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('pointermove', this._onPointerMove);
    this.addEventListener('pointerup', this._onPointerUp);
    this.addEventListener('pointercancel', this._onPointerCancel);
    this.addEventListener('lostpointercapture', this._onLostPointerCapture);
    this.addEventListener('input', this._onSliderInput);
    this.addEventListener('change', this._onSliderChange);
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeydown);
    window.addEventListener('blur', this._onWindowBlur);
  }

  disconnectedCallback() {
    if (!this._wired) return;
    this._cancelSlider();
    this.removeEventListener('pointerdown', this._onPointerDown);
    this.removeEventListener('pointermove', this._onPointerMove);
    this.removeEventListener('pointerup', this._onPointerUp);
    this.removeEventListener('pointercancel', this._onPointerCancel);
    this.removeEventListener('lostpointercapture', this._onLostPointerCapture);
    this.removeEventListener('input', this._onSliderInput);
    this.removeEventListener('change', this._onSliderChange);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeydown);
    window.removeEventListener('blur', this._onWindowBlur);
    this._wired = false;
  }

  _sliderFromEvent(ev) {
    const target = ev.target;
    return target && typeof target.closest === 'function' ? target.closest('.sl') : null;
  }

  _onPointerDown(ev) {
    const slider = this._sliderFromEvent(ev);
    if (!slider || this._dragging) return;
    ev.stopPropagation();
    ev.preventDefault();
    this._dragging = true;
    this._activeSlider = slider;
    this._pointerId = ev.pointerId;
    this._sliderCommitted = false;
    try {
      slider.setPointerCapture(ev.pointerId);
    } catch (err) {
      // Pointer capture is best-effort; the pointer events still work in-browser.
    }
    this._updateSliderFromPointer(slider, ev.clientX);
  }

  _onPointerMove(ev) {
    if (!this._dragging || !this._activeSlider || ev.pointerId !== this._pointerId) return;
    ev.stopPropagation();
    ev.preventDefault();
    this._updateSliderFromPointer(this._activeSlider, ev.clientX);
  }

  _onPointerUp(ev) {
    if (!this._dragging || !this._activeSlider || ev.pointerId !== this._pointerId) return;
    ev.stopPropagation();
    ev.preventDefault();
    this._finishSlider(true);
  }

  _onPointerCancel(ev) {
    if (!this._dragging || !this._activeSlider || ev.pointerId !== this._pointerId) return;
    ev.stopPropagation();
    this._finishSlider(false);
  }

  _onLostPointerCapture(ev) {
    if (this._dragging && ev.pointerId === this._pointerId) this._finishSlider(false);
  }

  _onWindowBlur() {
    if (this._dragging) this._finishSlider(false);
  }

  _onSliderInput(ev) {
    const slider = this._sliderFromEvent(ev);
    if (!slider) return;
    const value = this._sliderValue(slider);
    this._setSliderVisual(slider, value);
    this._sliderPreview = { entity: slider.dataset.e, value };
  }

  _onSliderChange(ev) {
    const slider = this._sliderFromEvent(ev);
    if (!slider) return;
    ev.stopPropagation();
    if (this._ignoreSliderChange === slider) {
      this._ignoreSliderChange = null;
      return;
    }
    if (this._dragging) return;
    const value = this._sliderValue(slider);
    this._sliderPreview = { entity: slider.dataset.e, value };
    this._commitSlider(slider, value);
    this._sliderPreview = null;
    this._render();
  }

  _onClick(ev) {
    if (this._sliderFromEvent(ev)) {
      ev.stopPropagation();
      return;
    }
    if (ev.target.closest && ev.target.closest('[data-toggle]')) {
      const entity = this._c.entity;
      this._call(entity.split('.')[0], 'toggle', entity);
    }
    if (ev.target.closest && ev.target.closest('[data-more]')) this._more(this._c.entity);
  }

  _onKeydown(ev) {
    if ((ev.key === 'Enter' || ev.key === ' ') &&
        ev.target.closest && ev.target.closest('[data-more]')) {
      ev.preventDefault();
      this._more(this._c.entity);
    }
  }

  _finishSlider(commit) {
    const slider = this._activeSlider;
    if (!slider) return;
    const pointerId = this._pointerId;
    if (commit && !this._sliderCommitted) {
      this._sliderCommitted = true;
      this._commitSlider(slider, this._sliderValue(slider));
    }
    this._ignoreSliderChange = slider;
    this._clearIgnoreSliderChangeLater(slider);
    this._dragging = false;
    this._activeSlider = null;
    this._pointerId = null;
    this._sliderPreview = null;
    try {
      if (pointerId != null && slider.hasPointerCapture(pointerId)) {
        slider.releasePointerCapture(pointerId);
      }
    } catch (err) {
      // The browser may already have released capture during cancellation.
    }
    this._render();
  }

  _cancelSlider() {
    if (this._activeSlider) this._finishSlider(false);
    this._dragging = false;
    this._activeSlider = null;
    this._pointerId = null;
    this._sliderPreview = null;
  }

  _clearIgnoreSliderChangeLater(slider) {
    if (this._ignoreSliderChangeTimer) clearTimeout(this._ignoreSliderChangeTimer);
    this._ignoreSliderChangeTimer = setTimeout(() => {
      if (this._ignoreSliderChange === slider) this._ignoreSliderChange = null;
      this._ignoreSliderChangeTimer = null;
    }, 0);
  }

  _updateSliderFromPointer(el, clientX) {
    const rect = el.getBoundingClientRect();
    const min = Number.isFinite(parseFloat(el.min)) ? parseFloat(el.min) : 0;
    const max = Number.isFinite(parseFloat(el.max)) ? parseFloat(el.max) : 100;
    let pct = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    pct = Math.max(0, Math.min(1, pct));
    const val = Math.round(min + pct * (max - min));
    el.value = String(val);
    this._setSliderVisual(el, val);
    this._sliderPreview = { entity: el.dataset.e, value: val };
    return val;
  }

  _sliderValue(el) {
    const min = Number.isFinite(parseFloat(el.min)) ? parseFloat(el.min) : 0;
    const max = Number.isFinite(parseFloat(el.max)) ? parseFloat(el.max) : 100;
    const value = Number.isFinite(parseFloat(el.value)) ? parseFloat(el.value) : min;
    return Math.round(Math.max(min, Math.min(max, value)));
  }

  _setSliderVisual(el, value) {
    const min = Number.isFinite(parseFloat(el.min)) ? parseFloat(el.min) : 0;
    const max = Number.isFinite(parseFloat(el.max)) ? parseFloat(el.max) : 100;
    const ratio = max > min ? (value - min) / (max - min) : 0;
    el.value = String(value);
    const fill = el.parentElement.querySelector('.bar-fill');
    if (fill) fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }

  _commitSlider(el, value) {
    const entity = el.dataset.e;
    const brightness = this._sliderValue({ min: el.min, max: el.max, value });
    this._clearPendingSlider();
    this._pendingSlider = {
      entity,
      value: brightness,
      startedAt: Date.now(),
    };
    this._pendingSliderTimer = setTimeout(() => this._expirePendingSlider(), 5000);
    try {
      const result = this._call('light', 'turn_on', entity, { brightness_pct: brightness });
      if (result && typeof result.catch === 'function') {
        result.catch(() => this._expirePendingSlider());
      }
    } catch (err) {
      this._expirePendingSlider();
    }
  }

  _clearPendingSlider() {
    if (this._pendingSliderTimer) clearTimeout(this._pendingSliderTimer);
    this._pendingSliderTimer = null;
    this._pendingSlider = null;
  }

  _expirePendingSlider() {
    if (!this._pendingSlider) return;
    this._clearPendingSlider();
    this._render();
  }

  _pendingSliderReachedState(pending) {
    const state = this._hass && this._hass.states[pending.entity];
    if (!state) return false;
    if (pending.value === 0 && state.state === 'off') return true;
    if (state.state !== 'on') return false;
    const brightness = Number(state.attributes && state.attributes.brightness);
    return Number.isFinite(brightness) && Math.round((brightness / 255) * 100) === pending.value;
  }

  _ic(icon, cls) {
    return `<ha-icon icon="${icon}" class="${cls || ''}" style="--mdc-icon-size:20px"></ha-icon>`;
  }

  _render() {
    if (!this._hass || this._dragging) return;
    const entity = this._c.entity;
    const dimmable = this._dimmable();
    const authoritativeOn = this._st(entity) === 'on';
    const authoritativeBrightness = dimmable
      ? Math.round((this._attr(entity, 'brightness', 0) / 255) * 100)
      : null;
    const pending = this._pendingSlider && this._pendingSlider.entity === entity
      ? this._pendingSlider
      : null;
    if (pending && this._pendingSliderReachedState(pending)) {
      this._clearPendingSlider();
    }
    const activePending = this._pendingSlider && this._pendingSlider.entity === entity
      ? this._pendingSlider
      : null;
    const preview = this._sliderPreview && this._sliderPreview.entity === entity
      ? this._sliderPreview
      : null;
    const localValue = activePending ? activePending.value : preview ? preview.value : null;
    const on = localValue == null ? authoritativeOn : authoritativeOn || localValue > 0;
    const brightness = dimmable
      ? localValue == null ? authoritativeBrightness : localValue
      : null;
    const name = this._c.name || this._attr(entity, 'friendly_name', 'Light');

    const html = `
      <div class="row-top">
        <div class="row-left" data-more role="button" tabindex="0" aria-label="Show details for ${name}">
          ${this._ic('mdi:lightbulb', on ? 'ic-amber' : 'ic-mute')}
          <div>
            <div class="row-name">${name}</div>
            <div class="row-sub">${on ? (brightness != null ? `On &middot; ${brightness}%` : 'On') : 'Off'}</div>
          </div>
        </div>
        <button class="toggle ${on ? 'on' : ''}" data-toggle type="button"
          aria-label="${on ? 'Turn off' : 'Turn on'} ${name}"
          aria-pressed="${on}">
          <span class="knob"></span>
        </button>
      </div>
      ${dimmable ? `
        <div class="slider-wrap">
          <div class="bar"><div class="bar-fill amber" style="width:${on ? brightness : 0}%"></div></div>
          <input type="range" class="sl amber" min="0" max="100" value="${on ? brightness : 0}"
            aria-label="Brightness for ${name}" data-e="${entity}">
        </div>
      ` : ''}
    `;

    if (!this._shell) {
      this.innerHTML = `<style>${this._css()}</style><ha-card class="row-card"></ha-card>`;
      this._shell = true;
      this._card = this.querySelector('.row-card');
    }
    this._card.innerHTML = html;
  }

  _css() {
    return `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif;
        --light-card-bg: var(--home-dark-card-background, #212c42);
        --light-primary-text: var(--home-dark-primary-text, #f5f7fb);
        --light-secondary-text: var(--home-dark-secondary-text, #91a2bb);
        --light-accent: var(--home-dark-accent, var(--accent-color, #ffb340));
        --light-dark: var(--home-dark-page-background, #1a2433);
        --light-track: var(--home-dark-control-background, #2b3850);
        --light-muted: var(--home-dark-muted-text, #66758f);
      }
      .row-card {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        background: var(--light-card-bg) !important;
        color: var(--light-primary-text);
        border-radius: var(--ha-card-border-radius, 20px);
        border: 1px solid rgba(255,255,255,.1);
        padding: 14px 16px;
        color-scheme: dark;
      }
      .row-top { display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .row-left {
        display:flex; gap:10px; align-items:center; cursor:pointer; flex:1; min-width:0;
        outline:none;
      }
      .row-left:focus-visible { outline:2px solid var(--light-accent); outline-offset:3px; border-radius:6px; }
      .row-name { font-size:14px; font-weight:700; }
      .row-sub { font-size:11.5px; color:var(--light-secondary-text); }
      .slider-wrap { position:relative; height:28px; margin-top:10px; }
      .bar {
        position:absolute; left:0; right:0; top:50%; transform:translateY(-50%);
        height:6px; border-radius:3px; background:var(--light-track);
        overflow:hidden; pointer-events:none;
      }
      .bar-fill { height:100%; background:var(--light-accent); }
      .sl {
        position:absolute; left:0; top:0; -webkit-appearance:none; appearance:none;
        width:100%; height:28px; margin:0; background:transparent;
        touch-action:none; cursor:pointer;
      }
      .sl::-webkit-slider-runnable-track { background:transparent; height:28px; }
      .sl::-moz-range-track { background:transparent; height:28px; }
      .sl::-webkit-slider-thumb {
        -webkit-appearance:none; width:20px; height:20px; border-radius:50%;
        background:var(--light-accent); cursor:pointer; margin-top:4px;
      }
      .sl::-moz-range-thumb {
        width:20px; height:20px; border-radius:50%; background:var(--light-accent);
        cursor:pointer; border:0;
      }
      .toggle {
        all:unset; cursor:pointer; width:44px; height:26px; border-radius:999px;
        background:var(--light-track); position:relative; flex:none;
      }
      .toggle.on { background:var(--light-accent); }
      .toggle:focus-visible { outline:2px solid var(--light-accent); outline-offset:3px; }
      .toggle .knob {
        position:absolute; left:3px; top:3px; width:20px; height:20px;
        border-radius:50%; background:var(--light-muted); transition:left .15s;
      }
      .toggle.on .knob { left:21px; background:var(--light-dark); }
      .ic-amber { color:var(--light-accent); }
      .ic-mute { color:var(--light-muted); }
    `;
  }
}

customElements.define('home-light-card', HomeLightCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-light-card',
  name: 'Home Light',
  description: 'Theme-aware light control row with optional brightness slider',
});
