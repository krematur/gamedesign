# Wildholm — Multiplayer Survival RPG

A browser-based multiplayer survival RPG rendered in full 3D. Node.js +
Socket.IO server that runs an authoritative simulation of a shared world;
players connect through a Three.js/WebGL client with a third-person camera.

## Features

- Real 3D world (Three.js/WebGL): a smooth heightmapped terrain mesh (water
  sunken, stone raised) with low-poly 3D models for every tree, rock, bush,
  fish spot, mob, player, NPC, and structure; a third-person camera follows
  the player and orbits toward the aim direction
- A real rendering pipeline, not just raw geometry: soft real-time shadows
  from a directional sun that follows the player (tight, sharp shadow
  frustum instead of one stretched over the whole map), a post-processing
  chain (bloom on fire/emissive surfaces, FXAA, ACES filmic tone mapping),
  a gradient sky dome, subtle per-vertex terrain color/height variation so
  biomes don't read as flat color blocks, and looping ember particles on
  campfires/torches
- Day/night cycle drives real lighting — sun/hemisphere light intensity, sky
  gradient, and fog all shift between day and a darker, foggier night
- Procedurally generated island world (grass, forest, stone, sand, water biomes)
- Real-time multiplayer via WebSockets — every player sees the same shared world
- Gathering: chop trees for wood, mine rocks/iron/coal/gold veins, dig clay
  pits, pick berry bushes for food, harvest shrubs for fiber, and fish
  shoreline waters for raw fish (requires a fishing rod)
- Wildlife ecosystem (`server/mobs.js`): five animal types with distinct AI —
  wolves and bears hunt the nearest player (bears hit much harder and are
  rarer); rabbits and deer flee on sight; boars wander peacefully but turn
  and fight back once attacked. Each drops its own materials (hides, furs,
  tusks, claws) alongside meat, and spawns in the biomes and day/night
  conditions that suit it (wolves favor night, grazers favor day)
- Resource quality tiers: every gathered material drops as **Crude**,
  **Normal**, or **Fine** quality — better tools improve your odds of a
  Fine catch. Crafting consumes a specific quality tier and the recipe UI
  lets you pick which one to use, producing a matching-quality result: a
  Fine Axe hits harder than any axe a "normal" recipe alone could ever
  produce. Applies to tools/weapons, all smelted ingots, and cooked food
- Resource fields (`server/resourceFields.js`), Star Wars Galaxies-style:
  each of the 8 harvestable raw materials has exactly one active "deposit"
  on the map at a time — a roving hotspot with its own randomly-rolled
  richness that dominates the Crude/Normal/Fine odds far more than gear
  does. Harvesting the same resource node outside any active deposit is
  mostly Crude/Normal regardless of tool; the good stuff is wherever the
  current hotspot happens to be. Deposits drain as they're mined and expire
  after 8–15 minutes either way, then respawn at a new random spot in a
  biome that suits the material — so the best place to mine iron this hour
  won't be the best place tomorrow, and making Fine-tier gear means
  scouting for wherever the richness currently is. Each deposit shows up
  in-world as a colored glowing ring on the ground (visible once you're
  close enough to render distance) — there's no map or list revealing them
  remotely, so finding one is real exploration
- Tiered gear progression, five material rungs deep:
  - Tools/weapons: stone (axe, pickaxe, spear) → iron → **steel** (smelted
    from iron ingot + coal at a furnace, gated behind the Master Smith
    quest) — each tier additionally craftable at Crude/Normal/Fine quality
  - Situational weapons: a Tusk Dagger (fast, low damage) and Claw
    Gauntlets (slow, heavy damage) trade the standard damage/speed curve
    for a different playstyle, each with its own attack cooldown
  - Armor: three slots (head/chest/legs) across cloth → leather → **heavy
    hide** (bear-hunting reward) → iron → **steel**, each reducing incoming
    damage (stacking, capped at 60%). Leather can be crafted from either
    wolf hide or deer hide — alternate recipes for the same item let you
    hunt whichever animal you find
  - A fourth equip slot, accessories: a Gold Ring (smelted from gold ore +
    coal) grants a passive +1 bonus to every gather yield
