# Wildholm — native engine prototype (Bevy)

A real, compiled, verified native build of Wildholm's world — this one
actually builds and runs in this environment, unlike the Unreal Engine 5
scaffold in `../../unreal/` (no engine binary, no GUI, no network access
to install it there; see `../../unreal/Wildholm/README.md`).

![Proof screenshot](docs/proof_screenshot.png)

That screenshot is a real render, not a mockup: the actual island
generation algorithm ported from `server/world.js`, real PBR terrain
textures blended per-vertex across biomes (grass/forest/sand/stone all
visible, tiling and blending correctly), a village (ported from
`buildVillage()`/`buildHut()`/`buildKeep()` in `public/js/render3d.js`)
sitting on it, and a controllable player character with a following
camera — all lit with real-time shadows, compiled and run headlessly in
this sandbox, captured to disk, and inspected.

## What's real vs. what's a stub

**Real and verified (compiles, runs, screenshot-checked):**

- `src/world.rs` — the island generator, ported near line-for-line from
  `server/world.js`: radial falloff warped by large-scale noise for the
  coastline, an independent mountain noise field (so highlands don't
  always crown the exact map center), coastal cliff patches, and the
  5-trail path-carving algorithm. Same xorshift RNG as the JS version.
- `src/terrain.rs` + `src/terrain_material.rs` +
  `assets/shaders/terrain_blend.wgsl` — builds an actual heightmapped Bevy
  `Mesh` (per-vertex height averaging + jitter, same approach as
  `setWorld()` in `render3d.js`), split into land/water index buffers
  sharing one position buffer so they stitch with no seams. The land mesh
  uses a custom `MaterialExtension` on `StandardMaterial` that blends four
  real biome diffuse textures per-fragment, weighted by per-vertex weights
  carried in the vertex-color attribute — the WGSL/Bevy equivalent of
  `applyBlendedTerrainTextures()`'s shader injection in `render3d.js`.
  Hit two real bugs getting this right, both fixed by actually running it
  and looking at the output rather than trusting the code: the material
  briefly showed one flat color across huge stretches of ground (a
  legitimate biome, just an unlucky village placement, confirmed against
  the real world-gen output — not a bug), and then a genuine bug where
  the terrain rendered as a uniform blur with zero texture detail, caused
  by the default texture sampler clamping to the edge pixel instead of
  tiling (UVs run well past `[0,1]` on an 80-tile world) — fixed by
  loading the textures with explicit `Repeat` addressing.
- `src/village.rs` — the keep + 5-hut layout, ported from
  `render3d.js`'s `buildVillage()`.
- `src/player.rs` — a capsule character with WASD movement and a
  lerped third-person follow camera (matching the `CAMERA_BACK`/
  `CAMERA_HEIGHT`/`CAMERA_LERP` constants in `render3d.js`). The
  movement/camera *systems* are real, compiled code; headless testing
  here can't press keys, so only the initial placement (spawn position,
  camera framing) has actually been visually verified — the input
  handling itself hasn't been interactively exercised.
- `main.rs` ties it together: generates the world, builds/spawns the
  terrain meshes, finds a walkable spawn point (preferring grass/forest
  over sand/stone for a nicer default view), spawns the player just off
  from the village so they don't start inside the keep, lights the scene,
  and — for headless verification — screenshots and exits after enough
  frames for the four 1024×1024 textures to actually finish loading.

**Known simplification:** the terrain-texture-blend vertex-color
attribute now carries the four biome blend *weights* (grass/forest/sand/
stone), which used the last spare RGBA channel — there's no room left to
also carry the dirt-path tint the browser version shows. `world.rs` still
computes the path data (`World::paths`/`path_at()`, currently unused,
`#[allow(dead_code)]`'d rather than deleted); re-adding the visual means
either a second vertex attribute or a small greyscale path-mask texture
sampled alongside the four biome textures.

**Still a stub / not started:** everything gameplay-related — no
networking, no inventory/crafting/quests, no mobs, no resource nodes/
fields, no day-night cycle. This is a world-rendering + character-
movement prototype, not a game yet. See
`../../unreal/Wildholm/DESIGN_PORT.md` for the system-by-system porting
plan (item/quest/mob data, resource fields, day/night) — it was written
for the Unreal port but the *design* mapping applies here too; only the
target APIs differ (Bevy ECS + its own networking crates instead of
Unreal's built-in replication).

## Why Bevy and not Unreal

This environment has a real native toolchain (`gcc`/`g++`/`cmake`) and
`cargo`/crates.io access, but no GPU-accelerated hardware, no display
server beyond what Xvfb provides, and — critically for Unreal specifically
— no way to install Unreal Engine itself (no GUI, and Epic's
launcher/marketplace aren't reachable through the network policy here).
Bevy is a real, actively developed native game engine (Rust, ECS-based,
wgpu-backed PBR renderer) that compiles and runs with tools already
available, which made it possible to actually verify this instead of
producing more unverified scaffolding.

This is **not** a replacement for the Unreal Engine port — Unreal has a
substantially higher visual ceiling (Lumen, Nanite) and was the engine
explicitly chosen for that reason. This is a working reference/prototype
that proves out the "move to a native PBR pipeline" direction concretely,
and one that can keep growing directly in this environment for as long as
that's useful.

## Running it

Needs a few system packages beyond the Rust toolchain (Debian/Ubuntu):

```
sudo apt-get install -y xvfb libgl1-mesa-dri mesa-vulkan-drivers \
  libvulkan1 vulkan-tools libxkbcommon-x11-0 pkg-config \
  libasound2-dev libudev-dev libx11-dev libxi-dev libxcursor-dev \
  libxrandr-dev libxinerama-dev
```

Build:

```
cargo build
```

Bevy's default asset loader resolves `assets/` relative to the compiled
executable's directory, not the crate root — copy (or symlink) it in
after building:

```
cp -r assets target/debug/assets
```

Run headlessly under a virtual display with software rendering (no GPU
required — this is exactly how the proof screenshot was produced):

```
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json WGPU_BACKEND=vulkan \
  xvfb-run -a -s "-screen 0 1280x800x24" ./target/debug/wildholm-native
```

It runs for ~200 frames (slow under software rendering, but that gives
the four terrain textures time to actually finish loading before the
screenshot fires), saves `screenshot.png` next to wherever you ran it
from, and exits. On a machine with a real GPU, drop the `xvfb-run`
wrapper and the env vars and run the binary directly instead — you'll
get a live interactive window and can actually test WASD movement and
the follow camera, which headless testing here can't exercise.
