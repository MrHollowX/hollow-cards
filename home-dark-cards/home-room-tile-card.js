class HomeRoomTileCard extends HTMLElement {
  setConfig(c){ if(!c.name) throw new Error('name required'); this._c=c; this._lastRenderSignature=null; }
  getCardSize(){ return 2; }
  set hass(h){ this._hass=h; this._render(); }
  _st(e){ if(!e) return 'unavailable'; const s=this._hass.states[e]; return s? s.state:'unavailable'; }
  _attr(e,a,d){ if(!e) return d; const s=this._hass.states[e]; return s && s.attributes[a]!=null? s.attributes[a]:d; }
  _temperatureUnit(e){
    const entityUnit=this._attr(e,'temperature_unit',null)||this._attr(e,'unit_of_measurement',null);
    if(typeof entityUnit==='string'&&entityUnit.trim()) return entityUnit.trim();
    const configuredUnit=this._hass&&this._hass.config&&this._hass.config.unit_system
      ? this._hass.config.unit_system.temperature : '';
    if(typeof configuredUnit==='string'&&configuredUnit.trim()) return configuredUnit.trim();
    return '\u00b0C';
  }
  _esc(value){ return String(value==null?'':value).replace(/[&<>"']/g, character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
  _more(e){ if(!e) return; this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:e},bubbles:true,composed:true})); }
  _popupHash(){
    if(typeof this._c.popup_hash!=='string') return '';
    const hash=this._c.popup_hash.trim();
    return hash ? (hash.startsWith('#')?hash:'#'+hash) : '';
  }
  _open(){
    const hash=this._popupHash();
    if(hash){ window.location.hash=hash; return; }
    this._more(this._c.light_group_entity||this._c.climate_entity);
  }
  _stateSignature(){
    const c=this._c, fields=[
      c.light_group_entity,c.climate_entity,c.cover_entity,c.media_entity,c.motion_entity
    ];
    return [
      c.name,c.icon,this._hass&&this._hass.config&&this._hass.config.unit_system
        ? this._hass.config.unit_system.temperature : '',
      ...fields.map((entity)=>{
        if(!entity)return '';
        const state=this._hass.states[entity], attrs=state&&state.attributes?state.attributes:{};
        return [
          entity,state?state.state:'unavailable',
          attrs.current_temperature==null?'':attrs.current_temperature,
          attrs.current_humidity==null?'':attrs.current_humidity,
          attrs.temperature_unit==null?'':attrs.temperature_unit,
          attrs.unit_of_measurement==null?'':attrs.unit_of_measurement,
        ].join('|');
      }),
    ].join(';;');
  }
  _render(){
    if(!this._hass) return;
    const c=this._c;
    const stateSignature=this._stateSignature();
    if(this._shell && stateSignature===this._lastRenderSignature)return;
    this._lastRenderSignature=stateSignature;
    const on = c.light_group_entity && this._st(c.light_group_entity)==='on';
    const temp = c.climate_entity? this._attr(c.climate_entity,'current_temperature','--') : null;
    const hum = c.climate_entity? this._attr(c.climate_entity,'current_humidity','') : '';
    const temperatureText = temp==null || temp==='--'
      ? '--'
      : `${this._esc(temp)} ${this._esc(this._temperatureUnit(c.climate_entity))}`;
    const domainIcons=[];
    if(c.light_group_entity) domainIcons.push('mdi:lightbulb-outline');
    if(c.motion_entity) domainIcons.push('mdi:motion-sensor');
    if(c.media_entity) domainIcons.push('mdi:music');
    if(c.climate_entity) domainIcons.push('mdi:thermometer');
    if(c.cover_entity) domainIcons.push('mdi:blinds');
    if(!this._shell){
      this.innerHTML=`<style>${this._css()}</style><div class="tile"><ha-icon class="mainicon" style="--mdc-icon-size:26px"></ha-icon><div class="name"></div><div class="sub"></div><div class="icons"></div></div>`;
      this._shell=true;
      this._tile=this.querySelector('.tile');
      this._mainicon=this.querySelector('.mainicon');
      this._name=this.querySelector('.name');
      this._sub=this.querySelector('.sub');
      this._icons=this.querySelector('.icons');
      this._tile.addEventListener('click', ()=>this._open());
    }
    this._mainicon.setAttribute('icon', c.icon||'mdi:home');
    this._name.innerHTML=c.name;
    this._sub.innerHTML= temp!=null? `${temperatureText}${hum?' &middot; '+this._esc(hum)+'%':''}` : '';
    this._icons.innerHTML= domainIcons.map(i=>`<ha-icon icon="${i}" style="--mdc-icon-size:13px"></ha-icon>`).join('') + (on? `<span class="tag">on</span>`:'');
  }
  _css(){
    return `
    :host{ display:block; min-width:0; height:100%; font-family:-apple-system,'Segoe UI',Helvetica,sans-serif; }
    .tile{ background:#212c42; border-radius:22px; padding:16px 12px 14px; min-height:120px; height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; text-align:center; color:#fff; }
    .name{ font-size:14px; font-weight:700; }
    .sub{ min-height:14px; font-size:11.5px; color:#8fa0b8; }
    .icons{ display:flex; gap:6px; color:#5f7091; align-items:center; margin-top:2px; min-height:13px; }
    .tag{ font-size:10px; font-weight:700; color:#ffb340; background:rgba(255,179,64,.14); border-radius:999px; padding:2px 7px; }
    `;
  }
}
customElements.define('home-room-tile-card', HomeRoomTileCard);
window.customCards = window.customCards || [];
window.customCards.push({type:'home-room-tile-card', name:'Home Room Tile', description:'Room summary tile (tap for more-info or configured popup hash)'});
