# Model assets

Drop real 3D character models here in glTF binary format (`.glb` — a single
self-contained file with geometry, materials, and textures baked in; this is
the standard export format from Blender, Mixamo, Sketchfab downloads, etc.).

Loaded via Three.js's `GLTFLoader` (vendored at `public/vendor/loaders/GLTFLoader.js`).
A wireframe capsule placeholder shows while the model loads (or forever, if
the file is missing/fails to parse — better than nothing).

To use one, add an entry to `public/js/assets.js`:

```js
export const ASSET_MANIFEST = {
  mob: {
    wolf: { type: 'model', url: '/assets/models/wolf.glb', scale: 1 },
  },
};
```

`scale` is a uniform multiplier applied after load — most exported models
aren't sized in the same world units as Wildholm's ~1-unit-per-tile scale,
so you'll likely need to tune this per model. No server restart is needed;
just refresh the page once the file and manifest entry are in place.

Animation (walk cycles, idle poses, etc.) is not wired up yet — a loaded
model currently renders in its default bind pose. See the README roadmap
for animated-model support.
