// Real-art overrides for Wildholm's default low-poly procedural models.
//
// By default every player, NPC, and animal is built out of simple Three.js
// primitives (see render3d.js). Drop a file into public/assets/sprites/ or
// public/assets/models/ and add an entry below to replace any of them with
// real character art — no other code changes needed.
//
// Two asset types are supported:
//
//   sprite — a 2D image (PNG with transparency works best) rendered as a
//            billboard that always rotates to face the camera around the
//            vertical axis, like classic 2.5D sprite-based games. This is
//            the right choice for illustrated/painted/photoreal character
//            art (concept art, portraits) that isn't a 3D model.
//            { type: 'sprite', url: '/assets/sprites/<file>.png', width, height }
//
//   model  — a real rigged/unrigged 3D model in glTF binary (.glb) format,
//            loaded with Three.js's GLTFLoader. Use this for actual 3D
//            character models exported from Blender/Mixamo/etc.
//            { type: 'model', url: '/assets/models/<file>.glb', scale }
//
// Until an asset is added below, everything keeps using the built-in
// procedural geometry — this file being empty is the normal/default state.
export const ASSET_MANIFEST = {
  // Applies to every player if set (no per-player skins yet).
  player: {
    // default: { type: 'sprite', url: '/assets/sprites/ranger.png', width: 1.6, height: 2.6 },
  },
  // Keyed by NPC id (see server/quests.js NPCS).
  npc: {
    // elder_rowan: { type: 'sprite', url: '/assets/sprites/elder_rowan.png', width: 1.6, height: 2.6 },
  },
  // Keyed by animal type (see server/mobs.js MOB_TYPES).
  mob: {
    // wolf: { type: 'model', url: '/assets/models/wolf.glb', scale: 1 },
  },
};
