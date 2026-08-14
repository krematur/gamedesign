const { generateWorld, TILE, isWalkable, WORLD_SIZE, makeRng } = require('./world');
const { ITEMS, RECIPES } = require('./items');
const { NPCS, QUESTS } = require('./quests');
const { QUALITY_TIERS, qualifiedId, rollGatherQuality } = require('./quality');

const TICK_MS = 150;
const DAY_LENGTH_TICKS = Math.round((6 * 60 * 1000) / TICK_MS); // ~6 min full day/night cycle
const HUNGER_TICK_INTERVAL = Math.round(4000 / TICK_MS); // hunger drains every ~4s
const REGEN_TICK_INTERVAL = Math.round(2000 / TICK_MS);
const MOVE_SPEED = 4.2; // tiles per second
const GATHER_RANGE = 1.6;
const ATTACK_RANGE = 1.6;
const ATTACK_COOLDOWN_MS = 500;
const GATHER_COOLDOWN_MS = 550;
const RESOURCE_RESPAWN_TICKS = Math.round(30000 / TICK_MS);
const MAX_MOBS = 24;
const MOB_AGGRO_RANGE = 6;
const MOB_ATTACK_RANGE = 1.2;
const MOB_ATTACK_COOLDOWN_MS = 900;
const STRUCTURE_RANGE = 3;
const NPC_INTERACT_RANGE = 3;
const MAX_ARMOR_REDUCTION = 0.6;

let nextEntityId = 1;
const genId = () => nextEntityId++;

class Game {
  constructor(seed) {
    this.world = generateWorld(seed);
    this.rng = makeRng((seed || 1) + 42);
    this.players = new Map(); // id -> player
    this.resources = new Map(); // id -> resource node
    this.mobs = new Map(); // id -> mob
    this.structures = new Map(); // id -> placed structure
    this.tick = 0;
    this.spawnResources();
    this.spawnInitialMobs();
    this.npcs = NPCS.map(n => this.placeNpc(n));
  }

  placeNpc(def) {
    const cx = this.world.size / 2, cy = this.world.size / 2;
    let x = cx, y = cy, tries = 0;
    while (!isWalkable(this.world, x, y) && tries < 50) {
      x = cx + (this.rng() - 0.5) * 6;
      y = cy + (this.rng() - 0.5) * 6;
      tries++;
    }
    return { ...def, x, y };
  }

  isNight() {
    const phase = (this.tick % DAY_LENGTH_TICKS) / DAY_LENGTH_TICKS;
    return phase > 0.55 && phase < 0.97;
  }

  dayPhase() {
    return (this.tick % DAY_LENGTH_TICKS) / DAY_LENGTH_TICKS;
  }

  hasWalkableNeighbor(x, y) {
    return isWalkable(this.world, x - 1, y) || isWalkable(this.world, x + 1, y) ||
      isWalkable(this.world, x, y - 1) || isWalkable(this.world, x, y + 1);
  }

  spawnResources() {
    for (let y = 0; y < this.world.size; y++) {
      for (let x = 0; x < this.world.size; x++) {
        const t = this.world.tiles[y * this.world.size + x];
        const r = this.rng();
        if (t === TILE.FOREST && r < 0.12) {
          this.addResource('tree', x + 0.5, y + 0.5);
        } else if (t === TILE.STONE && r < 0.025) {
          this.addResource('iron_vein', x + 0.5, y + 0.5);
        } else if (t === TILE.STONE && r < 0.18) {
          this.addResource('rock', x + 0.5, y + 0.5);
        } else if (t === TILE.GRASS && r < 0.03) {
          this.addResource('bush', x + 0.5, y + 0.5);
        } else if (t === TILE.GRASS && r < 0.055) {
          this.addResource('shrub', x + 0.5, y + 0.5);
        } else if (t === TILE.WATER && this.hasWalkableNeighbor(x, y) && r < 0.22) {
          this.addResource('fishing_spot', x + 0.5, y + 0.5);
        }
      }
    }
  }

  addResource(type, x, y) {
    const id = 'r' + genId();
    const hpByType = { tree: 30, rock: 40, bush: 12, iron_vein: 50, shrub: 10, fishing_spot: 15 };
    const yieldByType = {
      tree: { item: 'wood', min: 3, max: 6 },
      rock: { item: 'stone', min: 2, max: 5 },
      bush: { item: 'berry', min: 1, max: 3 },
      iron_vein: { item: 'iron_ore', min: 1, max: 3 },
      shrub: { item: 'fiber', min: 1, max: 3 },
      fishing_spot: { item: 'raw_fish', min: 1, max: 2 },
    };
    this.resources.set(id, {
      id, type, x, y,
      hp: hpByType[type], maxHp: hpByType[type],
      yield: yieldByType[type],
      alive: true, respawnAt: 0,
    });
    return id;
  }

