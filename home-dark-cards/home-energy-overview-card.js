class HomeEnergyOverviewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._wired = false;
    this._renderKey = '';
  }

  setConfig(config) {
    const priceEntity = typeof config?.price_entity === 'string' && config.price_entity.includes('.')
      ? config.price_entity
      : '';
    const items = Array.isArray(config?.items) ? config.items
      .map(item => {
        const price = Number(item?.price_per_kwh ?? config.price_per_kwh);
        return {
          item,
          price: Number.isFinite(price) && price >= 0 ? price : null,
        };
      })
      .filter(({ item, price }) => item && typeof item.usage_entity === 'string' && (typeof item.cost_entity === 'string' || price != null || priceEntity))
      .map(({ item, price }) => ({
        label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.usage_entity,
        icon: typeof item.icon === 'string' && item.icon ? item.icon : 'mdi:flash',
        usage_entity: item.usage_entity,
        cost_entity: typeof item.cost_entity === 'string' ? item.cost_entity : '',
        price_per_kwh: price,
      }))
      : [];
    if (!items.length) throw new Error('home-energy-overview-card requires one or more items with usage_entity and either cost_entity, price_per_kwh, or price_entity');
    this._config = {
      title: typeof config.title === 'string' && config.title.trim() ? config.title.trim() : "Today's usage & cost",
      icon: typeof config.icon === 'string' && config.icon ? config.icon : 'mdi:chart-line',
      price_entity: priceEntity,
      items,
    };
    this._renderKey = '';
    this._render();
  }

  getCardSize() { return 4; }

  getGridOptions() { return { columns: 12, rows: 'auto' }; }

  set hass(value) {
    this._hass = value;
    this._render();
  }

  connectedCallback() {
    if (this._wired) return;
    this._wired = true;
    this.shadowRoot.addEventListener('click', event => {
      const item = event.target.closest('button[data-entity]');
      if (!item) return;
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: item.dataset.entity },
        bubbles: true,
        composed: true,
      }));
    });
  }

  _state(entity) {
    return this._hass?.states?.[entity] || null;
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

  _value(entity, fallbackUnit) {
    const state = this._state(entity);
    const value = Number(state?.state);
    if (!state || !Number.isFinite(value)) return { text: 'Unavailable', unit: '', unavailable: true, value: null };
    const unit = state.attributes?.unit_of_measurement || fallbackUnit;
    return {
      text: value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      unit,
      unavailable: false,
      value,
    };
  }

  _calculatedCost(usage, pricePerKwh) {
    if (usage.unavailable || pricePerKwh == null) return { text: 'Unavailable', unit: '', unavailable: true, value: null };
    const value = usage.value * pricePerKwh;
    return {
      text: value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      unit: 'RON',
      unavailable: false,
      value,
    };
  }

  _price(entity) {
    const value = Number(this._state(entity)?.state);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  _render() {
    if (!this._hass || !this._config) return;
    const dynamicPrice = this._price(this._config.price_entity);
    const items = this._config.items.map(item => ({
      ...item,
      usage: this._value(item.usage_entity, 'kWh'),
      cost: item.cost_entity
        ? this._value(item.cost_entity, 'RON')
        : this._calculatedCost(this._value(item.usage_entity, 'kWh'), dynamicPrice ?? item.price_per_kwh),
    }));
    const renderKey = JSON.stringify({
      title: this._config.title,
      icon: this._config.icon,
      priceEntity: this._config.price_entity,
      dynamicPrice,
      items: items.map(item => [
        item.label,
        item.icon,
        item.price_per_kwh,
        item.usage.text,
        item.usage.unit,
        item.cost.text,
        item.cost.unit,
      ]),
    });
    if (renderKey === this._renderKey) return;
    this._renderKey = renderKey;

    const content = items.map(item => {
      const usageText = item.usage.unavailable ? item.usage.text : `${item.usage.text} ${item.usage.unit}`;
      const costText = item.cost.unavailable ? item.cost.text : `${item.cost.text} ${item.cost.unit}`;
      return `<button class="item" type="button" data-entity="${this._escape(item.usage_entity)}"
        aria-label="Show details for ${this._escape(item.label)}: ${this._escape(usageText)} used today and ${this._escape(costText)} today">
        <span class="item-header"><ha-icon icon="${this._escape(item.icon)}" aria-hidden="true"></ha-icon><span>${this._escape(item.label)}</span></span>
        <span class="values">
          <span class="value${item.usage.unavailable ? ' unavailable' : ''}"><span class="caption">Usage</span><strong>${this._escape(item.usage.text)}${item.usage.unit ? `<small>${this._escape(item.usage.unit)}</small>` : ''}</strong></span>
          <span class="value cost${item.cost.unavailable ? ' unavailable' : ''}"><span class="caption">Cost</span><strong>${this._escape(item.cost.text)}${item.cost.unit ? `<small>${this._escape(item.cost.unit)}</small>` : ''}</strong></span>
        </span>
      </button>`;
    }).join('');

    this.shadowRoot.innerHTML = `<style>${this._css()}</style>
      <ha-card class="card">
        <div class="header"><ha-icon icon="${this._escape(this._config.icon)}" aria-hidden="true"></ha-icon><span>${this._escape(this._config.title)}</span></div>
        <div class="items">${content}</div>
      </ha-card>`;
  }

  _css() {
    return `
      :host { display:block; min-width:0; width:100%; container-type:inline-size; color:var(--primary-text-color,#f5f7fb); font-family:-apple-system,'Segoe UI',Helvetica,sans-serif; }
      .card { box-sizing:border-box; padding:14px; overflow:hidden; background:var(--home-dark-card-background,#212c42); color:var(--primary-text-color,#f5f7fb); border:0; border-radius:var(--ha-card-border-radius,20px); box-shadow:0 4px 14px rgba(0,0,0,.16); }
      .card *, .card *::before, .card *::after { box-sizing:border-box; }
      .header { display:flex; align-items:center; gap:8px; margin:0 2px 11px; min-width:0; color:var(--primary-text-color,#f5f7fb); font-size:15px; font-weight:750; line-height:1.2; }
      .header ha-icon { flex:0 0 auto; color:var(--primary-color,#ffb340); --mdc-icon-size:20px; }
      .header > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .items { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
      .item { min-width:0; min-height:94px; padding:11px 10px; overflow:hidden; border:0; border-radius:14px; background:var(--home-dark-control-background,#2b3850); color:inherit; cursor:pointer; font:inherit; text-align:left; }
      .item:focus-visible { outline:3px solid var(--primary-color,#ffb340); outline-offset:2px; }
      .item-header { display:flex; align-items:center; gap:6px; min-width:0; color:var(--primary-text-color,#f5f7fb); font-size:12px; font-weight:750; line-height:1.2; }
      .item-header ha-icon { flex:0 0 auto; color:var(--primary-color,#ffb340); --mdc-icon-size:16px; }
      .item-header > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .values { display:grid; min-width:0; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:7px; margin-top:12px; }
      .value { min-width:0; display:flex; flex-direction:column; gap:2px; }
      .value + .value { padding-left:7px; border-left:1px solid var(--divider-color,rgba(255,255,255,.14)); }
      .caption { color:var(--secondary-text-color,#91a2bb); font-size:10px; font-weight:650; line-height:1.1; }
      strong { min-width:0; overflow:hidden; color:var(--primary-text-color,#f5f7fb); font-size:14px; font-weight:750; line-height:1.15; text-overflow:ellipsis; white-space:nowrap; }
      .cost strong { color:var(--primary-color,#ffb340); }
      small { margin-left:2px; color:inherit; font-size:10px; font-weight:650; }
      .unavailable strong { color:var(--secondary-text-color,#91a2bb); font-size:11px; font-weight:650; }
      @container (min-width:760px) {
        .items { grid-template-columns:repeat(4,minmax(0,1fr)); }
      }
      @media (max-width:360px) {
        .card { padding:12px; }
        .item { min-height:88px; padding:10px 8px; }
        .values { gap:5px; margin-top:10px; }
        .value + .value { padding-left:5px; }
        strong { font-size:13px; }
        small { font-size:9px; }
      }
    `;
  }
}

customElements.define('home-energy-overview-card', HomeEnergyOverviewCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-energy-overview-card',
  name: 'Home Energy Overview',
  description: 'Responsive daily energy usage and cost summary',
});
