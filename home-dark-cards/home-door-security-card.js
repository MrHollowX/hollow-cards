class HomeDoorSecurityCard extends HTMLElement {
  constructor(){
    super();
    this.attachShadow({mode:'open'});
    this._key='';
    this._shell=false;
    this._connected=false;
    this._dialogOpen=false;
    this._pendingLockAction='';
    this._previousFocus=null;
    this._snapshotBase='';
    this._loadedSnapshotBase='';
    this._snapshotDirty=false;
    this._cameraAvailable=false;
    this._snapshotSequence=0;
    this._intersectionObserver=null;
    this._usingViewportFallback=false;
    this._isIntersecting=false;
    this._refreshActive=false;
    this._refreshTimer=null;
    this._viewportFrame=null;
    this._ageTimer=null;
    this._ageSourceKey='';
    this._passiveListenerOptions={passive:true};
    this._capturePassiveListenerOptions={capture:true,passive:true};

    this._onClick=this._onClick.bind(this);
    this._onKeyDown=this._onKeyDown.bind(this);
    this._stopEvent=this._stopEvent.bind(this);
    this._onDocumentFocusIn=this._onDocumentFocusIn.bind(this);
    this._onDocumentKeyDown=this._onDocumentKeyDown.bind(this);
    this._onVisibilityChange=this._onVisibilityChange.bind(this);
    this._onIntersection=this._onIntersection.bind(this);
    this._onRefreshTimer=this._onRefreshTimer.bind(this);
    this._onViewportChange=this._onViewportChange.bind(this);
    this._onViewportFrame=this._onViewportFrame.bind(this);
    this._onAgeTimer=this._onAgeTimer.bind(this);
  }
  setConfig(c){
    if(!c||typeof c.camera_entity!=='string'||typeof c.lock_entity!=='string')throw new Error('camera_entity and lock_entity are required');
    const snapshotRefreshSeconds=this._parseSnapshotRefreshSeconds(c.snapshot_refresh_seconds);
    const previousCameraEntity=this._c?.camera_entity;
    const previousRefreshSeconds=this._c?.snapshot_refresh_seconds;
    if(this._dialogOpen)this._finishLock(false);
    this._c={camera_entity:c.camera_entity,lock_entity:c.lock_entity,battery_entity:typeof c.battery_entity==='string'?c.battery_entity:'',front_sensor_entity:typeof c.front_sensor_entity==='string'?c.front_sensor_entity:'',silent_entity:typeof c.silent_entity==='string'?c.silent_entity:'',last_ring_entity:typeof c.last_ring_entity==='string'?c.last_ring_entity:'',name:typeof c.name==='string'?c.name:'Door Security',camera_label:typeof c.camera_label==='string'?c.camera_label:'Video doorbell',lock_label:typeof c.lock_label==='string'?c.lock_label:'Front door',sound_on_label:typeof c.sound_on_label==='string'?c.sound_on_label:'Sound on',dnd_label:typeof c.dnd_label==='string'?c.dnd_label:'DND',status_position:c.status_position==='bottom'?'bottom':'top',show_camera:c.show_camera!==false,show_lock:c.show_lock!==false,show_lock_name:c.show_lock_name!==false,show_silent:c.show_silent!==false,show_last_ring:c.show_last_ring!==false,confirm_unlock:c.confirm_unlock===true,confirm_lock_actions:c.confirm_lock_actions===true,snapshot_refresh_seconds:snapshotRefreshSeconds};
    this._c.icon=typeof c.icon==='string'?c.icon.trim():'';
    this._c.icons=c.icons&&typeof c.icons==='object'?c.icons:{};
    this._key='';
    if(previousCameraEntity!==this._c.camera_entity){
      this._snapshotBase='';
      this._snapshotDirty=true;
    }
    if(this._connected&&previousRefreshSeconds!==snapshotRefreshSeconds)this._clearRefreshTimer();
    this._clearAgeTimer();
    this._ageSourceKey='';
    if(this._hass){
      this._render();
      this._applyThemeStyles();
    }
  }
  getCardSize(){return 5;}
  getGridOptions(){return {columns:12,rows:'auto',min_columns:6,min_rows:1};}
  set hass(h){
    this._hass=h;
    this._render();
    this._applyThemeStyles();
  }
  connectedCallback(){
    if(this._connected)return;
    this._connected=true;
    this.shadowRoot.addEventListener('click',this._onClick);
    this.shadowRoot.addEventListener('keydown',this._onKeyDown);
    this.shadowRoot.addEventListener('keyup',this._stopEvent);
    this.shadowRoot.addEventListener('pointerdown',this._stopEvent);
    this.shadowRoot.addEventListener('pointerup',this._stopEvent);
    this.shadowRoot.addEventListener('pointercancel',this._stopEvent);
    document.addEventListener('visibilitychange',this._onVisibilityChange);
    this._render();
    this._applyThemeStyles();
    this._startViewportTracking();
    this._startAgeTimer();
  }
  disconnectedCallback(){
    if(!this._connected)return;
    this.shadowRoot.removeEventListener('click',this._onClick);
    this.shadowRoot.removeEventListener('keydown',this._onKeyDown);
    this.shadowRoot.removeEventListener('keyup',this._stopEvent);
    this.shadowRoot.removeEventListener('pointerdown',this._stopEvent);
    this.shadowRoot.removeEventListener('pointerup',this._stopEvent);
    this.shadowRoot.removeEventListener('pointercancel',this._stopEvent);
    document.removeEventListener('visibilitychange',this._onVisibilityChange);
    this._stopViewportTracking();
    this._removeDialogGuards();
    if(this._dialogOpen)this._finishLock(false,false);
    this._connected=false;
    this._isIntersecting=false;
    this._key='';
    this._deactivateSnapshots();
    this._clearAgeTimer();
  }
  _actionTarget(event){
    const path=typeof event.composedPath==='function'?event.composedPath():[event.target];
    return path.find(node=>node?.dataset?.a)||event.target?.closest?.('[data-a]')||null;
  }
  _onClick(event){
    event.stopPropagation();
    const target=this._actionTarget(event);
    if(!target)return;
    const action=target.dataset.a;
    if(action==='dialog-panel')return;
    event.preventDefault();
    if(action==='camera')this._more(this._c.camera_entity);
    else if(action==='more-info')this._more(target.dataset.e);
    else if(action==='lock')this._controlLock(target);
    else if(action==='silent')this._toggleSilent();
    else if(action==='confirm-lock')this._finishLock(true);
    else if(action==='cancel-lock'||action==='lock-backdrop')this._finishLock(false);
  }
  _onKeyDown(event){
    event.stopPropagation();
    if(this._dialogOpen){
      if(event.key==='Escape'){
        event.preventDefault();
        this._finishLock(false);
      }else if(event.key==='Tab'){
        this._trapDialogFocus(event);
      }
      return;
    }
    const target=this._actionTarget(event);
    if(target?.dataset.a==='camera'&&(event.key==='Enter'||event.key===' ')){
      event.preventDefault();
      this._more(this._c.camera_entity);
    }
  }
  _stopEvent(event){event.stopPropagation();}
  _onDocumentFocusIn(){
    if(!this._dialogOpen||this._dialog.contains(this.shadowRoot.activeElement))return;
    this._dialogConfirm?.focus();
  }
  _onDocumentKeyDown(event){
    if(!this._dialogOpen)return;
    if(event.key==='Escape'){
      event.preventDefault();
      event.stopPropagation();
      this._finishLock(false);
    }else if(event.key==='Tab'){
      event.stopPropagation();
      this._trapDialogFocus(event);
    }
  }
  _dialogFocusables(){
    if(!this._dialog)return[];
    return Array.from(this._dialog.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(node=>!node.hidden&&node.getAttribute('aria-hidden')!=='true');
  }
  _trapDialogFocus(event){
    const focusables=this._dialogFocusables();
    if(!focusables.length){
      event.preventDefault();
      return;
    }
    const first=focusables[0],last=focusables[focusables.length-1],active=this.shadowRoot.activeElement;
    if(!this._dialog.contains(active)){
      event.preventDefault();
      (event.shiftKey?last:first).focus();
    }else if(event.shiftKey&&active===first){
      event.preventDefault();
      last.focus();
    }else if(!event.shiftKey&&active===last){
      event.preventDefault();
      first.focus();
    }
  }
  _addDialogGuards(){
    document.addEventListener('focusin',this._onDocumentFocusIn,true);
    document.addEventListener('keydown',this._onDocumentKeyDown,true);
    if(this._cameraWrap)this._cameraWrap.inert=true;
  }
  _removeDialogGuards(){
    document.removeEventListener('focusin',this._onDocumentFocusIn,true);
    document.removeEventListener('keydown',this._onDocumentKeyDown,true);
    if(this._cameraWrap)this._cameraWrap.inert=false;
  }
  _onVisibilityChange(){
    if(this._usingViewportFallback&&!document.hidden){
      this._updateFallbackIntersection();
      return;
    }
    this._updateRefreshActivity();
  }
  _onIntersection(entries){
    let nextIntersection=null;
    entries.forEach(entry=>{if(entry.target===this)nextIntersection=Boolean(entry.isIntersecting);});
    if(nextIntersection==null)return;
    this._isIntersecting=nextIntersection;
    this._updateRefreshActivity();
  }
  _onRefreshTimer(){
    this._refreshTimer=null;
    if(!this._canRefreshSnapshots()||this._c.snapshot_refresh_seconds<=0){
      this._updateRefreshActivity();
      return;
    }
    this._refreshSnapshot(false);
    this._scheduleRefresh();
  }
  _onViewportChange(){
    if(!this._connected||!this._usingViewportFallback||this._viewportFrame!==null)return;
    this._viewportFrame=window.requestAnimationFrame(this._onViewportFrame);
  }
  _onViewportFrame(){
    this._viewportFrame=null;
    if(!this._connected||!this._usingViewportFallback)return;
    this._updateFallbackIntersection();
  }
  _parseSnapshotRefreshSeconds(value){
    if(value==null||value==='')return 30;
    if(typeof value==='boolean')throw new Error('snapshot_refresh_seconds must be 0 or between 5 and 300');
    const seconds=Number(value);
    if(!Number.isFinite(seconds)||(seconds!==0&&(seconds<5||seconds>300)))throw new Error('snapshot_refresh_seconds must be 0 or between 5 and 300');
    return seconds;
  }
  _isAvailable(state){return Boolean(state&&typeof state.state==='string'&&!['unknown','unavailable'].includes(state.state));}
  _startAgeTimer(){
    if(this._ageTimer)return;
    this._ageTimer=setInterval(this._onAgeTimer,30000);
  }
  _clearAgeTimer(){
    if(!this._ageTimer)return;
    clearInterval(this._ageTimer);
    this._ageTimer=null;
  }
  _onAgeTimer(){
    if(!this._connected||!this._hass||!this._c)return;
    this._render();
  }
  _snapshotBaseUrl(entity,state){
    const path=`/api/camera_proxy/${encodeURIComponent(entity)}`;
    const token=state?.attributes?.access_token;
    return token?`${path}?token=${encodeURIComponent(token)}`:path;
  }
  _snapshotUrl(baseUrl,refreshToken){
    const separator=baseUrl.includes('?')?'&':'?';
    return `${baseUrl}${separator}_=${encodeURIComponent(refreshToken)}`;
  }
  _nextSnapshotToken(){
    this._snapshotSequence+=1;
    return `${Date.now()}-${this._snapshotSequence}`;
  }
  _startViewportTracking(){
    if(typeof IntersectionObserver!=='function'){
      this._usingViewportFallback=true;
      window.addEventListener('scroll',this._onViewportChange,this._passiveListenerOptions);
      window.addEventListener('resize',this._onViewportChange,this._passiveListenerOptions);
      document.addEventListener('scroll',this._onViewportChange,this._capturePassiveListenerOptions);
      this._updateFallbackIntersection();
      return;
    }
    this._isIntersecting=false;
    this._intersectionObserver=new IntersectionObserver(this._onIntersection,{threshold:0});
    this._intersectionObserver.observe(this);
  }
  _stopViewportTracking(){
    if(this._intersectionObserver){
      this._intersectionObserver.disconnect();
      this._intersectionObserver=null;
    }
    if(this._usingViewportFallback){
      window.removeEventListener('scroll',this._onViewportChange,this._passiveListenerOptions);
      window.removeEventListener('resize',this._onViewportChange,this._passiveListenerOptions);
      document.removeEventListener('scroll',this._onViewportChange,this._capturePassiveListenerOptions);
      this._usingViewportFallback=false;
    }
    if(this._viewportFrame!==null){
      window.cancelAnimationFrame(this._viewportFrame);
      this._viewportFrame=null;
    }
  }
  _updateFallbackIntersection(){
    if(!this._connected||!this._usingViewportFallback)return;
    this._isIntersecting=this._isWithinViewport();
    this._updateRefreshActivity();
  }
  _isWithinViewport(){
    const rect=this.getBoundingClientRect();
    const viewportWidth=window.innerWidth||document.documentElement?.clientWidth||0;
    const viewportHeight=window.innerHeight||document.documentElement?.clientHeight||0;
    const width=Number.isFinite(rect.width)?rect.width:rect.right-rect.left;
    const height=Number.isFinite(rect.height)?rect.height:rect.bottom-rect.top;
    return width>0&&height>0&&rect.bottom>0&&rect.right>0&&rect.top<viewportHeight&&rect.left<viewportWidth;
  }
  _canRefreshSnapshots(){
    if(!this._connected||!this._hass||!this._c||!this._c.show_camera||!this._cameraAvailable||document.hidden)return false;
    const withinViewport=this._isWithinViewport();
    if(this._usingViewportFallback)this._isIntersecting=withinViewport;
    return this._isIntersecting&&withinViewport;
  }
  _updateRefreshActivity(){
    if(!this._canRefreshSnapshots()){
      this._deactivateSnapshots();
      return;
    }
    const resumed=!this._refreshActive;
    this._refreshActive=true;
    if(resumed){
      this._clearRefreshTimer();
      this._refreshSnapshot(false);
    }else if(this._snapshotDirty){
      this._clearRefreshTimer();
      this._refreshSnapshot(true);
    }
    this._scheduleRefresh();
  }
  _scheduleRefresh(){
    if(!this._refreshActive||this._c.snapshot_refresh_seconds<=0||this._refreshTimer!==null)return;
    if(!this._canRefreshSnapshots()){
      this._deactivateSnapshots();
      return;
    }
    this._refreshTimer=setTimeout(this._onRefreshTimer,this._c.snapshot_refresh_seconds*1000);
  }
  _clearRefreshTimer(){
    if(this._refreshTimer!==null){
      clearTimeout(this._refreshTimer);
      this._refreshTimer=null;
    }
  }
  _deactivateSnapshots(){
    this._clearRefreshTimer();
    this._refreshActive=false;
  }
  _assignSnapshot(){
    this._image.setAttribute('src',this._snapshotUrl(this._snapshotBase,this._nextSnapshotToken()));
    this._loadedSnapshotBase=this._snapshotBase;
    this._snapshotDirty=false;
    this._image.style.display='';
    this._fallback.style.display='none';
  }
  _refreshSnapshot(dirtyOnly){
    if(!this._image||!this._c||!this._hass)return false;
    this._patchCameraPreview(this._state(this._c.camera_entity));
    if(!this._canRefreshSnapshots()||!this._cameraAvailable||(dirtyOnly&&!this._snapshotDirty))return false;
    this._assignSnapshot();
    return true;
  }
  _applyThemeStyles(){
    if(!this._shell||this._themeStyle?.isConnected)return;
    if(!this._themeStyle){
      this._themeStyle=document.createElement('style');
      this._themeStyle.textContent=`:host{--door-surface:var(--card-background-color,var(--ha-card-background,#212c42));--door-card-radius:var(--home-door-security-card-border-radius,20px);--door-control:var(--secondary-background-color,#2b3850);--door-primary:var(--primary-text-color,#f5f7fb);--door-secondary:var(--secondary-text-color,#91a2bb);--door-accent:var(--primary-color,#3d8bfd);--door-divider:var(--divider-color,rgba(255,255,255,.16));color:var(--door-primary)}.card{background:var(--door-surface)!important;border-color:var(--door-divider)!important;border-radius:var(--door-card-radius)!important;box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important}.camera-wrap,.camera{background:var(--primary-background-color,#182337)}.camera:focus-visible,.ring:focus-visible,.door-inline:focus-visible,.silent:focus-visible,.lock:focus-visible,.dialog-confirm:focus-visible,.dialog-cancel:focus-visible{outline-color:var(--door-accent)}.fallback,.dialog-text{color:var(--door-secondary)}.silent.neutral,.lock.neutral,.dialog-cancel{background:var(--door-control);color:var(--door-primary)}.dialog-panel{background:var(--door-surface);border-color:var(--door-divider);color:var(--door-primary)}.dialog-actions button{border-color:var(--door-divider)}.lock-state,.lock-battery{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;
    }
    this.shadowRoot.append(this._themeStyle);
  }
  _state(e){return e&&this._hass&&this._hass.states[e]||null;}
  _attr(e,k,d=''){const s=this._state(e);return s&&s.attributes[k]!=null?s.attributes[k]:d;}
  _icon(key,fallback){const configured=this._c?.icons?.[key]||(key==='camera'?this._c?.icon:'');return typeof configured==='string'&&configured.trim()?configured.trim():fallback;}
  _applyIcons({doorOpen,soundOn,silentAvailable,locked,unlocked}){
    this._fallback?.querySelector('ha-icon')?.setAttribute('icon',this._icon('camera','mdi:video-outline'));
    this._doorIcon?.setAttribute('icon',this._icon(doorOpen?'door_open':'door_closed',doorOpen?'mdi:door-open':'mdi:door-closed'));
    const silentKey=!silentAvailable?'silent_unavailable':soundOn?'silent_on':'silent_off';
    const silentFallback=!silentAvailable?'mdi:bell-alert-outline':soundOn?'mdi:bell':'mdi:bell-off';
    this._silentIcon?.setAttribute('icon',this._icon(silentKey,silentFallback));
    const lockKey=locked?'lock_locked':unlocked?'lock_unlocked':'lock_unavailable';
    const lockFallback=locked?'mdi:lock':unlocked?'mdi:lock-open-variant':'mdi:lock-question';
    this._lockIcon?.setAttribute('icon',this._icon(lockKey,lockFallback));
  }
  _more(e){if(e)this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:e},bubbles:true,composed:true}));}
  _controlLock(invoker){
    const s=this._state(this._c.lock_entity);
    if(!s||!['locked','unlocked'].includes(s.state))return;
    const service=s.state==='locked'?'unlock':'lock';
    const shouldConfirm=this._c.confirm_lock_actions||(service==='unlock'&&this._c.confirm_unlock);
    if(shouldConfirm){
      this._openLockDialog(service,invoker);
      return;
    }
    this._callLock(service);
  }
  _callLock(service){
    const state=this._state(this._c.lock_entity);
    const expected=service==='unlock'?'locked':service==='lock'?'unlocked':'';
    if(!expected||!state||state.state!==expected)return false;
    try{
      this._hass.callService('lock',service,{entity_id:this._c.lock_entity});
      return true;
    }catch(_error){
      return false;
    }
  }
  _openLockDialog(service,invoker){
    this._pendingLockAction=service;
    this._previousFocus=invoker&&typeof invoker.focus==='function'?invoker:this.shadowRoot.activeElement;
    const actionLabel=service==='unlock'?'Unlock':'Lock';
    this._dialogTitle.textContent=`${actionLabel} ${this._c.lock_label}?`;
    this._dialogText.textContent=`This will ${service} ${this._c.lock_label}.`;
    this._dialogConfirm.textContent=actionLabel;
    this._dialog.classList.add('open');
    this._dialog.setAttribute('aria-hidden','false');
    this._dialogOpen=true;
    this._addDialogGuards();
    this._dialogConfirm.focus();
  }
  _finishLock(confirm,restoreFocus=true){
    if(!this._dialogOpen){
      this._removeDialogGuards();
      return;
    }
    const service=this._pendingLockAction;
    const previousFocus=this._previousFocus;
    this._dialog.classList.remove('open');
    this._dialog.setAttribute('aria-hidden','true');
    this._dialogOpen=false;
    this._pendingLockAction='';
    this._previousFocus=null;
    this._removeDialogGuards();
    if(confirm&&service)this._callLock(service);
    if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus();
  }
  _toggleSilent(){const s=this._state(this._c.silent_entity);if(!s||!['on','off'].includes(s.state))return;this._hass.callService('switch',s.state==='on'?'turn_off':'turn_on',{entity_id:this._c.silent_entity});}
  _relative(s){if(!s||!s.last_changed)return 'Unavailable';const t=new Date(s.last_changed).getTime();if(!Number.isFinite(t))return 'Unavailable';const mins=Math.max(0,Math.floor((Date.now()-t)/60000));if(mins<1)return 'just now';if(mins<60)return `${mins} minute${mins===1?'':'s'} ago`;const hours=Math.floor(mins/60);if(hours<24)return `${hours} hour${hours===1?'':'s'} ago`;const days=Math.floor(hours/24);return `${days} day${days===1?'':'s'} ago`;}
  _ringText(s){if(!s||!s.state||['unknown','unavailable','none'].includes(String(s.state).toLowerCase()))return 'Last Ring: unavailable';const t=new Date(s.state).getTime();if(!Number.isFinite(t))return 'Last Ring: unavailable';const mins=Math.max(0,Math.floor((Date.now()-t)/60000));if(mins<1)return 'Last Ring: just now';if(mins<60)return `Last Ring: ${mins} minute${mins===1?'':'s'} ago`;const hours=Math.floor(mins/60);if(hours<24)return `Last Ring: ${hours} hour${hours===1?'':'s'} ago`;const days=Math.floor(hours/24);return `Last Ring: ${days} day${days===1?'':'s'} ago`;}
  _getDoorStatus(s){if(!s||['unknown','unavailable'].includes(s.state))return {label:'Unavailable',open:false};const open=s.state==='on'||s.state==='open';return {label:open?'Open':'Closed',open};}
  _updateCameraImage(cam,forceSnapshot=false,refreshToken=''){
    const available=Boolean(this._c.show_camera&&this._isAvailable(cam));
    this._cameraAvailable=available;
    const cameraName=cam?.attributes?.friendly_name||this._c.camera_label;
    this._image.alt=`${cameraName} snapshot preview`;
    if(!available){
      this._image.removeAttribute('src');
      this._image.style.display='none';
      this._fallback.style.display=this._c.show_camera?'':'none';
      this._fallback.lastElementChild.textContent='Camera unavailable';
      this._snapshotBase='';
      this._loadedSnapshotBase='';
      this._snapshotDirty=false;
      return;
    }
    const snapshotBase=this._snapshotBaseUrl(this._c.camera_entity,cam);
    const baseChanged=snapshotBase!==this._snapshotBase;
    if(forceSnapshot||baseChanged||this._loadedSnapshotBase!==snapshotBase||!this._image.hasAttribute('src')){
      const token=refreshToken||this._nextSnapshotToken();
      this._image.setAttribute('src',this._snapshotUrl(snapshotBase,token));
      this._snapshotBase=snapshotBase;
      this._loadedSnapshotBase=snapshotBase;
      this._snapshotDirty=false;
    }else{
      this._snapshotBase=snapshotBase;
    }
    this._image.style.display='';
    this._fallback.style.display='none';
    this._fallback.lastElementChild.textContent='Tap to view camera';
  }
  _patchCameraPreview(cam){
    if(!this._shell||!this._image||!this._fallback)return;
    this._updateCameraImage(cam);
  }
  _render(){
    if(!this._hass||!this._c)return;
    const cam=this._state(this._c.camera_entity),lock=this._state(this._c.lock_entity),silent=this._state(this._c.silent_entity),door=this._state(this._c.front_sensor_entity),ring=this._state(this._c.last_ring_entity),ls=lock?lock.state:'unavailable',ss=silent?silent.state:'unavailable',locked=ls==='locked',unlocked=ls==='unlocked',silentAvailable=Boolean(silent&&['on','off'].includes(ss)),soundOn=silentAvailable&&ss==='on',battery=this._state(this._c.battery_entity),bt=battery&&!['unknown','unavailable'].includes(battery.state)?`${battery.state}${battery.attributes.unit_of_measurement||'%'} battery`:'',ds=this._getDoorStatus(door),activity=this._relative(door),ringText=this._ringText(ring),key=JSON.stringify([cam?.state||'unavailable',cam?.attributes?.access_token||'',cam?.attributes?.friendly_name||'',ls,ss,door?.state||'unavailable',door?.last_changed||'',activity,ring?.state||'unavailable',ringText,bt,this._c.name,this._c.camera_label,this._c.lock_label,this._c.show_lock_name,this._c.sound_on_label,this._c.dnd_label,this._c.status_position]);
    if(key===this._key){
      return;
    }
    this._key=key;
    if(!this._shell){this.shadowRoot.innerHTML=`<style>${this._css()}</style><ha-card class="card"><div class="title"></div><div class="camera-wrap"><div class="camera" data-a="camera" role="button" tabindex="0"><span class="fallback"><ha-icon icon="mdi:video-outline"></ha-icon><span></span></span><img class="image" alt=""></div><div class="overlay-row" role="group"><button class="ring" data-a="more-info" type="button"></button><button class="door-inline" data-a="more-info" type="button"><ha-icon class="door-icon"></ha-icon><span class="door-label"></span><span class="activity"></span></button></div><button class="silent" data-a="silent" type="button"><ha-icon class="silent-icon"></ha-icon><span class="silent-state"></span></button><button class="lock" data-a="lock" type="button"><ha-icon class="lock-icon"></ha-icon><span class="lock-copy"><span class="lock-state"></span><span class="lock-battery"></span></span></button></div><div class="lock-dialog" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="lock-dialog-title" data-a="lock-backdrop"><div class="dialog-panel" data-a="dialog-panel"><h2 class="dialog-title" id="lock-dialog-title"></h2><p class="dialog-text"></p><div class="dialog-actions"><button class="dialog-cancel" data-a="cancel-lock" type="button">Cancel</button><button class="dialog-confirm" data-a="confirm-lock" type="button"></button></div></div></div></ha-card>`;this._shell=true;this._title=this.shadowRoot.querySelector('.title');this._camera=this.shadowRoot.querySelector('.camera');this._fallback=this.shadowRoot.querySelector('.fallback');this._image=this.shadowRoot.querySelector('.image');this._cameraWrap=this.shadowRoot.querySelector('.camera-wrap');this._overlay=this.shadowRoot.querySelector('.overlay-row');this._ring=this.shadowRoot.querySelector('.ring');this._door=this.shadowRoot.querySelector('.door-inline');this._doorIcon=this.shadowRoot.querySelector('.door-icon');this._doorLabel=this.shadowRoot.querySelector('.door-label');this._activity=this.shadowRoot.querySelector('.activity');this._silent=this.shadowRoot.querySelector('.silent');this._silentIcon=this.shadowRoot.querySelector('.silent-icon');this._silentState=this.shadowRoot.querySelector('.silent-state');this._lockButton=this.shadowRoot.querySelector('.lock');this._lockIcon=this.shadowRoot.querySelector('.lock-icon');this._lockState=this.shadowRoot.querySelector('.lock-state');this._lockBattery=this.shadowRoot.querySelector('.lock-battery');this._dialog=this.shadowRoot.querySelector('.lock-dialog');this._dialogTitle=this.shadowRoot.querySelector('.dialog-title');this._dialogText=this.shadowRoot.querySelector('.dialog-text');this._dialogConfirm=this.shadowRoot.querySelector('[data-a="confirm-lock"]');}
    this._title.textContent=this._c.name;this._camera.style.display=this._c.show_camera?'':'none';this._camera.setAttribute('aria-label',`Open ${cam?.attributes?.friendly_name||this._c.camera_label} camera details`);this._cameraWrap.classList.toggle('status-bottom',this._c.status_position==='bottom');this._cameraWrap.classList.toggle('status-top',this._c.status_position==='top');this._updateCameraImage(cam);this._overlay.style.display=this._c.show_last_ring||this._c.front_sensor_entity?'':'none';this._overlay.classList.toggle('bottom',this._c.status_position==='bottom');this._ring.style.display=this._c.show_last_ring&&this._c.last_ring_entity?'':'none';this._ring.textContent=ringText;this._ring.dataset.e=this._c.last_ring_entity;this._ring.setAttribute('aria-label',`${ringText}. Open entity details`);this._door.style.display=this._c.front_sensor_entity?'':'none';this._door.dataset.e=this._c.front_sensor_entity;this._door.setAttribute('aria-label',`${this._c.lock_label} ${ds.label}, ${activity}. Open entity details`);this._doorLabel.textContent=ds.label;this._activity.textContent=activity;this._silent.style.display=this._c.show_silent&&this._c.silent_entity?'':'none';this._silentState.textContent=!silentAvailable?'Unavailable':soundOn?this._c.sound_on_label:this._c.dnd_label;this._silent.classList.toggle('sound-on',soundOn);this._silent.classList.toggle('dnd',silentAvailable&&!soundOn);this._silent.classList.toggle('neutral',!silentAvailable);this._silent.disabled=!silentAvailable;this._silent.title=!silentAvailable?'Doorbell sound control unavailable':soundOn?this._c.sound_on_label:this._c.dnd_label;this._silent.setAttribute('aria-label',this._silent.title);this._lockButton.style.display=this._c.show_lock?'':'none';const lockStateText=locked?'Locked':unlocked?'Unlocked':ls==='locking'?'Locking':ls==='unlocking'?'Unlocking':'Unavailable',visibleLockState=this._c.show_lock_name?`${this._c.lock_label}: ${lockStateText}`:lockStateText;this._lockState.textContent=visibleLockState;this._lockBattery.textContent=bt;this._lockBattery.style.display=bt?'':'none';this._lockButton.classList.toggle('locked',locked);this._lockButton.classList.toggle('unlocked',unlocked);this._lockButton.classList.toggle('neutral',!locked&&!unlocked);this._lockButton.disabled=!locked&&!unlocked;this._lockButton.title=locked?`Unlock ${this._c.lock_label}`:unlocked?`Lock ${this._c.lock_label}`:`${this._c.lock_label} lock unavailable`;this._lockButton.setAttribute('aria-label',this._lockButton.title);this._applyIcons({doorOpen:ds.open,soundOn,silentAvailable,locked,unlocked});if(this._dialog&&!this._dialogOpen)this._dialog.setAttribute('aria-hidden','true');
  }
  _css(){return `:host{display:block;min-width:0;width:100%;color:#f5f7fb;font-family:-apple-system,'Segoe UI',Helvetica,sans-serif}.card{position:relative;box-sizing:border-box;overflow:hidden;width:100%;background:#212c42;border:1px solid rgba(255,255,255,.1);border-radius:20px;box-shadow:0 4px 14px rgba(0,0,0,.16)}.title{box-sizing:border-box;height:42px;padding:14px 16px 8px;font-size:16px;font-weight:750}.camera-wrap{position:relative;margin:0 10px 10px;width:calc(100% - 20px);aspect-ratio:16 / 10;overflow:hidden;border-radius:14px;background:#182337}.camera{position:absolute;inset:0;overflow:hidden;background:#182337;cursor:pointer}.camera:focus-visible{outline:3px solid #3d8bfd;outline-offset:-3px}.image{display:block;width:100%;height:100%;object-fit:cover}.fallback{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;color:#8fa0b8;font-size:12px}.fallback ha-icon{--mdc-icon-size:34px}.overlay-row{position:absolute;top:12px;left:12px;right:12px;z-index:2;display:flex;align-items:center;gap:10px;padding:0 0 7px;border-bottom:1px solid rgba(255,255,255,.28);color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9);pointer-events:none}.overlay-row.bottom{top:auto;bottom:12px;padding:7px 0 0;border-bottom:0;border-top:1px solid rgba(255,255,255,.28)}.ring,.door-inline{all:unset;box-sizing:border-box;pointer-events:auto;cursor:pointer;color:inherit;font:inherit;border:0;background:transparent;box-shadow:none}.ring{min-width:0;flex:1;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}.door-inline{display:flex;align-items:center;gap:4px;min-width:0;font-size:11px;font-weight:700;white-space:nowrap}.ring:focus-visible,.door-inline:focus-visible{outline:2px solid #3d8bfd;outline-offset:2px;border-radius:3px}.door-icon{--mdc-icon-size:17px}.activity{font-size:10px;color:inherit}.silent,.lock{all:unset;box-sizing:border-box;position:absolute;z-index:3;display:flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#596579;color:#fff;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.3);backdrop-filter:blur(8px)}.camera-wrap.status-bottom .silent,.camera-wrap.status-bottom .lock{top:12px;bottom:auto}.camera-wrap.status-top .silent,.camera-wrap.status-top .lock{top:auto;bottom:12px}.silent{left:12px}.lock{right:12px;max-width:calc(50% - 18px)}.silent:focus-visible,.lock:focus-visible{outline:3px solid #3d8bfd;outline-offset:2px}.silent:disabled,.lock:disabled{cursor:not-allowed}.silent.sound-on{background:#25824a}.silent.dnd{background:#b9362a}.silent.neutral{background:#596579}.silent-icon,.lock-icon{--mdc-icon-size:20px}.silent-state{font-size:11px;font-weight:800}.lock-copy{display:flex;flex-direction:column;min-width:0}.lock-state{font-size:12px;font-weight:800;line-height:1.1}.lock-battery{font-size:9px;opacity:.82;line-height:1.1}.lock.locked{background:#25824a}.lock.unlocked{background:#b9362a}.lock.neutral{background:#596579}.lock-dialog{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(16,24,39,.74);backdrop-filter:blur(5px)}.lock-dialog.open{display:flex}.dialog-panel{width:min(100%,320px);box-sizing:border-box;padding:20px;background:#212c42;border:1px solid rgba(255,255,255,.16);border-radius:18px;box-shadow:0 12px 30px rgba(0,0,0,.4);color:#f5f7fb}.dialog-title{margin:0;font-size:18px;font-weight:800}.dialog-text{margin:8px 0 18px;color:#9fb0c8;font-size:13px;line-height:1.4}.dialog-actions{display:flex;justify-content:flex-end;gap:8px}.dialog-actions button{min-height:40px;padding:9px 14px;border:1px solid rgba(255,255,255,.16);border-radius:10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.dialog-cancel{background:#2b3850;color:#f5f7fb}.dialog-confirm{background:#25824a;color:#fff}.dialog-confirm:focus-visible,.dialog-cancel:focus-visible{outline:3px solid #3d8bfd;outline-offset:2px}@media(max-width:560px){.title{padding-inline:12px}.overlay-row{top:10px;left:10px;right:10px;gap:6px}.overlay-row.bottom{top:auto;bottom:10px}.camera-wrap.status-bottom .silent,.camera-wrap.status-bottom .lock{top:10px;bottom:auto}.camera-wrap.status-top .silent,.camera-wrap.status-top .lock{top:auto;bottom:10px}.door-inline,.ring{font-size:10px}.activity{font-size:9px}.silent,.lock{padding:7px 9px}.lock{right:10px;max-width:calc(50% - 14px)}}@media(max-width:380px){.silent-state{font-size:10px}.silent,.lock{padding-inline:8px}.silent-icon,.lock-icon{--mdc-icon-size:18px}.door-inline{gap:2px}.activity{font-size:8px}}@media(max-width:360px){.camera-wrap{margin-inline:8px;width:calc(100% - 16px)}.silent{left:8px}.lock{right:8px}}`;}
}
if(!customElements.get('home-door-security-card')){
  customElements.define('home-door-security-card',HomeDoorSecurityCard);
}
window.customCards=window.customCards||[];
if(!window.customCards.some(card=>card.type==='home-door-security-card')){
  window.customCards.push({type:'home-door-security-card',name:'Home Door Security',description:'Responsive camera security card with configurable local lock confirmation dialog'});
}
