# Wildholm — Multiplayer Survival RPG

A browser-based multiplayer survival RPG. Node.js + Socket.IO server that
runs an authoritative simulation of a shared world; players connect through
a lightweight HTML5 canvas client.

## Features

- Procedurally generated island world (grass, forest, stone, sand, water biomes)
- Real-time multiplayer via WebSockets — every player sees the same shared world
- Gathering: chop trees for wood, mine rocks and iron veins, pick berry bushes for food
- Tiered gear progression:
  - Tools/weapons: stone tier (axe, pickaxe, spear) → iron tier (iron axe,
    iron pickaxe, iron sword), smelted from iron ore at a furnace
  - Armor: three slots (head/chest/legs) across cloth → leather → iron
    materials, each reducing incoming damage (stacking, capped at 60%)
- Crafting: full recipe list in `server/items.js`, including structures
  (campfire, furnace, walls) and gated recipes that require a nearby
  structure and/or a completed quest
- Combat: melee attacks against wildlife (wolves) and other players, with
  armor mitigating damage taken
- Survival stats: health and hunger, with starvation damage and natural regen
- Day/night cycle that darkens the world and spawns more wolves at night
- Quests & NPCs: Elder Rowan offers a linear quest chain (`server/quests.js`)
  — gather supplies, hunt wolves, mine iron for the blacksmith, defend the
  village — that unlocks leather and iron gear recipes as you progress
- Building: place campfires (needed to cook meat) and furnaces (needed to
  smelt iron and craft iron gear)
- In-world chat

## Running locally

```bash
npm install
npm start
```

Then open `http://localhost:3000` in a browser. Open multiple tabs/windows
(or have friends connect to your IP) to test multiplayer.

Environment variables:

- `PORT` — HTTP port (default `3000`)
- `WORLD_SEED` — integer seed for world generation (default `1337`)

## Controls

- `WASD` / arrow keys — move
- Left-click — gather the nearest resource or attack the nearest mob/player
  within reach (aims toward your cursor)
- `E` — open/close the crafting menu
- `Space` — eat the best available food in your inventory
- Click an inventory item to equip a tool/weapon, eat food, or place a
  structure in front of you; click an armor piece to equip/unequip it
- Click an NPC (within range) to talk, accept quests, and turn them in
- `Enter` — open chat / send message
- `Esc` — close an NPC dialogue

## Architecture

- `server/world.js` — deterministic procedural world generation (tile grid)
- `server/items.js` — item and crafting recipe definitions (tools, armor,
  structures, gating rules)
- `server/quests.js` — NPC and quest chain definitions
- `server/game.js` — authoritative game simulation: movement, gathering,
  crafting, combat, armor damage reduction, mob AI, day/night cycle, quest
  tracking, tick loop
- `server/index.js` — Express static file server + Socket.IO event wiring
- `public/` — canvas-based client (rendering, input, HUD, inventory, armor
  slots, crafting UI, NPC dialogue, quest tracker, chat)

The server runs a fixed-timestep tick loop (~6.6 Hz) that updates the whole
simulation and broadcasts a state snapshot to every connected client, which
keeps all players in sync without any client-side authority.

## Roadmap ideas

- Persistent player accounts / save files
- Larger world with chunked streaming instead of full-state broadcast
- More biomes, creatures, and additional gear tiers beyond iron
- Player-owned bases with durability and raiding
- Branching quest lines, multiple NPCs, and repeatable/daily quests
