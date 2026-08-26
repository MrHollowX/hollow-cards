class HomeApplianceCard extends HTMLElement {
  setConfig(config) {
    if (!config?.name || !config?.connectivity_entity) {
      throw new Error('name and connectivity_entity are required');
    }
    this._config = {
      ...config,
      name: String(config.name),
      location: typeof config.location === 'string' ? config.location : '',
      icon: typeof config.icon === 'string' ? config.icon : 'mdi:home-outline',
      accent: typeof config.accent === 'string' ? config.accent : '#3d8bfd',
      state_entity: config.state_entity || '',
      progress_entity: config.progress_entity || '',
      finish_time_entity: config.finish_time_entity || '',
      remaining_entity: config.remaining_entity || '',
      program_entity: config.program_entity || '',
      power_entity: config.power_entity || '',
      stop_button_entity: config.stop_button_entity || '',
      metric: config.metric && typeof config.metric.entity === 'string' ? config.metric : null,
      status_entities: Array.isArray(config.status_entities) ? config.status_entities : [],
      options: Array.isArray(config.options) ? config.options.filter(item => item?.entity) : [],
    };
    this._expanded = false;
    this._programMenuOpen = false;
    this._programMenuAbove = false;
    this._renderKey = '';
  }

  getCardSize() { return 3; }

  getGridOptions() { return { columns: 12, rows: 'auto' }; }

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
    this._onOutsidePointerDown = this._onOutsidePointerDown.bind(this);
    this._onViewportChange = this._onViewportChange.bind(this);
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeydown);
    this.addEventListener('pointerdown', this._onPointerDown, true);
    document.addEventListener('pointerdown', this._onOutsidePointerDown, true);
    window.addEventListener('resize', this._onViewportChange);
    document.addEventListener('scroll', this._onViewportChange, true);
  }

  disconnectedCallback() {
    if (!this._wired) return;
    clearTimeout(this._pendingTimer);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeydown);
    this.removeEventListener('pointerdown', this._onPointerDown, true);
    document.removeEventListener('pointerdown', this._onOutsidePointerDown, true);
    window.removeEventListener('resize', this._onViewportChange);
    document.removeEventListener('scroll', this._onViewportChange, true);
    this._wired = false;
  }

  _state(entity) {
    return entity && this._hass ? this._hass.states[entity] || null : null;
  }

  _available(entity) {
    const state = this._state(entity);
    return Boolean(state && (
      String(entity).startsWith('button.') ||
      !['unknown', 'unavailable'].includes(String(state.state).toLowerCase())
    ));
  }

  _isOn(entity) {
    return this._state(entity)?.state === 'on';
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

  _words(value) {
    return String(value == null ? '' : value)
      .replace(/^.*(?:_program_|\.Program\.)/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase())
      .trim() || 'Not selected';
  }

  _operation() {
    if (!this._isOn(this._config.connectivity_entity)) return 'Offline';
    const state = String(this._state(this._config.state_entity)?.state || '').toLowerCase();
    return {
      inactive: 'Standby',
      ready: 'Ready to start',
      delayedstart: 'Programmed',
      run: 'Running',
      pause: 'Paused',
      actionrequired: 'Action required',
      finished: 'Finished',
      error: 'Attention needed',
      aborting: 'Stopping',
    }[state] || (state ? this._words(state) : 'Connected');
  }

  _isActive() {
    return ['run', 'pause', 'delayedstart', 'actionrequired'].includes(
      String(this._state(this._config.state_entity)?.state || '').toLowerCase(),
    );
  }

  _program() {
    const state = this._state(this._config.program_entity)?.state;
    return this._available(this._config.program_entity) ? this._words(state) : '';
  }

  _progress() {
    const value = Number(this._state(this._config.progress_entity)?.state);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  }

  _finishTime() {
    const value = this._state(this._config.finish_time_entity)?.state;
    if (!value || ['unknown', 'unavailable'].includes(value)) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  _remaining() {
    if (!this._isActive()) return '';
    const seconds = Number(this._state(this._config.remaining_entity)?.state);
    if (Number.isFinite(seconds) && seconds >= 0) return this._duration(seconds);
    const finish = new Date(this._state(this._config.finish_time_entity)?.state).getTime();
    return Number.isFinite(finish) && finish > Date.now() ? this._duration((finish - Date.now()) / 1000) : '';
  }

  _duration(seconds) {
    const totalMinutes = Math.ceil(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}` : `${minutes} min`;
  }

  _metric() {
    if (!this._config.metric) return null;
    const state = this._state(this._config.metric.entity);
    if (!this._available(this._config.metric.entity)) return null;
    return {
      value: `${state.state}${this._config.metric.unit || state.attributes.unit_of_measurement || ''}`,
      label: this._config.metric.label || state.attributes.friendly_name || '',
    };
  }

  _setPending(text) {
    clearTimeout(this._pendingTimer);
    this._pending = text;
    this._pendingTimer = setTimeout(() => {
      this._pending = '';
      this._render(true);
    }, 5000);
    this._render(true);
  }

  _call(domain, service, entity, data = {}) {
    if (!this._hass || !entity || !this._available(entity)) return;
    try {
      const result = this._hass.callService(domain, service, { entity_id: entity, ...data });
      if (result?.catch) result.catch(() => {
        this._pending = '';
        this._render(true);
      });
      return result;
    } catch {
      this._pending = '';
      this._render(true);
      return null;
    }
  }

  _togglePower() {
    const entity = this._config.power_entity;
    if (!this._available(entity)) return;
    this._setPending(this._isOn(entity) ? 'Turning off…' : 'Turning on…');
    this._call('switch', this._isOn(entity) ? 'turn_off' : 'turn_on', entity);
  }

  _toggleOption(entity, label) {
    if (!this._available(entity)) return;
    this._setPending(`${this._isOn(entity) ? 'Disabling' : 'Enabling'} ${label}…`);
    this._call('switch', this._isOn(entity) ? 'turn_off' : 'turn_on', entity);
  }

  _chooseProgram(value) {
    if (!value || !this._available(this._config.program_entity)) return;
    this._programMenuOpen = false;
    this._setPending('Updating program…');
    this._call('select', 'select_option', this._config.program_entity, { option: value });
  }

  _stopProgram() {
    if (!this._isActive() || !this._available(this._config.stop_button_entity)) return;
    if (!window.confirm(`Stop the active program on ${this._config.name}?`)) return;
    this._setPending('Stopping program…');
    this._call('button', 'press', this._config.stop_button_entity);
  }

  _eventControl(event, selector) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const candidate = path.find(node => node?.matches?.(selector));
    return candidate && this.contains(candidate) ? candidate : null;
  }

  _onPointerDown(event) {
    if (this._eventControl(event, 'button,[data-program-option]')) event.stopPropagation();
  }

  _onOutsidePointerDown(event) {
    if (!this._programMenuOpen) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (!path.includes(this) && !this.contains(event.target)) {
      this._programMenuOpen = false;
      this._render(true);
    }
  }

  _onViewportChange() {
    if (this._programMenuOpen) this._positionProgramMenu();
  }

  _positionProgramMenu() {
    const trigger = this.querySelector('[data-program-trigger]');
    const menu = this.querySelector('.program-menu');
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = 8;
    const above = Math.max(0, rect.top - gap);
    const below = Math.max(0, viewportHeight - rect.bottom - gap);
    this._programMenuAbove = above > below && above >= 80;
    const available = this._programMenuAbove ? above : below;
    menu.classList.toggle('above', this._programMenuAbove);
    menu.style.maxHeight = `${Math.max(80, Math.min(240, available || 80))}px`;
  }

  _onClick(event) {
    const selectOption = this._eventControl(event, '[data-program-option]');
    if (selectOption) {
      event.preventDefault();
      event.stopPropagation();
      this._chooseProgram(selectOption.dataset.programOption);
      return;
    }
    const program = this._eventControl(event, '[data-program-trigger]');
    if (program) {
      event.preventDefault();
      event.stopPropagation();
      this._programMenuOpen = !this._programMenuOpen;
      this._render(true);
      if (this._programMenuOpen) requestAnimationFrame(() => {
        this._positionProgramMenu();
        this.querySelector('[data-program-option][aria-selected="true"], [data-program-option]')?.focus();
      });
      return;
    }
    const toggle = this._eventControl(event, '[data-toggle]');
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      this._expanded = !this._expanded;
      this._programMenuOpen = false;
      this._render(true);
      return;
    }
    const power = this._eventControl(event, '[data-power]');
    if (power) {
      event.preventDefault();
      event.stopPropagation();
      this._togglePower();
      return;
    }
    const option = this._eventControl(event, '[data-option]');
    if (option) {
      event.preventDefault();
      event.stopPropagation();
      this._toggleOption(option.dataset.option, option.dataset.label || 'option');
      return;
    }
    const stop = this._eventControl(event, '[data-stop]');
    if (stop) {
      event.preventDefault();
      event.stopPropagation();
      this._stopProgram();
    }
  }

  _onKeydown(event) {
    if (event.key === 'Escape' && this._programMenuOpen) {
      event.preventDefault();
      this._programMenuOpen = false;
      this._render(true);
      requestAnimationFrame(() => this.querySelector('[data-program-trigger]')?.focus());
      return;
    }
    const option = this._eventControl(event, '[data-program-option]');
    if (!option || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = Array.from(this.querySelectorAll('[data-program-option]'));
    const current = options.indexOf(option);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }

  _programControl(online) {
    const state = this._state(this._config.program_entity);
    const options = Array.isArray(state?.attributes?.options) ? state.attributes.options : [];
    if (!state) return '';
    const enabled = online && this._available(this._config.program_entity) && options.length > 0;
    return `<div class="program-control">
      <span class="control-label">Program</span>
      <button type="button" class="program-trigger" data-program-trigger aria-haspopup="listbox"
        aria-expanded="${this._programMenuOpen}" ${enabled ? '' : 'disabled'}>
        <span>${this._escape(this._program())}</span><ha-icon icon="mdi:chevron-down" aria-hidden="true"></ha-icon>
      </button>
      ${this._programMenuOpen && enabled ? `<div class="program-menu" role="listbox" aria-label="${this._escape(this._config.name)} program">
        ${options.map(option => `<button type="button" role="option" data-program-option="${this._escape(option)}"
          class="${option === state.state ? 'selected' : ''}" aria-selected="${option === state.state}">${this._escape(this._words(option))}</button>`).join('')}
      </div>` : ''}
    </div>`;
  }

  _statusItems(operation, finish) {
    const values = [operation];
    this._config.status_entities.forEach(item => {
      const state = this._state(item.entity);
      if (!this._available(item.entity)) return;
      const text = item.label ? `${item.label} ${this._words(state.state)}` : this._words(state.state);
      values.push(text);
    });
    if (finish) values.push(`Ends ${finish}`);
    return values.slice(0, 3).map(value => `<span>${this._escape(value)}</span>`).join('');
  }

  _render(force = false) {
    if (!this._hass || !this._config) return;
    if (this._programMenuOpen && !force) return;
    const online = this._isOn(this._config.connectivity_entity);
    const operation = this._operation();
    const program = this._program();
    const progress = this._progress();
    const finish = this._finishTime();
    const remaining = this._remaining();
    const metric = this._metric();
    const signature = JSON.stringify({
      online, operation, program, progress, finish, remaining, metric,
      expanded: this._expanded, menu: this._programMenuOpen, pending: this._pending,
      states: [this._config.power_entity, this._config.stop_button_entity, ...this._config.options.map(item => item.entity), ...this._config.status_entities.map(item => item.entity)].map(entity => this._state(entity)?.state),
    });
    if (!force && signature === this._renderKey) return;
    this._renderKey = signature;

    const subtitle = [this._config.location, program].filter(Boolean).join(' · ') || operation;
    const primary = metric || (remaining ? { value: remaining, label: 'remaining' } : null);
    const options = this._config.options.filter(item => this._state(item.entity)).map(item => {
      const on = this._isOn(item.entity);
      return `<button type="button" class="option${on ? ' on' : ''}" data-option="${this._escape(item.entity)}"
        data-label="${this._escape(item.name || 'option')}" ${online && this._available(item.entity) ? '' : 'disabled'} aria-pressed="${on}">
        <ha-icon icon="${this._escape(item.icon || 'mdi:check')}" aria-hidden="true"></ha-icon><span>${this._escape(item.name || 'Option')}</span>
      </button>`;
    }).join('');
    const canStop = online && this._isActive() && this._available(this._config.stop_button_entity);
    const html = `<ha-card class="appliance-card${online ? '' : ' offline'}" style="--appliance-accent:${this._escape(this._config.accent)}">
      <button type="button" class="summary" data-toggle aria-expanded="${this._expanded}" aria-label="${this._expanded ? 'Collapse' : 'Show'} controls for ${this._escape(this._config.name)}">
        <span class="top-row">
          <span class="identity"><span class="icon-shell"><ha-icon icon="${this._escape(this._config.icon)}" aria-hidden="true"></ha-icon></span>
            <span class="copy"><strong>${this._escape(this._config.name)}</strong><small>${this._escape(subtitle)}</small></span>
          </span>
          ${primary ? `<span class="primary-value"><strong>${this._escape(primary.value)}</strong><small>${this._escape(primary.label)}</small></span>` : ''}
        </span>
        ${progress != null ? `<span class="track" role="progressbar" aria-label="${this._escape(this._config.name)} program progress"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></span>` : ''}
        <span class="status-row">${this._statusItems(operation, finish)}</span>
      </button>
      ${this._expanded ? `<section class="controls" aria-label="${this._escape(this._config.name)} controls">
        <div class="control-row">
          ${this._config.power_entity && this._state(this._config.power_entity) ? `<button type="button" class="power${this._isOn(this._config.power_entity) ? ' on' : ''}" data-power ${online && this._available(this._config.power_entity) ? '' : 'disabled'} aria-pressed="${this._isOn(this._config.power_entity)}"><ha-icon icon="mdi:power" aria-hidden="true"></ha-icon><span>Power</span></button>` : ''}
          ${this._programControl(online)}
          ${canStop ? `<button type="button" class="stop" data-stop><ha-icon icon="mdi:stop" aria-hidden="true"></ha-icon><span>Stop</span></button>` : ''}
        </div>
        ${options ? `<div class="options">${options}</div>` : ''}
        ${this._pending ? `<p class="pending" role="status"><ha-icon icon="mdi:progress-clock" aria-hidden="true"></ha-icon>${this._escape(this._pending)}</p>` : ''}
      </section>` : ''}
      ${!online ? '<p class="offline-note">Home Connect is not currently reporting from this appliance.</p>' : ''}
    </ha-card>`;
    this.innerHTML = `<style>${this._css()}</style>${html}`;
  }

  _css() {
    return `
      home-appliance-card { display:block; min-width:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; --appliance-page:var(--primary-background-color,#1a2433); --appliance-bg:var(--card-background-color,var(--ha-card-background,#212c42)); --appliance-card-radius:var(--home-appliance-card-border-radius,20px); --appliance-primary:var(--primary-text-color,#f5f7fb); --appliance-secondary:var(--secondary-text-color,#91a2bb); --appliance-muted:var(--disabled-text-color,#66758f); --appliance-control:var(--secondary-background-color,#2b3850); --appliance-focus:var(--primary-color,#3d8bfd); --appliance-divider:var(--divider-color,rgba(145,162,187,.22)); }
      home-appliance-card > ha-card.appliance-card { min-width:0; padding:14px 16px; color:var(--appliance-primary); background:var(--appliance-bg)!important; border:1px solid var(--appliance-divider)!important; border-radius:var(--appliance-card-radius)!important; box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important; }
      .appliance-card * { box-sizing:border-box; } button { font:inherit; } button:not(:disabled) { cursor:pointer; } button:focus-visible { outline:3px solid var(--appliance-focus); outline-offset:2px; } button:disabled { cursor:not-allowed; opacity:.45; }
      .summary { all:unset; box-sizing:border-box; display:block; width:100%; min-width:0; border-radius:10px; } .top-row,.identity,.copy,.primary-value,.status-row,.control-row,.options,.pending { display:flex; align-items:center; }
      .top-row { justify-content:space-between; gap:12px; } .identity { min-width:0; gap:11px; } .icon-shell { width:42px; height:42px; display:grid; place-items:center; flex:none; border-radius:50%; background:rgba(145,162,187,.13); color:var(--appliance-accent); } .icon-shell ha-icon { --mdc-icon-size:22px; }
      .copy,.primary-value { min-width:0; flex-direction:column; align-items:flex-start; } .copy strong { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; line-height:1.2; font-weight:780; } .copy small,.primary-value small { margin-top:3px; color:var(--appliance-secondary); font-size:11px; line-height:1.2; }
      .primary-value { flex:none; align-items:flex-end; text-align:right; } .primary-value strong { color:var(--appliance-accent); font-size:18px; line-height:1; font-weight:800; } .primary-value small { white-space:nowrap; }
      .track { display:block; height:6px; overflow:hidden; margin-top:13px; border-radius:999px; background:rgba(145,162,187,.15); } .track > span { display:block; height:100%; min-width:0; border-radius:inherit; background:var(--appliance-accent); transition:width .2s ease; }
      .status-row { flex-wrap:wrap; gap:0; margin-top:11px; color:var(--appliance-secondary); font-size:11px; line-height:1.2; } .status-row span + span::before { content:'·'; margin:0 8px; color:rgba(145,162,187,.58); }
      .controls { position:relative; margin-top:13px; padding-top:13px; border-top:1px solid var(--appliance-divider); } .control-row { align-items:stretch; gap:8px; } .power,.stop,.program-trigger,.option { border:1px solid var(--appliance-divider); border-radius:9px; color:var(--appliance-primary); background:var(--appliance-control); }
      .power,.stop { display:flex; align-items:center; justify-content:center; gap:5px; min-width:62px; padding:0 9px; color:var(--appliance-secondary); font-size:11px; font-weight:750; } .power ha-icon,.stop ha-icon { --mdc-icon-size:16px; } .power.on { color:var(--appliance-page); border-color:transparent; background:var(--appliance-accent); } .stop { color:#ffb4a8; }
      .program-control { position:relative; flex:1 1 auto; min-width:0; } .control-label { display:block; margin-bottom:4px; color:var(--appliance-secondary); font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; } .program-trigger { display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%; min-height:36px; padding:5px 8px 5px 10px; font-size:12px; font-weight:750; text-align:left; } .program-trigger span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .program-trigger ha-icon { --mdc-icon-size:18px; color:var(--appliance-secondary); }
      .program-menu { position:absolute; z-index:30; top:calc(100% + 5px); right:0; left:0; max-height:min(240px,50dvh); overflow:auto; overscroll-behavior:contain; padding:4px; border:1px solid rgba(145,162,187,.24); border-radius:10px; background:var(--appliance-control); box-shadow:0 14px 28px rgba(0,0,0,.42); } .program-menu.above { top:auto; bottom:calc(100% + 5px); } .program-menu button { display:block; width:100%; padding:8px 9px; border:0; border-radius:7px; color:var(--appliance-primary); background:transparent; text-align:left; font-size:12px; font-weight:650; line-height:1.25; } .program-menu button:hover,.program-menu button:focus-visible,.program-menu button.selected { background:rgba(255,255,255,.09); } .program-menu button.selected { color:var(--appliance-accent); }
      .options { flex-wrap:wrap; gap:7px; margin-top:10px; } .option { display:inline-flex; align-items:center; gap:5px; min-height:30px; padding:4px 7px; color:var(--appliance-secondary); font-size:10.5px; font-weight:700; } .option ha-icon { --mdc-icon-size:14px; } .option.on { border-color:transparent; color:var(--appliance-accent); background:color-mix(in srgb,var(--appliance-accent) 17%,transparent); }
      .pending { gap:5px; margin:10px 0 0; color:var(--appliance-secondary); font-size:11px; } .pending ha-icon { --mdc-icon-size:14px; color:var(--appliance-accent); } .offline-note { margin:10px 0 0; color:var(--appliance-secondary); font-size:10.5px; line-height:1.35; } .offline { border:1px solid rgba(145,162,187,.12); }
      @media(max-width:380px) { .appliance-card { padding:13px; } .control-row { flex-wrap:wrap; } .program-control { flex-basis:100%; } .power,.stop { min-height:36px; } }
    `;
  }
}

customElements.define('home-appliance-card', HomeApplianceCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-appliance-card',
  name: 'Home Appliance',
  description: 'Compact Bosch Home Connect appliance status and controls',
});
