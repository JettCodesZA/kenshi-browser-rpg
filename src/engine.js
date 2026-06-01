const LIMBS = ['head', 'chest', 'stomach', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const JOBS = {
  idle: { label: 'Idle', icon: '·' },
  mine: { label: 'Mine copper', icon: '⛏', skill: 'labor' },
  haul: { label: 'Haul supplies', icon: '▣', skill: 'athletics' },
  guard: { label: 'Guard camp', icon: '◆', skill: 'melee' },
  scout: { label: 'Scout ruins', icon: '◇', skill: 'athletics' },
};

export function createGame(options = {}) {
  const seed = options.seed ?? Date.now();
  const rng = mulberry32(seed);
  const game = {
    seed,
    tick: 0,
    paused: false,
    speed: 1,
    cats: 120,
    inventory: { food: 3, ore: 0, medkits: 1, scrap: 0 },
    location: { name: 'Vulture Flats', biome: 'salt desert', threat: 0.38, x: 48, y: 56 },
    selectedId: 'dera',
    squad: [
      createMember('dera', 'Dera', 'wanderer', { melee: 2, labor: 1, athletics: 2, toughness: 1 }, 72, rng),
      createMember('mako', 'Mako', 'ex-slave medic', { melee: 1, labor: 1, athletics: 1, medic: 3, toughness: 2 }, 69, rng),
    ],
    world: createWorld(),
    encounters: [],
    log: ['Day 1: Two drifters crawl into Vulture Flats with 120 cats and bad boots.'],
    rng,
  };
  return game;
}

function createMember(id, name, origin, skills, hunger, rng) {
  return {
    id,
    name,
    origin,
    job: 'idle',
    state: 'ready',
    hunger,
    fatigue: Math.round(rng() * 8),
    skills: { melee: 1, labor: 1, athletics: 1, medic: 1, toughness: 1, ...skills },
    limbs: Object.fromEntries(LIMBS.map((l) => [l, 100])),
    xp: { melee: 0, labor: 0, athletics: 0, medic: 0, toughness: 0 },
    x: 42 + rng() * 16,
    y: 45 + rng() * 16,
    targetX: 42 + rng() * 16,
    targetY: 45 + rng() * 16,
    cooldown: 0,
  };
}

export function createWorld() {
  return {
    factions: [
      { name: 'Dust Jackals', relation: -35, color: '#d9924a' },
      { name: 'Free Caravans', relation: 18, color: '#8bc5ff' },
      { name: 'Iron Choir', relation: -5, color: '#d86161' },
      { name: 'Nomad Glassers', relation: 8, color: '#91d98b' },
    ],
    towns: [
      { name: 'Waystation Kudu', x: 65, y: 39, buy: { ore: 18 }, sell: { food: 12, medkits: 38 }, faction: 'Free Caravans' },
      { name: 'Rustwake', x: 24, y: 74, buy: { ore: 22 }, sell: { food: 14, medkits: 42 }, faction: 'Iron Choir' },
      { name: 'Blue Salt Camp', x: 77, y: 79, buy: { ore: 16 }, sell: { food: 10, medkits: 45 }, faction: 'Nomad Glassers' },
    ],
    ruins: [
      { name: 'Sunken Lab', x: 31, y: 30, loot: 'scrap', danger: 0.68 },
      { name: 'Skimmer Nest', x: 83, y: 18, loot: 'eggs', danger: 0.82 },
      { name: 'Old Drill Yard', x: 15, y: 51, loot: 'ore', danger: 0.44 },
    ],
  };
}

export function assignJob(game, memberId, job) {
  if (!JOBS[job]) throw new Error(`Unknown job: ${job}`);
  const member = getMember(game, memberId);
  member.job = job;
  member.state = job === 'idle' ? 'ready' : JOBS[job].label.toLowerCase();
  game.log.unshift(`${member.name} now assigned: ${JOBS[job].label}.`);
  trimLog(game);
  return member;
}

export function stepGame(game, dt = 1) {
  if (game.paused) return game;
  game.tick += dt;
  consumeFood(game, dt);
  for (const member of game.squad) {
    healOrBleed(member, game, dt);
    if (member.state === 'downed') continue;
    runJob(game, member, dt);
    wander(member, game, dt);
  }
  maybeEncounter(game, dt);
  return game;
}

function consumeFood(game, dt) {
  if (Math.floor((game.tick - dt) / 14) === Math.floor(game.tick / 14)) return;
  for (const member of game.squad) {
    if (game.inventory.food > 0 && member.hunger < 78) {
      game.inventory.food -= 1;
      member.hunger = Math.min(100, member.hunger + 24);
      game.log.unshift(`${member.name} eats dried cactus. Food left: ${game.inventory.food}.`);
    } else {
      member.hunger = Math.max(0, member.hunger - 6);
      if (member.hunger < 25) damageLimb(member, 'stomach', 3, game, `${member.name} is starving.`);
    }
  }
  trimLog(game);
}

function runJob(game, member, dt) {
  member.cooldown -= dt;
  const job = JOBS[member.job];
  if (!job || member.job === 'idle') return;
  gainSkill(member, job.skill, 0.024 * dt);
  if (member.job === 'mine' && member.cooldown <= 0) {
    game.inventory.ore += 1;
    member.cooldown = 10 - Math.min(5, member.skills.labor * 0.65);
    game.log.unshift(`${member.name} chips copper ore from the cracked flats.`);
  }
  if (member.job === 'haul' && member.cooldown <= 0) {
    game.inventory.food += game.rng() > 0.55 ? 1 : 0;
    member.cooldown = 13;
    game.log.unshift(`${member.name} hauls salvage and finds ${game.inventory.food ? 'supplies' : 'nothing useful'}.`);
  }
  if (member.job === 'scout' && member.cooldown <= 0) {
    const found = game.rng() > 0.62;
    if (found) game.inventory.scrap += 1;
    member.cooldown = 16;
    game.log.unshift(found ? `${member.name} scouts a ruin and pockets ancient scrap.` : `${member.name} scouts dust trails. No loot, good cardio.`);
  }
  if (member.job === 'guard') gainSkill(member, 'melee', 0.014 * dt);
  trimLog(game);
}

function maybeEncounter(game, dt) {
  const active = game.squad.filter((m) => m.state !== 'downed');
  if (!active.length) return;
  const guardBonus = active.filter((m) => m.job === 'guard').length * 0.007;
  const chance = Math.max(0.002, game.location.threat * 0.017 * dt - guardBonus);
  if (game.rng() > chance) return;
  const enemy = game.rng() > 0.5 ? 'Dust Jackals' : 'bone dogs';
  game.log.unshift(`The squad is ambushed by ${enemy}.`);
  const rounds = 2 + Math.floor(game.rng() * 3);
  for (let i = 0; i < rounds; i += 1) {
    const target = active[Math.floor(game.rng() * active.length)];
    const limb = LIMBS[Math.floor(game.rng() * LIMBS.length)];
    const incoming = 6 + game.rng() * 15;
    const mitigation = target.skills.toughness * 0.9 + target.skills.melee * 0.35;
    damageLimb(target, limb, Math.max(2, incoming - mitigation), game, `${target.name} is wounded in the ${prettyLimb(limb)}.`);
    gainSkill(target, 'toughness', 0.58);
    gainSkill(target, 'melee', 0.36);
  }
  trimLog(game);
}

function damageLimb(member, limb, amount, game, message) {
  member.limbs[limb] = Math.max(-25, Math.round((member.limbs[limb] - amount) * 10) / 10);
  if (message) game.log.unshift(message);
  if (member.limbs.head <= 0 || member.limbs.chest <= 0 || member.limbs.stomach <= 0) {
    member.state = 'downed';
    game.log.unshift(`${member.name} is down. Patch them up or carry them to town.`);
  }
}

function healOrBleed(member, game, dt) {
  const critical = ['head', 'chest', 'stomach'].some((l) => member.limbs[l] < 18);
  if (critical && game.inventory.medkits > 0 && member.state === 'downed') {
    game.inventory.medkits -= 1;
    for (const limb of LIMBS) member.limbs[limb] = Math.max(member.limbs[limb], 22);
    member.state = 'recovering';
    game.log.unshift(`${member.name} gets patched with a medkit.`);
  }
  if (member.state === 'recovering') {
    for (const limb of LIMBS) member.limbs[limb] = Math.min(100, member.limbs[limb] + 0.09 * dt);
    if (['head', 'chest', 'stomach'].every((l) => member.limbs[l] > 34)) member.state = 'ready';
  }
}

function wander(member, game, dt) {
  const speed = (0.05 + member.skills.athletics * 0.015) * dt * (member.hunger < 25 ? 0.45 : 1);
  const dx = member.targetX - member.x;
  const dy = member.targetY - member.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.8) {
    member.targetX = clamp(member.x + (game.rng() - 0.5) * 20, 5, 95);
    member.targetY = clamp(member.y + (game.rng() - 0.5) * 20, 5, 95);
  } else {
    member.x += (dx / dist) * speed;
    member.y += (dy / dist) * speed;
  }
}

