import {
  assignJob,
  createGame,
  getInventorySlots,
  getLimbs,
  getSquadPower,
  getVisibleJobs,
  getWorldObjects,
  moveSquadTo,
  recruitDrifter,
  stepGame,
  tradeAtTown,
} from './engine.js';
import './styles.css';

const game = createGame();
const jobs = getVisibleJobs();
const limbs = getLimbs();
let selectedTown = 'Waystation Kudu';
let selectedWorldId = null;
let camera = { x: 50, y: 52, zoom: 1 };
let last = performance.now();

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="game-shell">
    <header class="hud-top">
      <div class="brand-block">
        <p class="eyebrow">Squad sandbox RPG prototype</p>
        <h1>Dustwake</h1>
      </div>
      <div class="resource-strip">
        <div><b id="cats"></b><span>Cats</span></div>
        <div><b id="food"></b><span>Food</span></div>
        <div><b id="water"></b><span>Water</span></div>
        <div><b id="power"></b><span>Power</span></div>
      </div>
      <div class="time-controls">
        <button id="pauseBtn">Pause</button>
        <button data-speed="1">1×</button>
        <button data-speed="3">3×</button>
        <button data-speed="8">8×</button>
      </div>
    </header>

    <section class="game-layout">
      <aside class="side-panel left-stack">
        <section class="panel squad-panel">
          <div class="panel-title"><h2>Squad</h2><span id="squadCount"></span></div>
          <div id="squad" class="squad-list"></div>
          <button id="recruitBtn" class="primary wide">Recruit drifter — 75 cats</button>
        </section>
        <section class="panel inventory-panel">
          <div class="panel-title"><h2>Inventory</h2><span id="carryWeight"></span></div>
          <div id="inventory" class="inventory-grid"></div>
        </section>
      </aside>

      <section class="world-frame">
        <div class="world-toolbar">
          <span id="locationReadout"></span>
          <span>Left-click map to move squad · click labels to inspect</span>
        </div>
        <canvas id="map" width="1320" height="860"></canvas>
        <div id="worldTooltip" class="world-tooltip hidden"></div>
      </section>

      <aside class="side-panel right-stack">
        <section class="panel details-panel">
          <div class="panel-title"><h2 id="selectedName">Selected</h2><span id="selectedState"></span></div>
          <div id="details"></div>
          <h3>Jobs</h3>
          <div id="jobButtons" class="job-grid"></div>
        </section>
        <section class="panel world-panel">
          <div class="panel-title"><h2>World</h2><span>POIs</span></div>
          <div id="worldList" class="world-list"></div>
        </section>
        <section class="panel trade-panel">
          <div class="panel-title"><h2>Trade</h2><span>Town market</span></div>
          <select id="townSelect"></select>
          <div class="trade-grid">
            <button id="sellOre">Sell ore</button>
            <button id="buyFood">Buy food</button>
            <button id="buyWater">Buy water</button>
            <button id="buyMedkit">Buy medkit</button>
          </div>
        </section>
      </aside>
    </section>

    <section class="panel log-panel">
      <div class="panel-title"><h2>World log</h2><span>Latest events</span></div>
      <div id="log"></div>
    </section>
  </main>
