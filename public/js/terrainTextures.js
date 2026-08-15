// Real PBR textures for terrain biomes. Each entry needs at minimum a
// `diffuse` map; `normal` and `roughness` are optional but recommended.
// A biome with no entry here just keeps the flat vertex-colored look — so
// this can be filled in incrementally, one biome at a time, with no visual
// regression for the ones not done yet.
//
// `repeat` controls tiling density: how many times the texture repeats per
// world unit (tiles are ~1 world unit each). Smaller values = larger,
// less-repetitive texture per tile; tune per texture based on its apparent
// real-world scale.
export const TERRAIN_TEXTURES = {
  grass: {
    diffuse: '/assets/textures/terrain/grass_diffuse_1024.png',
    normal: '/assets/textures/terrain/grass_normal_opengl_1024.png',
    roughness: '/assets/textures/terrain/grass_roughness_1024.png',
    repeat: 0.35,
  },
  forest: {
    diffuse: '/assets/textures/terrain/forest_floor_diffuse_1024.png',
    normal: '/assets/textures/terrain/forest_floor_normal_opengl_1024.png',
    roughness: '/assets/textures/terrain/forest_floor_roughness_1024.png',
    repeat: 0.35,
  },
  sand: {
    diffuse: '/assets/textures/terrain/sand_diffuse_1024.png',
    normal: '/assets/textures/terrain/sand_normal_opengl_1024.png',
    roughness: '/assets/textures/terrain/sand_roughness_1024.png',
    repeat: 0.3,
  },
  stone: {
    diffuse: '/assets/textures/terrain/stone_diffuse_1024.png',
    normal: '/assets/textures/terrain/stone_normal_opengl_1024.png',
    roughness: '/assets/textures/terrain/stone_roughness_1024.png',
    repeat: 0.4,
  },
  // water intentionally has no entry — it already renders as its own
  // translucent shaded plane, not part of the vertex-colored ground mesh.
};
