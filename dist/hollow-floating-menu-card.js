const DEFAULT_TABS = [
  { id: 'home', icon: 'mdi:home', label: 'Home', path: '/home-dark/home' },
  { id: 'lights', icon: 'mdi:lightbulb', label: 'Lights', path: '/home-dark/lights' },
  { id: 'climate', icon: 'mdi:thermometer', label: 'Climate', path: '/home-dark/climate' },
  { id: 'blinds', icon: 'mdi:blinds-horizontal', label: 'Blinds', path: '/home-dark/blinds' },
  { id: 'media', icon: 'mdi:music', label: 'Media', path: '/home-dark/media' },
  { id: 'vacuum', icon: 'mdi:robot-vacuum', label: 'Vacuum', path: '/home-dark/vacuum' },
];

class HomeFloatingMenuCard extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._buttons = new Map();
    this._instanceOrder = ++HomeFloatingMenuCard._nextInstanceOrder;
    this._onPointerDown = (event) => {
      if (this._buttonFromEvent(event)) event.stopPropagation();
    };
    this._onClick = (event) => {
      const button = this._buttonFromEvent(event);
      if (!button) return;
      event.stopPropagation();
      const tab = this._config?.tabs.find((item) => item.id === button.dataset.tab);
      if (tab) this._navigate(tab.path);
    };
    this._onObservedResize = () => this._schedulePosition();
  }

  setConfig(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('Floating-menu configuration must be an object');
    }
    const tabs = Array.isArray(config.tabs) && config.tabs.length
      ? config.tabs
      : DEFAULT_TABS;
    const seen = new Set();

    const nextConfig = {
      ...config,
      tabs: tabs.map((tab) => {
        if (!tab || typeof tab !== 'object') {
          throw new Error('Each floating-menu tab must be an object');
        }
        const id = String(tab.id || '').trim();
        const path = String(tab.path || '').trim();
        if (!id || !path) {
          throw new Error('Each floating-menu tab needs an id and path');
        }
        if (seen.has(id)) {
          throw new Error(`Duplicate floating-menu tab id: ${id}`);
        }
        seen.add(id);
        return {
          id,
          path,
          icon: String(tab.icon || 'mdi:circle-outline'),
          label: String(tab.label || id),
        };
      }),
      show_labels: config.show_labels === true,
      current: config.current == null ? '' : String(config.current).trim(),
      view_path: config.view_path == null ? '' : String(config.view_path).trim(),
    };
    const structureKey = JSON.stringify({
      tabs: nextConfig.tabs,
      showLabels: nextConfig.show_labels,
    });
    const structureChanged = structureKey !== this._structureKey || !this._menu;

    this._config = nextConfig;
    if (structureChanged) {
      this._structureKey = structureKey;
      this._buildMenu();
    }

    if (this._connected) {
      HomeFloatingMenuCard._syncInstances();
      if (structureChanged) this._schedulePosition();
    } else {
      const routeTab = this._routeTabId();
      this._updateActiveHighlight(this._highlightedTabId(routeTab));
    }
  }

  connectedCallback() {
    if (this._connected) return;
    HomeFloatingMenuCard._instances.add(this);
    this._connected = true;
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('click', this._onClick);
    HomeFloatingMenuCard._attachGlobalListeners();
    if (typeof ResizeObserver === 'function') {
      this._layoutObserver = new ResizeObserver(this._onObservedResize);
      this._layoutObserver.observe(this);
    }
    HomeFloatingMenuCard._syncInstances();
    this._schedulePosition();
  }

  disconnectedCallback() {
    if (!this._connected) return;
    this._layoutObserver?.disconnect();
    this._layoutObserver = null;
    if (this._positionFrame != null) cancelAnimationFrame(this._positionFrame);
    this._positionFrame = null;
    this.removeEventListener('pointerdown', this._onPointerDown);
    this.removeEventListener('click', this._onClick);
    this._connected = false;
    HomeFloatingMenuCard._instances.delete(this);
    if (HomeFloatingMenuCard._instances.size) {
      HomeFloatingMenuCard._syncInstances();
    } else {
      HomeFloatingMenuCard._detachGlobalListeners();
    }
  }

  getCardSize() {
    return 0;
  }

  getGridOptions() {
    return { columns: 'full', rows: 'auto' };
  }

  static _attachGlobalListeners() {
    if (HomeFloatingMenuCard._globalListenersAttached) return;
    window.addEventListener(
      'location-changed',
      HomeFloatingMenuCard._handleLocationChanged,
    );
    window.addEventListener('popstate', HomeFloatingMenuCard._handleLocationChanged);
    window.addEventListener('hashchange', HomeFloatingMenuCard._handleLocationChanged);
    window.addEventListener('resize', HomeFloatingMenuCard._handleResize);
    HomeFloatingMenuCard._globalListenersAttached = true;
  }

  static _detachGlobalListeners() {
    if (!HomeFloatingMenuCard._globalListenersAttached) return;
    window.removeEventListener(
      'location-changed',
      HomeFloatingMenuCard._handleLocationChanged,
    );
    window.removeEventListener('popstate', HomeFloatingMenuCard._handleLocationChanged);
    window.removeEventListener('hashchange', HomeFloatingMenuCard._handleLocationChanged);
    window.removeEventListener('resize', HomeFloatingMenuCard._handleResize);
    HomeFloatingMenuCard._globalListenersAttached = false;
    HomeFloatingMenuCard._lastSyncedPath = '';
  }

  static _handleLocationChanged() {
    const path = HomeFloatingMenuCard._currentPath();
    if (path === HomeFloatingMenuCard._lastSyncedPath) return;
    HomeFloatingMenuCard._syncInstances();
  }

  static _handleResize() {
    HomeFloatingMenuCard._instances.forEach((instance) => {
      if (instance._connected) instance._schedulePosition();
    });
  }

  static _currentPath() {
    return window.location.pathname.replace(/\/+$/, '') || '/';
  }

  static _syncInstances() {
    HomeFloatingMenuCard._lastSyncedPath = HomeFloatingMenuCard._currentPath();
    const instances = [...HomeFloatingMenuCard._instances]
      .filter((instance) => instance._connected && instance._config && instance._menu)
      .sort((a, b) => a._instanceOrder - b._instanceOrder);
    if (!instances.length) return;

    const routeTabs = new Map();
    instances.forEach((instance) => {
      const routeTab = instance._routeTabId();
      routeTabs.set(instance, routeTab);
      instance._updateActiveHighlight(instance._highlightedTabId(routeTab));
    });

    const routeInstance = instances.find((instance) => (
      instance._config.view_path &&
      instance._config.view_path === routeTabs.get(instance)
    ));
    const unscopedInstance = instances.find((instance) => !instance._config.view_path);
    const visibleInstance = routeInstance || unscopedInstance || instances[0];

    instances.forEach((instance) => {
      instance._updateRouteVisibility(instance === visibleInstance);
    });
  }

  _routeTabId() {
    if (!this._config) return '';
    const currentPath = HomeFloatingMenuCard._currentPath();
    const matchedTab = this._config.tabs.find((tab) => {
      const targetPath = this._tabPath(tab);
      if (!targetPath) return false;
      if (currentPath === targetPath) return true;
      if (tab.id !== 'home' || !targetPath.endsWith('/home')) return false;
      return currentPath === (targetPath.slice(0, -'/home'.length) || '/');
    });

    if (matchedTab) {
      HomeFloatingMenuCard._lastKnownRoute = matchedTab.id;
      return matchedTab.id;
    }

    const lastKnown = HomeFloatingMenuCard._lastKnownRoute;
    return this._config.tabs.some((tab) => tab.id === lastKnown) ? lastKnown : '';
  }

  _highlightedTabId(routeTab) {
    const current = this._config?.current;
    if (current && this._config.tabs.some((tab) => tab.id === current)) {
      return current;
    }
    return routeTab;
  }

  _tabPath(tab) {
    try {
      const target = new URL(tab.path, window.location.origin);
      if (target.origin !== window.location.origin) return '';
      return target.pathname.replace(/\/+$/, '') || '/';
    } catch (_error) {
      return '';
    }
  }

  _navigate(path) {
    let target;
    try {
      target = new URL(path, window.location.origin);
    } catch (_error) {
      return;
    }
    if (target.origin !== window.location.origin) return;
    if (window.location.pathname === target.pathname &&
        window.location.search === target.search &&
        window.location.hash === target.hash) {
      return;
    }
    const targetTab = this._config?.tabs.find((tab) => tab.path === path);
    if (targetTab) {
      HomeFloatingMenuCard._lastKnownRoute = targetTab.id;
    }
    const previousPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const currentState = window.history.state;
    const nextState = currentState && typeof currentState === 'object'
      ? { ...currentState, from: previousPath }
      : { from: previousPath };
    window.history.pushState(
      nextState,
      '',
      `${target.pathname}${target.search}${target.hash}`,
    );
    window.dispatchEvent(new CustomEvent('location-changed', {
      detail: { replace: false },
    }));
  }

  _buildMenu() {
    if (!this._config) return;
    const labelsClass = this._config.show_labels ? 'with-labels' : '';
    const tabs = this._config.tabs.map((tab) => {
      return `
        <button
          type="button"
          data-tab="${this._escape(tab.id)}"
          aria-label="${this._escape(tab.label)}"
          aria-current="false"
          title="${this._escape(tab.label)}"
        >
          <ha-icon icon="${this._escape(tab.icon)}"></ha-icon>
          ${this._config.show_labels ? `<span>${this._escape(tab.label)}</span>` : ''}
        </button>
      `;
    }).join('');

    this._root.innerHTML = `
      <style>
        :host {
          position: relative;
          display: block;
          width: 100%;
          height: 76px;
          min-height: 76px;
          margin: 0;
          overflow: visible;
          pointer-events: none;
          --menu-surface: var(--card-background-color, var(--ha-card-background, #161f2f));
          --menu-primary: var(--primary-text-color, #f5f7fb);
          --menu-muted: var(--secondary-text-color, #91a2bb);
          --menu-accent: var(--primary-color, #ffb340);
          --menu-divider: var(--divider-color, rgba(102, 117, 143, 0.32));
        }

        .menu {
          position: fixed;
          z-index: 20;
          left: var(--menu-center, 50%);
          right: auto;
          bottom: max(14px, env(safe-area-inset-bottom));
          transform: translateX(-50%);
          display: grid;
          grid-template-columns: repeat(${this._config.tabs.length}, minmax(0, 1fr));
          gap: 4px;
          width: min(calc(100vw - 28px), 560px);
          height: 64px;
          margin: 0 auto;
          padding: 6px;
          box-sizing: border-box;
          pointer-events: auto;
          border: 1px solid var(--menu-divider);
          border-radius: 34px;
          background: color-mix(in srgb, var(--menu-surface) 96%, transparent);
          box-shadow: 0 10px 28px rgba(5, 10, 20, 0.38);
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
          visibility: hidden;
        }

        .menu.positioned {
          visibility: visible;
        }

        button {
          min-width: 0;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 0 8px;
          border: 0;
          border-radius: 27px;
          color: var(--menu-muted);
          background: transparent;
          font: inherit;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: color 160ms ease, background 160ms ease, transform 160ms ease;
        }

        button:hover {
          color: var(--menu-primary);
          background: color-mix(in srgb, var(--menu-surface) 72%, transparent);
        }

        button:active {
          transform: scale(0.94);
        }

        button.active {
          color: var(--primary-background-color, #1a2433);
          background: var(--menu-accent);
        }

        ha-icon {
          --mdc-icon-size: 25px;
          flex: 0 0 auto;
        }

        span {
          overflow: hidden;
          max-width: 100%;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 700;
        }

        .with-labels button {
          flex-direction: column;
          gap: 1px;
          padding-inline: 3px;
        }

        button:focus-visible {
          outline: 2px solid var(--primary-color, #f5f7fb);
          outline-offset: -3px;
        }

        @media (max-width: 380px) {
          :host {
            height: 70px;
            min-height: 70px;
          }

          .menu {
            left: var(--menu-center, 50%);
            right: auto;
            bottom: max(8px, env(safe-area-inset-bottom));
            transform: translateX(-50%);
            height: 58px;
            width: calc(100vw - 16px);
            padding: 4px;
          }

          button {
            min-height: 48px;
            padding-inline: 2px;
          }

          ha-icon {
            --mdc-icon-size: 23px;
          }

          span {
            font-size: 10px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          button {
            transition: none;
          }
        }
      </style>
      <nav class="menu ${labelsClass}" aria-label="Dashboard navigation">
        ${tabs}
      </nav>
    `;

    this._menu = this._root.querySelector('.menu');
    this._buttons = new Map();
    this._root.querySelectorAll('button').forEach((button) => {
      this._buttons.set(button.dataset.tab, button);
    });
  }

  _buttonFromEvent(event) {
    if (typeof event.composedPath !== 'function') return null;
    const path = event.composedPath();
    for (const node of path) {
      const tabId = node?.dataset?.tab;
      if (tabId && this._buttons.get(tabId) === node) return node;
      if (node === this) break;
    }
    return null;
  }

  _updateRouteVisibility(visible) {
    if (this._routeVisible === visible) return;
    this._routeVisible = visible;
    this.style.display = visible ? '' : 'none';
  }

  _updateActiveHighlight(activeTab) {
    this._buttons.forEach((button, tabId) => {
      const isActive = tabId === activeTab;
      button.classList.toggle('active', isActive);
      const ariaCurrent = isActive ? 'page' : 'false';
      if (button.getAttribute('aria-current') !== ariaCurrent) {
        button.setAttribute('aria-current', ariaCurrent);
      }
    });
  }

  _positionMenu() {
    const menu = this._menu;
    if (!menu) return false;
    const centerRect = this._dashboardColumnRect();
    if (!centerRect) {
      menu.classList.remove('positioned');
      return false;
    }
    menu.style.setProperty('--menu-center', `${centerRect.left + centerRect.width / 2}px`);
    menu.classList.add('positioned');
    return true;
  }

  _dashboardColumnRect() {
    const viewportWidth = window.innerWidth;
    const candidates = [];
    let node = this;
    while (node) {
      if (typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        if (rect.width > 1 && rect.height >= 0 &&
            rect.right >= 0 && rect.left <= viewportWidth) {
          candidates.push(rect);
        }
      }
      const root = node.getRootNode?.();
      node = node.parentElement || root?.host || null;
    }

    const constrained = candidates
      .filter((rect) => rect.width > 120 && rect.width < viewportWidth - 24)
      .sort((a, b) => a.width - b.width)[0];
    if (constrained) return constrained;

    const hostRect = candidates[0];
    return hostRect && hostRect.width > 1 ? hostRect : null;
  }

  _schedulePosition() {
    if (!this._connected || this._positionFrame != null) return;
    this._positionFrame = requestAnimationFrame(() => {
      this._positionFrame = null;
      if (this._connected) this._positionMenu();
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
}

HomeFloatingMenuCard._instances = new Set();
HomeFloatingMenuCard._nextInstanceOrder = 0;
HomeFloatingMenuCard._lastKnownRoute = '';
HomeFloatingMenuCard._lastSyncedPath = '';
HomeFloatingMenuCard._globalListenersAttached = false;
if (!customElements.get('hollow-floating-menu-card')) {
  customElements.define('hollow-floating-menu-card', HomeFloatingMenuCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card?.type === 'hollow-floating-menu-card')) {
  window.customCards.push({
    type: 'hollow-floating-menu-card',
    name: 'Hollow Floating Menu Card',
    description: 'Fixed bottom navigation for Hollow Cards dashboard views',
  });
}
