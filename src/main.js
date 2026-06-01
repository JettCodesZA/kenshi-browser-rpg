import { assignJob, createGame, getLimbs, getSquadPower, getVisibleJobs, recruitDrifter, stepGame, tradeAtTown } from './engine.js';
import './styles.css';

const game = createGame();
const jobs = getVisibleJobs();
const limbs = getLimbs();
let selectedTown = 'Waystation Kudu';
let last = performance.now();

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="shell">
    <section class="topbar">
      <div>
        <p class="eyebrow">Open desert squad survival RPG</p>
        <h1>Dustwake</h1>
      </div>
      <div class="meters">
        <span id="cats"></span><span id="food"></span><span id="ore"></span><span id="power"></span>
      </div>
      <div class="controls">
        <button id="pauseBtn">Pause</button>
        <button data-speed="1">1×</button>
        <button data-speed="3">3×</button>
        <button data-speed="8">8×</button>
      </div>
    </section>
    <section class="layout">
      <aside class="panel squad-panel">
        <h2>Squad</h2>
        <div id="squad"></div>
        <button id="recruitBtn" class="wide">Recruit drifter — 75 cats</button>
      </aside>
      <section class="map-card">
        <canvas id="map" width="980" height="680"></canvas>
        <div class="map-hint">Click squad members to inspect. Assign jobs, survive ambushes, sell ore, buy food.</div>
      </section>
      <aside class="panel details-panel">
        <h2 id="selectedName">Selected</h2>
        <div id="details"></div>
        <h3>Jobs</h3>
        <div id="jobButtons" class="job-grid"></div>
        <h3>Trade</h3>
        <select id="townSelect"></select>
        <div class="trade-grid">
          <button id="sellOre">Sell 1 ore</button>
          <button id="buyFood">Buy 1 food</button>
          <button id="buyMedkit">Buy medkit</button>
        </div>
      </aside>
    </section>
    <section class="panel log-panel">
      <h2>World log</h2>
      <div id="log"></div>
    </section>
  </main>