- Crafting: 40+ recipes in `server/items.js`, including structures
  (campfire, furnace, walls, reinforced brick walls, torches) and gated
  recipes that require a nearby structure and/or a completed quest. Recipes
  have a unique id independent of their output item, so multiple recipes
  can produce the same result via different ingredients
- Combat: melee attacks against wildlife and other players, with armor
  mitigating damage taken and per-weapon attack speed
- Survival stats: health and hunger, with starvation damage and natural regen
- Day/night cycle that darkens the world and shifts which animals spawn
- Quests & NPCs: Elder Rowan offers a six-quest chain (`server/quests.js`)
  — gather supplies, hunt wolves, catch fish, mine iron for the blacksmith,
  defend the village, then supply coal for the Master Smith — that unlocks
  leather, iron, and finally steel gear recipes as you progress. Quest
  turn-ins accept any quality tier of a material
- Building: place campfires (needed to cook meat/fish and fire clay into
  brick), furnaces (needed to smelt iron/gold/steel and craft that gear),
  walls/reinforced walls, and torches for light
- In-world chat
- Real-art pipeline: any player, NPC, or animal can be swapped from the
  built-in low-poly geometry to real character art — either a 2D
  illustration rendered as a camera-facing billboard, or a rigged/unrigged
  glTF (`.glb`) 3D model — by dropping a file in `public/assets/` and adding
  one line to `public/js/assets.js`. No art is wired in by default

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
- Mouse — aim (raycasts onto the ground to steer the camera and pick
  gather/attack targets)
- Left-click — gather the nearest resource or attack the nearest mob/player
  within reach (aims toward your cursor)
- `E` — open/close the crafting menu
- `Space` — eat the best available food in your inventory
- Click an inventory item to equip a tool/weapon, eat food, or place a
  structure in front of you; click an armor or accessory piece to
  equip/unequip it
- In the crafting menu, tiered recipes show Crude/Normal/Fine buttons —
  pick a tier to craft with materials of that quality
- Click an NPC (within range) to talk, accept quests, and turn them in
- `Enter` — open chat / send message
- `Esc` — close an NPC dialogue

## Architecture

- `server/world.js` — deterministic procedural world generation (tile grid)
- `server/quality.js` — Crude/Normal/Fine tier definitions, item id helpers
  (`wood` ↔ `wood_fine`), and the gather-quality roll (dominated by resource
  field bias, nudged a little by tool tier)
- `server/resourceFields.js` — the roving per-material resource deposits:
  placement, richness/capacity/lifetime rolls, bias lookup, depletion
- `server/items.js` — item and crafting recipe definitions; tierable base
  items auto-generate their Crude/Fine variants with scaled stats; recipes
  have an `id` distinct from their `result` so multiple recipes can share
  an output item
- `server/mobs.js` — animal type definitions (stats, AI behavior, spawn
  biomes, drop tables) that `game.js` drives generically
- `server/quests.js` — NPC and quest chain definitions
- `server/game.js` — authoritative game simulation: movement, gathering
  (with field-aware quality rolls), crafting (with quality selection),
  combat (with per-weapon attack speed), armor damage reduction,
  data-driven mob AI (aggressive/flee/neutral), day/night cycle, resource
  field lifecycle, quest tracking, tick loop
- `server/index.js` — Express static file server + Socket.IO event wiring
- `public/js/render3d.js` — Three.js scene: terrain mesh generation, entity
  mesh builders, resource field aura + ember particle rendering, the
  shadow/post-processing/sky pipeline, day/night lighting, camera follow
  (sun frustum included), mouse-to-ground raycasting, and world-to-screen
  projection (for the HTML/2D HUD overlay)
- `public/js/client.js` — networking, input, and all DOM-based UI (HUD,
  inventory, armor slots, crafting with quality selector, NPC dialogue,
  quest tracker, chat); delegates all 3D rendering to `render3d.js`