  spawnInitialMobs() {
    for (let i = 0; i < 10; i++) this.spawnMob();
  }

  spawnMob() {
    if (this.mobs.size >= MAX_MOBS) return;
    let x, y, tries = 0;
    do {
      x = this.rng() * this.world.size;
      y = this.rng() * this.world.size;
      tries++;
    } while (!isWalkable(this.world, x, y) && tries < 50);
    const id = 'm' + genId();
    this.mobs.set(id, {
      id, type: 'wolf', x, y, hp: 30, maxHp: 30, damage: 8,
      state: 'wander', targetPlayerId: null,
      wanderAngle: this.rng() * Math.PI * 2,
      lastAttack: 0, alive: true,
    });
  }

  addPlayer(socketId, name) {
    let x, y, tries = 0;
    do {
      x = this.world.size / 2 + (this.rng() - 0.5) * 10;
      y = this.world.size / 2 + (this.rng() - 0.5) * 10;
      tries++;
    } while (!isWalkable(this.world, x, y) && tries < 50);

    const player = {
      id: socketId,
      name: name && name.trim() ? name.trim().slice(0, 16) : 'Survivor',
      x, y,
      dir: { x: 0, y: 1 },
      hp: 100, maxHp: 100,
      hunger: 100, maxHunger: 100,
      inventory: { wood: 0, stone: 0, fiber: 2, berry: 0, meat_raw: 0, meat_cooked: 0 },
      equipped: null,
      armor: { head: null, chest: null, legs: null },
      alive: true,
      lastAttack: 0,
      lastGather: 0,
      input: { up: false, down: false, left: false, right: false },
      nearStructures: [],
      joinedAt: Date.now(),
      kills: 0,
      deaths: 0,
      completedQuests: new Set(),
      activeQuests: {}, // questId -> { progress }
    };
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  setInput(socketId, input) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return;
    p.input = {
      up: !!input.up, down: !!input.down, left: !!input.left, right: !!input.right,
    };
    if (typeof input.aimX === 'number' && typeof input.aimY === 'number') {
      p.dir = { x: input.aimX, y: input.aimY };
    }
  }

  armorReduction(p) {
    let total = 0;
    for (const slot of Object.values(p.armor)) {
      if (!slot) continue;
      const def = ITEMS[slot];
      if (def && def.defense) total += def.defense;
    }
    return Math.min(MAX_ARMOR_REDUCTION, total);
  }

  damagePlayer(p, dmg) {
    const reduction = this.armorReduction(p);
    const actual = Math.max(1, Math.round(dmg * (1 - reduction)));
    p.hp -= actual;
    return actual;
  }

  gather(socketId, resourceId) {
    const p = this.players.get(socketId);
    const r = this.resources.get(resourceId);
    if (!p || !p.alive || !r || !r.alive) return null;

    const tool = p.equipped && ITEMS[p.equipped];
    if (r.type === 'fishing_spot' && (!tool || tool.tool !== 'fishing_rod')) {
      return [{ type: 'gatherFail', reason: 'need a fishing rod', resourceId }];
    }

    const now = Date.now();
    if (now - p.lastGather < GATHER_COOLDOWN_MS) return null;
    const dist = Math.hypot(p.x - r.x, p.y - r.y);
    if (dist > GATHER_RANGE) return null;
    p.lastGather = now;

    let dmg = 5;
    let toolMatch = 'none';
    if (r.type === 'tree') {
      if (tool && tool.tool === 'axe') { dmg = 8 + (tool.gatherBonus.wood || 0); toolMatch = tool.tier === 2 ? 'iron' : 'basic'; }
    } else if (r.type === 'rock' || r.type === 'iron_vein') {
      if (tool && tool.tool === 'pickaxe') { dmg = 8 + (tool.gatherBonus.stone || 0); toolMatch = tool.tier === 2 ? 'iron' : 'basic'; }
    } else if (r.type === 'bush' || r.type === 'shrub') {
      dmg = r.hp; toolMatch = 'basic'; // one-shot harvest
    } else if (r.type === 'fishing_spot') {
      dmg = 10; toolMatch = 'basic';
    }

    r.hp -= dmg;
    const events = [{ type: 'gatherHit', resourceId, x: r.x, y: r.y }];
    if (r.hp <= 0) {
      r.alive = false;
      r.respawnAt = this.tick + RESOURCE_RESPAWN_TICKS;
      const amount = r.yield.min + Math.floor(this.rng() * (r.yield.max - r.yield.min + 1));
      const baseItem = r.yield.item;
      const tierable = ITEMS[baseItem] && ITEMS[baseItem].tierable;
      const quality = tierable ? rollGatherQuality(this.rng, toolMatch) : 'normal';
      const finalId = tierable ? qualifiedId(baseItem, quality) : baseItem;
      p.inventory[finalId] = (p.inventory[finalId] || 0) + amount;
      events.push({ type: 'gathered', item: finalId, amount, resourceId, quality });
    }
    return events;
  }

