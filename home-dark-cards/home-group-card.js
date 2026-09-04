class HomeGroupCard extends HTMLElement {
  constructor() {
    super();
    this._open = false;
    this._childrenReady = false;
    this._childrenCommitted = false;
    this._childCards = [];
    this._childrenPromise = null;
    this._renderToken = 0;
  }

  setConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Group configuration required');
    }
    if (!Array.isArray(config.cards)) {
      throw new Error('cards must be an array of Lovelace card configurations');
    }
    if (config.cards.some((card) => !card || typeof card !== 'object' || !card.type)) {
      throw new Error('Each group card needs a Lovelace card type');
    }

    const entity = typeof config.entity === 'string' && config.entity.trim()
      ? config.entity.trim()
      : null;
    const title = String(config.title || config.name || '').trim();
    this._config = {
      ...config,
      entity,
      title,
      cards: config.cards.map((card) => ({ ...card })),
      open: config.open === true,
      show_entity_state: config.show_entity_state !== false,
    };
    this._open = this._config.open;
    this._childrenReady = false;
    this._childrenCommitted = false;
    this._childCards = [];
    this._childrenPromise = null;
    this._renderToken += 1;
    this._shell = false;
    this.innerHTML = '';
    this._render();
    if (this._open && this.isConnected) this._ensureChildren();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateHeader();
    this._childCards.forEach((card) => {
      card.hass = hass;
    });
    if (this._open && !this._childrenReady) this._ensureChildren();
  }

  connectedCallback() {
    this._render();
    if (this._open) this._ensureChildren();
  }

  disconnectedCallback() {
    this._renderToken += 1;
    this._childrenPromise = null;
    this._childrenReady = this._childrenCommitted;
    const body = this.querySelector('.group-body');
    if (body) body.removeAttribute('aria-busy');
  }

  getCardSize() {
    return this._open ? Math.max(1, this._config?.cards.length || 1) : 1;
  }

  getGridOptions() {
    return this._config?.grid_options || { columns: 'full', rows: 'auto' };
  }

  async _ensureChildren() {
    if (this._childrenReady || !this._config || !this.isConnected) return;
    if (this._childrenPromise) return this._childrenPromise;
    const body = this.querySelector('.group-body');
    if (!body) return;
    const token = this._renderToken;
    body.setAttribute('aria-busy', 'true');

    const creation = (async () => {
      try {
        if (typeof window.loadCardHelpers !== 'function') {
          throw new Error('Home Assistant card helpers are unavailable');
        }
        const helpers = await window.loadCardHelpers();
        if (token !== this._renderToken || !this.isConnected) return;

        const configs = this._config.cards;
        const children = await Promise.all(
          configs.map((config) => Promise.resolve(helpers.createCardElement(config)))
        );
        if (token !== this._renderToken || !this.isConnected ||
            body !== this.querySelector('.group-body')) {
          return;
        }

        children.forEach((card) => {
          if (!(card instanceof Node)) {
            throw new Error('Home Assistant returned an invalid child card');
          }
          if (this._hass) card.hass = this._hass;
        });
        body.replaceChildren(...children);
        this._childCards = children;
        this._childrenCommitted = true;
        this._childrenReady = true;
      } catch (error) {
        if (token !== this._renderToken || !this.isConnected ||
            body !== this.querySelector('.group-body')) {
          return;
        }
        this._childrenReady = false;
        this._childrenCommitted = false;
        this._childCards = [];
        const message = document.createElement('div');
        message.className = 'group-error';
        message.textContent = 'Unable to load grouped cards.';
        body.replaceChildren(message);
        console.error('home-group-card:', error);
      } finally {
        if (token === this._renderToken && body === this.querySelector('.group-body')) {
          body.removeAttribute('aria-busy');
        }
      }
    })();
    this._childrenPromise = creation;
    try {
      return await creation;
    } finally {
      if (this._childrenPromise === creation) {
        this._childrenPromise = null;
      }
    }
  }

  _entityState() {
    if (!this._config?.entity || !this._hass) return null;
    return this._hass.states[this._config.entity] || null;
  }

  _title() {
    const state = this._entityState();
    return this._config?.title || state?.attributes?.friendly_name || 'Group';
  }

  _icon() {
    const state = this._entityState();
    return this._config?.icon || state?.attributes?.icon || 'mdi:folder-outline';
  }

  _updateHeader() {
    const title = this.querySelector('.group-title');
    const state = this.querySelector('.entity-state');
    const chevron = this.querySelector('.group-chevron');
    const icon = this.querySelector('.group-icon');

    if (title) title.textContent = this._title();
    if (icon) icon.setAttribute('icon', this._icon());
    if (state) {
      const entityState = this._entityState();
      state.textContent = entityState ? entityState.state : 'Unavailable';
    }
    if (chevron) chevron.setAttribute('icon', this._open ? 'mdi:chevron-up' : 'mdi:chevron-down');
  }

  _render() {
    if (!this._config || this._shell) {
      this._updateHeader();
      return;
    }

    this.innerHTML = `
      <style>
        home-group-card {
          display: block;
          width: 100%;
          min-width: 0;
          font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif;
          --group-card-bg: var(--card-background-color, var(--ha-card-background, #212c42));
          --group-card-radius: var(--home-group-card-border-radius, 20px);
          --group-primary: var(--primary-text-color, #f5f7fb);
          --group-secondary: var(--secondary-text-color, #91a2bb);
          --group-control: var(--secondary-background-color, #2b3850);
          --group-accent: var(--primary-color, var(--accent-color, #ffb340));
          --group-muted: var(--disabled-text-color, #66758f);
          --group-divider: var(--divider-color, rgba(255, 255, 255, .1));
        }
        home-group-card > .group-card {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--group-divider) !important;
          border-radius: var(--group-card-radius) !important;
          background: var(--group-card-bg) !important;
          box-shadow: var(--ha-card-box-shadow, 0 4px 14px rgba(0,0,0,.16)) !important;
          color: var(--group-primary);
        }
        .group-details { display: block; }
        .group-header {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          min-height: 44px;
          padding: 10px 14px;
          border-radius: 12px;
          color: inherit;
          background: transparent;
          font: inherit;
          text-align: left;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          list-style: none;
        }
        .group-header::-webkit-details-marker { display: none; }
        .group-header::marker { content: ''; }
        .group-header:hover { background: rgba(43, 56, 80, 0.58); }
        .group-header:active { transform: scale(0.99); }
        .group-header:focus-visible {
          outline: 2px solid var(--group-accent);
          outline-offset: 2px;
        }
        .group-icon {
          flex: 0 0 auto;
          color: var(--group-accent);
          --mdc-icon-size: 22px;
        }
        .group-copy { min-width: 0; flex: 1 1 auto; }
        .group-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          font-weight: 750;
          line-height: 1.25;
        }
        .group-subtitle {
          overflow: hidden;
          margin-top: 2px;
          color: var(--group-secondary);
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11.5px;
          line-height: 1.2;
        }
        .group-chevron {
          flex: 0 0 auto;
          color: var(--group-muted);
          --mdc-icon-size: 24px;
        }
        .group-body {
          display: grid;
          gap: 8px;
          min-width: 0;
          padding: 0 12px 12px;
        }
        .group-body > * { min-width: 0; }
        .group-error {
          padding: 10px 2px 2px;
          color: var(--group-secondary);
          font-size: 13px;
        }
        @media (prefers-reduced-motion: reduce) {
          .group-header:active { transform: none; }
        }
      </style>
      <ha-card class="group-card">
        <details class="group-details" ${this._open ? 'open' : ''}>
          <summary class="group-header">
            <ha-icon class="group-icon"></ha-icon>
            <span class="group-copy">
              <span class="group-title"></span>
              ${this._config.entity && this._config.show_entity_state
                ? '<span class="group-subtitle entity-state"></span>'
                : ''}
            </span>
            <ha-icon class="group-chevron"></ha-icon>
          </summary>
          <div class="group-body"></div>
        </details>
      </ha-card>
    `;
    this._shell = true;
    this.querySelector('.group-icon').setAttribute('icon', this._icon());
    const details = this.querySelector('.group-details');
    const header = this.querySelector('.group-header');
    const body = this.querySelector('.group-body');
    ['pointerdown', 'click'].forEach((type) => {
      header.addEventListener(type, (event) => event.stopPropagation());
    });
    ['pointerdown', 'click', 'input', 'change'].forEach((type) => {
      body.addEventListener(type, (event) => event.stopPropagation());
    });
    details.addEventListener('toggle', (event) => {
      this._open = event.currentTarget.open;
      this._updateHeader();
      if (this._open) this._ensureChildren();
    });
    this._updateHeader();
  }
}

if (!customElements.get('home-group-card')) {
  customElements.define('home-group-card', HomeGroupCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'home-group-card')) {
  window.customCards.push({
    type: 'home-group-card',
    name: 'Home Group',
    description: 'Expandable Home Dark card group with an optional entity header',
  });
}
