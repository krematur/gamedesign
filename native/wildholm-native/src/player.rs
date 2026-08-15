// Third-person player character: WASD movement (camera-relative, matching
// public/js/client.js's input handling) and a spring-arm-less follow
// camera that trails behind/above the player, matching the CAMERA_BACK/
// CAMERA_HEIGHT/CAMERA_LERP constants in public/js/render3d.js.

use bevy::prelude::*;

const MOVE_SPEED: f32 = 4.0;
const CAMERA_BACK: f32 = 8.5;
const CAMERA_HEIGHT: f32 = 7.5;
const CAMERA_LERP: f32 = 0.12;

#[derive(Component)]
pub struct Player;

#[derive(Component)]
pub struct FollowCamera;

pub fn spawn_player(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    spawn_pos: Vec3,
) {
    commands.spawn((
        Player,
        Mesh3d(meshes.add(Capsule3d::new(0.28, 0.5))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.298, 0.478, 0.227),
            perceptual_roughness: 0.8,
            ..default()
        })),
        Transform::from_translation(spawn_pos + Vec3::Y * 0.55),
    ));

    commands.spawn((
        FollowCamera,
        Camera3d::default(),
        Transform::from_translation(spawn_pos + Vec3::new(0.0, CAMERA_HEIGHT, CAMERA_BACK))
            .looking_at(spawn_pos + Vec3::Y, Vec3::Y),
    ));
}

pub fn move_player(
    keys: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    mut query: Query<&mut Transform, (With<Player>, Without<FollowCamera>)>,
) {
    let Ok(mut transform) = query.get_single_mut() else { return };

    let mut input = Vec2::ZERO;
    if keys.pressed(KeyCode::KeyW) || keys.pressed(KeyCode::ArrowUp) {
        input.y += 1.0;
    }
    if keys.pressed(KeyCode::KeyS) || keys.pressed(KeyCode::ArrowDown) {
        input.y -= 1.0;
    }
    if keys.pressed(KeyCode::KeyD) || keys.pressed(KeyCode::ArrowRight) {
        input.x += 1.0;
    }
    if keys.pressed(KeyCode::KeyA) || keys.pressed(KeyCode::ArrowLeft) {
        input.x -= 1.0;
    }
    if input == Vec2::ZERO {
        return;
    }
    input = input.normalize();

    let delta = Vec3::new(input.x, 0.0, -input.y) * MOVE_SPEED * time.delta_secs();
    transform.translation += delta;

    let facing = Vec3::new(input.x, 0.0, -input.y).normalize();
    transform.rotation = Transform::from_translation(Vec3::ZERO).looking_at(-facing, Vec3::Y).rotation;
}

pub fn follow_camera(
    player_q: Query<&Transform, (With<Player>, Without<FollowCamera>)>,
    mut camera_q: Query<&mut Transform, (With<FollowCamera>, Without<Player>)>,
) {
    let Ok(player) = player_q.get_single() else { return };
    let Ok(mut camera) = camera_q.get_single_mut() else { return };

    let target = player.translation + Vec3::new(0.0, CAMERA_HEIGHT, CAMERA_BACK);
    camera.translation = camera.translation.lerp(target, CAMERA_LERP);
    let look_target = player.translation + Vec3::Y;
    let look_rotation = Transform::from_translation(camera.translation).looking_at(look_target, Vec3::Y).rotation;
    camera.rotation = camera.rotation.slerp(look_rotation, CAMERA_LERP);
}
