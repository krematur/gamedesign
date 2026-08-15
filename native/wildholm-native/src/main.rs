// Native-engine prototype, now actually built from the game's real world
// generation instead of a static demo scene: island terrain (ported from
// server/world.js), a village, and a controllable third-person character.
// Still a rendering/world prototype, not a full port — no networking, no
// gameplay systems (inventory/crafting/quests/mobs) yet.

mod player;
mod terrain;
mod terrain_material;
mod village;
mod world;

use bevy::image::{ImageAddressMode, ImageLoaderSettings, ImageSampler, ImageSamplerDescriptor};
use bevy::pbr::{ExtendedMaterial, MaterialPlugin};
use bevy::prelude::*;
use bevy::render::view::screenshot::{save_to_disk, Screenshot};
use bevy::window::WindowResolution;

use terrain_material::{TerrainExtension, TerrainMaterial};
use world::{Tile, World, WORLD_SIZE};

#[derive(Resource, Default)]
struct FrameCounter(u32);

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                resolution: WindowResolution::new(1280.0, 800.0),
                title: "Wildholm (native prototype)".into(),
                ..default()
            }),
            ..default()
        }))
        .add_plugins(MaterialPlugin::<TerrainMaterial>::default())
        .insert_resource(FrameCounter::default())
        .add_systems(Startup, setup)
        .add_systems(Update, (player::move_player, player::follow_camera, tick).chain())
        .run();
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut terrain_materials: ResMut<Assets<TerrainMaterial>>,
    asset_server: Res<AssetServer>,
) {
    let world = world::generate_world(1337);

    let terrain::TerrainMeshes { land, water } = terrain::build_terrain_meshes(&world);

    let terrain_material = terrain_materials.add(ExtendedMaterial {
        base: StandardMaterial { perceptual_roughness: 0.92, ..default() },
        extension: TerrainExtension {
            repeats: Vec4::new(0.35, 0.35, 0.3, 0.4),
            grass_texture: load_tiling(&asset_server, "terrain/grass_diffuse_1024.png"),
            forest_texture: load_tiling(&asset_server, "terrain/forest_floor_diffuse_1024.png"),
            sand_texture: load_tiling(&asset_server, "terrain/sand_diffuse_1024.png"),
            stone_texture: load_tiling(&asset_server, "terrain/stone_diffuse_1024.png"),
        },
    });

    commands.spawn((Mesh3d(meshes.add(land)), MeshMaterial3d(terrain_material), Transform::default()));

    commands.spawn((
        Mesh3d(meshes.add(water)),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgba(0.184, 0.498, 0.722, 0.75),
            perceptual_roughness: 0.12,
            metallic: 0.15,
            alpha_mode: AlphaMode::Blend,
            ..default()
        })),
        Transform::from_xyz(0.0, 0.15, 0.0),
    ));

    let spawn_tile = find_walkable_spawn(&world);
    let village_anchor = Vec3::new(spawn_tile.0 as f32, 0.0, spawn_tile.1 as f32);
    // Spawn the player a few tiles off from the village anchor, not on top
    // of it — otherwise the character starts inside the keep.
    let spawn_pos = village_anchor + Vec3::new(0.0, 0.0, 6.0);

    player::spawn_player(&mut commands, &mut meshes, &mut materials, spawn_pos);
    village::spawn_village(&mut commands, &mut meshes, &mut materials, village_anchor);

    commands.spawn((
        DirectionalLight { illuminance: 12000.0, shadows_enabled: true, ..default() },
        Transform::from_xyz(spawn_tile.0 as f32 + 24.0, 36.0, spawn_tile.1 as f32 + 16.0)
            .looking_at(spawn_pos, Vec3::Y),
    ));
    commands.insert_resource(AmbientLight { color: Color::srgb(0.75, 0.82, 0.9), brightness: 250.0, ..default() });
}

// Terrain UVs are raw world-position coordinates (0..WORLD_SIZE) scaled by
// a small repeat factor in the shader, so they land well outside [0,1]
// almost everywhere — the default sampler clamps to the edge pixel out
// there, which is what was producing a flat, blurry terrain with no
// visible texture detail. Force Repeat addressing so the texture actually
// tiles.
fn load_tiling(asset_server: &AssetServer, path: &str) -> Handle<Image> {
    asset_server.load_with_settings(path, |settings: &mut ImageLoaderSettings| {
        settings.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
            address_mode_u: ImageAddressMode::Repeat,
            address_mode_v: ImageAddressMode::Repeat,
            ..default()
        });
    })
}

// Same "jitter around the map center, retry until walkable" approach as
// addPlayer()/placeNpc() in server/game.js, minus the randomness (a fixed
// small spiral search is enough for a deterministic single-seed prototype
// and avoids pulling in a `rand` dependency for one call site) — plus a
// preference for grass/forest specifically, so the village doesn't land
// on a random sand/stone patch when a nicer spot is only a few tiles away.
fn find_walkable_spawn(world: &World) -> (i32, i32) {
    let center = (WORLD_SIZE as i32 / 2, WORLD_SIZE as i32 / 2);

    let is_vegetated = |t: Tile| matches!(t, Tile::Grass | Tile::Forest);
    if is_vegetated(world.tile_at(center.0, center.1)) {
        return center;
    }
    for radius in 1..20 {
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                let x = center.0 + dx;
                let y = center.1 + dy;
                if is_vegetated(world.tile_at(x, y)) {
                    return (x, y);
                }
            }
        }
    }

    // Fall back to any walkable tile if there's somehow no grass/forest
    // within range (shouldn't happen on a real island, but don't spawn in
    // the ocean if it does).
    if world.tile_at(center.0, center.1) != Tile::Water {
        return center;
    }
    for radius in 1..20 {
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                let x = center.0 + dx;
                let y = center.1 + dy;
                if world.tile_at(x, y) != Tile::Water {
                    return (x, y);
                }
            }
        }
    }
    center
}

// Wait for the scene to actually render, then capture a screenshot and
// exit — verifiable headlessly instead of requiring a live window.
fn tick(mut counter: ResMut<FrameCounter>, mut commands: Commands, mut exit: EventWriter<AppExit>) {
    counter.0 += 1;
    // Four 1024x1024 textures take longer to decode/upload than the
    // single-texture demo did — give them real time (not just frames,
    // since each software-rendered frame is itself slow) before capturing.
    if counter.0 == 180 {
        commands.spawn(Screenshot::primary_window()).observe(save_to_disk("screenshot.png"));
    }
    if counter.0 == 200 {
        exit.send(AppExit::Success);
    }
}
