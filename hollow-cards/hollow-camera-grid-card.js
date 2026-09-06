class HomeCameraGridCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._connected = false;
    this._card = null;
    this._providers = null;
    this._groups = [];
    this._structureKey = '';
    this._intersectionObserver = null;
    this._usingViewportFallback = false;
    this._isIntersecting = false;
    this._refreshActive = false;
    this._refreshTimer = null;
    this._viewportFrame = null;
    this._snapshotSequence = 0;
    this._passiveListenerOptions = { passive: true };
    this._capturePassiveListenerOptions = { capture: true, passive: true };

    this._onClick = this._onClick.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._onIntersection = this._onIntersection.bind(this);
    this._onRefreshTimer = this._onRefreshTimer.bind(this);
    this._onViewportChange = this._onViewportChange.bind(this);
    this._onViewportFrame = this._onViewportFrame.bind(this);
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.camera_groups) || !config.camera_groups.length) {
      throw new Error('camera_groups with at least one group is required');
    }
    const snapshotRefreshSeconds = this._parseSnapshotRefreshSeconds(config.snapshot_refresh_seconds);
    const previousRefreshSeconds = this._config?.snapshot_refresh_seconds;
    this._config = {
      ...config,
      title: typeof config.title === 'string' && config.title ? config.title : 'Cameras',
      subtitle: typeof config.subtitle === 'string' ? config.subtitle : 'Camera snapshots',
      icon: typeof config.icon === 'string' && config.icon ? config.icon : 'mdi:cctv',
      camera_icon: typeof config.camera_icon === 'string' && config.camera_icon ? config.camera_icon : 'mdi:video-outline',
      unavailable_icon: typeof config.unavailable_icon === 'string' && config.unavailable_icon ? config.unavailable_icon : 'mdi:camera-off-outline',
      snapshot_refresh_seconds: snapshotRefreshSeconds,
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
    if (this._connected && previousRefreshSeconds !== snapshotRefreshSeconds) {
      this._clearRefreshTimer();
    }
    this._render();
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
    if (this._connected) return;
    this._connected = true;
    this.addEventListener('click', this._onClick);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this._render();
    this._startViewportTracking();
  }

  disconnectedCallback() {
    if (!this._connected) return;
    this.removeEventListener('click', this._onClick);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this._stopViewportTracking();
    this._connected = false;
    this._isIntersecting = false;
    this._deactivateSnapshots();
  }

  _onClick(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    const camera = path.find((node) => node?.dataset?.camera && node?.classList?.contains('camera-tile'))
      || event.target?.closest?.('.camera-tile[data-camera]');
    if (!camera) return;
    event.preventDefault();
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: camera.dataset.camera },
      bubbles: true,
      composed: true,
    }));
  }

  _onVisibilityChange() {
    if (this._usingViewportFallback && !document.hidden) {
      this._updateFallbackIntersection();
      return;
    }
    this._updateRefreshActivity();
  }

  _onIntersection(entries) {
    let nextIntersection = null;
    entries.forEach((entry) => {
      if (entry.target === this) nextIntersection = Boolean(entry.isIntersecting);
    });
    if (nextIntersection == null) return;
    this._isIntersecting = nextIntersection;
    this._updateRefreshActivity();
  }

  _onRefreshTimer() {
    this._refreshTimer = null;
    if (!this._canRefreshSnapshots() || this._config.snapshot_refresh_seconds <= 0) {
      this._updateRefreshActivity();
      return;
    }
    this._refreshSnapshots(false);
    this._scheduleRefresh();
  }

  _onViewportChange() {
    if (!this._connected || !this._usingViewportFallback || this._viewportFrame !== null) return;
    this._viewportFrame = window.requestAnimationFrame(this._onViewportFrame);
  }

  _onViewportFrame() {
    this._viewportFrame = null;
    if (!this._connected || !this._usingViewportFallback) return;
    this._updateFallbackIntersection();
  }

  _parseSnapshotRefreshSeconds(value) {
    if (value == null || value === '') return 30;
    if (typeof value === 'boolean') {
      throw new Error('snapshot_refresh_seconds must be 0 or between 5 and 300');
    }
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || (seconds !== 0 && (seconds < 5 || seconds > 300))) {
      throw new Error('snapshot_refresh_seconds must be 0 or between 5 and 300');
    }
    return seconds;
  }

  _state(entity) {
    return this._hass?.states?.[entity] || null;
  }

  _isAvailable(state) {
    return Boolean(state && typeof state.state === 'string' && !['unknown', 'unavailable'].includes(state.state));
  }

  _snapshotBaseUrl(entity, state) {
    const path = `/api/camera_proxy/${encodeURIComponent(entity)}`;
    const token = state?.attributes?.access_token;
    return token ? `${path}?token=${encodeURIComponent(token)}` : path;
  }

  _snapshotUrl(baseUrl, refreshToken) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}_=${encodeURIComponent(refreshToken)}`;
  }

  _nextSnapshotToken() {
    this._snapshotSequence += 1;
    return `${Date.now()}-${this._snapshotSequence}`;
  }

  _stateLabel(state) {
    if (!this._isAvailable(state)) return 'Unavailable';
    if (state.state === 'recording') return 'Recording';
    if (state.state === 'idle') return 'Online';
    return state.state;
  }

  _startViewportTracking() {
    if (typeof IntersectionObserver === 'function') {
      this._isIntersecting = false;
      this._intersectionObserver = new IntersectionObserver(this._onIntersection, { threshold: 0 });
      this._intersectionObserver.observe(this);
      return;
    }
    this._usingViewportFallback = true;
    window.addEventListener('scroll', this._onViewportChange, this._passiveListenerOptions);
    window.addEventListener('resize', this._onViewportChange, this._passiveListenerOptions);
    document.addEventListener('scroll', this._onViewportChange, this._capturePassiveListenerOptions);
    this._updateFallbackIntersection();
  }

  _stopViewportTracking() {
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }
    if (this._usingViewportFallback) {
      window.removeEventListener('scroll', this._onViewportChange, this._passiveListenerOptions);
      window.removeEventListener('resize', this._onViewportChange, this._passiveListenerOptions);
      document.removeEventListener('scroll', this._onViewportChange, this._capturePassiveListenerOptions);
      this._usingViewportFallback = false;
    }
    if (this._viewportFrame !== null) {
      window.cancelAnimationFrame(this._viewportFrame);
      this._viewportFrame = null;
    }
  }

  _updateFallbackIntersection() {
    if (!this._connected || !this._usingViewportFallback) return;
    this._isIntersecting = this._isWithinViewport();
    this._updateRefreshActivity();
  }

  _isWithinViewport() {
    const rect = this.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
    const width = Number.isFinite(rect.width) ? rect.width : rect.right - rect.left;
    const height = Number.isFinite(rect.height) ? rect.height : rect.bottom - rect.top;
    return width > 0
      && height > 0
      && rect.bottom > 0
      && rect.right > 0
      && rect.top < viewportHeight
      && rect.left < viewportWidth;
  }

  _documentIsVisible() {
    return !document.hidden;
  }

  _canRefreshSnapshots() {
    if (!this._connected || !this._hass || !this._config || !this._documentIsVisible()) return false;
    const withinViewport = this._isWithinViewport();
    if (this._usingViewportFallback) this._isIntersecting = withinViewport;
    return this._isIntersecting && withinViewport;
  }

  _hasDirtySnapshots() {
    return this._groups.some((group) => group.cameras.some(
      (camera) => camera.available && camera.snapshotDirty,
    ));
  }

  _updateRefreshActivity() {
    if (!this._canRefreshSnapshots()) {
      this._deactivateSnapshots();
      return;
    }
    const resumed = !this._refreshActive;
    this._refreshActive = true;
    if (resumed) {
      this._clearRefreshTimer();
      this._refreshSnapshots(false);
    } else if (this._hasDirtySnapshots()) {
      this._clearRefreshTimer();
      this._refreshSnapshots(true);
    }
    this._scheduleRefresh();
  }

  _scheduleRefresh() {
    if (
      !this._refreshActive
      || this._config.snapshot_refresh_seconds <= 0
      || this._refreshTimer !== null
    ) return;
    if (!this._canRefreshSnapshots()) {
      this._deactivateSnapshots();
      return;
    }
    this._refreshTimer = setTimeout(
      this._onRefreshTimer,
      this._config.snapshot_refresh_seconds * 1000,
    );
  }

  _clearRefreshTimer() {
    if (this._refreshTimer !== null) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  _deactivateSnapshots() {
    this._clearRefreshTimer();
    this._refreshActive = false;
  }

  _ensureShell() {
    if (this._card) return;

    const style = document.createElement('style');
    style.textContent = this._css();

    const card = document.createElement('ha-card');
    card.className = 'nvr-card';

    const header = document.createElement('header');
    header.className = 'nvr-header';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'nvr-icon';
    const headerIcon = document.createElement('ha-icon');
    headerIcon.setAttribute('aria-hidden', 'true');
    iconWrap.append(headerIcon);

    const copy = document.createElement('span');
    copy.className = 'nvr-copy';
    const title = document.createElement('strong');
    const subtitle = document.createElement('span');
    copy.append(title, subtitle);

    const status = document.createElement('span');
    status.className = 'nvr-status';
    const statusIcon = document.createElement('ha-icon');
    statusIcon.setAttribute('icon', 'mdi:image-multiple-outline');
    statusIcon.setAttribute('aria-hidden', 'true');
    const statusText = document.createElement('span');
    statusText.textContent = 'SNAPSHOTS';
    status.append(statusIcon, statusText);

    const providers = document.createElement('div');
    providers.className = 'providers';

    header.append(iconWrap, copy, status);
    card.append(header, providers);
    this.replaceChildren(style, card);

    this._card = card;
    this._providers = providers;
    this._headerIcon = headerIcon;
    this._titleNode = title;
    this._subtitleNode = subtitle;
  }

  _structureSignature() {
    return JSON.stringify(
      this._config.camera_groups.map((group) => group.cameras.map((camera) => camera.entity)),
    );
  }

  _ensureStructure() {
    const structureKey = this._structureSignature();
    if (structureKey !== this._structureKey) {
      this._rebuildGroups();
      this._structureKey = structureKey;
      return;
    }
    this._groups.forEach((groupRecord, groupIndex) => {
      groupRecord.config = this._config.camera_groups[groupIndex];
      groupRecord.cameras.forEach((cameraRecord, cameraIndex) => {
        cameraRecord.config = groupRecord.config.cameras[cameraIndex];
      });
    });
  }

  _rebuildGroups() {
    this._groups = this._config.camera_groups.map((group) => {
      const section = document.createElement('section');
      section.className = 'provider-group';

      const heading = document.createElement('div');
      heading.className = 'provider-heading';
      const headingMain = document.createElement('span');
      const headingIcon = document.createElement('ha-icon');
      headingIcon.setAttribute('aria-hidden', 'true');
      const headingTitle = document.createElement('span');
      headingMain.append(headingIcon, headingTitle);
      const headingCount = document.createElement('small');
      heading.append(headingMain, headingCount);

      const grid = document.createElement('div');
      grid.className = 'camera-grid';
      const cameras = group.cameras.map((camera) => this._createCameraRecord(camera));
      grid.append(...cameras.map((cameraRecord) => cameraRecord.tile));
      section.append(heading, grid);

      return {
        config: group,
        section,
        headingIcon,
        headingTitle,
        headingCount,
        cameras,
      };
    });
    this._providers.replaceChildren(...this._groups.map((group) => group.section));
  }

  _createCameraRecord(camera) {
    const tile = document.createElement('button');
    tile.className = 'camera-tile';
    tile.type = 'button';
    tile.dataset.camera = camera.entity;

    const feed = document.createElement('span');
    feed.className = 'camera-feed';

    const image = document.createElement('img');
    image.alt = '';
    image.loading = 'lazy';
    image.hidden = true;

    const unavailable = document.createElement('span');
    unavailable.className = 'camera-unavailable';
    const unavailableIcon = document.createElement('ha-icon');
    unavailableIcon.setAttribute('aria-hidden', 'true');
    const unavailableText = document.createElement('span');
    unavailableText.textContent = 'Unavailable';
    unavailable.append(unavailableIcon, unavailableText);

    const pill = document.createElement('span');
    pill.className = 'live-pill';
    const pillDot = document.createElement('span');
    pillDot.className = 'live-dot';
    pillDot.setAttribute('aria-hidden', 'true');
    const pillText = document.createElement('span');
    pill.append(pillDot, pillText);

    const openLive = document.createElement('span');
    openLive.className = 'open-live';
    openLive.hidden = true;
    const openLiveIcon = document.createElement('ha-icon');
    openLiveIcon.setAttribute('icon', 'mdi:play-circle-outline');
    openLiveIcon.setAttribute('aria-hidden', 'true');
    const openLiveText = document.createElement('span');
    openLiveText.textContent = 'Open live';
    openLive.append(openLiveIcon, openLiveText);

    const label = document.createElement('span');
    label.className = 'camera-label';
    const labelIcon = document.createElement('ha-icon');
    labelIcon.setAttribute('aria-hidden', 'true');
    const labelText = document.createElement('span');
    label.append(labelIcon, labelText);

    feed.append(image, unavailable, pill, openLive);
    tile.append(feed, label);

    return {
      config: camera,
      tile,
      image,
      unavailable,
      unavailableIcon,
      pill,
      pillText,
      openLive,
      labelIcon,
      labelText,
      available: false,
      snapshotBase: '',
      loadedSnapshotBase: '',
      snapshotDirty: false,
    };
  }

  _patchHeader() {
    this._headerIcon.setAttribute('icon', this._config.icon);
    this._titleNode.textContent = this._config.title;
    this._subtitleNode.textContent = this._config.subtitle;
  }

  _patchGroups() {
    this._groups.forEach((groupRecord) => {
      const group = groupRecord.config;
      groupRecord.section.setAttribute('aria-label', `${group.title} cameras`);
      groupRecord.headingIcon.setAttribute('icon', group.icon);
      groupRecord.headingTitle.textContent = group.title;
      groupRecord.headingCount.textContent = `${group.cameras.length} cameras`;
      groupRecord.cameras.forEach((cameraRecord) => {
        this._patchCamera(cameraRecord);
      });
    });
  }

  _patchCamera(cameraRecord) {
    const camera = cameraRecord.config;
    const state = this._state(camera.entity);
    const available = this._isAvailable(state);
    const name = camera.name || state?.attributes?.friendly_name || camera.entity;
    const label = this._stateLabel(state);

    cameraRecord.tile.dataset.camera = camera.entity;
    cameraRecord.tile.setAttribute('aria-label', `Open ${name} camera details`);
    cameraRecord.tile.classList.toggle('is-unavailable', !available);
    cameraRecord.labelIcon.setAttribute('icon', this._config.camera_icon);
    cameraRecord.labelText.textContent = name;
    cameraRecord.unavailableIcon.setAttribute('icon', this._config.unavailable_icon);
    cameraRecord.pill.classList.toggle('is-recording', label === 'Recording');
    cameraRecord.pillText.textContent = label;

    if (!available) {
      cameraRecord.image.hidden = true;
      if (cameraRecord.image.hasAttribute('src')) cameraRecord.image.removeAttribute('src');
      cameraRecord.unavailable.hidden = false;
      cameraRecord.openLive.hidden = true;
      cameraRecord.available = false;
      cameraRecord.snapshotBase = '';
      cameraRecord.loadedSnapshotBase = '';
      cameraRecord.snapshotDirty = false;
      return;
    }

    const snapshotBase = this._snapshotBaseUrl(camera.entity, state);
    const baseChanged = snapshotBase !== cameraRecord.snapshotBase;
    cameraRecord.available = true;
    cameraRecord.snapshotBase = snapshotBase;
    cameraRecord.snapshotDirty = cameraRecord.snapshotDirty
      || baseChanged
      || cameraRecord.loadedSnapshotBase !== snapshotBase
      || !cameraRecord.image.hasAttribute('src');
    cameraRecord.image.hidden = false;
    cameraRecord.unavailable.hidden = true;
    cameraRecord.openLive.hidden = false;
  }

  _assignSnapshot(cameraRecord, refreshToken) {
    cameraRecord.image.setAttribute(
      'src',
      this._snapshotUrl(cameraRecord.snapshotBase, refreshToken),
    );
    cameraRecord.loadedSnapshotBase = cameraRecord.snapshotBase;
    cameraRecord.snapshotDirty = false;
  }

  _refreshSnapshots(dirtyOnly) {
    if (!this._canRefreshSnapshots() || !this._groups.length) return 0;
    this._patchGroups();
    const candidates = [];
    this._groups.forEach((group) => {
      group.cameras.forEach((camera) => {
        if (camera.available && (!dirtyOnly || camera.snapshotDirty)) candidates.push(camera);
      });
    });
    if (!candidates.length) return 0;
    const refreshToken = this._nextSnapshotToken();
    candidates.forEach((camera, index) => {
      this._assignSnapshot(camera, `${refreshToken}-${index}`);
    });
    return candidates.length;
  }

  _render() {
    if (!this._config) return;
    this._ensureShell();
    this._ensureStructure();
    this._patchHeader();
    this._patchGroups();
    if (this._connected) this._updateRefreshActivity();
  }

  _css() {
    return `
      hollow-camera-grid-card{display:block;min-width:0;width:100%;font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;--bg:var(--card-background-color,var(--ha-card-background,#212c42));--camera-card-radius:var(--hollow-camera-grid-card-border-radius,20px);--page:var(--primary-background-color,#1a2433);--text:var(--primary-text-color,#f5f7fb);--secondary:var(--secondary-text-color,#91a2bb);--muted:var(--disabled-text-color,#66758f);--accent:var(--primary-color,#ffb340);--control:var(--secondary-background-color,#2b3850);--divider:var(--divider-color,rgba(255,255,255,.1))}
      hollow-camera-grid-card > ha-card.nvr-card{box-sizing:border-box;overflow:hidden;padding:16px;background:var(--bg)!important;color:var(--text);border:1px solid var(--divider)!important;border-radius:var(--camera-card-radius)!important;box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important}
      .nvr-header{display:flex;align-items:center;gap:11px;min-width:0}.nvr-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:14px;background:var(--control);color:var(--accent)}.nvr-icon ha-icon{--mdc-icon-size:25px}.nvr-copy{display:grid;min-width:0;gap:3px}.nvr-copy strong{overflow:hidden;font-size:16px;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.nvr-copy span{overflow:hidden;color:var(--secondary);font-size:11.5px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.nvr-status{display:flex;align-items:center;gap:5px;margin-left:auto;color:var(--secondary);font-size:9px;font-weight:850;letter-spacing:.07em}.nvr-status ha-icon{color:var(--accent);--mdc-icon-size:16px}.live-pill>.live-dot{display:block;flex:none;width:7px;height:7px;border-radius:50%;background:currentColor}
      .providers{display:grid;gap:17px;margin-top:17px}.provider-group{display:grid;gap:9px}.provider-group+.provider-group{padding-top:15px;border-top:1px solid var(--divider)}.provider-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--secondary);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.provider-heading>span{display:flex;align-items:center;gap:6px;min-width:0}.provider-heading ha-icon{color:var(--accent);--mdc-icon-size:18px}.provider-heading small{flex:none;color:var(--muted);font-size:10px;font-weight:750;letter-spacing:normal;text-transform:none}
      .camera-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.camera-tile{display:grid;min-width:0;padding:0;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:var(--control);color:var(--text);font:inherit;text-align:left;cursor:pointer}.camera-tile:hover{border-color:rgba(255,179,64,.55)}.camera-tile:active{transform:scale(.985)}.camera-tile:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.camera-feed{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;background:var(--page)}.camera-feed img{display:block;width:100%;height:100%;object-fit:cover}.camera-feed img[hidden],.camera-unavailable[hidden],.open-live[hidden]{display:none}.camera-tile:not(.is-unavailable) .camera-feed::after{position:absolute;inset:0;content:'';pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.18),transparent 42%,rgba(0,0,0,.22))}.live-pill{position:absolute;z-index:1;top:7px;left:7px;display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:7px;background:rgba(9,15,26,.76);color:#d7e1ef;font-size:8px;font-weight:850;letter-spacing:.05em;line-height:1;text-transform:uppercase}.live-pill.is-recording{color:#ff6a6a}.open-live{position:absolute;z-index:1;right:7px;bottom:7px;display:flex;align-items:center;gap:3px;padding:4px 6px;border-radius:7px;background:rgba(9,15,26,.76);color:#f5f7fb;font-size:8px;font-weight:800;line-height:1}.open-live ha-icon{color:var(--accent);--mdc-icon-size:13px}.camera-label{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:6px;min-width:0;padding:8px 9px;color:var(--text);font-size:11px;font-weight:750}.camera-label ha-icon{color:var(--secondary);--mdc-icon-size:16px}.camera-label>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.camera-unavailable{display:grid;place-items:center;align-content:center;gap:5px;width:100%;height:100%;color:var(--muted);font-size:10px;font-weight:750}.camera-unavailable ha-icon{--mdc-icon-size:25px}.is-unavailable{opacity:.72}
      @media (max-width:360px){.nvr-card{padding:14px}.camera-grid{gap:7px}.camera-label{padding:7px;font-size:10px}.live-pill,.open-live{top:5px;padding:3px 5px;font-size:7px}.live-pill{left:5px}.open-live{top:auto;right:5px;bottom:5px}}
    `;
  }
}

if (!customElements.get('hollow-camera-grid-card')) {
  customElements.define('hollow-camera-grid-card', HomeCameraGridCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'hollow-camera-grid-card')) {
  window.customCards.push({
    type: 'hollow-camera-grid-card',
    name: 'Hollow Camera Grid',
    description: 'Hollow live NVR-style camera grid',
  });
}
