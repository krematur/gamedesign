const { generateWorld, TILE, isWalkable, WORLD_SIZE, makeRng } = require('./world');
const { ITEMS, RECIPES } = require('./items');

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

let nextEntityId = 1;
const genId = () => nextEntityId++;

class Game {
  constructor(seed) {
    this.world = generateWorld(seed);
    this.rng = makeRng((seed || 1) + 42);
    this.players = new Map(); // id -> player
    this.resources = new Map(); // id -> resource node
    this.mobs = new Map(); // id -> mob
    this.tick = 0;
    this.spawnResources();
    this.spawnInitialMobs();
  }

  isNight() {
    const phase = (this.tick % DAY_LENGTH_TICKS) / DAY_LENGTH_TICKS;
    return phase > 0.55 && phase < 0.97;
  }

  dayPhase() {
    return (this.tick % DAY_LENGTH_TICKS) / DAY_LENGTH_TICKS;
  }

  spawnResources() {
    for (let y = 0; y < this.world.size; y++) {
      for (let x = 0; x < this.world.size; x++) {
        const t = this.world.tiles[y * this.world.size + x];
        const r = this.rng();
        if (t === TILE.FOREST && r < 0.12) {
          this.addResource('tree', x + 0.5, y + 0.5);
        } else if (t === TILE.STONE && r < 0.16) {
          this.addResource('rock', x + 0.5, y + 0.5);
        } else if (t === TILE.GRASS && r < 0.03) {
          this.addResource('bush', x + 0.5, y + 0.5);
        }
      }
    }
  }

  addResource(type, x, y) {
    const id = 'r' + genId();
    const hpByType = { tree: 30, rock: 40, bush: 12 };
    const yieldByType = {
      tree: { item: 'wood', min: 3, max: 6 },
      rock: { item: 'stone', min: 2, max: 5 },
      bush: { item: 'berry', min: 1, max: 3 },
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
      id, x, y, hp: 30, maxHp: 30, damage: 8,
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
      alive: true,
      lastAttack: 0,
      lastGather: 0,
      input: { up: false, down: false, left: false, right: false },
      near_fire: false,
      joinedAt: Date.now(),
      kills: 0,
      deaths: 0,
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

  gather(socketId, resourceId) {
    const p = this.players.get(socketId);
    const r = this.resources.get(resourceId);
    if (!p || !p.alive || !r || !r.alive) return null;
    const now = Date.now();
    if (now - p.lastGather < GATHER_COOLDOWN_MS) return null;
    const dist = Math.hypot(p.x - r.x, p.y - r.y);
    if (dist > GATHER_RANGE) return null;
    p.lastGather = now;

    let dmg = 5;
    const tool = p.equipped && ITEMS[p.equipped];
    if (tool && tool.tool === 'axe' && r.type === 'tree') dmg = 14;
    if (tool && tool.tool === 'pickaxe' && r.type === 'rock') dmg = 14;
    if (r.type === 'bush') dmg = r.hp; // one-shot harvest

    r.hp -= dmg;
    const events = [{ type: 'gatherHit', resourceId, x: r.x, y: r.y }];
    if (r.hp <= 0) {
      r.alive = false;
      r.respawnAt = this.tick + RESOURCE_RESPAWN_TICKS;
      const amount = r.yield.min + Math.floor(this.rng() * (r.yield.max - r.yield.min + 1));
      p.inventory[r.yield.item] = (p.inventory[r.yield.item] || 0) + amount;
      events.push({ type: 'gathered', item: r.yield.item, amount, resourceId });
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
    const dmg = weapon && weapon.damage ? weapon.damage : 4;
    target.hp -= dmg;
    const events = [{ type: 'attackHit', targetType, targetId, dmg }];

    if (target.hp <= 0) {
      target.alive = false;
      if (targetType === 'mob') {
        p.kills++;
        const meat = 2 + Math.floor(this.rng() * 3);
        p.inventory.meat_raw = (p.inventory.meat_raw || 0) + meat;
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

  craft(socketId, itemId) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return { ok: false, reason: 'dead' };
    const recipe = RECIPES.find(r => r.result === itemId);
    if (!recipe) return { ok: false, reason: 'unknown recipe' };
    if (recipe.requiresFire && !p.near_fire) return { ok: false, reason: 'need a campfire nearby' };
    for (const [item, amt] of Object.entries(recipe.cost)) {
      if ((p.inventory[item] || 0) < amt) return { ok: false, reason: `not enough ${item}` };
    }
    for (const [item, amt] of Object.entries(recipe.cost)) {
      p.inventory[item] -= amt;
    }
    const def = ITEMS[itemId];
    if (def.placeable) {
      p.inventory[itemId] = (p.inventory[itemId] || 0) + recipe.count;
    } else if (def.tool || def.stackable === false) {
      p.inventory[itemId] = (p.inventory[itemId] || 0) + recipe.count;
    } else {
      p.inventory[itemId] = (p.inventory[itemId] || 0) + recipe.count;
    }
    return { ok: true, item: itemId };
  }

  equip(socketId, itemId) {
    const p = this.players.get(socketId);
    if (!p || !p.alive) return;
    if (itemId === null) { p.equipped = null; return; }
    const def = ITEMS[itemId];
    if (!def || def.stackable) return;
    if (!(p.inventory[itemId] > 0)) return;
    p.equipped = itemId;
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
    if (!this.structures) this.structures = new Map();
    this.structures.set(id, structure);
    return { ok: true, structure };
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

      p.near_fire = false;
      if (this.structures) {
        for (const s of this.structures.values()) {
          if (s.type === 'campfire' && s.alive && Math.hypot(s.x - p.x, s.y - p.y) < 3) {
            p.near_fire = true;
            break;
          }
        }
      }
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
            this.respawnTimer = this.respawnTimer || new Map();
          }
        }
      }
    }

    if (this.tick % REGEN_TICK_INTERVAL === 0) {
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (p.hunger > 50 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 2);
        if (!p.alive && p.hp <= 0) this.respawnPlayer(p);
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
            nearest.hp -= m.damage;
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
        equipped: p.equipped, alive: p.alive, kills: p.kills, deaths: p.deaths,
      })),
      mobs: Array.from(this.mobs.values()).filter(m => m.alive).map(m => ({
        id: m.id, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, state: m.state,
      })),
      resources: Array.from(this.resources.values()).filter(r => r.alive).map(r => ({
        id: r.id, type: r.type, x: r.x, y: r.y, hp: r.hp, maxHp: r.maxHp,
      })),
      structures: this.structures ? Array.from(this.structures.values()).filter(s => s.alive).map(s => ({
        id: s.id, type: s.type, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp,
      })) : [],
    };
  }

  playerState(socketId) {
    const p = this.players.get(socketId);
    if (!p) return null;
    return {
      inventory: p.inventory, equipped: p.equipped, hp: p.hp, maxHp: p.maxHp,
      hunger: p.hunger, maxHunger: p.maxHunger, alive: p.alive, near_fire: p.near_fire,
    };
  }
}

module.exports = { Game, TICK_MS, WORLD_SIZE };
