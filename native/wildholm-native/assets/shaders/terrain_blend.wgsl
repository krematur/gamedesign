#import bevy_pbr::{
    pbr_fragment::pbr_input_from_standard_material,
    pbr_functions::alpha_discard,
}

#ifdef PREPASS_PIPELINE
#import bevy_pbr::{
    prepass_io::{VertexOutput, FragmentOutput},
    pbr_deferred_functions::deferred_output,
}
#else
#import bevy_pbr::{
    forward_io::{VertexOutput, FragmentOutput},
    pbr_functions::{apply_pbr_lighting, main_pass_post_lighting_processing},
}
#endif

struct TerrainExtension {
    // x=grass, y=forest, z=sand, w=stone tiling repeat density.
    repeats: vec4<f32>,
}

@group(2) @binding(100)
var<uniform> terrain_extension: TerrainExtension;
@group(2) @binding(101) var grass_texture: texture_2d<f32>;
@group(2) @binding(102) var grass_sampler: sampler;
@group(2) @binding(103) var forest_texture: texture_2d<f32>;
@group(2) @binding(104) var forest_sampler: sampler;
@group(2) @binding(105) var sand_texture: texture_2d<f32>;
@group(2) @binding(106) var sand_sampler: sampler;
@group(2) @binding(107) var stone_texture: texture_2d<f32>;
@group(2) @binding(108) var stone_sampler: sampler;

@fragment
fn fragment(
    in: VertexOutput,
    @builtin(front_facing) is_front: bool,
) -> FragmentOutput {
    var pbr_input = pbr_input_from_standard_material(in, is_front);

    // Per-vertex biome weights, carried in the mesh's vertex-color
    // attribute (r=grass, g=forest, b=sand, a=stone) — see
    // src/terrain.rs. Renormalized so partial-weight vertices at biome
    // boundaries still sum to 1.
    let w = in.color;
    let total = max(w.r + w.g + w.b + w.a, 0.0001);
    let bw = w / total;

    let grass_c = textureSample(grass_texture, grass_sampler, in.uv * terrain_extension.repeats.x).rgb;
    let forest_c = textureSample(forest_texture, forest_sampler, in.uv * terrain_extension.repeats.y).rgb;
    let sand_c = textureSample(sand_texture, sand_sampler, in.uv * terrain_extension.repeats.z).rgb;
    let stone_c = textureSample(stone_texture, stone_sampler, in.uv * terrain_extension.repeats.w).rgb;

    let blended = grass_c * bw.r + forest_c * bw.g + sand_c * bw.b + stone_c * bw.a;
    pbr_input.material.base_color = vec4<f32>(blended, 1.0);
    pbr_input.material.base_color = alpha_discard(pbr_input.material, pbr_input.material.base_color);

#ifdef PREPASS_PIPELINE
    let out = deferred_output(in, pbr_input);
#else
    var out: FragmentOutput;
    out.color = apply_pbr_lighting(pbr_input);
    out.color = main_pass_post_lighting_processing(pbr_input, out.color);
#endif

    return out;
}
