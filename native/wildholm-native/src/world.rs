// Rust port of server/world.js — same island-generation algorithm (radial
// falloff warped by large-scale noise, an independent mountain noise
// field, coastal cliff patches, and path carving), so the native
// prototype's world matches the browser version's design instead of
// diverging into a second, different implementation.

pub const WORLD_SIZE: usize = 80;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tile {
    Grass,
    Forest,
    Water,
    Stone,
    Sand,
}

impl Tile {
    pub fn height(self) -> f32 {
        match self {
            Tile::Grass => 0.0,
            Tile::Forest => 0.08,
            Tile::Water => -0.6,
            Tile::Stone => 0.55,
            Tile::Sand => -0.05,
        }
    }

    // Not used now that terrain.rs blends real textures instead of flat
    // tinted vertex colors — kept for a minimap or a fallback low-detail
    // render mode later.
    #[allow(dead_code)]
    pub fn color(self) -> [f32; 3] {
        match self {
            Tile::Grass => [0.298, 0.478, 0.227],  // #4c7a3a
            Tile::Forest => [0.184, 0.353, 0.173], // #2f5a2c
            Tile::Water => [0.141, 0.353, 0.525],  // #245a86
            Tile::Stone => [0.541, 0.541, 0.502],  // #8a8a80
            Tile::Sand => [0.847, 0.788, 0.541],   // #d8c98a
        }
    }
}

pub struct World {
    pub size: usize,
    pub tiles: Vec<Tile>,
    // Not consumed yet — terrain.rs dropped path-tinting when it switched
    // the vertex-color attribute over to biome blend weights (no spare
    // channel left for a tint). Re-adding it means either a 5th blend
    // weight (needs a second vertex-color-sized attribute) or a small
    // separate greyscale "path mask" texture sampled alongside the biome
    // textures. Kept computed since it's cheap and the data is correct.
    #[allow(dead_code)]
    pub paths: Vec<bool>,
}

impl World {
    pub fn tile_at(&self, x: i32, y: i32) -> Tile {
        let x = x.clamp(0, self.size as i32 - 1) as usize;
        let y = y.clamp(0, self.size as i32 - 1) as usize;
        self.tiles[y * self.size + x]
    }

    #[allow(dead_code)]
    pub fn path_at(&self, x: i32, y: i32) -> bool {
        if x < 0 || y < 0 || x >= self.size as i32 || y >= self.size as i32 {
            return false;
        }
        self.paths[y as usize * self.size + x as usize]
    }
}

// Same xorshift generator as makeRng() in server/world.js, so a given seed
// produces the same underlying noise field (not that exact tile-for-tile
// parity matters much for a prototype, but there's no reason to diverge).
struct Rng(u32);

impl Rng {
    fn new(seed: u32) -> Self {
        Rng(seed)
    }

    fn next(&mut self) -> f32 {
        let mut s = self.0;
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        self.0 = s;
        (s as f64 / 4294967296.0) as f32
    }
}

fn blur_field(raw: &[f32], size: usize, radius: i32) -> Vec<f32> {
    let mut out = vec![0.0; size * size];
    for y in 0..size as i32 {
        for x in 0..size as i32 {
            let mut sum = 0.0;
            let mut count = 0.0;
            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    let nx = x + dx;
                    let ny = y + dy;
                    if nx >= 0 && ny >= 0 && nx < size as i32 && ny < size as i32 {
                        sum += raw[ny as usize * size + nx as usize];
                        count += 1.0;
                    }
                }
            }
            out[y as usize * size + x as usize] = sum / count;
        }
    }
    out
}

fn normalize01(field: &[f32]) -> Vec<f32> {
    let min = field.iter().cloned().fold(f32::INFINITY, f32::min);
    let max = field.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let range = (max - min).max(1e-6);
    field.iter().map(|v| (v - min) / range).collect()
}

