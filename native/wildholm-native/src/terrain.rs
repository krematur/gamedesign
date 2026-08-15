// Builds a real heightmapped, vertex-colored terrain Mesh from a
// world::World — the native-engine equivalent of setWorld() in
// public/js/render3d.js. Unlike the browser version this doesn't yet
// blend per-biome PBR textures (that's a real chunk of WGSL shader work
// for a future pass); vertex colors + a lit PBR material already look
// dramatically better than a flat-shaded low-poly scene and prove the
// terrain-generation port works before investing in texture blending.

use bevy::prelude::*;
use bevy::render::mesh::{Indices, PrimitiveTopology};
use bevy::render::render_asset::RenderAssetUsages;

use crate::world::{Tile, World};

const PATH_COLOR: [f32; 3] = [0.541, 0.42, 0.247]; // #8a6b3f, matches PATH_COLOR in render3d.js

pub struct TerrainMeshes {
    pub land: Mesh,
    pub water: Mesh,
}

pub fn build_terrain_meshes(world: &World) -> TerrainMeshes {
    let size = world.size;
    let verts = size + 1;

    let mut positions: Vec<[f32; 3]> = Vec::with_capacity(verts * verts);
    let mut colors: Vec<[f32; 4]> = Vec::with_capacity(verts * verts);

    // Cheap deterministic hash -> [0,1), same purpose as hash2() in
    // render3d.js: jitters height/color per vertex so terrain doesn't
    // read as flat uniform biome blocks.
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

            let nearest_x = fx.min(size as i32 - 1);
            let nearest_y = fy.min(size as i32 - 1);
            let nearest = world.tile_at(nearest_x, nearest_y);
            let mut c = nearest.color();
            let is_path = world.path_at(fx - 1, fy - 1)
                || world.path_at(fx, fy - 1)
                || world.path_at(fx - 1, fy)
                || world.path_at(fx, fy);
            if is_path {
                for i in 0..3 {
                    c[i] = c[i] * 0.3 + PATH_COLOR[i] * 0.7;
                }
            }
            let shade = 0.92 + hash2(vx as f32 + 91.7, vy as f32 + 13.3) * 0.16;

            positions.push([vx as f32, h + bump, vy as f32]);
            colors.push([c[0] * shade, c[1] * shade, c[2] * shade, 1.0]);
        }
    }

    // Two index buffers sharing the same position/color data (so land and
    // water stitch together with no seams), matching the split in
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

    let land = build_mesh(&positions, &colors, &land_indices);
    let water = build_mesh(&positions, &colors, &water_indices);

    TerrainMeshes { land, water }
}

fn build_mesh(positions: &[[f32; 3]], colors: &[[f32; 4]], indices: &[u32]) -> Mesh {
    let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::default());
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions.to_vec());
    mesh.insert_attribute(Mesh::ATTRIBUTE_COLOR, colors.to_vec());
    mesh.insert_indices(Indices::U32(indices.to_vec()));
    mesh.compute_smooth_normals();
    mesh
}
