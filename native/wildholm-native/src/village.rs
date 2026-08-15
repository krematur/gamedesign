// Static decorative village — Rust port of buildVillage()/buildHut()/
// buildKeep() in public/js/render3d.js: a keep and a loose ring of huts
// around the village anchor point. Same fixed relative layout, so both
// versions produce a recognizably similar settlement.

use bevy::prelude::*;
use std::f32::consts::PI;

struct HutSpec {
    dx: f32,
    dz: f32,
    w: f32,
    d: f32,
    h: f32,
    wall_color: Color,
}

const HUTS: &[HutSpec] = &[
    HutSpec { dx: -3.4, dz: 0.6, w: 1.7, d: 1.4, h: 1.15, wall_color: Color::srgb(0.541, 0.439, 0.322) },
    HutSpec { dx: 3.2, dz: -0.8, w: 1.4, d: 1.5, h: 1.0, wall_color: Color::srgb(0.604, 0.514, 0.384) },
    HutSpec { dx: -2.2, dz: -3.0, w: 1.5, d: 1.3, h: 1.05, wall_color: Color::srgb(0.478, 0.384, 0.282) },
    HutSpec { dx: 2.6, dz: 3.4, w: 1.8, d: 1.5, h: 1.2, wall_color: Color::srgb(0.541, 0.439, 0.322) },
    HutSpec { dx: -4.4, dz: -1.6, w: 1.3, d: 1.3, h: 0.95, wall_color: Color::srgb(0.604, 0.514, 0.384) },
];

pub fn spawn_village(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    anchor: Vec3,
) {
    spawn_keep(commands, meshes, materials, anchor + Vec3::new(0.0, 0.0, 3.2));

    for hut in HUTS {
        spawn_hut(commands, meshes, materials, anchor + Vec3::new(hut.dx, 0.0, hut.dz), hut);
    }
}

fn spawn_hut(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    pos: Vec3,
    hut: &HutSpec,
) {
    let roof_height = 0.9;
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(hut.w, hut.h, hut.d))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: hut.wall_color,
            perceptual_roughness: 0.95,
            ..default()
        })),
        Transform::from_translation(pos + Vec3::Y * hut.h / 2.0),
    ));
    commands.spawn((
        Mesh3d(meshes.add(Cone { radius: hut.w.max(hut.d) * 0.78, height: roof_height })),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.42, 0.227, 0.165),
            perceptual_roughness: 0.85,
            ..default()
        })),
        Transform::from_translation(pos + Vec3::Y * (hut.h + roof_height / 2.0 - 0.05))
            .with_rotation(Quat::from_rotation_y(PI / 4.0)),
    ));
}

fn spawn_keep(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    pos: Vec3,
) {
    let base_h = 2.4;
    let roof_h = 1.3;
    commands.spawn((
        Mesh3d(meshes.add(Cylinder::new(1.15, base_h))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.541, 0.541, 0.502),
            perceptual_roughness: 0.9,
            ..default()
        })),
        Transform::from_translation(pos + Vec3::Y * base_h / 2.0),
    ));
    commands.spawn((
        Mesh3d(meshes.add(Cone { radius: 1.35, height: roof_h })),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.29, 0.227, 0.353),
            perceptual_roughness: 0.7,
            ..default()
        })),
        Transform::from_translation(pos + Vec3::Y * (base_h + roof_h / 2.0)),
    ));
}