  attack(socketId, targetType, targetId) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return null;
    const now = Date.now();
    if (now - p.lastAttack < ATTACK_COOLDOWN_MS) return null;

    let target;
    if (targetType === 'mob') target = this.mobs.get(targetId);
    else if (targetType === 'player') target = this.players.get(targetId);
    if (!target || !target.alive || target === p) return null;

    const dist = Math.hypot(p.x - target.x, p.y - target.y);
    if (dist > ATTACK_RANGE) return null;
    p.lastAttack = now;

    const weapon = p.equipped && ITEMS[p.equipped];
    const rawDmg = weapon && weapon.damage ? weapon.damage : 4;
    const dmg = targetType === 'player' ? this.damagePlayer(target, rawDmg) : (target.hp -= rawDmg, rawDmg);
    const events = [{ type: 'attackHit', targetType, targetId, dmg }];

    if (target.hp <= 0) {
      target.alive = false;
      if (targetType === 'mob') {
        p.kills++;
        const meat = 2 + Math.floor(this.rng() * 3);
        p.inventory.meat_raw = (p.inventory.meat_raw || 0) + meat;
        if (target.type === 'wolf') {
          p.inventory.wolf_hide = (p.inventory.wolf_hide || 0) + 1;
        }
        this.trackKill(p, target.type);
        events.push({ type: 'mobKilled', mobId: targetId, by: socketId });
      } else {
        target.deaths++;
        p.kills++;
        events.push({ type: 'playerKilled', playerId: targetId, by: socketId });
        this.respawnPlayer(target);
      }
    }
    return events;
  }

  trackKill(p, mobType) {
    for (const [qid, progress] of Object.entries(p.activeQuests)) {
      const q = QUESTS[qid];
      if (q && q.type === 'kill' && q.mobType === mobType) {
        progress.progress = Math.min(q.amount, (progress.progress || 0) + 1);
      }
    }
  }

  respawnPlayer(p) {
    p.hp = p.maxHp;
    p.hunger = Math.max(p.hunger, 40);
    p.alive = true;
    let x, y, tries = 0;
    do {
      x = this.world.size / 2 + (this.rng() - 0.5) * 14;
      y = this.world.size / 2 + (this.rng() - 0.5) * 14;
      tries++;
    } while (!isWalkable(this.world, x, y) && tries < 50);
    p.x = x; p.y = y;
  }

  craft(socketId, itemId, quality) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return { ok: false, reason: 'dead' };
    const recipe = RECIPES.find(r => r.result === itemId);
    if (!recipe) return { ok: false, reason: 'unknown recipe' };
    if (recipe.requiresStructure && !p.nearStructures.includes(recipe.requiresStructure)) {
      return { ok: false, reason: `need a ${recipe.requiresStructure} nearby` };
    }
    if (recipe.requiresQuest && !p.completedQuests.has(recipe.requiresQuest)) {
      return { ok: false, reason: 'recipe not yet learned' };
    }

    // Quality only applies to results marked tierable; everything else
    // (structures, armor, cloth gear, fishing rod) always crafts "normal".
    const resultTierable = ITEMS[itemId] && ITEMS[itemId].tierable;
    const effectiveQuality = resultTierable && QUALITY_TIERS.includes(quality) ? quality : 'normal';

    const resolvedCost = {};
    for (const [material, amt] of Object.entries(recipe.cost)) {
      const materialTierable = ITEMS[material] && ITEMS[material].tierable;
      const costId = materialTierable && effectiveQuality !== 'normal' ? qualifiedId(material, effectiveQuality) : material;
      resolvedCost[costId] = (resolvedCost[costId] || 0) + amt;
    }
    for (const [id, amt] of Object.entries(resolvedCost)) {
      if ((p.inventory[id] || 0) < amt) return { ok: false, reason: `not enough ${id.replace(/_/g, ' ')}` };
    }
    for (const [id, amt] of Object.entries(resolvedCost)) {
      p.inventory[id] -= amt;
    }

    const outputId = resultTierable ? qualifiedId(itemId, effectiveQuality) : itemId;
    p.inventory[outputId] = (p.inventory[outputId] || 0) + recipe.count;
    return { ok: true, item: outputId, quality: effectiveQuality };
  }

  equip(socketId, itemId) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return;
    if (itemId === null) { p.equipped = null; return; }
    const def = ITEMS[itemId];
    if (!def || def.stackable || def.armorSlot) return;
    if (!(p.inventory[itemId] > 0)) return;
    p.equipped = itemId;
  }

  equipArmor(socketId, itemId) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return;
    if (itemId === null) return;
    const def = ITEMS[itemId];
    if (!def || !def.armorSlot) return;
    if (!(p.inventory[itemId] > 0)) return;
    const slot = def.armorSlot;
    p.armor[slot] = p.armor[slot] === itemId ? null : itemId;
  }

  eat(socketId, itemId) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return { ok: false };
    const def = ITEMS[itemId];
    if (!def || !def.food) return { ok: false };
    if (!(p.inventory[itemId] > 0)) return { ok: false };
    p.inventory[itemId]--;
    p.hunger = Math.min(p.maxHunger, p.hunger + def.food);
    return { ok: true };
  }

  place(socketId, itemId, x, y) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return { ok: false };
    const def = ITEMS[itemId];
    if (!def || !def.placeable) return { ok: false };
    if (!(p.inventory[itemId] > 0)) return { ok: false };
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist > 2.5) return { ok: false };
    if (!isWalkable(this.world, x, y) && itemId !== 'wall') return { ok: false };
    p.inventory[itemId]--;
    const id = 'p' + genId();
    const structure = { id, type: itemId, x, y, hp: 40, maxHp: 40, alive: true, ownerId: socketId };
    this.structures.set(id, structure);
    return { ok: true, structure };
  }

  // ---------- Quests / NPCs ----------

  nearbyNpc(p, npcId) {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) return null;
    const dist = Math.hypot(p.x - npc.x, p.y - npc.y);
    if (dist > NPC_INTERACT_RANGE) return null;
    return npc;
  }

  talkToNpc(socketId, npcId) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return { ok: false, reason: 'dead' };
    const npc = this.nearbyNpc(p, npcId);
    if (!npc) return { ok: false, reason: 'too far away' };

    // Find the first quest in this NPC's chain not yet completed.
    let quest = null;
    for (const qid of npc.questChain) {
      if (!p.completedQuests.has(qid)) { quest = QUESTS[qid]; break; }
    }

    if (!quest) {
      return { ok: true, npc: { id: npc.id, name: npc.name }, state: 'done', text: `${npc.name} has no more tasks for you. Thank you for protecting Wildholm!` };
    }

    if (p.activeQuests[quest.id]) {
      const progress = this.questProgressFor(p, quest);
      const complete = progress.done >= progress.total;
      return {
        ok: true, npc: { id: npc.id, name: npc.name }, state: complete ? 'ready' : 'in_progress',
        quest: this.describeQuest(quest, progress),
      };
    }

    return {
      ok: true, npc: { id: npc.id, name: npc.name }, state: 'offer',
      quest: this.describeQuest(quest, this.questProgressFor(p, quest)),
    };
  }

  // Quality-agnostic inventory helpers: quests care about "10 wood", not
  // which quality tier it came in, so these sum across all tiers of a
  // tierable base item (crafting, by contrast, cares about exact quality
  // and uses the inventory map directly).
  inventoryQuantity(p, baseItem) {
    if (!(ITEMS[baseItem] && ITEMS[baseItem].tierable)) return p.inventory[baseItem] || 0;
    return QUALITY_TIERS.reduce((sum, q) => sum + (p.inventory[qualifiedId(baseItem, q)] || 0), 0);
  }

  consumeInventory(p, baseItem, amount) {
    if (!(ITEMS[baseItem] && ITEMS[baseItem].tierable)) {
      p.inventory[baseItem] = (p.inventory[baseItem] || 0) - amount;
      return;
    }
    let remaining = amount;
    for (const q of QUALITY_TIERS) { // spend crude first, save the good stuff
      const id = qualifiedId(baseItem, q);
      const have = p.inventory[id] || 0;
      const take = Math.min(have, remaining);
      p.inventory[id] = have - take;
      remaining -= take;
      if (remaining <= 0) break;
    }
  }

  questProgressFor(p, quest) {
    if (quest.type === 'collect') {
      const entries = Object.entries(quest.cost).map(([item, amt]) => ({
        item, need: amt, have: Math.min(amt, this.inventoryQuantity(p, item)),
      }));
      const done = entries.every(e => e.have >= e.need) ? 1 : 0;
      return { entries, done, total: 1 };
    }
    const active = p.activeQuests[quest.id];
    const done = active ? (active.progress || 0) : 0;
    return { done, total: quest.amount };
  }

  describeQuest(quest, progress) {
    return {
      id: quest.id, title: quest.title, desc: quest.desc, type: quest.type,
      cost: quest.cost, mobType: quest.mobType, amount: quest.amount,
      rewardText: quest.rewardText, progress,
    };
  }

  acceptQuest(socketId, questId) {
    const p = this.players.get(socketId);
    const quest = QUESTS[questId];
    if (!p || !p.alive || !quest) return { ok: false };
    if (p.completedQuests.has(questId) || p.activeQuests[questId]) return { ok: false };
    const npc = this.nearbyNpc(p, quest.npc);
    if (!npc) return { ok: false, reason: 'too far away' };
    p.activeQuests[questId] = { progress: 0 };
    return { ok: true, questId };
  }

  turnInQuest(socketId, questId) {
    const p = this.players.get(socketId);
    const quest = QUESTS[questId];
    if (!p || !p.alive || !quest) return { ok: false };
    if (!p.activeQuests[questId]) return { ok: false, reason: 'quest not active' };
    const npc = this.nearbyNpc(p, quest.npc);
    if (!npc) return { ok: false, reason: 'too far away' };

    const progress = this.questProgressFor(p, quest);
    if (progress.done < progress.total) return { ok: false, reason: 'objective not complete' };

    if (quest.type === 'collect') {
      for (const [item, amt] of Object.entries(quest.cost)) {
        this.consumeInventory(p, item, amt);
      }
    }
    delete p.activeQuests[questId];
    p.completedQuests.add(questId);
    if (quest.reward && quest.reward.items) {
      for (const [item, amt] of Object.entries(quest.reward.items)) {
        p.inventory[item] = (p.inventory[item] || 0) + amt;
      }
    }
    return { ok: true, questId, reward: quest.reward };
  }

  update(dtMs) {
    this.tick++;
    const dt = dtMs / 1000;

    // Players: movement + hunger/regen
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      let mx = 0, my = 0;
      if (p.input.up) my -= 1;
      if (p.input.down) my += 1;
      if (p.input.left) mx -= 1;
      if (p.input.right) mx += 1;
      if (mx || my) {
        const len = Math.hypot(mx, my);
        mx /= len; my /= len;
        const nx = p.x + mx * MOVE_SPEED * dt;
        const ny = p.y + my * MOVE_SPEED * dt;
        if (isWalkable(this.world, nx, p.y)) p.x = nx;
        if (isWalkable(this.world, p.x, ny)) p.y = ny;
        p.dir = { x: mx, y: my };
      }

      const near = [];
      for (const s of this.structures.values()) {
        if (s.alive && Math.hypot(s.x - p.x, s.y - p.y) < STRUCTURE_RANGE && !near.includes(s.type)) {
          near.push(s.type);
        }
      }
      p.nearStructures = near;
    }

    if (this.tick % HUNGER_TICK_INTERVAL === 0) {
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        p.hunger = Math.max(0, p.hunger - 1);
        if (p.hunger <= 0) {
          p.hp -= 3;
          if (p.hp <= 0) {
            p.alive = false;
            p.deaths++;
          }
        }
      }
    }

    if (this.tick % REGEN_TICK_INTERVAL === 0) {
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (p.hunger > 50 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 2);
      }
    }

    // dead players auto respawn after short delay
    for (const p of this.players.values()) {
      if (!p.alive) {
        p._deadTicks = (p._deadTicks || 0) + 1;
        if (p._deadTicks > Math.round(3000 / TICK_MS)) {
          p._deadTicks = 0;
          this.respawnPlayer(p);
        }
      } else {
        p._deadTicks = 0;
      }
    }

    // Resource respawn
    for (const r of this.resources.values()) {
      if (!r.alive && this.tick >= r.respawnAt) {
        r.alive = true;
        r.hp = r.maxHp;
      }
    }

    // Mobs AI
    const night = this.isNight();
    if (night && this.mobs.size < MAX_MOBS && this.rng() < 0.02) this.spawnMob();

    for (const m of this.mobs.values()) {
      if (!m.alive) continue;
      // find nearest player
      let nearest = null, nearestDist = Infinity;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < nearestDist) { nearestDist = d; nearest = p; }
      }

      if (nearest && nearestDist < MOB_AGGRO_RANGE) {
        m.state = 'chase';
        m.targetPlayerId = nearest.id;
        const dx = nearest.x - m.x, dy = nearest.y - m.y;
        const len = Math.hypot(dx, dy) || 1;
        if (nearestDist > MOB_ATTACK_RANGE) {
          const speed = 2.6;
          const nx = m.x + (dx / len) * speed * dt;
          const ny = m.y + (dy / len) * speed * dt;
          if (isWalkable(this.world, nx, ny)) { m.x = nx; m.y = ny; }
        } else {
          const now = Date.now();
          if (now - m.lastAttack > MOB_ATTACK_COOLDOWN_MS) {
            m.lastAttack = now;
            this.damagePlayer(nearest, m.damage);
            if (nearest.hp <= 0) {
              nearest.alive = false;
              nearest.deaths++;
            }
          }
        }
      } else {
        m.state = 'wander';
        m.wanderAngle += (this.rng() - 0.5) * 0.6;
        const speed = 0.8;
        const nx = m.x + Math.cos(m.wanderAngle) * speed * dt;
        const ny = m.y + Math.sin(m.wanderAngle) * speed * dt;
        if (isWalkable(this.world, nx, ny)) { m.x = nx; m.y = ny; }
        else m.wanderAngle += Math.PI;
      }
    }
    // cleanup dead mobs after a delay (respawn elsewhere)
    for (const [id, m] of this.mobs) {
      if (!m.alive) {
        m._deadTicks = (m._deadTicks || 0) + 1;
        if (m._deadTicks > Math.round(8000 / TICK_MS)) {
          this.mobs.delete(id);
          this.spawnMob();
        }
      }
    }
  }

  snapshot() {
    return {
      tick: this.tick,
      dayPhase: this.dayPhase(),
      isNight: this.isNight(),
      players: Array.from(this.players.values()).map(p => ({
        id: p.id, name: p.name, x: p.x, y: p.y, dir: p.dir,
        hp: p.hp, maxHp: p.maxHp, hunger: p.hunger, maxHunger: p.maxHunger,
        equipped: p.equipped, armor: p.armor, alive: p.alive, kills: p.kills, deaths: p.deaths,
      })),
      mobs: Array.from(this.mobs.values()).filter(m => m.alive).map(m => ({
        id: m.id, type: m.type, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, state: m.state,
      })),
      resources: Array.from(this.resources.values()).filter(r => r.alive).map(r => ({
        id: r.id, type: r.type, x: r.x, y: r.y, hp: r.hp, maxHp: r.maxHp,
      })),
      structures: Array.from(this.structures.values()).filter(s => s.alive).map(s => ({
        id: s.id, type: s.type, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp,
      })),
      npcs: this.npcs.map(n => ({ id: n.id, name: n.name, icon: n.icon, x: n.x, y: n.y })),
    };
  }

  playerState(socketId) {
    const p = this.players.get(socketId);
    if (!p) return null;
    const activeQuests = {};
    for (const [qid, state] of Object.entries(p.activeQuests)) {
      const quest = QUESTS[qid];
      activeQuests[qid] = this.describeQuest(quest, this.questProgressFor(p, quest));
    }
    return {
      inventory: p.inventory, equipped: p.equipped, armor: p.armor,
      hp: p.hp, maxHp: p.maxHp, hunger: p.hunger, maxHunger: p.maxHunger, alive: p.alive,
      nearStructures: p.nearStructures,
      completedQuests: Array.from(p.completedQuests),
      activeQuests,
    };
  }
}

module.exports = { Game, TICK_MS, WORLD_SIZE };
