class HomeRowCard extends HTMLElement {
  setConfig(c){
    if(!c.kind) throw new Error('kind required');
    this._c={
      ...c,
      tap_action:c.tap_action||{action:c.kind==='light'?'none':'more-info'},
      hold_action:c.hold_action||{action:'none'},
      double_tap_action:c.double_tap_action||{action:'none'},
    };
    this._lastRenderSignature=null;
  }
  getCardSize(){ return 1; }
  set hass(h){ this._hass=h; this._render(); }
  _st(e){ if(!e) return 'unavailable'; const s=this._hass.states[e]; return s? s.state:'unavailable'; }
  _attr(e,a,d){ if(!e) return d; const s=this._hass.states[e]; return s && s.attributes[a]!=null? s.attributes[a]:d; }
  _num(e,d){ const v=parseFloat(this._st(e)); return isNaN(v)?d:v; }
  _call(domain,service,entity,data){ this._hass.callService(domain,service,Object.assign({entity_id:entity},data||{})); }
  _more(e){ if(!e) return; this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:e},bubbles:true,composed:true})); }
  _actionConfig(kind){
    const configured=this._c[`${kind}_action`];
    return typeof configured==='string'?{action:configured}:configured||{action:'none'};
  }
  _toggleLight(entity){
    if(!entity||this._st(entity)==='unavailable')return;
    if(entity===this._c.entity&&this._st(entity)!=='on'&&this._lightDimmable(entity)){
      this._clearToggleAnimation();
      this._toggleAnimationEntity=entity;
      this._toggleAnimationTimer=setTimeout(()=>this._clearToggleAnimation(),5000);
    }
    this._call(entity.split('.')[0],'toggle',entity);
  }
  _runLightAction(kind){
    const actionConfig=this._actionConfig(kind);
    const action=actionConfig.action||'none';
    const entity=actionConfig.entity||this._c.entity;
    if(action==='none')return;
    if(action==='toggle'){ this._toggleLight(entity); return; }
    if(action==='more-info'){ this._more(entity); return; }
    if(action==='perform-action'||action==='call-service'){
      const serviceName=actionConfig.perform_action||actionConfig.service;
      if(!serviceName)return;
      const [domain,service]=serviceName.split('.',2);
      if(domain&&service)this._hass.callService(domain,service,actionConfig.data||actionConfig.service_data||{},actionConfig.target);
      return;
    }
    if(action==='navigate'&&actionConfig.navigation_path){
      window.history.pushState({},'',actionConfig.navigation_path);
      window.dispatchEvent(new Event('location-changed'));
      return;
    }
    if(action==='url'&&actionConfig.url_path){ window.open(actionConfig.url_path,'_blank','noopener'); return; }
    if(action==='fire-dom-event')this.dispatchEvent(new CustomEvent('ll-custom',{detail:actionConfig,bubbles:true,composed:true}));
  }
  _lightDimmable(entity){
    const modes=this._attr(entity,'supported_color_modes',[]);
    return Array.isArray(modes) && modes.some(m=>m!=='onoff');
  }
  _lightIcon(on){
    const stateIcon=on?this._c.icon_on:this._c.icon_off;
    if(typeof stateIcon==='string'&&stateIcon.trim())return stateIcon;
    if(typeof this._c.icon==='string'&&this._c.icon.trim())return this._c.icon;
    return 'mdi:lightbulb';
  }

  connectedCallback(){
    if(this._wired) return; this._wired=true;
    this._onPointerDown=this._onPointerDown.bind(this);
    this._onPointerMove=this._onPointerMove.bind(this);
    this._onPointerUp=this._onPointerUp.bind(this);
    this._onPointerCancel=this._onPointerCancel.bind(this);
    this._onLostPointerCapture=this._onLostPointerCapture.bind(this);
    this._onWindowBlur=this._onWindowBlur.bind(this);
    this._onClick=this._onClick.bind(this);
    this._onKeydown=this._onKeydown.bind(this);
    this.addEventListener('pointerdown',this._onPointerDown);
    this.addEventListener('pointermove',this._onPointerMove);
    this.addEventListener('pointerup',this._onPointerUp);
    this.addEventListener('pointercancel',this._onPointerCancel);
    this.addEventListener('lostpointercapture',this._onLostPointerCapture);
    this.addEventListener('click',this._onClick);
    this.addEventListener('keydown',this._onKeydown);
    window.addEventListener('blur',this._onWindowBlur);
  }

  disconnectedCallback(){
    if(!this._wired)return;
    this._cancelSlider();
    this._clearGestureTimers();
    this._clearToggleAnimation();
    this._cancelBrightnessAnimation();
    this.removeEventListener('pointerdown',this._onPointerDown);
    this.removeEventListener('pointermove',this._onPointerMove);
    this.removeEventListener('pointerup',this._onPointerUp);
    this.removeEventListener('pointercancel',this._onPointerCancel);
    this.removeEventListener('lostpointercapture',this._onLostPointerCapture);
    this.removeEventListener('click',this._onClick);
    this.removeEventListener('keydown',this._onKeydown);
    window.removeEventListener('blur',this._onWindowBlur);
    this._wired=false;
  }

  _sliderFromEvent(ev){
    const target=ev.target;
    return target&&typeof target.closest==='function'?target.closest('.sl'):null;
  }
  _actionTarget(ev){
    const target=ev.target;
    return target&&typeof target.closest==='function'?target.closest('[data-action]'):null;
  }

  _onPointerDown(ev){
    const sl=this._sliderFromEvent(ev);
    if(sl){
      if(this._dragging)return;
      ev.stopPropagation();
      ev.preventDefault();
      this._dragging=true;
      this._activeSlider=sl;
      this._pointerId=ev.pointerId;
      try{sl.setPointerCapture(ev.pointerId);}catch(_error){}
      this._updateSliderFromPointer(sl,ev.clientX);
      return;
    }
    if(this._c.kind!=='light'||!this._actionTarget(ev))return;
    ev.stopPropagation();
    if(this._holdTimer)clearTimeout(this._holdTimer);
    this._holdTimer=setTimeout(()=>{
      this._holdTimer=null;
      this._suppressNextClick=true;
      this._runLightAction('hold');
    },550);
  }

  _onPointerMove(ev){
    if(!this._dragging||!this._activeSlider||ev.pointerId!==this._pointerId)return;
    ev.stopPropagation();
    ev.preventDefault();
    this._updateSliderFromPointer(this._activeSlider,ev.clientX);
  }

  _onPointerUp(ev){
    if(this._dragging&&this._activeSlider&&ev.pointerId===this._pointerId){
      ev.stopPropagation();
      ev.preventDefault();
      this._finishSlider(true);
      return;
    }
    if(this._c.kind!=='light'||!this._actionTarget(ev))return;
    ev.stopPropagation();
    if(this._holdTimer){ clearTimeout(this._holdTimer); this._holdTimer=null; }
  }

  _onPointerCancel(ev){
    if(this._dragging&&this._activeSlider&&ev.pointerId===this._pointerId){
      ev.stopPropagation();
      this._finishSlider(false);
      return;
    }
    if(this._holdTimer){ clearTimeout(this._holdTimer); this._holdTimer=null; }
  }

  _onLostPointerCapture(ev){
    if(this._dragging&&ev.pointerId===this._pointerId)this._finishSlider(false);
  }

  _onWindowBlur(){
    if(this._dragging)this._finishSlider(false);
    this._clearGestureTimers();
  }

  _onClick(ev){
    const c=this._c, e=c.entity;
    if(this._sliderFromEvent(ev)){ ev.stopPropagation(); return; }
    if(ev.target.closest('[data-toggle]')){
      ev.stopPropagation();
      ev.preventDefault();
      if(c.kind==='light')this._toggleLight(e); else this._call(e.split('.')[0],'toggle',e);
      return;
    }
    if(ev.target.closest('[data-mediatoggle]')){ this._call('media_player','media_play_pause',e); return; }
    if(ev.target.closest('[data-vac]')){ const cleaning=this._st(e)==='cleaning'; this._call('vacuum', cleaning?'return_to_base':'start', e); return; }
    if(ev.target.closest('[data-more]')){ this._more(c.kind==='tesla'? c.charge_switch : e); return; }
    if(c.kind!=='light'||!this._actionTarget(ev))return;
    ev.stopPropagation();
    if(this._suppressNextClick){ this._suppressNextClick=false; return; }
    this._queueTap();
  }
  _onKeydown(ev){
    if(this._c.kind!=='light'||(ev.key!=='Enter'&&ev.key!==' ')||!this._actionTarget(ev))return;
    ev.preventDefault();
    ev.stopPropagation();
    this._clearGestureTimers();
    this._suppressNextClick=true;
    this._runLightAction('tap');
    setTimeout(()=>{this._suppressNextClick=false;},0);
  }
  _clearGestureTimers(){
    if(this._tapTimer)clearTimeout(this._tapTimer);
    if(this._holdTimer)clearTimeout(this._holdTimer);
    this._tapTimer=null;
    this._holdTimer=null;
  }
  _queueTap(){
    if(this._tapTimer){
      clearTimeout(this._tapTimer);
      this._tapTimer=null;
      this._runLightAction('double_tap');
      return;
    }
    this._tapTimer=setTimeout(()=>{
      this._tapTimer=null;
      this._runLightAction('tap');
    },260);
  }

  _finishSlider(commit){
    const slider=this._activeSlider;
    if(!slider)return;
    const pointerId=this._pointerId;
    if(commit)this._commitSlider(slider);
    this._dragging=false;
    this._activeSlider=null;
    this._pointerId=null;
    this._lastRenderSignature=null;
    try{
      if(pointerId!=null&&slider.hasPointerCapture(pointerId))slider.releasePointerCapture(pointerId);
    }catch(_error){}
    this._render();
  }

  _cancelSlider(){
    const slider=this._activeSlider;
    const pointerId=this._pointerId;
    this._dragging=false;
    this._activeSlider=null;
    this._pointerId=null;
    try{
      if(slider&&pointerId!=null&&slider.hasPointerCapture(pointerId))slider.releasePointerCapture(pointerId);
    }catch(_error){}
  }

  _updateSliderFromPointer(el, clientX){
    const rect=el.getBoundingClientRect();
    const min=parseFloat(el.min)||0, max=parseFloat(el.max)||100;
    let pct=rect.width>0? (clientX-rect.left)/rect.width : 0;
    pct=Math.max(0,Math.min(1,pct));
    const val=Math.round(min+pct*(max-min));
    el.value=val;
    const fill=el.parentElement.querySelector('.bar-fill');
    if(fill) fill.style.width=val+'%';
    return val;
  }
  _commitSlider(el){
    const field=el.dataset.field, val=+el.value;
    this._call(el.dataset.d, el.dataset.sv, el.dataset.e, {[field]:val});
  }
  _clearToggleAnimation(){
    if(this._toggleAnimationTimer)clearTimeout(this._toggleAnimationTimer);
    this._toggleAnimationTimer=null;
    this._toggleAnimationEntity=null;
  }
  _cancelBrightnessAnimation(){
    if(this._brightnessAnimationFrame)cancelAnimationFrame(this._brightnessAnimationFrame);
    this._brightnessAnimationFrame=null;
  }
  _animateBrightnessFill(fill,targetWidth){
    if(!fill)return;
    this._cancelBrightnessAnimation();
    this._brightnessAnimationFrame=requestAnimationFrame(()=>{
      this._brightnessAnimationFrame=requestAnimationFrame(()=>{
        fill.style.width=targetWidth+'%';
        this._brightnessAnimationFrame=null;
      });
    });
  }
  _ic(i,cls){ return `<ha-icon icon="${i}" class="${cls||''}" style="--mdc-icon-size:20px"></ha-icon>`; }

  _render(){
    if(!this._hass || this._dragging) return;
    const c=this._c, kind=c.kind, e=c.entity;
    const state=this._hass.states[e];
    const attrs=state&&state.attributes?state.attributes:{};
    const renderSignature=[
      kind,e,c.name||'',c.icon||'',c.icon_on||'',c.icon_off||'',c.battery_entity||'',c.charge_switch||'',
      state?state.state:'unavailable',
      attrs.brightness==null?'':attrs.brightness,
      Array.isArray(attrs.supported_color_modes)?attrs.supported_color_modes.join(','):'',
      attrs.current_position==null?'':attrs.current_position,
      attrs.media_title==null?'':attrs.media_title,
      attrs.source==null?'':attrs.source,
      this._st(c.battery_entity),
      this._st(c.charge_switch),
    ].join('|');
    if(this._shell && renderSignature===this._lastRenderSignature)return;
    this._lastRenderSignature=renderSignature;
    let html='';
    if(kind==='light'){
      const on=this._st(e)==='on';
      const dimmable=this._lightDimmable(e);
      const bri=dimmable? Math.round((this._attr(e,'brightness',0)/255)*100):null;
      const animateBrightness=dimmable&&on&&this._toggleAnimationEntity===e;
      if(animateBrightness)this._clearToggleAnimation();
      html=`<div class="row-top">
        <div class="row-left" data-action role="button" tabindex="0" aria-label="Light actions for ${c.name||'Light'}">${this._ic(this._lightIcon(on),on?'ic-amber':'ic-mute')}
          <div><div class="row-name">${c.name||''}</div><div class="row-sub">${on?(bri!=null?'On &middot; '+bri+'%':'On'):'Off'}</div></div>
        </div>
        <button class="toggle ${on?'on':''}" data-toggle><span class="knob"></span></button>
      </div>
      ${dimmable?`<div class="slider-wrap"><div class="bar"><div class="bar-fill amber" style="width:${animateBrightness?0:on?bri:0}%"></div></div><input type="range" class="sl amber" min="0" max="100" value="${on?bri:0}" data-d="light" data-sv="turn_on" data-e="${e}" data-field="brightness_pct"></div>`:''}`;
    } else if(kind==='cover'){
      const pos=this._attr(e,'current_position', this._st(e)==='open'?100:0);
      html=`<div class="row-top"><div class="row-name">${c.name||'Blinds'}</div><div class="row-sub">${pos>0?'Open':'Closed'} &middot; ${pos}%</div></div>
      <div class="slider-wrap"><div class="bar"><div class="bar-fill blue" style="width:${pos}%"></div></div><input type="range" class="sl" min="0" max="100" value="${pos}" data-d="cover" data-sv="set_cover_position" data-e="${e}" data-field="position"></div>`;
    } else if(kind==='media'){
      const playing=this._st(e)==='playing';
      const title=this._attr(e,'media_title', playing?'Playing':'Idle');
      const src=this._attr(e,'source','');
      html=`<div class="card-row">${this._ic('mdi:television','')}
        <div style="flex:1"><div class="row-name">${c.name||this._attr(e,'friendly_name','Media')}</div><div class="row-sub">${playing?'Playing':'Idle'}${title&&playing?' &middot; '+title:''}${src?' &middot; '+src:''}</div></div>
        <button class="round-btn" data-mediatoggle>${this._ic(playing?'mdi:pause':'mdi:play')}</button>
      </div>`;
    } else if(kind==='vacuum'){
      const s=this._st(e), cleaning=s==='cleaning';
      html=`<div class="card-row">${this._ic('mdi:robot-vacuum','ic-lg')}
        <div style="flex:1"><div class="row-name">${c.name||'Vacuum'}</div><div class="row-sub">${cleaning?'Cleaning':s==='docked'?'Docked':s}</div></div>
        <button class="pill ${cleaning?'on':''}" data-vac>${cleaning?'STOP':'CLEAN'}</button>
      </div>`;
    } else if(kind==='tesla'){
      const bat=Math.round(this._num(c.battery_entity,0));
      const charging=this._st(c.charge_switch)==='on';
      html=`<div class="card-row" data-more>${this._ic('mdi:car-electric','ic-lg')}
        <div style="flex:1"><div class="row-name">${c.name||'Tesla'}</div><div class="row-sub">${charging?'Charging &middot; ':''}${bat}%</div></div>
      </div>`;
    }
    if(!this._shell){
      this.innerHTML=`<style>${this._css()}</style><ha-card class="row-card"></ha-card>`;
      this._shell=true;
      this._card=this.querySelector('.row-card');
    }
    this._card.innerHTML=html;
    if(kind==='light'&&animateBrightness)this._animateBrightnessFill(this._card.querySelector('.bar-fill'),bri);
  }
  _css(){
    return `
    :host{ font-family:-apple-system,'Segoe UI',Helvetica,sans-serif; }
    .row-card{ background:#212c42; color:#fff; border-radius:20px; padding:14px 16px; }
    .row-top{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
    .row-left{ display:flex; gap:10px; align-items:center; cursor:pointer; flex:1; min-width:0; }
    .row-name{ font-size:14px; font-weight:700; }
    .row-sub{ font-size:11.5px; color:#8fa0b8; }
    .row-sub.upper{ text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
    .card-row{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
    .slider-wrap{ position:relative; height:28px; margin-top:10px; }
    .bar{ position:absolute; left:0; right:0; top:50%; transform:translateY(-50%); height:6px; border-radius:3px; background:#2c3852; overflow:hidden; pointer-events:none; }
    .bar-fill{ height:100%; transition:width 1s cubic-bezier(.2,.8,.2,1); }
    .bar-fill.amber{ background:#ffb340; }
    .bar-fill.blue{ background:#3d8bfd; }
    .sl{ position:absolute; left:0; top:0; -webkit-appearance:none; appearance:none; width:100%; height:28px; margin:0; background:transparent; touch-action:none; cursor:pointer; }
    .sl::-webkit-slider-runnable-track{ background:transparent; height:28px; }
    .sl::-moz-range-track{ background:transparent; height:28px; }
    .sl::-webkit-slider-thumb{ -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:#3d8bfd; cursor:pointer; margin-top:4px; }
    .sl::-moz-range-thumb{ width:20px; height:20px; border-radius:50%; background:#3d8bfd; cursor:pointer; border:0; }
    .sl.amber::-webkit-slider-thumb{ background:#ffb340; }
    .sl.amber::-moz-range-thumb{ background:#ffb340; }
    .toggle{ all:unset; cursor:pointer; width:44px; height:26px; border-radius:999px; background:#2c3852; position:relative; flex:none; }
    .toggle.on{ background:#ffb340; }
    .toggle .knob{ position:absolute; left:3px; top:3px; width:20px; height:20px; border-radius:50%; background:#66758f; transition:left .15s; }
    .toggle.on .knob{ left:21px; background:#1a2433; }
    .round-btn{ all:unset; cursor:pointer; width:36px; height:36px; border-radius:50%; background:#2c3852; display:flex; align-items:center; justify-content:center; }
    .pill{ all:unset; cursor:pointer; font-weight:700; font-size:12px; padding:8px 16px; border-radius:999px; background:#2c3852; color:#fff; }
    .pill.on{ background:#ec3013; }
    .ic-amber{ color:#ffb340; }
    .ic-mute{ color:#66758f; }
    .ic-lg{ --mdc-icon-size:28px!important; }
    @media (prefers-reduced-motion:reduce){ .bar-fill{ transition:none; } }
    `;
  }
}
customElements.define('home-row-card', HomeRowCard);
window.customCards = window.customCards || [];
window.customCards.push({type:'home-row-card', name:'Home Row', description:'Single-entity control row: light, cover, media, vacuum or tesla'});
