// Minimal native-engine proof of concept: a real, compiled, PBR-lit 3D
// scene using the same grass texture set as the browser version, rendered
// with Bevy instead of Three.js/WebGL. Runs for a fixed number of frames
// under a virtual display (Xvfb) and writes out a screenshot, so this can
// be verified headlessly the same way the WebGL renderer was tested with
// Playwright all session.

use bevy::prelude::*;
use bevy::render::view::screenshot::{save_to_disk, Screenshot};
use bevy::window::WindowResolution;

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
        .insert_resource(FrameCounter::default())
        .add_systems(Startup, setup)
        .add_systems(Update, tick)
        .run();
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    asset_server: Res<AssetServer>,
) {
    // Ground plane using the same PBR grass texture set the browser
    // version uses (public/assets/textures/terrain/), copied into
    // assets/terrain/ here — proves the same source art works in a real
    // PBR pipeline, not just a stylized vertex-color one.
    let grass_diffuse = asset_server.load("terrain/grass_diffuse_1024.png");
    let grass_normal = asset_server.load("terrain/grass_normal_opengl_1024.png");
    let grass_rough = asset_server.load("terrain/grass_roughness_1024.png");

    commands.spawn((
        Mesh3d(meshes.add(Plane3d::default().mesh().size(20.0, 20.0))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color_texture: Some(grass_diffuse),
            normal_map_texture: Some(grass_normal),
            metallic_roughness_texture: Some(grass_rough),
            perceptual_roughness: 1.0,
            ..default()
        })),
        Transform::default(),
    ));

    // A simple hut prop (stand-in for public/js/render3d.js's buildHut) —
    // just proves real PBR materials + shadows on non-terrain geometry.
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(1.6, 1.1, 1.4))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.54, 0.44, 0.32),
            perceptual_roughness: 0.9,
            ..default()
        })),
        Transform::from_xyz(-2.0, 0.55, 0.0),
    ));

    // A boulder prop.
    commands.spawn((
        Mesh3d(meshes.add(Sphere::new(0.6).mesh().ico(4).unwrap())),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.55, 0.55, 0.52),
            perceptual_roughness: 0.95,
            metallic: 0.0,
            ..default()
        })),
        Transform::from_xyz(2.2, 0.5, 0.5),
    ));

    commands.spawn((
        DirectionalLight {
            illuminance: 12000.0,
            shadows_enabled: true,
            ..default()
        },
        Transform::from_xyz(4.0, 8.0, 4.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.insert_resource(AmbientLight {
        color: Color::srgb(0.75, 0.82, 0.9),
        brightness: 250.0,
        ..default()
    });

    commands.spawn((
        Camera3d::default(),
        Transform::from_xyz(-6.0, 5.0, 8.0).looking_at(Vec3::new(0.0, 0.5, 0.0), Vec3::Y),
    ));
}

// Wait a few frames for assets to load and the scene to actually render,
// then capture a screenshot and exit — this is what makes the scene
// verifiable in a headless/CI context instead of requiring a human to
// look at a live window.
fn tick(mut counter: ResMut<FrameCounter>, mut commands: Commands, mut exit: EventWriter<AppExit>) {
    counter.0 += 1;
    if counter.0 == 60 {
        commands
            .spawn(Screenshot::primary_window())
            .observe(save_to_disk("screenshot.png"));
    }
    if counter.0 == 75 {
        exit.send(AppExit::Success);
    }
}
