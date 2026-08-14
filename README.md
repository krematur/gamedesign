# Wildholm — Multiplayer Survival RPG

A browser-based multiplayer survival RPG. Node.js + Socket.IO server that
runs an authoritative simulation of a shared world; players connect through
a lightweight HTML5 canvas client.

## Features

- Procedurally generated island world (grass, forest, stone, sand, water biomes)
- Real-time multiplayer via WebSockets — every player sees the same shared world
- Gathering: chop trees for wood, mine rocks for stone, pick berry bushes for food
- Crafting: axe, pickaxe, spear, campfire, walls, and cooked meat (recipes in
  `server/items.js`)
- Combat: melee attacks against wildlife (wolves) and other players
- Survival stats: health and hunger, with starvation damage and natural regen
- Day/night cycle that darkens the world and spawns more wolves at night
- Building: place campfires (required to cook meat) and walls
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
  structure in front of you
- `Enter` — open chat / send message

## Architecture

- `server/world.js` — deterministic procedural world generation (tile grid)
- `server/items.js` — item and crafting recipe definitions
- `server/game.js` — authoritative game simulation: movement, gathering,
  crafting, combat, mob AI, day/night cycle, tick loop
- `server/index.js` — Express static file server + Socket.IO event wiring
- `public/` — canvas-based client (rendering, input, HUD, inventory,
  crafting UI, chat)

The server runs a fixed-timestep tick loop (~6.6 Hz) that updates the whole
simulation and broadcasts a state snapshot to every connected client, which
keeps all players in sync without any client-side authority.

## Roadmap ideas

- Persistent player accounts / save files
- Larger world with chunked streaming instead of full-state broadcast
- More biomes, creatures, and crafting tiers (armor, tiered tools)
- Player-owned bases with durability and raiding
- Quests / NPCs for RPG progression
