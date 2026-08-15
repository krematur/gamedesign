// A StandardMaterial extension that blends four biome diffuse textures
// per-fragment, weighted by per-vertex weights carried in the mesh's
// vertex-color attribute (r=grass, g=forest, b=sand, a=stone) — the Bevy/
// WGSL equivalent of applyBlendedTerrainTextures()'s onBeforeCompile
// shader injection in public/js/render3d.js. Same goal, same underlying
// idea (smooth per-vertex blend instead of hard per-tile texture edges),
// different engine's shader hook mechanism.

use bevy::pbr::{ExtendedMaterial, MaterialExtension};
use bevy::prelude::*;
use bevy::render::render_resource::{AsBindGroup, ShaderRef};

pub type TerrainMaterial = ExtendedMaterial<StandardMaterial, TerrainExtension>;

#[derive(Asset, AsBindGroup, TypePath, Clone)]
pub struct TerrainExtension {
    #[uniform(100)]
    pub repeats: Vec4, // grass, forest, sand, stone tiling density

    #[texture(101)]
    #[sampler(102)]
    pub grass_texture: Handle<Image>,
    #[texture(103)]
    #[sampler(104)]
    pub forest_texture: Handle<Image>,
    #[texture(105)]
    #[sampler(106)]
    pub sand_texture: Handle<Image>,
    #[texture(107)]
    #[sampler(108)]
    pub stone_texture: Handle<Image>,
}

impl MaterialExtension for TerrainExtension {
    fn fragment_shader() -> ShaderRef {
        "shaders/terrain_blend.wgsl".into()
    }
}
