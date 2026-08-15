# Sprite assets

Drop 2D character art here (PNG with a transparent background works best —
JPEGs will render with a solid rectangular background since there's no alpha
channel to cut them out).

Each image is rendered in-game as a billboard: a flat plane that always
rotates to face the camera around the vertical axis, so the character reads
as "standing" in the 3D world from any viewing angle rather than facing the
camera dead-on like a flat UI sprite.

To use one, add an entry to `public/js/assets.js`:

```js
export const ASSET_MANIFEST = {
  npc: {
    elder_rowan: { type: 'sprite', url: '/assets/sprites/elder_rowan.png', width: 1.6, height: 2.6 },
  },
};
```

`width`/`height` are in world units (roughly meters/tiles) — tune them to
match the character's actual proportions in the source image so they don't
look stretched or squashed. No server restart is needed; just refresh the
page once the file and manifest entry are in place.
