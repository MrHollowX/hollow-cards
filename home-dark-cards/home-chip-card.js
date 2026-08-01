class HomeChipCard extends HTMLElement {
  setConfig(c){ if(!c.entity) throw new Error('entity required'); this._c=c; }
  getCardSize(){ return 1; }
  set hass(h){ this._hass=h; this._render(); }
  _st(e){ const s=this._hass.states[e]; return s? s.state:'unavailable'; }
  _attr(e,a,d){ const s=this._hass.states[e]; return s && s.attributes[a]!=null? s.attributes[a]:d; }
  _more(){ this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:this._c.entity},bubbles:true,composed:true})); }
  _render(){
    if(!this._hass) return;
    const c=this._c, kind=c.kind||'entity';
    let icon='mdi:circle', text='', active=false, avatar='';
    if(kind==='person'){
      const home=this._st(c.entity)==='home';
      const pic=this._attr(c.entity,'entity_picture','');
      avatar = pic? `<img class="avatar" src="${pic}">` : `<div class="avatar init">${(c.label||'?')[0]}</div>`;
      text = `${c.label||''} &middot; ${home?'Home':'Away'}`;
      active = home;
    } else if(kind==='lock'){
      const locked=this._st(c.entity)==='locked';
      icon = locked? 'mdi:lock':'mdi:lock-open-variant';
      text = c.label||'';
      active = locked;
    } else if(kind==='light-group'){
      const members=this._attr(c.entity,'entity_id',[]);
      const on = (Array.isArray(members) && members.length)? members.filter(m=>this._st(m)==='on').length : (this._st(c.entity)==='on'?1:0);
      icon='mdi:lightbulb';
      text = c.label!=null? `${c.label} ${on}` : `${on}`;
      active = on>0;
    } else {
      icon = c.icon||'mdi:circle';
      text = c.label|| this._attr(c.entity,'friendly_name','');
      active = this._st(c.entity)==='on';
    }
    if(!this._shell){
      this.innerHTML=`<style>${this._css()}</style><div class="chip"><span class="ico"></span><span class="txt"></span></div>`;
      this._shell=true;
      this._chip=this.querySelector('.chip');
      this._ico=this.querySelector('.ico');
      this._txt=this.querySelector('.txt');
      this._chip.addEventListener('click', ()=>this._more());
    }
    this._chip.classList.toggle('active', !!active);
    this._ico.innerHTML = avatar || `<ha-icon icon="${icon}" style="--mdc-icon-size:16px"></ha-icon>`;
    this._txt.innerHTML = text;
  }
  _css(){
    return `
    :host{ display:block; min-width:0; font-family:-apple-system,'Segoe UI',Helvetica,sans-serif; }
    .chip{ display:flex; align-items:center; justify-content:center; gap:6px; min-width:0; background:#243048; border-radius:999px; padding:5px 8px 5px 5px; font-size:12px; font-weight:600; color:#fff; cursor:pointer; white-space:normal; overflow-wrap:anywhere; }
    .chip.active{ color:#ffb340; }
    .chip:not(.active) .avatar{ filter:grayscale(1); opacity:.72; }
    .avatar{ width:22px; height:22px; border-radius:50%; object-fit:cover; display:flex; align-items:center; justify-content:center; background:#3d4a66; font-size:10px; font-weight:700; flex:none; }
    .txt{ min-width:0; text-align:center; }
    `;
  }
}
customElements.define('home-chip-card', HomeChipCard);
window.customCards = window.customCards || [];
window.customCards.push({type:'home-chip-card', name:'Home Chip', description:'Small status chip (person / lock / light group)'});
