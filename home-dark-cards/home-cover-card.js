const FEATURE_OPEN=1,FEATURE_CLOSE=2,FEATURE_POSITION=4,FEATURE_STOP=8,FEATURE_OPEN_TILT=16,FEATURE_CLOSE_TILT=32,FEATURE_STOP_TILT=64,FEATURE_SET_TILT_POSITION=128;
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)));
class HomeCoverCard extends HTMLElement{
  constructor(){
    super();
    this.attachShadow({mode:'open'});
    this._error='';
    this._lastStateSignature=null;
    this._onPointerDown=this._onPointerDown.bind(this);
    this._onPointerMove=this._onPointerMove.bind(this);
    this._onPointerUp=this._onPointerUp.bind(this);
    this._onPointerCancel=this._onPointerCancel.bind(this);
    this._onLostPointerCapture=this._onLostPointerCapture.bind(this);
    this._onClick=this._onClick.bind(this);
    this._onInput=this._onInput.bind(this);
    this._onChange=this._onChange.bind(this);
    this._onKeydown=this._onKeydown.bind(this);
    this._onFocusIn=this._onFocusIn.bind(this);
    this._onFocusOut=this._onFocusOut.bind(this);
    this._onWindowBlur=this._onWindowBlur.bind(this);
    this._onWindowPointerEnd=this._onWindowPointerEnd.bind(this);
  }
  static getConfigElement(){return document.createElement('home-cover-card-editor');}
  static getStubConfig(){return {kind:'blinds',entity:'cover.example',name:'Blinds',half_open_position:50,show_tilt_buttons:true};}
  setConfig(config){
    const topKind=config?.kind;
    const normalize=(room)=>{
      const raw=room?.entities??room?.entity;
      const entities=(Array.isArray(raw)?raw:[raw]).map((item)=>typeof item==='string'?item:item?.entity).filter((id)=>typeof id==='string'&&id.startsWith('cover.'));
      if(!entities.length)return null;
      const configuredKind=room?.kind||topKind||'blinds';
      const kind=configuredKind==='blind'?'blinds':configuredKind==='shutter'?'shutters':configuredKind;
      return {...room,kind,entities,half_open_position:clamp(room?.half_open_position??config?.half_open_position??50),name:room?.name||'',names:Array.isArray(room?.names)?room.names:[],icon:typeof room?.icon==='string'&&room.icon.trim()?room.icon.trim():(typeof config?.icon==='string'&&config.icon.trim()?config.icon.trim():'')};
    };
    const rooms=Array.isArray(config?.rooms)?config.rooms.map(normalize).filter(Boolean):[normalize(config)].filter(Boolean);
    if(!rooms.length) throw new Error('home-cover-card requires a cover entity, entities list, or rooms list');
    if(rooms.some((room)=>!['blinds','shutters'].includes(room.kind))) throw new Error('home-cover-card requires kind: blinds or shutters for every room');
    const directSingleEntity=!Array.isArray(config?.rooms)&&rooms.length===1&&rooms[0].entities.length===1;
    this._config={...config,show_tilt_buttons:config?.show_tilt_buttons!==false,rooms,direct_single_entity:directSingleEntity};
    this._lastStateSignature=null;
    if(this._hass)this._render();
  }
  getCardSize(){return Math.max(3,2*(this._config?.rooms||[]).reduce((sum,room)=>sum+room.entities.length,0));}
  getGridOptions(){return {columns:12,rows:'auto'};}
  set hass(value){
    this._hass=value;
    if(this._stateSignature()!==this._lastStateSignature)this._render();
  }
  connectedCallback(){
    if(this._wired)return;
    this._wired=true;
    this.shadowRoot.addEventListener('pointerdown',this._onPointerDown);
    this.shadowRoot.addEventListener('pointermove',this._onPointerMove);
    this.shadowRoot.addEventListener('pointerup',this._onPointerUp);
    this.shadowRoot.addEventListener('pointercancel',this._onPointerCancel);
    this.shadowRoot.addEventListener('lostpointercapture',this._onLostPointerCapture);
    this.shadowRoot.addEventListener('click',this._onClick);
    this.shadowRoot.addEventListener('input',this._onInput);
    this.shadowRoot.addEventListener('change',this._onChange);
    this.shadowRoot.addEventListener('keydown',this._onKeydown);
    this.shadowRoot.addEventListener('focusin',this._onFocusIn);
    this.shadowRoot.addEventListener('focusout',this._onFocusOut);
    window.addEventListener('blur',this._onWindowBlur);
    if(this._config&&this._hass){
      this._lastStateSignature=null;
      this._render();
    }
  }
  disconnectedCallback(){
    if(!this._wired)return;
    this.shadowRoot.removeEventListener('pointerdown',this._onPointerDown);
    this.shadowRoot.removeEventListener('pointermove',this._onPointerMove);
    this.shadowRoot.removeEventListener('pointerup',this._onPointerUp);
    this.shadowRoot.removeEventListener('pointercancel',this._onPointerCancel);
    this.shadowRoot.removeEventListener('lostpointercapture',this._onLostPointerCapture);
    this.shadowRoot.removeEventListener('click',this._onClick);
    this.shadowRoot.removeEventListener('input',this._onInput);
    this.shadowRoot.removeEventListener('change',this._onChange);
    this.shadowRoot.removeEventListener('keydown',this._onKeydown);
    this.shadowRoot.removeEventListener('focusin',this._onFocusIn);
    this.shadowRoot.removeEventListener('focusout',this._onFocusOut);
    window.removeEventListener('blur',this._onWindowBlur);
    this._clearCoverFlushTimer();
    this._resetSliderInteraction();
    this._focusedSlider=null;
    this._deferredCoverRender=false;
    this._wired=false;
  }
  _eventControl(event,selector){
    const path=typeof event?.composedPath==='function'?event.composedPath():[];
    for(const node of path){
      if(node===this.shadowRoot||node===this)break;
      if(node?.matches?.(selector)&&this.shadowRoot.contains(node))return node;
    }
    const target=event?.target;
    const control=target?.closest?.(selector);
    return control&&this.shadowRoot.contains(control)?control:null;
  }
  _sliderFromEvent(event){return this._eventControl(event,'input[data-slider]');}
  _buttonFromEvent(event){return this._eventControl(event,'button');}
  _onPointerDown(event){
    const button=this._buttonFromEvent(event);
    const input=this._sliderFromEvent(event);
    if(!button&&!input)return;
    event.stopPropagation();
    if(!input||input.disabled||event.button!==0||event.isPrimary===false)return;
    this._resetSliderInteraction();
    this._dragging=true;
    this._activeSlider=input;
    this._pointerId=event.pointerId;
    window.addEventListener('pointerup',this._onWindowPointerEnd,true);
    window.addEventListener('pointercancel',this._onWindowPointerEnd,true);
    try{input.setPointerCapture(event.pointerId);}catch(_error){}
  }
  _onPointerMove(event){
    if(!this._dragging||event.pointerId!==this._pointerId)return;
    event.stopPropagation();
  }
  _onPointerUp(event){
    const control=this._buttonFromEvent(event)||this._sliderFromEvent(event);
    if(control||event.pointerId===this._pointerId)event.stopPropagation();
    if(this._dragging&&event.pointerId===this._pointerId)this._finishSliderInteraction(true);
  }
  _onPointerCancel(event){
    if(event.pointerId!==this._pointerId)return;
    event.stopPropagation();
    this._finishSliderInteraction(false);
  }
  _onLostPointerCapture(event){
    if(event.pointerId!==this._pointerId)return;
    this._finishSliderInteraction(false);
  }
  _onClick(event){
    const button=this._buttonFromEvent(event);
    const input=this._sliderFromEvent(event);
    if(!button&&!input)return;
    event.stopPropagation();
    if(!button||button.disabled||(
      !button.dataset.service&&
      !button.hasAttribute('data-position')&&
      !button.hasAttribute('data-tilt-position')
    ))return;
    this._invokeButton(button);
  }
  _onInput(event){
    const input=this._sliderFromEvent(event);
    if(!input)return;
    event.stopPropagation();
    const target=this.shadowRoot.querySelector(`[data-value="${CSS.escape(input.dataset.entity+'-'+input.dataset.slider)}"]`);
    if(target)target.textContent=`${input.value}%`;
    input.setAttribute('aria-valuetext',`${input.value} percent`);
  }
  _onChange(event){
    const input=this._sliderFromEvent(event);
    if(!input)return;
    event.stopPropagation();
    if(!input.disabled)this._call(input.dataset.entity,'set_cover_position',{position:Number(input.value)});
    this._queueCoverFlush();
  }
  _onKeydown(event){
    if(this._buttonFromEvent(event)||this._sliderFromEvent(event))event.stopPropagation();
  }
  _onFocusIn(event){
    const input=this._sliderFromEvent(event);
    if(input)this._focusedSlider=input;
  }
  _onFocusOut(event){
    const next=event.relatedTarget;
    if(next?.matches?.('input[data-slider]')&&this.shadowRoot.contains(next)){
      this._focusedSlider=next;
      return;
    }
    this._focusedSlider=null;
    this._queueCoverFlush();
  }
  _onWindowBlur(){
    if(this._dragging)this._finishSliderInteraction(false);
    this._focusedSlider=null;
    this._queueCoverFlush();
  }
  _onWindowPointerEnd(event){
    if(event.pointerId!==this._pointerId)return;
    Promise.resolve().then(()=>{
      if(this._dragging&&event.pointerId===this._pointerId)this._finishSliderInteraction(false);
    });
  }
  _finishSliderInteraction(commit){
    const slider=this._activeSlider;
    const pointerId=this._pointerId;
    this._dragging=false;
    this._activeSlider=null;
    this._pointerId=null;
    window.removeEventListener('pointerup',this._onWindowPointerEnd,true);
    window.removeEventListener('pointercancel',this._onWindowPointerEnd,true);
    if(slider&&pointerId!=null){
      try{if(slider.hasPointerCapture(pointerId))slider.releasePointerCapture(pointerId);}catch(_error){}
    }
    if(!commit)this._deferredCoverRender=true;
    this._queueCoverFlush();
  }
  _resetSliderInteraction(){
    const slider=this._activeSlider;
    const pointerId=this._pointerId;
    this._dragging=false;
    this._activeSlider=null;
    this._pointerId=null;
    window.removeEventListener('pointerup',this._onWindowPointerEnd,true);
    window.removeEventListener('pointercancel',this._onWindowPointerEnd,true);
    if(slider&&pointerId!=null){
      try{if(slider.hasPointerCapture(pointerId))slider.releasePointerCapture(pointerId);}catch(_error){}
    }
  }
  _hasSliderFocus(){
    return !!(this._focusedSlider&&this._focusedSlider.isConnected&&this.shadowRoot.contains(this._focusedSlider));
  }
  _interactionActive(){return !!this._dragging||this._hasSliderFocus();}
  _queueCoverFlush(){
    this._clearCoverFlushTimer();
    this._coverFlushTimer=setTimeout(()=>{
      this._coverFlushTimer=null;
      this._flushDeferredCoverRender();
    },0);
  }
  _clearCoverFlushTimer(){
    if(this._coverFlushTimer)clearTimeout(this._coverFlushTimer);
    this._coverFlushTimer=null;
  }
  _flushDeferredCoverRender(){
    if(!this.isConnected||!this._deferredCoverRender)return;
    if(this._interactionActive())return;
    this._deferredCoverRender=false;
    this._render();
  }
  _invokeButton(button){
    if(button.dataset.service)this._call(button.dataset.entity,button.dataset.service);
    else if(button.hasAttribute('data-position'))this._call(button.dataset.entity,'set_cover_position',{position:clamp(button.dataset.position)});
    else if(button.hasAttribute('data-tilt-position'))this._call(button.dataset.entity,'set_cover_tilt_position',{tilt_position:clamp(button.dataset.tiltPosition)});
  }
  _stateSignature(){
    if(!this._config||!this._hass)return '';
    return this._config.rooms.flatMap((room)=>room.entities.map((entity)=>{const state=this._hass.states?.[entity],attrs=state?.attributes||{};return [entity,state?.state,attrs.supported_features,attrs.current_position,attrs.current_tilt_position,attrs.device_class,attrs.friendly_name].join('|');})).join(';;');
  }
  _feature(state,bit){return Number(state?.attributes?.supported_features||0)&bit;}
  _position(state,key){const value=Number(state?.attributes?.[key]);return Number.isFinite(value)?clamp(value):null;}
  _state(entity){return this._hass?.states?.[entity]||null;}
  _available(entity){
    const state=this._state(entity);
    return !!state&&!['unknown','unavailable'].includes(String(state.state).toLowerCase());
  }
  _serviceSupported(entity,service){
    if(!this._available(entity))return false;
    const state=this._state(entity);
    const required={
      open_cover:FEATURE_OPEN,
      close_cover:FEATURE_CLOSE,
      set_cover_position:FEATURE_POSITION,
      stop_cover:FEATURE_STOP,
      set_cover_tilt_position:FEATURE_SET_TILT_POSITION,
    }[service];
    return !required||!!this._feature(state,required);
  }
  _syncError(){
    if(!this._card)return;
    const current=this._card.querySelector(':scope > .error');
    if(!this._error){
      if(current)current.remove();
      return;
    }
    const alert=current||document.createElement('div');
    alert.className='error';
    alert.setAttribute('role','alert');
    alert.textContent=this._error;
    if(!current)this._card.prepend(alert);
  }
  _call(entity,service,data={}){
    if(!this._hass||!this._serviceSupported(entity,service))return;
    if(service==='set_cover_position'&&!Number.isFinite(Number(data.position)))return;
    if(service==='set_cover_tilt_position'&&!Number.isFinite(Number(data.tilt_position)))return;
    if(this._error){
      this._error='';
      this._syncError();
    }
    try{
      return Promise.resolve(this._hass.callService('cover',service,{...data,entity_id:entity})).catch((error)=>{
        this._error=error?.message||'Command failed';
        this._syncError();
      });
    }catch(error){
      this._error=error?.message||'Command failed';
      this._syncError();
      return;
    }
  }
  _button(entity,service,label,icon,disabled,title){return `<button class="action" data-entity="${esc(entity)}" data-service="${service}" aria-label="${esc(label)}" title="${esc(title||label)}"${disabled?' disabled':''}><ha-icon icon="${icon}"></ha-icon><span>${esc(label)}</span></button>`;}
  _renderEntity(room,entity,index){
    const state=this._hass?.states?.[entity];
    const attrs=state?.attributes||{};
    const unavailable=!state||state.state==='unavailable'||state.state==='unknown';
    const features=Number(attrs.supported_features||0);
    const isBlind=room.kind==='blinds';
    const position=this._position(state,'current_position');
    const tilt=this._position(state,'current_tilt_position');
    const canPosition=!!(features&FEATURE_POSITION);
    const canTilt=this._config.show_tilt_buttons&&!!(features&FEATURE_SET_TILT_POSITION)&&tilt!==null;
    const friendly=attrs.friendly_name||entity;
    const configuredName=room.names[index]||(room.entities.length===1&&room.name?room.name:friendly);
    const status=unavailable?'Unavailable':(state.state==='opening'?'Opening':state.state==='closing'?'Closing':state.state==='open'?'Open':state.state==='closed'?'Closed':state.state);
    const stateValue=position===null?status:`${status} - ${position}%`;
    const mismatch=isBlind?(attrs.device_class&&!['blind','shade','curtain'].includes(attrs.device_class)):(attrs.device_class&&attrs.device_class!=='shutter');
    const disabled=(condition)=>unavailable||!condition;
    const id=`cover-${index}-${entity.replace(/[^a-z0-9]/gi,'-')}`;
    const opening=this._config.direct_single_entity?'':`<section class="cover ${unavailable?'is-unavailable':''}" aria-labelledby="${id}-name">`;
    const closing=this._config.direct_single_entity?'':'</section>';
    return `${opening}
      <div class="entity-head"><div class="entity-icon"><ha-icon icon="${esc(room.icon||(isBlind?'mdi:blinds-horizontal':'mdi:window-shutter'))}"></ha-icon></div><div class="entity-copy"><div id="${id}-name" class="entity-name">${esc(configuredName)}</div><div class="entity-meta">${esc(stateValue)}</div></div><div class="mode">${isBlind?'BLINDS':'SHUTTERS'}</div></div>
      ${mismatch?`<div class="notice" role="status"><ha-icon icon="mdi:information-outline"></ha-icon><span>Configured as ${isBlind?'blinds':'shutters'}; device class is ${esc(attrs.device_class)}.</span></div>`:''}
      <div class="actions" role="group" aria-label="${esc(friendly)} controls">
        ${this._button(entity,'open_cover','Open','mdi:arrow-up',disabled(this._feature(state,FEATURE_OPEN)),'Open cover')}
        ${this._button(entity,'stop_cover','Stop','mdi:stop',disabled(this._feature(state,FEATURE_STOP)),'Stop cover')}
        ${this._button(entity,'close_cover','Close','mdi:arrow-down',disabled(this._feature(state,FEATURE_CLOSE)),'Close cover')}
        ${!isBlind&&canPosition?`<button class="action accent" data-entity="${esc(entity)}" data-position="${room.half_open_position}" aria-label="Set light position to ${room.half_open_position}%" title="Set light position to ${room.half_open_position}%"${disabled(canPosition)?' disabled':''}><ha-icon icon="mdi:white-balance-sunny"></ha-icon><span>Light ${room.half_open_position}%</span></button>`:''}
      </div>
      ${isBlind?`<div class="features">
        ${canPosition?`<div class="slider-row"><div class="slider-label"><span>Position</span><strong data-value="${esc(entity)}-position">${position??'--'}%</strong></div><input type="range" min="0" max="100" step="1" value="${position??0}" data-entity="${esc(entity)}" data-slider="position" aria-label="${esc(friendly)} position" aria-valuetext="${position??'unknown'} percent"${disabled(canPosition)?' disabled':''}></div>`:''}
        ${canTilt?`<div class="tilt-controls"><div class="slider-label"><span>Slat tilt</span><strong>${tilt}%</strong></div><div class="tilt-actions" role="group" aria-label="${esc(friendly)} slat tilt controls">
          ${[['0','Fully closed'],['25','Slightly open'],['75','Mostly open'],['100','Fully open']].map(([value,label])=>`<button class="action tilt-action" data-entity="${esc(entity)}" data-tilt-position="${value}" aria-label="${esc(label)} slat tilt" title="${esc(`Set slat tilt to ${value}% (${label})`)}"${disabled(canTilt)?' disabled':''}>${esc(label)}</button>`).join('')}
        </div></div>`:''}
        ${!canPosition?'<div class="unsupported">Position control is not supported by this cover.</div>':''}
        ${this._config.show_tilt_buttons&&!canTilt&&!!(features&(FEATURE_OPEN_TILT|FEATURE_CLOSE_TILT|FEATURE_STOP_TILT|FEATURE_SET_TILT_POSITION))?'<div class="unsupported">Tilt position is unavailable for this entity.</div>':''}
      </div>`:''}
      ${!isBlind&&!canPosition?'<div class="unsupported">Light position is not supported by this cover.</div>':''}
    ${closing}`;
  }
  _renderRoom(room){
    return `<div class="room-group">${room.name?`<div class="room-label">${esc(room.name)}</div>`:''}${room.entities.map((entity,index)=>this._renderEntity(room,entity,index)).join('')}</div>`;
  }
  _render(){
    if(!this._config||!this._hass)return;
    if(this._interactionActive()){
      this._deferredCoverRender=true;
      return;
    }
    this._deferredCoverRender=false;
    this._lastStateSignature=this._stateSignature();
    const directSingleEntity=this._config.direct_single_entity;
    const directRoom=this._config.rooms[0];
    const directEntity=directRoom?.entities[0];
    const directLabelId=directEntity?`cover-0-${directEntity.replace(/[^a-z0-9]/gi,'-')}-name`:'';
    const content=directSingleEntity
      ? this._renderEntity(directRoom,directEntity,0)
      : this._config.rooms.map((room)=>this._renderRoom(room)).join('');
    if(!this._shell){
      this.shadowRoot.innerHTML=`<style>
      :host{display:block;width:100%;min-width:0;height:100%;box-sizing:border-box;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}
      ha-card{box-sizing:border-box;width:100%;min-width:0;min-height:100%;height:auto;background:transparent;border:0;border-radius:0;color:#f3f6fb;overflow:visible;box-shadow:none}ha-card.single-cover{padding:14px 16px;background:#212c42;border:1px solid rgba(255,255,255,.1);border-radius:20px;box-shadow:0 4px 14px rgba(0,0,0,.16)}ha-card.single-cover .error{margin:0 0 12px}.error{margin:0 12px 12px;padding:9px 11px;border-radius:10px;background:rgba(231,91,91,.15);color:#ffb4b4;font-size:12px}.room-group{box-sizing:border-box;margin:0 12px 14px;padding:14px 16px;background:#212c42;border:1px solid rgba(255,255,255,.1);border-radius:20px;box-shadow:0 4px 14px rgba(0,0,0,.16)}.room-label{padding:0 0 10px;color:#9fc8ca;font-size:12px;font-weight:700;letter-spacing:.7px;text-transform:uppercase}.cover{margin:0 0 10px;padding:13px 13px 14px;background:#26364b;border:1px solid rgba(142,166,198,.13);border-radius:16px}.cover:last-child{margin-bottom:0}.cover.is-unavailable{opacity:.72}.entity-head{display:flex;align-items:center;gap:10px}.entity-icon{width:30px;height:30px;display:grid;place-items:center;color:#72d4d1}.entity-icon ha-icon{--mdc-icon-size:21px}.entity-copy{min-width:0;flex:1}.entity-name{font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.entity-meta{margin-top:3px;color:#9eb2c9;font-size:12px}.mode{align-self:flex-start;padding:4px 7px;border-radius:7px;background:#30445d;color:#9fc8ca;font-size:9px;font-weight:700;letter-spacing:.7px}.notice{display:flex;align-items:center;gap:6px;margin-top:10px;padding:7px 9px;border-radius:9px;background:rgba(240,183,74,.12);color:#f2c87c;font-size:11px}.notice ha-icon{--mdc-icon-size:16px}.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:13px}.action{font:inherit;border:1px solid rgba(142,166,198,.2);border-radius:10px;background:#2d425b;color:#eaf1f8;min-height:38px;padding:7px 5px;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;touch-action:manipulation}.action{font-size:11px;font-weight:600}.action ha-icon{--mdc-icon-size:17px}.action.accent{grid-column:1/-1;background:#2f5a63;border-color:#477e80;color:#d8ffff}.action:hover:not(:disabled){background:#38536f}.action:focus-visible,input:focus-visible{outline:2px solid #79e5df;outline-offset:2px}.action:disabled,input:disabled{cursor:not-allowed;opacity:.35}.features{margin-top:13px}.slider-row{margin-top:10px}.slider-row:first-child{margin-top:0}.slider-label{display:flex;justify-content:space-between;gap:10px;color:#a9bdd2;font-size:11px;margin-bottom:5px}.slider-label strong{color:#e6f5f5;font-weight:650}.slider-row input{width:100%;accent-color:#70d5d2;cursor:pointer}.tilt-controls{margin-top:12px}.tilt-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.tilt-action{min-height:34px;color:#b9d2dd;font-size:10px}.unsupported{margin-top:11px;color:#879db5;font-size:11px;font-style:italic}
      :host{--cover-surface:var(--card-background-color,var(--ha-card-background,#212c42));--cover-card-radius:var(--home-cover-card-border-radius,20px);--cover-control:var(--secondary-background-color,#26364b);--cover-primary:var(--primary-text-color,#f3f6fb);--cover-secondary:var(--secondary-text-color,#9eb2c9);--cover-accent:var(--primary-color,#72d4d1);--cover-divider:var(--divider-color,rgba(142,166,198,.2));color:var(--cover-primary)}ha-card.single-cover,.room-group{background:var(--cover-surface)!important;border:1px solid var(--cover-divider)!important;border-radius:var(--cover-card-radius)!important;box-shadow:var(--ha-card-box-shadow,0 4px 14px rgba(0,0,0,.16))!important}.cover,.action{background:var(--cover-control)!important;border-color:var(--cover-divider)!important;color:var(--cover-primary)}.cover{box-shadow:0 2px 8px color-mix(in srgb,var(--cover-primary) 8%,transparent)}.room-label,.entity-meta,.mode,.slider-label,.tilt-action,.unsupported{color:var(--cover-secondary)}.mode{background:var(--cover-control)!important}.entity-icon,.action:focus-visible,input:focus-visible{color:var(--cover-accent);outline-color:var(--cover-accent)}.slider-row input{accent-color:var(--cover-accent)}.action.accent{background:color-mix(in srgb,var(--cover-accent) 36%,var(--cover-control))!important;border-color:var(--cover-accent)!important;color:var(--cover-primary)!important}.action:hover:not(:disabled){background:color-mix(in srgb,var(--cover-control) 78%,var(--cover-primary))!important}
      .room-group{margin-inline:0}
      </style><ha-card></ha-card>`;
      this._card=this.shadowRoot.querySelector('ha-card');
      this._shell=true;
    }
    this._card.classList.toggle('single-cover',directSingleEntity);
    if(directSingleEntity&&directLabelId)this._card.setAttribute('aria-labelledby',directLabelId);
    else this._card.removeAttribute('aria-labelledby');
    this._card.innerHTML=`${this._error?`<div class="error" role="alert">${esc(this._error)}</div>`:''}${content}`;
  }
}
class HomeCoverCardEditor extends HTMLElement{
  constructor(){
    super();
    this._onValueChanged=this._onValueChanged.bind(this);
  }
  setConfig(config){this._config={...config};this._updateForm();}
  set hass(value){this._hass=value;this._updateForm();}
  _ensureForm(){
    if(this._form)return;
    this.innerHTML='<ha-form></ha-form>';
    this._form=this.querySelector('ha-form');
    this._form.addEventListener('value-changed',this._onValueChanged);
  }
  _updateForm(){
    if(!this._config)return;
    this._ensureForm();
    const grouped=Array.isArray(this._config.rooms);
    this._form.hass=this._hass;
    if(grouped){
      this._form.data={show_tilt_buttons:this._config.show_tilt_buttons!==false,rooms_json:JSON.stringify(this._config.rooms,null,2)};
      this._form.schema=[{name:'show_tilt_buttons',selector:{boolean:{}}},{name:'rooms_json',selector:{text:{multiline:true}}}];
    }else{
      this._form.data={kind:this._config.kind||'blinds',entities:Array.isArray(this._config.entities)?this._config.entities:(this._config.entity?[this._config.entity]:[]),name:this._config.name||'',icon:this._config.icon||'',half_open_position:Number(this._config.half_open_position??50),show_tilt_buttons:this._config.show_tilt_buttons!==false};
      this._form.schema=[{name:'kind',selector:{select:{options:[{value:'blinds',label:'Blinds'},{value:'shutters',label:'Shutters'}]}}},{name:'entities',selector:{entity:{domain:'cover',multiple:true}}},{name:'name',selector:{text:{}}},{name:'icon',selector:{icon:{}}},{name:'half_open_position',selector:{number:{min:0,max:100,step:1,mode:'box'}}},{name:'show_tilt_buttons',selector:{boolean:{}}}];
    }
  }
  _onValueChanged(event){
    const value=event.detail?.value||{};
    const grouped=Array.isArray(this._config?.rooms);
    if(grouped){
      let rooms;
      try{rooms=JSON.parse(value.rooms_json||'[]');}catch(_error){return;}
      if(!Array.isArray(rooms))return;
      const next={...this._config,rooms,show_tilt_buttons:value.show_tilt_buttons!==false};
      delete next.name;
      this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:next},bubbles:true,composed:true}));
      return;
    }
    const entities=Array.isArray(value.entities)?value.entities:[],next={...this._config,kind:value.kind,entities};
    delete next.entity;
    if(entities.length===1)next.entity=entities[0];
    if(value.name)next.name=value.name;else delete next.name;
    if(value.icon)next.icon=value.icon;else delete next.icon;
    next.half_open_position=clamp(value.half_open_position??50);
    next.show_tilt_buttons=value.show_tilt_buttons!==false;
    this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:next},bubbles:true,composed:true}));
  }
}
if(!customElements.get('home-cover-card'))customElements.define('home-cover-card',HomeCoverCard);
if(!customElements.get('home-cover-card-editor'))customElements.define('home-cover-card-editor',HomeCoverCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some((card)=>card.type==='home-cover-card'))window.customCards.push({type:'home-cover-card',name:'Home Cover Card',description:'Dark modular cover control for blinds and shutters with optional discrete slat-tilt buttons at 0%, 25%, 75%, and 100%'});