export function tradeAtTown(game, townName, order = {}) {
  const town = game.world.towns.find((t) => t.name === townName);
  if (!town) throw new Error(`Unknown town: ${townName}`);
  const sellOre = Math.min(order.sellOre ?? 0, game.inventory.ore);
  game.inventory.ore -= sellOre;
  game.cats += sellOre * town.buy.ore;
  const buyFood = Math.min(order.buyFood ?? 0, Math.floor(game.cats / town.sell.food));
  game.inventory.food += buyFood;
  game.cats -= buyFood * town.sell.food;
  const buyMedkits = Math.min(order.buyMedkits ?? 0, Math.floor(game.cats / town.sell.medkits));
  game.inventory.medkits += buyMedkits;
  game.cats -= buyMedkits * town.sell.medkits;
  game.log.unshift(`Traded at ${town.name}: sold ${sellOre} ore, bought ${buyFood} food and ${buyMedkits} medkits.`);
  trimLog(game);
  return game;
}

export function recruitDrifter(game, name = randomName(game.rng), archetype = 'fighter') {
  const cost = 75;
  if (game.cats < cost) throw new Error('Not enough cats to recruit a drifter.');
  game.cats -= cost;
  const skills = archetype === 'scout'
    ? { athletics: 3, melee: 1, labor: 1, medic: 1, toughness: 1 }
    : archetype === 'medic'
      ? { medic: 3, athletics: 1, melee: 1, labor: 1, toughness: 2 }
      : { melee: 3, toughness: 2, athletics: 1, labor: 1, medic: 1 };
  const member = createMember(`r${Math.round(game.rng() * 99999)}`, name, `${archetype} drifter`, skills, 64 + Math.round(game.rng() * 18), game.rng);
  game.squad.push(member);
  game.log.unshift(`${name} joins the squad for ${cost} cats.`);
  trimLog(game);
  return member;
}

