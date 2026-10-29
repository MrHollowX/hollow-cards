/**
 * Standing Desk Card for Home Assistant
 * Four preset buttons, a live desk visual, and an animation while the desk moves.
 *
 * Install: copy this file to /config/www/hollow-cards/hollow-standing-desk-card.js, then add it under
 * Settings > Dashboards > Resources as /local/hollow-cards/hollow-standing-desk-card.js (type: JavaScript module).
 */

const DESK_CARD_VERSION = "1.0.0";

class HollowStandingDeskCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.height_entity) {
      throw new Error("hollow-standing-desk-card: 'height_entity' is required");
    }

    this._config = {
      title: "Standing Desk",
      unit: "cm",
      min_height: 65,
      max_height: 120,
      rows: 2, // 1 = all presets in one row, 2 = two rows
      setup: "desktop", // "desktop" = monitor + PC tower, "laptop" = MacBook Pro
      layout: "bottom", // "bottom" = presets below the desk, "side" = presets stacked to the right
      move_timeout: 2000, // ms without a height change before the card considers the desk stopped
      presets: [
        { button: "button.desk_preset_1", name: "Sitting", icon: "mdi:seat" },
        { button: "button.desk_preset_2", name: "Standing", icon: "mdi:human-male-height" },
        { button: "button.desk_preset_3", name: "Minimum", icon: "mdi:arrow-collapse-down" },
        { button: "button.desk_preset_4", name: "Maximum", icon: "mdi:arrow-collapse-up" },
      ],
      ...config,
    };

    this._lastHeight = null;
    this._stopTimer = null;
    this._pressTimer = null;

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this._build();
    }
    this._root.querySelector(".props").classList.toggle("laptop", this._config.setup === "laptop");
    this._root.querySelector("ha-card").classList.toggle("layout-side", this._config.layout === "side");
    this._buildPresets();
    if (this._hass) this.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    const state = hass.states[this._config.height_entity];
    if (!state || state.state === "unavailable" || state.state === "unknown") {
      this._setStatus("Unavailable", "idle");
      this._root.querySelector(".height").textContent = "--";
      return;
    }
    const height = parseFloat(state.state);
    if (!isNaN(height)) this._update(height);

    // Disable preset buttons that are unavailable
    this._root.querySelectorAll("button.preset").forEach((btn) => {
      const entity = hass.states[btn.dataset.entity];
      btn.disabled = !entity || entity.state === "unavailable";
    });
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig() {
    return { height_entity: "sensor.desk_desk_height" };
  }

  // ---------- internals ----------

  _build() {
    const root = this.shadowRoot;
    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 16px; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .title { font-size: 1.1em; font-weight: 500; color: var(--primary-text-color); }
        .height { font-size: 1.4em; font-weight: 600; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
        .unit { font-size: 0.6em; font-weight: 400; color: var(--secondary-text-color); margin-left: 2px; }

        .stage {
          --p: 0;
          position: relative;
          height: 172px;
          margin: 12px 0 8px;
        }
        .floor {
          position: absolute; bottom: 0; left: 4%; right: 4%;
          height: 3px; border-radius: 2px;
          background: var(--divider-color, #555);
        }
        .leg {
          position: absolute; bottom: 3px; width: 8px;
          border-radius: 3px 3px 0 0;
          background: var(--secondary-text-color, #888);
          height: calc(var(--travel) + 14px);
          transition: height 0.9s cubic-bezier(.4,0,.2,1);
        }
        .leg.left { left: 16%; }
        .leg.right { right: 16%; }
        .top {
          position: absolute; left: 6%; right: 6%; height: 14px;
          border-radius: 6px;
          background: linear-gradient(180deg, var(--primary-color, #03a9f4), color-mix(in srgb, var(--primary-color, #03a9f4) 70%, black));
          box-shadow: 0 3px 8px rgba(0,0,0,.25);
          bottom: calc(3px + var(--travel));
          transition: bottom 0.9s cubic-bezier(.4,0,.2,1);
        }
        /* Travel range: stage height minus desk (14px + 3px floor gap), accessories (54px), and 6px headroom */
        .stage { --reserve: 77px; --travel: calc(var(--p) * (100% - var(--reserve))); }

        /* Side layout: presets stacked to the right, shorter desk */
        .body { display: block; }
        .layout-side .body { display: flex; gap: 16px; align-items: center; }
        .layout-side .main { flex: 1; min-width: 0; }
        .layout-side .stage { height: 140px; margin: 4px 0 4px; --reserve: 69px; }
        .layout-side .props { height: 46px; }
        .layout-side .presets { flex: 0 0 auto; margin-top: 0; grid-template-columns: max-content !important; justify-items: stretch; gap: 6px; }
        .layout-side button.preset { flex-direction: row; justify-content: flex-start; padding: 8px 12px; gap: 8px; }
        .layout-side button.preset ha-icon { --mdc-icon-size: 18px; }
        .layout-side .status { min-height: 18px; }

        /* Desk accessories sit on the desk top and move with it */
        .props {
          position: absolute; left: 0; right: 0; bottom: 100%;
          height: 54px; pointer-events: none;
        }
        .props svg { display: block; width: 100%; height: 100%; overflow: visible; }
        .props .body { fill: #2b2f36; }
        .props .body-light { fill: #3d434d; }
        .props .screen { fill: url(#desk-screen); }
        .props .glass-line { stroke: rgba(255,255,255,.25); stroke-width: 1.5; fill: none; }
        .props .led { fill: var(--primary-color, #03a9f4); }
        .props .grille { fill: #0b0b0b; }
        .props .cone { fill: #000; stroke: #2a2a2a; stroke-width: 1; }
        .props .white { fill: #f5f5f5; stroke: #d4d4d4; stroke-width: 1; }
        .props .trim { fill: #d9d9d9; }
        .props .aluminum { fill: #c9cdd4; stroke: #9ea4ad; stroke-width: 1; }
        .props .keyboard-deck { fill: #8d939c; }

        /* Setup switch: desktop (monitor + PC) or laptop (MacBook Pro) */
        .props .laptop-set { display: none; }
        .props.laptop .laptop-set { display: inline; }
        .props.laptop .desktop-set { display: none; }

        /* Moving animation: legs get flowing stripes, top glows, status pulses */
        .stage.moving .leg {
          background: repeating-linear-gradient(
            180deg,
            var(--primary-color, #03a9f4) 0 6px,
            transparent 6px 12px
          );
          background-size: 100% 12px;
          animation: flow-up 0.5s linear infinite;
        }
        .stage.moving.down .leg { animation-name: flow-down; }
        .stage.moving .top { animation: glow 1s ease-in-out infinite; }
        @keyframes flow-up { from { background-position: 0 0; } to { background-position: 0 -12px; } }
        @keyframes flow-down { from { background-position: 0 0; } to { background-position: 0 12px; } }
        @keyframes glow {
          0%, 100% { box-shadow: 0 3px 8px rgba(0,0,0,.25); }
          50%      { box-shadow: 0 0 16px 2px var(--primary-color, #03a9f4); }
        }

        .status {
          display: flex; align-items: center; gap: 6px; justify-content: center;
          min-height: 22px; font-size: 0.9em; color: var(--secondary-text-color);
        }
        .arrow { display: inline-block; font-size: 1.1em; opacity: 0; }
        .stage.moving ~ .status .arrow { opacity: 1; animation: bob 0.6s ease-in-out infinite; }
        .stage.moving.down ~ .status .arrow { animation-name: bob-down; }
        @keyframes bob { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-4px);} }
        @keyframes bob-down { 0%,100% { transform: translateY(0);} 50% { transform: translateY(4px);} }
        .stage.moving ~ .status .label { color: var(--primary-color); }

        .presets {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px;
        }
        button.preset {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 4px; padding: 12px 8px; border-radius: 12px; cursor: pointer;
          border: 1px solid var(--divider-color, #444);
          background: var(--card-background-color, #1c1c1c);
          color: var(--primary-text-color); font: inherit;
          transition: transform .1s ease, background .2s ease, border-color .2s ease;
        }
        button.preset ha-icon { --mdc-icon-size: 26px; color: var(--primary-color); }
        button.preset span { font-size: 0.9em; font-weight: 500; }
        button.preset:hover { border-color: var(--primary-color); }
        button.preset:active { transform: scale(0.97); }
        button.preset:disabled { opacity: 0.4; cursor: not-allowed; }
        button.preset.pressed { background: color-mix(in srgb, var(--primary-color) 25%, transparent); border-color: var(--primary-color); }
      </style>
      <ha-card>
        <div class="header">
          <div class="title"></div>
          <div class="height"><span class="value">--</span><span class="unit"></span></div>
        </div>
        <div class="body">
        <div class="main">
        <div class="stage">
          <div class="floor"></div>
          <div class="leg left"></div>
          <div class="leg right"></div>
          <div class="top">
            <div class="props">
              <svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
                <defs>
                  <linearGradient id="desk-screen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#1e3a5f"/>
                    <stop offset="1" stop-color="#0d1b2e"/>
                  </linearGradient>
                </defs>

                <!-- Left speaker -->
                <rect class="white" x="40" y="46" width="24" height="44" rx="3"/>
                <circle class="cone" cx="52" cy="58" r="6"/>
                <circle class="cone" cx="52" cy="76" r="8"/>

                <!-- Desktop: monitor -->
                <g class="desktop-set">
                  <rect class="body-light" x="82" y="8" width="96" height="60" rx="4"/>
                  <rect class="screen" x="87" y="13" width="86" height="48" rx="2"/>
                  <path class="glass-line" d="M92 20 H140 M92 28 H128 M92 36 H150"/>
                  <circle class="led" cx="130" cy="64" r="1.5"/>
                  <rect class="body" x="120" y="68" width="20" height="12"/>
                  <rect class="body" x="104" y="80" width="52" height="5" rx="2"/>
                </g>

                <!-- Laptop: MacBook Pro -->
                <g class="laptop-set">
                  <rect class="aluminum" x="88" y="24" width="84" height="56" rx="4"/>
                  <rect class="screen" x="92" y="28" width="76" height="48" rx="2"/>
                  <path class="glass-line" d="M98 36 H150 M98 44 H136 M98 52 H158"/>
                  <path class="aluminum" d="M78 80 H182 L186 87 H74 Z"/>
                  <path class="keyboard-deck" d="M100 82 H160 L162 85 H98 Z"/>
                </g>

                <!-- Right speaker -->
                <rect class="white" x="190" y="46" width="24" height="44" rx="3"/>
                <circle class="cone" cx="202" cy="58" r="6"/>
                <circle class="cone" cx="202" cy="76" r="8"/>

                <!-- Desktop: PC tower -->
                <g class="desktop-set">
                  <rect class="white" x="220" y="8" width="52" height="82" rx="4"/>
                  <rect class="trim" x="226" y="15" width="40" height="5" rx="1"/>
                  <rect class="grille" x="226" y="28" width="40" height="34" rx="2"/>
                  <circle class="led" cx="246" cy="72" r="3"/>
                </g>
              </svg>
            </div>
          </div>
        </div>
        <div class="status">
          <span class="arrow">▲</span>
          <span class="label">Idle</span>
        </div>
        </div>
        <div class="presets"></div>
        </div>
      </ha-card>
    `;
    this._root = root;
    this._stage = root.querySelector(".stage");
    this._valueEl = root.querySelector(".value");
  }

  _buildPresets() {
    const container = this._root.querySelector(".presets");
    const cfg = this._config;
    const rows = Math.max(1, Math.min(2, Number(cfg.rows) || 2));
    const columns = cfg.layout === "side" ? 1 : Math.max(1, Math.ceil(cfg.presets.length / rows));
    container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    container.innerHTML = "";
    this._root.querySelector(".title").textContent = cfg.title;
    this._root.querySelector(".unit").textContent = cfg.unit;

    cfg.presets.forEach((preset) => {
      const btn = document.createElement("button");
      btn.className = "preset";
      btn.dataset.entity = preset.button;
      btn.innerHTML = `<ha-icon icon="${preset.icon || "mdi:table-furniture"}"></ha-icon><span>${preset.name}</span>`;
      btn.addEventListener("click", () => this._press(preset.button, btn));
      container.appendChild(btn);
    });
  }

  _press(entityId, btn) {
    const entity = this._hass?.states?.[entityId];
    if (!entity || entity.state === "unavailable" || entity.state === "unknown") return;
    this._hass.callService("button", "press", { entity_id: entityId });
    btn.classList.add("pressed");
    clearTimeout(this._pressTimer);
    this._pressTimer = setTimeout(() => btn.classList.remove("pressed"), 600);
  }

  _update(height) {
    const cfg = this._config;
    const last = this._lastHeight;

    if (last !== null && Math.abs(height - last) > 0.05) {
      this._setMoving(true, height > last ? "up" : "down");
      clearTimeout(this._stopTimer);
      this._stopTimer = setTimeout(() => this._setMoving(false), cfg.move_timeout);
    }
    this._lastHeight = height;

    const range = cfg.max_height - cfg.min_height;
    const p = Math.min(1, Math.max(0, (height - cfg.min_height) / range));
    this._stage.style.setProperty("--p", p.toFixed(4));
    this._valueEl.textContent = height.toFixed(1);
  }

  _setMoving(moving, direction) {
    this._stage.classList.toggle("moving", moving);
    if (moving) {
      this._stage.classList.toggle("down", direction === "down");
      this._setStatus(direction === "up" ? "Rising" : "Lowering", "moving");
      this._root.querySelector(".arrow").textContent = direction === "up" ? "▲" : "▼";
    } else {
      this._stage.classList.remove("down");
      this._setStatus("Idle", "idle");
    }
  }

  _setStatus(text, mode) {
    this._root.querySelector(".label").textContent = text;
    if (mode === "idle") this._stage.classList.remove("moving", "down");
  }
}

customElements.define("hollow-standing-desk-card", HollowStandingDeskCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "hollow-standing-desk-card",
  name: "Hollow Standing Desk Card",
  description: "Four desk presets with a live height visual and movement animation",
  preview: true,
});

console.info(`%c HOLLOW-STANDING-DESK-CARD %c v${DESK_CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: #03a9f4; background: white; font-weight: 700;");