`;

const canvas = document.querySelector('#map');
const ctx = canvas.getContext('2d');

function tick(now) {
  const dt = Math.min(0.08, (now - last) / 1000);
  last = now;
  for (let i = 0; i < game.speed; i += 1) stepGame(game, dt * 10);
  draw();
  render();
  requestAnimationFrame(tick);
}

function draw() {
  const w = canvas.width; const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const grd = ctx.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, '#22180f'); grd.addColorStop(0.45, '#5b3b20'); grd.addColorStop(1, '#171414');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 70; i += 1) {
    const x = ((i * 137) % w); const y = ((i * 271) % h);
    ctx.strokeStyle = i % 3 ? '#f1c27d' : '#7bdff2';
    ctx.beginPath(); ctx.ellipse(x, y, 90 + (i % 5) * 30, 8, -0.3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const ruin of game.world.ruins) drawPoint(ruin.x, ruin.y, '#d86161', '△', ruin.name);
  for (const town of game.world.towns) drawPoint(town.x, town.y, '#8bc5ff', '▣', town.name);
  for (const m of game.squad) {
    const x = pctX(m.x); const y = pctY(m.y);
    ctx.shadowColor = m.id === game.selectedId ? '#fff0ae' : '#000'; ctx.shadowBlur = m.id === game.selectedId ? 20 : 8;
    ctx.fillStyle = m.state === 'downed' ? '#9e2f2f' : '#e8d8b0';
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#171414'; ctx.lineWidth = 3; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5ead2'; ctx.font = '12px ui-monospace, monospace'; ctx.fillText(`${jobs[m.job].icon} ${m.name}`, x + 12, y - 12);
    ctx.strokeStyle = '#e8d8b0'; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(pctX(m.targetX), pctY(m.targetY)); ctx.stroke(); ctx.globalAlpha = 1;
  }
}

function drawPoint(xp, yp, color, glyph, label) {
  const x = pctX(xp); const y = pctY(yp);
  ctx.fillStyle = color; ctx.font = '22px ui-monospace, monospace'; ctx.fillText(glyph, x, y);
  ctx.fillStyle = '#d8c7a0'; ctx.font = '12px Inter, sans-serif'; ctx.fillText(label, x + 20, y + 2);
}
function pctX(v) { return (v / 100) * canvas.width; }
function pctY(v) { return (v / 100) * canvas.height; }

function render() {
  document.querySelector('#cats').textContent = `${game.cats} cats`;
  document.querySelector('#food').textContent = `${game.inventory.food} food`;
  document.querySelector('#ore').textContent = `${game.inventory.ore} ore`;
  document.querySelector('#power').textContent = `power ${getSquadPower(game)}`;
  document.querySelector('#pauseBtn').textContent = game.paused ? 'Resume' : 'Pause';
  document.querySelector('#squad').innerHTML = game.squad.map((m) => squadCard(m)).join('');
  const selected = game.squad.find((m) => m.id === game.selectedId) ?? game.squad[0];
  document.querySelector('#selectedName').textContent = selected.name;
  document.querySelector('#details').innerHTML = details(selected);
  document.querySelector('#log').innerHTML = game.log.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

function squadCard(m) {
  const worst = Math.min(...Object.values(m.limbs));
  return `<button class="squad-card ${m.id === game.selectedId ? 'active' : ''}" data-member="${m.id}">
    <strong>${m.name}</strong><span>${m.origin}</span>
    <i>${jobs[m.job].label} · hunger ${Math.round(m.hunger)} · worst limb ${Math.round(worst)}</i>
  </button>`;
}

function details(m) {
  return `
    <div class="statline"><b>Status</b><span>${m.state}</span></div>
    <div class="statline"><b>Skills</b><span>Melee ${m.skills.melee.toFixed(1)} · Tough ${m.skills.toughness.toFixed(1)} · Labor ${m.skills.labor.toFixed(1)} · Ath ${m.skills.athletics.toFixed(1)}</span></div>
    <div class="limbs">${limbs.map((l) => `<div><span>${pretty(l)}</span><meter min="-25" max="100" low="25" high="75" optimum="100" value="${m.limbs[l]}"></meter><em>${Math.round(m.limbs[l])}</em></div>`).join('')}</div>`;
}
function pretty(s) { return s.replace(/[A-Z]/g, (m) => ' ' + m.toLowerCase()); }
function escapeHtml(str) { return str.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

function initControls() {
  document.querySelector('#jobButtons').innerHTML = Object.entries(jobs).map(([id, j]) => `<button data-job="${id}">${j.icon} ${j.label}</button>`).join('');
  document.querySelector('#townSelect').innerHTML = game.world.towns.map((t) => `<option>${t.name}</option>`).join('');
  document.querySelector('#pauseBtn').addEventListener('click', () => { game.paused = !game.paused; });
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { game.speed = Number(b.dataset.speed); }));
  document.querySelector('#squad').addEventListener('click', (e) => { const btn = e.target.closest('[data-member]'); if (btn) game.selectedId = btn.dataset.member; });
  document.querySelector('#jobButtons').addEventListener('click', (e) => { const btn = e.target.closest('[data-job]'); if (btn) assignJob(game, game.selectedId, btn.dataset.job); });
  document.querySelector('#townSelect').addEventListener('change', (e) => { selectedTown = e.target.value; });
  document.querySelector('#sellOre').addEventListener('click', () => tradeAtTown(game, selectedTown, { sellOre: 1 }));
  document.querySelector('#buyFood').addEventListener('click', () => tradeAtTown(game, selectedTown, { buyFood: 1 }));
  document.querySelector('#buyMedkit').addEventListener('click', () => tradeAtTown(game, selectedTown, { buyMedkits: 1 }));
  document.querySelector('#recruitBtn').addEventListener('click', () => {
    try { const r = recruitDrifter(game); game.selectedId = r.id; } catch (err) { game.log.unshift(err.message); }
  });
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const nearest = game.squad.reduce((best, m) => {
      const d = Math.hypot(m.x - x, m.y - y);
      return d < best.d ? { id: m.id, d } : best;
    }, { id: null, d: Infinity });
    if (nearest.d < 5) game.selectedId = nearest.id;
  });
}

initControls();
render();
requestAnimationFrame(tick);