- `public/js/assets.js` — the real-art manifest (see "Adding real character
  art" below); empty by default
- `public/vendor/` — vendored Three.js build, `GLTFLoader`, and the
  post-processing pipeline (`EffectComposer`, bloom, FXAA, tone mapping),
  all served locally with no CDN dependency

### Rendering pipeline

The renderer is a real (if lightweight) pipeline, not just `renderer.render()`:

- **Shadows**: a directional "sun" light casts soft (PCF) shadows. Its
  shadow-camera frustum is a small box that follows the player each frame
  instead of trying to cover the whole 80x80 map — that keeps the shadow
  map's resolution sharp near the player, who's the only one looking at it
- **Post-processing** (`EffectComposer`): render → `UnrealBloomPass` (glow
  on fire and other emissive surfaces) → `FXAAPass` (antialiasing, since a
  composer bypasses the browser's native MSAA) → `OutputPass` (ACES filmic
  tone mapping + correct color space on the final image)
- **Sky**: a gradient sky dome (custom vertex/fragment shader, horizon →
  zenith) instead of a flat background color, with its colors driven by
  the day/night cycle alongside the fog
- **Terrain variation**: a cheap deterministic hash jitters each terrain
  vertex's height and brightness slightly, so biomes read as natural ground
  rather than flat, uniform color blocks
- **Particles**: campfires and torches have a small looping ember system
  (`THREE.Points`, additive blending) drifting up out of the flame

This gets Wildholm to a polished stylized/low-poly look. It does not and
cannot make it photorealistic — that gap is almost entirely about art
assets (high-poly models, hand-authored textures, animation), not rendering
code; see "Adding real character art" below for the asset pipeline that
exists for when real art is available.

### Adding real character art

By default every entity is built from simple Three.js primitives. To swap
one for real art, drop a file into `public/assets/sprites/` (a 2D image,
rendered as a camera-facing billboard — the right choice for illustrated or
photoreal character art that isn't a 3D model) or `public/assets/models/`
(a `.glb` 3D model, loaded with `GLTFLoader`), then add one line to
`public/js/assets.js`:

```js
export const ASSET_MANIFEST = {
  npc: {
    elder_rowan: { type: 'sprite', url: '/assets/sprites/elder_rowan.png', width: 1.6, height: 2.6 },
  },
};
```

Loading is async with an immediate placeholder (blank billboard, or a
wireframe capsule for models) so nothing blocks on missing/slow assets — a
failed load just keeps the placeholder forever rather than crashing.
See the READMEs in `public/assets/sprites/` and `public/assets/models/` for
the full option list (`player`/`npc`/`mob`, keyed by NPC id or animal type).

The server runs a fixed-timestep tick loop (~6.6 Hz) that updates the whole
simulation and broadcasts a state snapshot to every connected client, which
keeps all players in sync without any client-side authority. The client
renders two stacked canvases: a WebGL canvas for the 3D world and a
transparent 2D canvas on top for HUD elements (health bars, floating text)
projected from world space via the Three.js camera.

## Roadmap ideas

- Persistent player accounts / save files
- Larger world with chunked streaming instead of full-state broadcast
- More biomes, creatures, and gear tiers beyond steel/Fine
- Quality tiers for armor (currently only tools/weapons/food are tiered)
- Deeper fishing (bait, rare/legendary catches, different water biomes)
- Player-owned bases with durability and raiding
- Branching quest lines, multiple NPCs, and repeatable/daily quests
- Animated/rigged character and animal models (loaded models currently
  render in their bind pose — no walk/idle animation yet), instanced
  rendering for very large worlds, and a first-person camera option
- More accessory effects and additional accessory slots
- Per-player skins (the player asset override currently applies to everyone)
- A survey/scanner tool for a more deliberate hunt for resource fields than
  "look for the glowing ring," plus multiple simultaneous deposits per
  material on larger maps
- Resource field quality attributes beyond a single richness score (SWG-style
  multi-stat resources — conductivity, malleability, etc. — feeding into
  which stat a crafted item favors)
- Deeper rendering: ambient occlusion (SSAO), water surface normal
  animation/reflections, GPU instancing for large forests, visible
  equipped weapons/armor on character models, higher-poly hand-authored
  meshes for the hero entities (player, key NPCs)
