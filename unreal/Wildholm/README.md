# Wildholm — Unreal Engine 5 port

This is the start of a native Unreal Engine 5 client/server, replacing the
browser (Three.js/Node.js/Socket.IO) version in `../../public` and
`../../server` for the sake of visual fidelity — real PBR materials, Lumen
lighting/reflections, Nanite geometry, and a proper landscape/foliage
pipeline instead of a stylized low-poly WebGL scene.

## Important: this was authored blind

The environment this was built in has **no GUI, no Unreal Engine
installed, and no network access to download the engine** — so none of
this has been opened, compiled, or tested. It's hand-written C++ and
plain-text config following standard UE5.3 conventions as accurately as
possible, but you should expect to fix at least minor compile errors on
first open (API surface shifts between engine versions, a missing include,
etc.). Treat it as a scaffold to get you started faster, not a finished,
verified build.

## What's here (text-authorable, so I could write it)

- `Wildholm.uproject` — project file, targets Engine 5.3 (change
  `EngineAssociation` if you're on a different 5.x version)
- `Source/Wildholm/` — C++ module:
  - `WildholmTypes.h` — `EWildholmQuality` (Crude/Normal/Fine, mirrors
    `server/quality.js`), `FWildholmInventorySlot`, `FWildholmQuestProgress`
  - `WildholmCharacter.h/.cpp` — third-person character, replicated
    Health/Hunger/Inventory/ActiveQuests, Enhanced Input movement/look,
    a `ServerGather` RPC stub
  - `WildholmGameState.h/.cpp` — replicated day/night cycle (`DayPhase`,
    `bIsNight`), mirrors the day/night logic in `server/game.js` and
    `public/js/render3d.js`'s `nightDarkness()`
  - `WildholmGameMode.h/.cpp`, `WildholmPlayerController`,
    `WildholmPlayerState` — wire the above together; this is the
    authoritative-server side, the native-networking replacement for
    `server/game.js`
- `Config/DefaultEngine.ini`, `Config/DefaultGame.ini` — minimal project
  settings (Lumen enabled, Enhanced Input as default, GameMode wired up)

## What's NOT here (requires the Unreal Editor GUI — I cannot author this)

Everything visual and most everything data-driven has to be built in the
Editor itself:

- **The level** (`Content/Maps/L_Wildholm.umap`, referenced by
  `DefaultEngine.ini` but not created) — build the island with Landscape
  sculpting + a material layer blend (grass/forest/sand/stone/cliff,
  matching the biome set in `server/world.js`), or import a heightmap
  exported from the existing world-gen (`server/world.js` writes out a
  tile grid — a small script could rasterize that to a PNG heightmap as a
  starting point for Landscape import)
- **Character/NPC/creature meshes and animations** — the old game used
  procedural low-poly primitives; this port should use real rigged
  meshes (Quixel Bridge/Fab, the Marketplace, or custom art) plus a
  Blueprint or Animation Blueprint driving locomotion
- **Materials** — the PBR textures already sourced for the web version
  (`../../public/assets/textures/terrain/`) can be reused directly as a
  starting point for Landscape material layers
- **UI** (UMG widgets) — inventory, crafting menu, quest dialogue, HP/
  Hunger bars; the Unreal equivalent of `public/js/client.js`'s DOM
  manipulation
- **DataTables** for items/recipes/quests/mobs — port the content (not
  the code) of `server/items.js`, `server/quests.js`, `server/mobs.js`
  into CSV/JSON DataTables importable in the Editor; see
  `DESIGN_PORT.md` for the field-by-field mapping
- **Resource-node, structure, and village Blueprints** — the equivalent
  of `public/js/render3d.js`'s procedural builders (`buildTree`,
  `buildHut`, `buildOreVein`, etc.), now built from real meshes as
  Blueprint actors instead of generated geometry

## Getting started

1. Install Unreal Engine 5.3+ via the Epic Games Launcher (requires an
   Epic account).
2. Right-click `Wildholm.uproject` → "Generate Visual Studio project
   files" (Windows) or use `UnrealBuildTool` directly on Mac/Linux, then
   open in the Editor. It will offer to build missing modules — accept.
3. Fix whatever compile errors show up (see the caveat above).
4. Create `Content/Maps/L_Wildholm` (or edit `DefaultEngine.ini` to point
   at whatever you name it) and start blocking out the island.
5. Work through `DESIGN_PORT.md` to bring the existing game design
   (items, quests, mobs, resource fields, quality tiers) across.

See `DESIGN_PORT.md` for the full system-by-system porting plan.
