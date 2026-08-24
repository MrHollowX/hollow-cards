const DEFAULT_TABS = [
  { id: 'home', icon: 'mdi:home', label: 'Home', path: '/home-dark/home' },
  { id: 'lights', icon: 'mdi:lightbulb', label: 'Lights', path: '/home-dark/lights' },
  { id: 'climate', icon: 'mdi:thermometer', label: 'Climate', path: '/home-dark/climate' },
  { id: 'cameras', icon: 'mdi:cctv', label: 'Cameras', path: '/home-dark/cameras' },
  { id: 'media', icon: 'mdi:music', label: 'Media', path: '/home-dark/media' },
  { id: 'vacuum', icon: 'mdi:robot-vacuum', label: 'Vacuum', path: '/home-dark/vacuum' },
];

class HomeFloatingMenuCard extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._onLocationChanged = () => {
      this._render();
      this._schedulePositionRetries();
    };
    this._onPointerDown = (event) => {
      if (event.target.closest?.('button')) event.stopPropagation();
    };
  }

  setConfig(config) {
    const tabs = Array.isArray(config.tabs) && config.tabs.length
      ? config.tabs
      : DEFAULT_TABS;
    const seen = new Set();

    this._config = {
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
    };
    this._render();
  }

  connectedCallback() {
    HomeFloatingMenuCard._instances.add(this);
    this._connected = true;
    window.addEventListener('location-changed', this._onLocationChanged);
    window.addEventListener('popstate', this._onLocationChanged);
    window.addEventListener('hashchange', this._onLocationChanged);
    window.addEventListener('resize', this._onLocationChanged);
    this.addEventListener('pointerdown', this._onPointerDown, true);
    if (typeof ResizeObserver === 'function') {
      this._layoutObserver = new ResizeObserver(() => this._positionMenu());
      this._layoutObserver.observe(this);
    }
    this._render();
    this._schedulePositionRetries();
  }

  disconnectedCallback() {
    this._layoutObserver?.disconnect();
    this._layoutObserver = null;
    if (this._positionFrame) cancelAnimationFrame(this._positionFrame);
    this._positionFrame = null;
    HomeFloatingMenuCard._instances.delete(this);
    this._connected = false;
    window.removeEventListener('location-changed', this._onLocationChanged);
    window.removeEventListener('popstate', this._onLocationChanged);
    window.removeEventListener('hashchange', this._onLocationChanged);
    window.removeEventListener('resize', this._onLocationChanged);
    this.removeEventListener('pointerdown', this._onPointerDown, true);
  }

  getCardSize() {
    return 0;
  }

  getGridOptions() {
    return { columns: 'full', rows: 'auto' };
  }

  _activeTab() {
    if (!this._config) return '';
    if (this._config.current) return String(this._config.current);

    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const matchedTab = this._config.tabs.find((tab) => {
      const targetPath = tab.path.replace(/\/+$/, '') || '/';
      if (currentPath === targetPath || currentPath.endsWith(`/${tab.id}`)) {
        return true;
      }
      return tab.id === 'home' && (
        currentPath === '/home-dark' ||
        currentPath.endsWith('/home-dark')
      );
    })?.id;
    if (matchedTab) {
      HomeFloatingMenuCard._lastKnownActive = matchedTab;
      return matchedTab;
    }
    return HomeFloatingMenuCard._lastKnownActive || '';
  }

  _navigate(path) {
    const target = new URL(path, window.location.origin);
    if (window.location.pathname === target.pathname &&
        window.location.search === target.search &&
        window.location.hash === target.hash) {
      return;
    }
    const targetTab = this._config.tabs.find((tab) => tab.path === path);
    if (targetTab) {
      HomeFloatingMenuCard._lastKnownActive = targetTab.id;
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

  _render() {
    if (!this._config) return;
    const active = this._activeTab();
    if (this._config.view_path && this._config.view_path !== active) {
      const activeInstanceExists = this._connected &&
        [...HomeFloatingMenuCard._instances].some(
          (instance) => instance._config?.view_path === active,
        );
      if (!activeInstanceExists) return;
      this._root.innerHTML = '';
      this.style.display = 'none';
      return;
    }
    if (this._connected) {
      HomeFloatingMenuCard._instances.forEach((instance) => {
        if (instance !== this) {
          instance._root.innerHTML = '';
          instance.style.display = 'none';
        }
      });
    }
    this.style.display = '';
    const labelsClass = this._config.show_labels ? 'with-labels' : '';
    const tabs = this._config.tabs.map((tab) => {
      const isActive = tab.id === active;
      return `
        <button
          type="button"
          class="${isActive ? 'active' : ''}"
          data-tab="${this._escape(tab.id)}"
          aria-label="${this._escape(tab.label)}"
          aria-current="${isActive ? 'page' : 'false'}"
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
          border: 1px solid rgba(102, 117, 143, 0.32);
          border-radius: 34px;
          background: rgba(22, 31, 47, 0.96);
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
          color: var(--home-dark-muted, #91a2bb);
          background: transparent;
          font: inherit;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: color 160ms ease, background 160ms ease, transform 160ms ease;
        }

        button:hover {
          color: var(--home-dark-text, #f5f7fb);
          background: rgba(43, 56, 80, 0.72);
        }

        button:active {
          transform: scale(0.94);
        }

        button.active {
          color: var(--home-dark-active-text, #1a2433);
          background: var(--home-dark-accent, #ffb340);
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
          outline: 2px solid var(--home-dark-focus, #f5f7fb);
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

    this._root.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const tab = this._config.tabs.find((item) => item.id === button.dataset.tab);
        if (tab) this._navigate(tab.path);
      });
    });
    this._positionMenu();
    this._schedulePositionRetries();
  }

  _positionMenu() {
    const menu = this._root.querySelector('.menu');
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

  _schedulePositionRetries() {
    if (this._positionFrame) cancelAnimationFrame(this._positionFrame);
    let attempts = 0;
    const retry = () => {
      this._positionFrame = null;
      this._positionMenu();
      attempts += 1;
      if (attempts < 8) {
        this._positionFrame = requestAnimationFrame(retry);
      }
    };
    this._positionFrame = requestAnimationFrame(retry);
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
HomeFloatingMenuCard._lastKnownActive = '';
customElements.define('home-floating-menu-card', HomeFloatingMenuCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-floating-menu-card',
  name: 'Home Floating Menu Card',
  description: 'Fixed bottom navigation for Home Dark dashboard views',
});