`;

const canvas = document.querySelector('#map');
const ctx = canvas.getContext('2d');
const tooltip = document.querySelector('#worldTooltip');

function tick(now) {
  const dt = Math.min(0.08, (now - last) / 1000);
  last = now;
  for (let i = 0; i < game.speed; i += 1) stepGame(game, dt * 10);
  updateCamera();
  draw();
  render();
  requestAnimationFrame(tick);
}

function updateCamera() {
  const alive = game.squad.filter((m) => m.state !== 'downed');
  const target = alive.length ? alive : game.squad;
  const avgX = target.reduce((s, m) => s + m.x, 0) / target.length;
  const avgY = target.reduce((s, m) => s + m.y, 0) / target.length;
  camera.x += (avgX - camera.x) * 0.025;
  camera.y += (avgY - camera.y) * 0.025;
}

function project(x, y, z = 0) {
  const scale = 8.6 * camera.zoom;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 + 52;
  const dx = x - camera.x;
  const dy = y - camera.y;
  return {
    x: cx + (dx - dy) * scale * 1.18,
    y: cy + (dx + dy) * scale * 0.58 - z * scale * 0.42,
  };
}

function unproject(screenX, screenY) {
  const scale = 8.6 * camera.zoom;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 + 52;
  const sx = (screenX - cx) / (scale * 1.18);
  const sy = (screenY - cy) / (scale * 0.58);
  return {
    x: clamp(camera.x + (sx + sy) / 2, 4, 96),
    y: clamp(camera.y + (sy - sx) / 2, 4, 96),
  };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky();
  drawTerrain();
  drawGrid();
  drawWorldObjects();
  drawOrderMarker();
  drawSquad();
  drawMiniMap();
}

function drawSky() {
  const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grd.addColorStop(0, '#19100a');
  grd.addColorStop(0.45, '#3f2716');
  grd.addColorStop(1, '#080705');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255, 197, 114, 0.06)';
  for (let i = 0; i < 24; i += 1) {
    const p = project((i * 17) % 110, (i * 29) % 110, -2);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 140 + (i % 4) * 55, 22, -0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTerrain() {
  const corners = [project(0, 0), project(100, 0), project(100, 100), project(0, 100)];
  ctx.fillStyle = '#6a4022';
  ctx.beginPath();
  corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 18; i += 1) {
    const x = (i * 23) % 100;
    const y = (i * 37) % 100;
    const p = project(x, y, 0.2);
    ctx.strokeStyle = i % 2 ? 'rgba(241,194,125,.18)' : 'rgba(123,223,242,.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 140, 28, 0.02, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGrid() {
  ctx.lineWidth = 1;
  for (let i = 0; i <= 100; i += 10) {
    const a = project(i, 0); const b = project(i, 100);
    const c = project(0, i); const d = project(100, i);
    ctx.strokeStyle = i % 20 === 0 ? 'rgba(255,226,179,.14)' : 'rgba(255,226,179,.07)';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
}

function drawWorldObjects() {
  for (const obj of getWorldObjects(game)) {
    if (obj.type === 'town') drawBuilding(obj, '#7bdff2', 18, '▣');
    if (obj.type === 'ruin') drawBuilding(obj, '#d86161', 14, '△');
    if (obj.type === 'resource') drawResource(obj);
    if (obj.type === 'camp') drawBuilding(obj, obj.faction === 'Player' ? '#f0ba62' : '#d9924a', 10, '◆');
    if (obj.type === 'threat') drawThreat(obj);
  }
}

function drawBuilding(obj, color, height, glyph) {
  const base = project(obj.x, obj.y, 0);
  const top = project(obj.x, obj.y, height + (obj.z ?? 0) * 0.25);
  const selected = selectedWorldId === obj.id;
  ctx.shadowColor = selected ? '#fff0ae' : '#000';
  ctx.shadowBlur = selected ? 24 : 10;
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(base.x, base.y + 10, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#1a1009';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y - 18);
  ctx.lineTo(top.x + 22, top.y - 4);
  ctx.lineTo(top.x + 18, base.y + 8);
  ctx.lineTo(top.x - 18, base.y + 8);
  ctx.lineTo(top.x - 22, top.y - 4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#140d08';
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.fillText(glyph, top.x - 8, top.y + 1);
  drawLabel(obj.name, base.x, base.y + 30, selected);
}

function drawResource(obj) {
  const p = project(obj.x, obj.y, obj.z ?? 0);
  ctx.fillStyle = obj.resource === 'water' ? '#7bdff2' : '#c98342';
  ctx.strokeStyle = '#1a1009';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.ellipse(p.x + i * 8 - 12, p.y + (i % 2) * 6, 9, 5, -0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  drawLabel(obj.name, p.x, p.y + 26, selectedWorldId === obj.id);
}

function drawThreat(obj) {
  const p = project(obj.x, obj.y, obj.z ?? 0);
  ctx.fillStyle = '#d86161';
  ctx.shadowColor = '#d86161'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(p.x, p.y, 11 + Math.sin(game.tick / 4) * 2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(216,97,97,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, Math.PI * 2); ctx.stroke();
  drawLabel(obj.name, p.x, p.y + 30, selectedWorldId === obj.id);
}

function drawLabel(label, x, y, selected = false) {
  ctx.font = '700 12px Inter, sans-serif';
  const width = ctx.measureText(label).width + 16;
  ctx.fillStyle = selected ? 'rgba(255,240,174,.92)' : 'rgba(12,9,6,.72)';
  roundRect(ctx, x - width / 2, y - 14, width, 22, 8);
  ctx.fill();
  ctx.fillStyle = selected ? '#19100a' : '#f5ead2';
  ctx.fillText(label, x - width / 2 + 8, y + 1);
}

function drawOrderMarker() {
  if (!game.orders.destination) return;
  const p = project(game.orders.destination.x, game.orders.destination.y, 0);
  ctx.strokeStyle = '#fff0ae'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
  ctx.beginPath(); ctx.arc(p.x, p.y, 28 + Math.sin(game.tick / 2) * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
}

function drawSquad() {
  const sorted = [...game.squad].sort((a, b) => a.y - b.y);
  for (const m of sorted) {
    const p = project(m.x, m.y, 4);
    const ground = project(m.x, m.y, 0);
    const selected = m.id === game.selectedId;
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.beginPath(); ctx.ellipse(ground.x, ground.y + 8, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#fff0ae'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(ground.x, ground.y + 7, 26, 12, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = '#130d08'; ctx.lineWidth = 3;
    ctx.fillStyle = m.state === 'downed' ? '#9e2f2f' : '#e8d8b0';
    ctx.beginPath(); ctx.arc(p.x, p.y - 16, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(p.x - 8, p.y - 8, 16, 22, 5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e8d8b0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y + 12); ctx.lineTo(project(m.targetX, m.targetY, 0).x, project(m.targetX, m.targetY, 0).y); ctx.stroke();
    drawLabel(`${jobs[m.job].icon} ${m.name}`, p.x, p.y - 34, selected);
  }
}

function drawMiniMap() {
  const x = canvas.width - 190; const y = 24; const size = 150;
  ctx.fillStyle = 'rgba(8,7,5,.78)'; roundRect(ctx, x, y, size, size, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,226,179,.22)'; ctx.stroke();
  for (const obj of getWorldObjects(game)) {
    ctx.fillStyle = obj.type === 'town' ? '#7bdff2' : obj.type === 'threat' ? '#d86161' : obj.type === 'resource' ? '#f0ba62' : '#ad9a7f';
    ctx.fillRect(x + obj.x * size / 100 - 2, y + obj.y * size / 100 - 2, 4, 4);
  }
  for (const m of game.squad) {
    ctx.fillStyle = '#fff0ae';
    ctx.beginPath(); ctx.arc(x + m.x * size / 100, y + m.y * size / 100, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#fff0ae'; ctx.lineWidth = 1;
  ctx.strokeRect(x + camera.x * size / 100 - 18, y + camera.y * size / 100 - 12, 36, 24);
}

function render() {
  document.querySelector('#cats').textContent = game.cats;
  document.querySelector('#food').textContent = game.inventory.food;
  document.querySelector('#water').textContent = game.inventory.water;
  document.querySelector('#power').textContent = getSquadPower(game);
  document.querySelector('#pauseBtn').textContent = game.paused ? 'Resume' : 'Pause';
  document.querySelector('#locationReadout').textContent = `${game.location.name} · ${game.location.biome} · threat ${(game.location.threat * 100).toFixed(0)}%`;
  document.querySelector('#squadCount').textContent = `${game.squad.length} drifters`;
  document.querySelector('#squad').innerHTML = game.squad.map((m) => squadCard(m)).join('');
  const selected = game.squad.find((m) => m.id === game.selectedId) ?? game.squad[0];
  document.querySelector('#selectedName').textContent = selected.name;
  document.querySelector('#selectedState').textContent = selected.state;
  document.querySelector('#details').innerHTML = details(selected);
  renderInventory();
  renderWorldList();
  document.querySelector('#log').innerHTML = game.log.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

function renderInventory() {
  const slots = getInventorySlots(game);
  const weight = slots.reduce((sum, slot) => sum + slot.qty * slot.weight, 0);
  document.querySelector('#carryWeight').textContent = `${weight.toFixed(1)} kg`;
  document.querySelector('#inventory').innerHTML = slots.map((slot) => `
    <div class="item-slot ${slot.qty ? '' : 'empty'}">
      <div class="item-icon">${slot.icon}</div>
      <div><strong>${slot.name}</strong><span>${slot.category} · ${slot.value} cats</span></div>
      <b>${slot.qty}</b>
    </div>`).join('');
}

function renderWorldList() {
  const objects = getWorldObjects(game);
  document.querySelector('#worldList').innerHTML = objects.map((obj) => `
    <button class="world-row ${selectedWorldId === obj.id ? 'active' : ''}" data-world="${obj.id}">
      <span>${typeIcon(obj.type)}</span>
      <strong>${obj.name}</strong>
      <i>${obj.type}${obj.danger ? ` · danger ${Math.round(obj.danger * 100)}%` : ''}</i>
    </button>`).join('');
}

function squadCard(m) {
  const worst = Math.min(...Object.values(m.limbs));
  const health = Math.max(0, Object.values(m.limbs).reduce((a, b) => a + b, 0) / limbs.length);
  return `<button class="squad-card ${m.id === game.selectedId ? 'active' : ''}" data-member="${m.id}">
    <div class="portrait">${m.name.slice(0, 1)}</div>
    <div><strong>${m.name}</strong><span>${m.origin}</span><i>${jobs[m.job].label} · hunger ${Math.round(m.hunger)}</i></div>
    <meter min="0" max="100" low="35" high="75" optimum="100" value="${health}"></meter>
    <em>worst limb ${Math.round(worst)}</em>
  </button>`;
}

function details(m) {
  return `
    <div class="stat-card"><b>Combat</b><span>Melee ${m.skills.melee.toFixed(1)} · Toughness ${m.skills.toughness.toFixed(1)}</span></div>
    <div class="stat-card"><b>Work</b><span>Labor ${m.skills.labor.toFixed(1)} · Athletics ${m.skills.athletics.toFixed(1)} · Medic ${m.skills.medic.toFixed(1)}</span></div>
    <div class="limbs">${limbs.map((l) => `<div><span>${pretty(l)}</span><meter min="-25" max="100" low="25" high="75" optimum="100" value="${m.limbs[l]}"></meter><em>${Math.round(m.limbs[l])}</em></div>`).join('')}</div>`;
}

function initControls() {
  document.querySelector('#jobButtons').innerHTML = Object.entries(jobs).map(([id, j]) => `<button data-job="${id}">${j.icon} ${j.label}</button>`).join('');
  document.querySelector('#townSelect').innerHTML = game.world.towns.map((t) => `<option>${t.name}</option>`).join('');
  document.querySelector('#pauseBtn').addEventListener('click', () => { game.paused = !game.paused; });
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { game.speed = Number(b.dataset.speed); }));
  document.querySelector('#squad').addEventListener('click', (e) => { const btn = e.target.closest('[data-member]'); if (btn) game.selectedId = btn.dataset.member; });
  document.querySelector('#jobButtons').addEventListener('click', (e) => { const btn = e.target.closest('[data-job]'); if (btn) assignJob(game, game.selectedId, btn.dataset.job); });
  document.querySelector('#worldList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-world]');
    if (!btn) return;
    const obj = getWorldObjects(game).find((o) => o.id === btn.dataset.world);
    selectedWorldId = obj.id;
    camera.x = obj.x; camera.y = obj.y;
    moveSquadTo(game, obj.x, obj.y);
  });
  document.querySelector('#townSelect').addEventListener('change', (e) => { selectedTown = e.target.value; });
  document.querySelector('#sellOre').addEventListener('click', () => tradeAtTown(game, selectedTown, { sellOre: 1 }));
  document.querySelector('#buyFood').addEventListener('click', () => tradeAtTown(game, selectedTown, { buyFood: 1 }));
  document.querySelector('#buyWater').addEventListener('click', () => tradeAtTown(game, selectedTown, { buyWater: 1 }));
  document.querySelector('#buyMedkit').addEventListener('click', () => tradeAtTown(game, selectedTown, { buyMedkits: 1 }));
  document.querySelector('#recruitBtn').addEventListener('click', () => {
    try { const r = recruitDrifter(game); game.selectedId = r.id; } catch (err) { game.log.unshift(err.message); }
  });
  canvas.addEventListener('click', (e) => {
    const point = getCanvasPoint(e);
    const nearestMember = game.squad.reduce((best, m) => {
      const p = project(m.x, m.y, 4);
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      return d < best.d ? { id: m.id, d } : best;
    }, { id: null, d: Infinity });
    if (nearestMember.d < 34) {
      game.selectedId = nearestMember.id;
      return;
    }
    const nearestObj = getWorldObjects(game).reduce((best, obj) => {
      const p = project(obj.x, obj.y, obj.z ?? 0);
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      return d < best.d ? { id: obj.id, obj, d } : best;
    }, { id: null, obj: null, d: Infinity });
    if (nearestObj.d < 42) {
      selectedWorldId = nearestObj.id;
      moveSquadTo(game, nearestObj.obj.x, nearestObj.obj.y);
      return;
    }
    const world = unproject(point.x, point.y);
    selectedWorldId = null;
    moveSquadTo(game, world.x, world.y);
  });
  canvas.addEventListener('mousemove', (e) => {
    const point = getCanvasPoint(e);
    const nearest = getWorldObjects(game).reduce((best, obj) => {
      const p = project(obj.x, obj.y, obj.z ?? 0);
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      return d < best.d ? { obj, d } : best;
    }, { obj: null, d: Infinity });
    if (nearest.obj && nearest.d < 46) {
      tooltip.classList.remove('hidden');
      tooltip.style.left = `${e.clientX + 16}px`;
      tooltip.style.top = `${e.clientY + 16}px`;
      tooltip.innerHTML = `<strong>${nearest.obj.name}</strong><span>${nearest.obj.type}${nearest.obj.faction ? ` · ${nearest.obj.faction}` : ''}</span>`;
    } else {
      tooltip.classList.add('hidden');
    }
  });
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
}
function typeIcon(type) { return ({ town: '▣', ruin: '△', resource: '◆', camp: '◈', threat: '●' })[type] ?? '·'; }
function pretty(s) { return s.replace(/[A-Z]/g, (m) => ' ' + m.toLowerCase()); }
function escapeHtml(str) { return str.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

initControls();
render();
requestAnimationFrame(tick);