pub fn generate_world(seed: u32) -> World {
    let size = WORLD_SIZE;
    let mut rng = Rng::new(seed);

    let mut raw_detail = vec![0.0f32; size * size];
    let mut raw_coast = vec![0.0f32; size * size];
    let mut raw_mountains = vec![0.0f32; size * size];
    let mut raw_cliff = vec![0.0f32; size * size];
    for i in 0..size * size {
        raw_detail[i] = rng.next();
        raw_coast[i] = rng.next();
        raw_mountains[i] = rng.next();
        raw_cliff[i] = rng.next();
    }
    let detail = normalize01(&blur_field(&raw_detail, size, 2));
    let coast_warp = normalize01(&blur_field(&raw_coast, size, 9));
    let mountains = normalize01(&blur_field(&raw_mountains, size, 7));
    let cliffs = normalize01(&blur_field(&raw_cliff, size, 4));

    let cx = size as f32 * 0.47;
    let cy = size as f32 * 0.55;
    let max_radius = size as f32 * 0.46;
    let mut elevation_raw = vec![0.0f32; size * size];
    for y in 0..size {
        for x in 0..size {
            let idx = y * size + x;
            let dx = (x as f32 - cx) / max_radius;
            let dy = (y as f32 - cy) / max_radius;
            let dist = (dx * dx + dy * dy).sqrt();
            let warp = (coast_warp[idx] - 0.5) * 0.7;
            let shaped_dist = (dist + warp).max(0.0);
            let island_shape = (1.0 - shaped_dist.powf(1.6)).max(0.0);
            elevation_raw[idx] = island_shape * 0.78 + detail[idx] * 0.22;
        }
    }
    let elevation = normalize01(&elevation_raw);

    let mut tiles = vec![Tile::Water; size * size];
    for y in 0..size {
        for x in 0..size {
            let idx = y * size + x;
            let dist_from_edge = x.min(y).min(size - 1 - x).min(size - 1 - y);
            let n = elevation[idx];
            let mut tile = if dist_from_edge < 2 {
                Tile::Water
            } else if n < 0.30 {
                Tile::Water
            } else if n < 0.36 {
                if cliffs[idx] > 0.6 { Tile::Stone } else { Tile::Sand }
            } else if n < 0.68 {
                Tile::Grass
            } else {
                Tile::Forest
            };
            if mountains[idx] > 0.66 && n >= 0.42 {
                tile = Tile::Stone;
            }
            tiles[idx] = tile;
        }
    }

    let paths = carve_paths(&tiles, size, &mut rng);

    World { size, tiles, paths }
}

fn carve_paths(tiles: &[Tile], size: usize, rng: &mut Rng) -> Vec<bool> {
    let mut paths = vec![false; size * size];
    let is_open = |x: i32, y: i32| -> bool {
        if x < 0 || y < 0 || x >= size as i32 || y >= size as i32 {
            return false;
        }
        let t = tiles[y as usize * size + x as usize];
        t != Tile::Water && t != Tile::Stone
    };
    let mark = |x: f32, y: f32, paths: &mut Vec<bool>| {
        let xi = x.round() as i32;
        let yi = y.round() as i32;
        for dy in -1..=1 {
            for dx in -1..=1 {
                if dx * dx + dy * dy > 1 {
                    continue;
                }
                let nx = xi + dx;
                let ny = yi + dy;
                if is_open(nx, ny) {
                    paths[ny as usize * size + nx as usize] = true;
                }
            }
        }
    };

    let origin_x = size as f32 / 2.0;
    let origin_y = size as f32 / 2.0;
    let trail_count = 5;
    for i in 0..trail_count {
        let angle = (i as f32 / trail_count as f32) * std::f32::consts::TAU + rng.next() * 0.6;
        let target_dist = size as f32 * (0.32 + rng.next() * 0.14);
        let mut tx = origin_x + angle.cos() * target_dist;
        let mut ty = origin_y + angle.sin() * target_dist;
        let mut guard = 0;
        while !is_open(tx.round() as i32, ty.round() as i32) && guard < 60 {
            tx += (origin_x - tx) * 0.08;
            ty += (origin_y - ty) * 0.08;
            guard += 1;
        }

        let steps = ((tx - origin_x).hypot(ty - origin_y) * 1.6).round().max(20.0) as i32;
        let perp_x = -(ty - origin_y);
        let perp_y = tx - origin_x;
        let perp_len = perp_x.hypot(perp_y).max(1e-6);
        let wiggle_freq = 2.0 + rng.next() * 2.0;
        let wiggle_amp = size as f32 * (0.03 + rng.next() * 0.03);
        for s in 0..=steps {
            let t = s as f32 / steps as f32;
            let base_x = origin_x + (tx - origin_x) * t;
            let base_y = origin_y + (ty - origin_y) * t;
            let wiggle =
                (t * std::f32::consts::PI * wiggle_freq).sin() * wiggle_amp * (t * std::f32::consts::PI).sin();
            let px = base_x + (perp_x / perp_len) * wiggle;
            let py = base_y + (perp_y / perp_len) * wiggle;
            mark(px, py, &mut paths);
        }
    }

    paths
}