export function getSquadPower(game) {
  return Math.round(game.squad.reduce((sum, m) => {
    const healthFactor = Object.values(m.limbs).reduce((a, b) => a + Math.max(0, b), 0) / (LIMBS.length * 100);
    return sum + (m.skills.melee * 2 + m.skills.toughness * 1.7 + m.skills.athletics * 0.6) * Math.max(0.25, healthFactor);
  }, 0) * 10) / 10;
}

export function getVisibleJobs() { return JOBS; }
export function getLimbs() { return LIMBS; }

function getMember(game, id) {
  const member = game.squad.find((m) => m.id === id);
  if (!member) throw new Error(`Unknown squad member: ${id}`);
  return member;
}

function gainSkill(member, skill, amount) {
  if (!skill) return;
  member.xp[skill] = (member.xp[skill] ?? 0) + amount;
  while (member.xp[skill] >= 1) {
    member.xp[skill] -= 1;
    member.skills[skill] = Math.round((member.skills[skill] + 0.1) * 10) / 10;
  }
}

function prettyLimb(limb) { return limb.replace(/([A-Z])/g, ' $1').toLowerCase(); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function trimLog(game) { game.log = game.log.slice(0, 12); }
function randomName(rng) { return ['Rook', 'Sable', 'Nix', 'Tavi', 'Kato', 'Vex'][Math.floor(rng() * 6)]; }

function mulberry32(a) {
  return function rng() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
