const LIMBS = ['head', 'chest', 'stomach', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const ITEMS = {
  food: { name: 'Dried cactus', icon: '🥫', category: 'rations', value: 12, weight: 0.4 },
  ore: { name: 'Copper ore', icon: '⛏️', category: 'trade goods', value: 18, weight: 2.4 },
  medkits: { name: 'Field medkit', icon: '✚', category: 'medical', value: 38, weight: 0.8 },
  scrap: { name: 'Ancient scrap', icon: '⚙', category: 'crafting', value: 32, weight: 1.2 },
  water: { name: 'Water skin', icon: '💧', category: 'rations', value: 8, weight: 1.0 },
};
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
    inventory: { food: 3, ore: 0, medkits: 1, scrap: 0, water: 2 },
    location: { name: 'Vulture Flats', biome: 'salt desert', threat: 0.38, x: 48, y: 56 },
    orders: { destination: null, selectedWorldId: null },
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
  const towns = [
    { id: 'town-kudu', name: 'Waystation Kudu', x: 65, y: 39, z: 9, buy: { ore: 18, scrap: 30 }, sell: { food: 12, medkits: 38, water: 8 }, faction: 'Free Caravans', population: 48 },
    { id: 'town-rustwake', name: 'Rustwake', x: 24, y: 74, z: 13, buy: { ore: 22, scrap: 35 }, sell: { food: 14, medkits: 42, water: 10 }, faction: 'Iron Choir', population: 92 },
    { id: 'town-blue-salt', name: 'Blue Salt Camp', x: 77, y: 79, z: 7, buy: { ore: 16, scrap: 25 }, sell: { food: 10, medkits: 45, water: 7 }, faction: 'Nomad Glassers', population: 31 },
  ];
  const ruins = [
    { id: 'ruin-lab', name: 'Sunken Lab', x: 31, y: 30, z: 18, loot: 'scrap', danger: 0.68 },
    { id: 'ruin-skimmer', name: 'Skimmer Nest', x: 83, y: 18, z: 14, loot: 'eggs', danger: 0.82 },
    { id: 'ruin-drill', name: 'Old Drill Yard', x: 15, y: 51, z: 11, loot: 'ore', danger: 0.44 },
  ];
  const resources = [
    { id: 'res-copper-north', type: 'resource', name: 'Copper vein north', x: 43, y: 42, z: 5, resource: 'ore', richness: 0.8 },
    { id: 'res-copper-ridge', type: 'resource', name: 'Copper ridge', x: 56, y: 63, z: 8, resource: 'ore', richness: 0.65 },
    { id: 'res-water', type: 'resource', name: 'Brackish well', x: 70, y: 54, z: 3, resource: 'water', richness: 0.45 },
  ];
  const camps = [
    { id: 'camp-player', type: 'camp', name: 'Dustwake camp', x: 48, y: 56, z: 4, faction: 'Player' },
    { id: 'camp-jackal', type: 'camp', name: 'Dust Jackal camp', x: 58, y: 24, z: 10, faction: 'Dust Jackals' },
  ];
  const threats = [
    { id: 'threat-bonedogs', type: 'threat', name: 'Bone dog pack', x: 39, y: 68, z: 2, danger: 0.55 },
    { id: 'threat-raiders', type: 'threat', name: 'Raider patrol', x: 71, y: 30, z: 4, danger: 0.72 },
  ];
  return {
    factions: [
      { name: 'Dust Jackals', relation: -35, color: '#d9924a' },
      { name: 'Free Caravans', relation: 18, color: '#8bc5ff' },
      { name: 'Iron Choir', relation: -5, color: '#d86161' },
      { name: 'Nomad Glassers', relation: 8, color: '#91d98b' },
    ],
    towns,
    ruins,
    resources,
    camps,
    threats,
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
    const vein = nearestObject(member, game.world.resources.filter((r) => r.resource === 'ore'));
    const richness = vein ? vein.richness : 0.5;
    game.inventory.ore += richness > 0.7 && game.rng() > 0.45 ? 2 : 1;
    member.cooldown = 10 - Math.min(5, member.skills.labor * 0.65);
    game.log.unshift(`${member.name} mines ${vein?.name ?? 'a copper vein'} for ore.`);
  }
  if (member.job === 'haul' && member.cooldown <= 0) {
    const foundFood = game.rng() > 0.55;
    if (foundFood) game.inventory.food += 1;
    else if (game.rng() > 0.5) game.inventory.water += 1;
    member.cooldown = 13;
    game.log.unshift(`${member.name} hauls salvage and finds ${foundFood ? 'rations' : 'a water skin'}.`);
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
  const ordered = game.orders.destination;
  const speed = (0.05 + member.skills.athletics * 0.015) * dt * (member.hunger < 25 ? 0.45 : 1);
  if (ordered) {
    const index = game.squad.findIndex((m) => m.id === member.id);
    const formation = formationOffset(index);
    member.targetX = clamp(ordered.x + formation.x, 4, 96);
    member.targetY = clamp(ordered.y + formation.y, 4, 96);
  }
  const dx = member.targetX - member.x;
  const dy = member.targetY - member.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.8) {
    if (!ordered) {
      member.targetX = clamp(member.x + (game.rng() - 0.5) * 20, 5, 95);
      member.targetY = clamp(member.y + (game.rng() - 0.5) * 20, 5, 95);
    }
  } else {
    member.x += (dx / dist) * speed;
    member.y += (dy / dist) * speed;
  }
  if (ordered && game.squad.every((m, i) => Math.hypot(m.x - clamp(ordered.x + formationOffset(i).x, 4, 96), m.y - clamp(ordered.y + formationOffset(i).y, 4, 96)) < 1.2)) {
    game.orders.destination = null;
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
  const buyWater = Math.min(order.buyWater ?? 0, Math.floor(game.cats / town.sell.water));
  game.inventory.water += buyWater;
  game.cats -= buyWater * town.sell.water;
  const buyMedkits = Math.min(order.buyMedkits ?? 0, Math.floor(game.cats / town.sell.medkits));
  game.inventory.medkits += buyMedkits;
  game.cats -= buyMedkits * town.sell.medkits;
  game.log.unshift(`Traded at ${town.name}: sold ${sellOre} ore, bought ${buyFood} food, ${buyWater} water and ${buyMedkits} medkits.`);
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

export function getInventorySlots(game) {
  return Object.entries(ITEMS).map(([id, meta]) => ({
    id,
    ...meta,
    qty: game.inventory[id] ?? 0,
  }));
}

export function getWorldObjects(game) {
  const withType = (type, items) => items.map((item) => ({ type, z: 0, ...item }));
  return [
    ...withType('town', game.world.towns),
    ...withType('ruin', game.world.ruins),
    ...withType('resource', game.world.resources),
    ...withType('camp', game.world.camps),
    ...withType('threat', game.world.threats),
  ].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function moveSquadTo(game, x, y) {
  game.orders.destination = { x: clamp(x, 4, 96), y: clamp(y, 4, 96) };
  for (const [index, member] of game.squad.entries()) {
    const offset = formationOffset(index);
    member.targetX = clamp(game.orders.destination.x + offset.x, 4, 96);
    member.targetY = clamp(game.orders.destination.y + offset.y, 4, 96);
    member.state = member.job === 'idle' ? 'moving' : member.state;
  }
  game.log.unshift(`Move order: squad heading to ${Math.round(game.orders.destination.x)}, ${Math.round(game.orders.destination.y)}.`);
  trimLog(game);
  return game.orders.destination;
}

export function getVisibleJobs() { return JOBS; }
export function getLimbs() { return LIMBS; }
export function getItems() { return ITEMS; }

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

function nearestObject(member, objects) {
  return objects.reduce((best, obj) => {
    const distance = Math.hypot(member.x - obj.x, member.y - obj.y);
    return !best || distance < best.distance ? { ...obj, distance } : best;
  }, null);
}

function formationOffset(index) {
  const offsets = [
    { x: 0, y: 0 },
    { x: -2.2, y: 1.8 },
    { x: 2.2, y: 1.8 },
    { x: -4.1, y: 3.6 },
    { x: 4.1, y: 3.6 },
    { x: 0, y: 4.8 },
  ];
  return offsets[index % offsets.length];
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
