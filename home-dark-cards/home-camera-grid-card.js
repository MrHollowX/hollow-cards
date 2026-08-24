class HomeCameraGridCard extends HTMLElement {
  setConfig(config) {
    if (!config || !Array.isArray(config.camera_groups) || !config.camera_groups.length) {
      throw new Error('camera_groups with at least one group is required');
    }
    this._config = {
      title: typeof config.title === 'string' && config.title ? config.title : 'Cameras',
      subtitle: typeof config.subtitle === 'string' ? config.subtitle : 'Camera snapshots',
      ...config,
      camera_groups: config.camera_groups.map((group) => {
        if (!group || !Array.isArray(group.cameras) || !group.cameras.length) {
          throw new Error('Each camera group needs at least one camera');
        }
        return {
          title: typeof group.title === 'string' && group.title ? group.title : 'Cameras',
          icon: typeof group.icon === 'string' && group.icon ? group.icon : 'mdi:cctv',
          cameras: group.cameras.map((camera) => {
            if (!camera || typeof camera.entity !== 'string' || !camera.entity.startsWith('camera.')) {
              throw new Error('Each camera needs a camera entity');
            }
            return {
              entity: camera.entity,
              name: typeof camera.name === 'string' ? camera.name : '',
            };
          }),
        };
      }),
    };
    this._renderKey = '';
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: 'full', rows: 'auto' };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    if (this._wired) return;
    this._wired = true;
    this._onClick = this._onClick.bind(this);
    this.addEventListener('click', this._onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._onClick);
    this._wired = false;
  }

  _onClick(event) {
    const camera = event.target.closest('[data-camera]');
    if (!camera) return;
    event.preventDefault();
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: camera.dataset.camera },
      bubbles: true,
      composed: true,
    }));
  }

  _state(entity) {
    return this._hass?.states?.[entity] || null;
  }

  _escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  }

  _snapshotUrl(entity, state) {
    const path = `/api/camera_proxy/${encodeURIComponent(entity)}`;
    const token = state?.attributes?.access_token;
    return token ? `${path}?token=${encodeURIComponent(token)}` : path;
  }

  _stateLabel(state) {
    if (!state || ['unknown', 'unavailable'].includes(state.state)) return 'Unavailable';
    if (state.state === 'recording') return 'Recording';
    if (state.state === 'idle') return 'Online';
    return state.state;
  }

  _cameraTile(camera) {
    const state = this._state(camera.entity);
    const unavailable = !state || ['unknown', 'unavailable'].includes(state.state);
    const name = camera.name || state?.attributes?.friendly_name || camera.entity;
    const label = this._stateLabel(state);
    const snapshot = unavailable ? '' : this._snapshotUrl(camera.entity, state);
    return `<button class="camera-tile${unavailable ? ' is-unavailable' : ''}" type="button"
      data-camera="${this._escape(camera.entity)}" aria-label="Open ${this._escape(name)} camera details">
      <span class="camera-feed">
        ${snapshot
          ? `<img src="${this._escape(snapshot)}" alt="" loading="lazy">`
          : `<span class="camera-unavailable"><ha-icon icon="mdi:camera-off-outline"></ha-icon><span>Unavailable</span></span>`}
        <span class="live-pill${label === 'Recording' ? ' is-recording' : ''}">
          <span aria-hidden="true"></span>${this._escape(label)}
        </span>
        ${snapshot ? '<span class="open-live"><ha-icon icon="mdi:play-circle-outline" aria-hidden="true"></ha-icon>Open live</span>' : ''}
      </span>
      <span class="camera-label">
        <ha-icon icon="mdi:video-outline" aria-hidden="true"></ha-icon>
        <span>${this._escape(name)}</span>
      </span>
    </button>`;
  }

  _render() {
    if (!this._hass || !this._config) return;
    const signature = JSON.stringify(this._config.camera_groups.map((group) => group.cameras.map((camera) => {
      const state = this._state(camera.entity);
      return [camera.entity, state?.state || 'unavailable', state?.attributes?.friendly_name || '', state?.attributes?.access_token || ''];
    })));
    if (signature === this._renderKey) return;
    this._renderKey = signature;
    const groups = this._config.camera_groups.map((group) => `<section class="provider-group" aria-label="${this._escape(group.title)} cameras">
      <div class="provider-heading">
        <span><ha-icon icon="${this._escape(group.icon)}" aria-hidden="true"></ha-icon>${this._escape(group.title)}</span>
        <small>${group.cameras.length} cameras</small>
      </div>
      <div class="camera-grid">${group.cameras.map((camera) => this._cameraTile(camera)).join('')}</div>
    </section>`).join('');
    this.innerHTML = `<style>${this._css()}</style>
      <ha-card class="nvr-card">
        <header class="nvr-header">
          <span class="nvr-icon"><ha-icon icon="mdi:cctv" aria-hidden="true"></ha-icon></span>
          <span class="nvr-copy"><strong>${this._escape(this._config.title)}</strong><span>${this._escape(this._config.subtitle)}</span></span>
          <span class="nvr-status"><ha-icon icon="mdi:image-multiple-outline" aria-hidden="true"></ha-icon>SNAPSHOTS</span>
        </header>
        <div class="providers">${groups}</div>
      </ha-card>`;
  }

  _css() {
    return `
      :host{display:block;min-width:0;width:100%;font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;--bg:var(--home-dark-card-background,var(--ha-card-background,var(--card-background-color,#212c42)));--page:var(--home-dark-page-background,#1a2433);--text:var(--home-dark-primary-text,var(--primary-text-color,#f5f7fb));--secondary:var(--home-dark-secondary-text,var(--secondary-text-color,#91a2bb));--muted:var(--home-dark-muted-text,#66758f);--accent:var(--home-dark-accent,var(--primary-color,#ffb340));--control:var(--home-dark-control-background,#2b3850)}
      .nvr-card{box-sizing:border-box;overflow:hidden;padding:16px;background:var(--bg);color:var(--text);border:1px solid rgba(255,255,255,.1);border-radius:var(--ha-card-border-radius,20px);box-shadow:0 4px 14px rgba(0,0,0,.16)}
      .nvr-header{display:flex;align-items:center;gap:11px;min-width:0}.nvr-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:14px;background:var(--control);color:var(--accent)}.nvr-icon ha-icon{--mdc-icon-size:25px}.nvr-copy{display:grid;min-width:0;gap:3px}.nvr-copy strong{overflow:hidden;font-size:16px;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.nvr-copy span{overflow:hidden;color:var(--secondary);font-size:11.5px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.nvr-status{display:flex;align-items:center;gap:5px;margin-left:auto;color:var(--secondary);font-size:9px;font-weight:850;letter-spacing:.07em}.nvr-status ha-icon{color:var(--accent);--mdc-icon-size:16px}.live-pill>span{display:block;flex:none;width:7px;height:7px;border-radius:50%;background:currentColor}
      .providers{display:grid;gap:17px;margin-top:17px}.provider-group{display:grid;gap:9px}.provider-group+.provider-group{padding-top:15px;border-top:1px solid rgba(255,255,255,.09)}.provider-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--secondary);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.provider-heading>span{display:flex;align-items:center;gap:6px;min-width:0}.provider-heading ha-icon{color:var(--accent);--mdc-icon-size:18px}.provider-heading small{flex:none;color:var(--muted);font-size:10px;font-weight:750;letter-spacing:normal;text-transform:none}
      .camera-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.camera-tile{display:grid;min-width:0;padding:0;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:var(--control);color:var(--text);font:inherit;text-align:left;cursor:pointer}.camera-tile:hover{border-color:rgba(255,179,64,.55)}.camera-tile:active{transform:scale(.985)}.camera-tile:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.camera-feed{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;background:var(--page)}.camera-feed img{display:block;width:100%;height:100%;object-fit:cover}.camera-feed:has(img)::after{position:absolute;inset:0;content:'';pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.18),transparent 42%,rgba(0,0,0,.22))}.live-pill{position:absolute;z-index:1;top:7px;left:7px;display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:7px;background:rgba(9,15,26,.76);color:#d7e1ef;font-size:8px;font-weight:850;letter-spacing:.05em;line-height:1;text-transform:uppercase}.live-pill.is-recording{color:#ff6a6a}.open-live{position:absolute;z-index:1;right:7px;bottom:7px;display:flex;align-items:center;gap:3px;padding:4px 6px;border-radius:7px;background:rgba(9,15,26,.76);color:#f5f7fb;font-size:8px;font-weight:800;line-height:1}.open-live ha-icon{color:var(--accent);--mdc-icon-size:13px}.camera-label{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:6px;min-width:0;padding:8px 9px;color:var(--text);font-size:11px;font-weight:750}.camera-label ha-icon{color:var(--secondary);--mdc-icon-size:16px}.camera-label>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.camera-unavailable{display:grid;place-items:center;align-content:center;gap:5px;width:100%;height:100%;color:var(--muted);font-size:10px;font-weight:750}.camera-unavailable ha-icon{--mdc-icon-size:25px}.is-unavailable{opacity:.72}
      @media (max-width:360px){.nvr-card{padding:14px}.camera-grid{gap:7px}.camera-label{padding:7px;font-size:10px}.live-pill,.open-live{top:5px;padding:3px 5px;font-size:7px}.live-pill{left:5px}.open-live{top:auto;right:5px;bottom:5px}}
    `;
  }
}

customElements.define('home-camera-grid-card', HomeCameraGridCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-camera-grid-card',
  name: 'Home Camera Grid',
  description: 'Home Dark live NVR-style camera grid',
});
