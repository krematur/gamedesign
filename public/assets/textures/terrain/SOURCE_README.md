# Medieval Environment Texture Pack

Four AI-generated terrain materials for game prototyping:

- Grass
- Forest floor
- Sand
- Stone

Each material includes:

- `*_diffuse_1024.png` — sRGB/base colour
- `*_normal_opengl_1024.png` — linear OpenGL normal map (+Y / green-up)
- `*_roughness_1024.png` — linear grayscale roughness map (white = rough)

All maps are 1024×1024 PNG and have exact matching opposite borders.

## Engine notes

- Unreal Engine: invert the normal map's green channel, or configure it as OpenGL if your workflow supports that.
- Unity/Godot/Blender: the supplied OpenGL normal orientation is generally suitable; confirm against your renderer.
- Import diffuse maps as sRGB. Import normal and roughness maps as non-colour/linear data.
- These normal and roughness maps are image-derived approximations suitable for prototypes and stylised/indie production. For physically measured PBR materials, replace them with scan-derived CC0 maps.

## Tiling

The textures use a periodic cross-blend and exact border matching. At very large tiled areas, break repetition with macro colour variation, decals, terrain blending, or a second detail texture.
