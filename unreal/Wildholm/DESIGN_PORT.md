# Porting Wildholm's game design to Unreal Engine 5

The browser version's game *design* — quality tiers, resource fields,
quests, mob AI, day/night — is solid and shouldn't need reinventing, just
re-implementing on Unreal's native replication instead of Socket.IO
snapshots. This maps each system to where it should live in the UE5
project. Everything under "Editor work" requires the GUI and is out of
reach for a blind-authored scaffold; everything under "C++" is either
already stubbed in `Source/Wildholm/` or described precisely enough to
write once you're in the Editor.

## World generation (`server/world.js`)

The island-shape algorithm (radial falloff warped by large-scale noise,
independent mountain/cliff noise fields, path carving) is engine-agnostic
math — it can be ported almost line-for-line into a C++ utility or a
Python/Houdini Digital Asset that generates a heightmap + biome mask
texture, then:

- **Editor work:** import the heightmap into a Landscape, paint material
  layers (grass/forest/sand/stone/path) driven by the biome mask, or use
  Landscape's built-in erosion/layer tools instead of a hand-ported mask
  if you'd rather art-direct it directly than regenerate procedurally.
- Alternative: keep `server/world.js` as a standalone Node script, run it
  once, export `tiles`/`paths` as a 16-bit grayscale PNG heightmap +
  an biome-index PNG, and import both.

## Items, recipes, quality tiers (`server/items.js`, `server/quality.js`)

- **C++:** `EWildholmQuality` enum already ported (`WildholmTypes.h`).
  The Crude/Normal/Fine quality-roll formula (`rollGatherQuality` in
  `server/quality.js`) is pure math — port it directly into a
  `UWildholmQualityLibrary::RollGatherQuality(float ToolMatch, float
  FieldBias)` blueprint function library.
- **Editor work:** create a `DataTable` (row struct = item definition:
  id, display name, icon, stack size, equip slot, damage/armor value,
  crafting-material flag) and import the content of `ITEM_INFO_BASE`
  from `public/js/data.js` as CSV. Recipes become a second DataTable
  (id, result item, ingredient list, required tool tier) mirroring
  `RECIPES`.

## Resource fields (`server/resourceFields.js`)

The roving-deposit logic (one active hotspot per material, richness/
capacity/lifetime, depletion-triggers-relocation) is server-authoritative
game logic, not rendering — port it near-verbatim into a
`UWildholmResourceFieldSubsystem` (a `UWorldSubsystem`, server-only,
replicating just the fields' current position/richness/material to
clients for the aura/glow effect). Keep `MATERIAL_BIOME`, deposit radius,
and lifetime constants as-is; they're already tuned.

- **Editor work:** the glow-ring aura effect (`buildFieldAura` in
  `render3d.js`) becomes a Niagara system or a simple decal, spawned/
  moved by the subsystem above.

## Quests & NPCs (`server/quests.js`)

- **Editor work:** `NPCS`/`QUESTS` become DataTables (NPC id/name/icon/
  quest-chain array; quest id/title/desc/type/cost/reward). The dialogue
  UI is a UMG widget driven by reading the DataTable + the player's
  `ActiveQuests` array (already on `AWildholmCharacter`).
- **C++:** `talkToNpc`/`turnInQuest`/`trackKill` from `server/game.js`
  port to `UFUNCTION(Server, Reliable)` calls on `AWildholmCharacter` or
  a dedicated `UWildholmQuestComponent`, operating on the DataTable +
  `ActiveQuests` instead of the in-memory `Map` the JS version used.

## Mobs / wildlife AI (`server/mobs.js`)

- **Editor work:** each mob type becomes a Blueprint (or C++) `ACharacter`
  subclass driven by an `AIController` + Behavior Tree. The *design* —
  aggressive/flee/neutral behavior, spawn biomes, day/night spawn bias,
  drop tables — maps directly onto Behavior Tree decorators/services and
  a drop-table DataTable; the JSON shape in `MOB_TYPES` is close to a
  ready-made spec for those Behavior Trees.
- Wolves/bears "hunt nearest player" → a Behavior Tree with a
  "find nearest player" service + Move To + Attack task. Rabbits/deer
  "flee on sight" → the same nearest-player service driving a Move To
  *away* from the target. Boars "wander, then fight back once attacked" →
  a Blackboard flag flipped by `ApplyDamage` (already stubbed on
  `AWildholmCharacter` — extend the same pattern for mob health).

## Day/night cycle

Already ported: `AWildholmGameState::DayPhase`/`bIsNight`
(`WildholmGameState.h/.cpp`), replicated automatically. Drive a
`Directional Light` + `Sky Atmosphere` actor's intensity/rotation and a
`Post Process Volume`'s exposure from `DayPhase` in a small
`AWildholmSkyManager` actor (Editor + a little C++/Blueprint) — the
Unreal equivalent of `setDayPhase()` in `render3d.js`.

## Equipment visuals (held weapons, worn armor)

- **Editor work:** with real skeletal meshes this becomes standard
  Unreal equipment-attachment (socket-based mesh attach on the
  character's skeleton) instead of procedurally building tier-colored
  primitive meshes — genuinely *simpler* than the web version once the
  art exists, since sockets + skeletal attachment are core engine
  features rather than something to hand-roll.

## What to build first

Recommended order, since each step is testable in isolation once you're
in the Editor (unlike this scaffold, which isn't testable at all yet):

1. Open the project, fix compile errors, confirm `AWildholmCharacter`
   spawns and moves on an empty default level.
2. Block out the island (even a grey-box Landscape) and confirm
   multiplayer works (two Play-In-Editor clients, PIE "Number of
   Players" = 2) — validates the GameMode/GameState replication before
   any art work is sunk in.
3. Item DataTable + a minimal inventory HUD — smallest slice that
   proves the full data → UI pipeline.
4. Everything else layers on top of that loop.
