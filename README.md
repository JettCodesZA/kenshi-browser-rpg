# Dustwake

A browser-based sandbox squad RPG prototype inspired by the *systems feel* of Kenshi: vulnerable drifters, open desert survival, faction towns, job automation, limb damage, ambushes, trading, and emergent squad growth.

## Run

```bash
npm install
npm run start
```

Open the Vite URL in a browser.

## Test

```bash
npm test
npm run build
```

## Current prototype features

- 3D-ish top-down/isometric canvas world with terrain grid, height, towns, ruins, resource nodes, camps, and threat markers.
- Click-to-move squad orders with visible destination markers and formation movement.
- Proper inventory panel with item icons, categories, values, quantities, and carry weight.
- Squad management with recruitable drifters, portraits, jobs, hunger, limb health, and skills.
- Job assignment: idle, mining, hauling, guarding, scouting.
- Hunger, food/water, medkits, ore/scrap inventory, cats economy.
- Body-part limb damage and downed/recovery states.
- Faction-flavoured towns and trade prices.
- Real-time pause/speed controls, world POI list, minimap, and event log.

## Next high-value upgrades

1. Real hostile squads visible on-map before combat, with chasing/fleeing AI.
2. Base-building zones: storage, beds, walls, farms, turrets.
3. Save/load via localStorage.
4. Procedural characters with portraits and more skills.
5. Equipment slots, loot containers, and drag/drop inventory.
