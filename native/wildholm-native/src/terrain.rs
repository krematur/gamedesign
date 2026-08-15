// Builds a real heightmapped terrain Mesh from a world::World — the
// native-engine equivalent of setWorld() in public/js/render3d.js. Land
// tiles (grass/forest/sand/stone) share one mesh whose vertex-color
// attribute carries per-vertex biome *blend weights* (r=grass, g=forest,
// b=sand, a=stone) rather than a literal tint color — terrain_material.rs
// / shaders/terrain_blend.wgsl sample and blend the four biome textures
// using those weights, the same smooth-per-vertex-blend idea as
// applyBlendedTerrainTextures() in render3d.js, just expressed as a
// custom WGSL material instead of a Three.js onBeforeCompile injection.

use bevy::prelude::*;
use bevy::render::mesh::{Indices, PrimitiveTopology};
use bevy::render::render_asset::RenderAssetUsages;

use crate::world::{Tile, World};

pub struct TerrainMeshes {
    pub land: Mesh,
    pub water: Mesh,
}

// Index into the (grass, forest, sand, stone) weight vector; water has no
// weight slot since it never appears in the land mesh's index buffer.
fn land_biome_index(tile: Tile) -> Option<usize> {
    match tile {
        Tile::Grass => Some(0),
        Tile::Forest => Some(1),
        Tile::Sand => Some(2),
        Tile::Stone => Some(3),
        Tile::Water => None,
    }
}

pub fn build_terrain_meshes(world: &World) -> TerrainMeshes {
    let size = world.size;
    let verts = size + 1;

    let mut positions: Vec<[f32; 3]> = Vec::with_capacity(verts * verts);
    let mut weights: Vec<[f32; 4]> = Vec::with_capacity(verts * verts);
    let mut uvs: Vec<[f32; 2]> = Vec::with_capacity(verts * verts);

    // Cheap deterministic hash -> [0,1) for per-vertex height jitter, same
    // purpose as hash2() in render3d.js.
    let hash2 = |x: f32, y: f32| -> f32 {
        let s = (x * 127.1 + y * 311.7).sin() * 43758.5453;
        s.fract().abs()
    };

    for vy in 0..verts {
        for vx in 0..verts {
            let fx = vx as i32;
            let fy = vy as i32;
            let corners = [
                world.tile_at(fx - 1, fy - 1),
                world.tile_at(fx, fy - 1),
                world.tile_at(fx - 1, fy),
                world.tile_at(fx, fy),
            ];
            let h: f32 = corners.iter().map(|t| t.height()).sum::<f32>() / 4.0;
            let bump = (hash2(vx as f32, vy as f32) - 0.5) * 0.06;

            let mut w = [0.0f32; 4];
            for t in &corners {
                if let Some(i) = land_biome_index(*t) {
                    w[i] += 0.25;
                }
            }

            positions.push([vx as f32, h + bump, vy as f32]);
            weights.push(w);
            uvs.push([vx as f32, vy as f32]);
        }
    }

    // Two index buffers sharing the same position/weight/uv data (so land
    // and water stitch together with no seams), matching the split in
    // render3d.js's setWorld().
    let mut land_indices: Vec<u32> = Vec::new();
    let mut water_indices: Vec<u32> = Vec::new();
    for ty in 0..size {
        for tx in 0..size {
            let biome = world.tile_at(tx as i32, ty as i32);
            let a = (ty * verts + tx) as u32;
            let b = a + 1;
            let c = a + verts as u32;
            let d = c + 1;
            let bucket = if biome == Tile::Water { &mut water_indices } else { &mut land_indices };
            bucket.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }

    let colors: Vec<[f32; 4]> = weights.iter().map(|w| [w[0], w[1], w[2], w[3]]).collect();

    let land = build_mesh(&positions, &colors, &uvs, &land_indices);
    let water = build_mesh(&positions, &colors, &uvs, &water_indices);

    TerrainMeshes { land, water }
}

fn build_mesh(positions: &[[f32; 3]], colors: &[[f32; 4]], uvs: &[[f32; 2]], indices: &[u32]) -> Mesh {
    let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::default());
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions.to_vec());
    mesh.insert_attribute(Mesh::ATTRIBUTE_COLOR, colors.to_vec());
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs.to_vec());
    mesh.insert_indices(Indices::U32(indices.to_vec()));
    mesh.compute_smooth_normals();
    mesh
}
