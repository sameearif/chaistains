// Shared metadata for sprite folders. Both the editor and the in-game
// renderer use this to size decorations consistently.

export type TileOverride = {
  widthTiles?: number;  // override the folder's default widthTiles
  jitter?: number;      // random per-cell offset as a fraction of one tile (0 = none)
  passable?: boolean;   // true → cat can walk over it (no collision)
  footprintW?: number;  // collision width in cells (default ≈ widthTiles)
  footprintH?: number;  // collision depth in cells at the base (default 1)
};

export type FolderMeta = {
  display: string;     // pretty name for the editor sidebar
  isDeco: boolean;     // false → fills one tile (ground); true → tall sprite anchored at its base
  widthTiles: number;  // default visual width relative to one tile
  jitter?: number;     // folder-default jitter (overridable per file)
  passable?: boolean;  // folder-default passability (overridable per file)
  footprintW?: number; // folder-default collision width in cells
  footprintH?: number; // folder-default collision depth in cells at the base
  // Optional per-file overrides, keyed by filename ("1.png", "2.png", ...).
  overrides?: Record<string, TileOverride>;
};

// Keyed by the folder's path under /public/sprites/exterior/.
export const FOLDER_META: Record<string, FolderMeta> = {
  "grass":              { display: "Grass",                isDeco: false, widthTiles: 1   },
  "path":               { display: "Path",                 isDeco: false, widthTiles: 1   },
  "grass_path":         { display: "Grass-Path",           isDeco: false, widthTiles: 1   },
  // Trees: only the trunk blocks (narrow footprint); the canopy is walk-behind.
  "trees":              { display: "Trees",                isDeco: true,  widthTiles: 1.3, footprintW: 1, footprintH: 1 },
  "rocks": {
    // Big rocks block just their single anchor cell so they don't bleed onto
    // an adjacent path; small ones are passable.
    display: "Rocks", isDeco: true, widthTiles: 1.5, footprintW: 1, footprintH: 1,
    overrides: {
      // Small/medium ones get random placement + are passable (no collision).
      "1.png": { widthTiles: 0.3, jitter: 0.55, passable: true },
      "2.png": { widthTiles: 0.6, jitter: 0.45, passable: true },
      "3.png": { widthTiles: 0.6, jitter: 0.45, passable: true },
      "4.png": { widthTiles: 0.6, passable: true },  // medium, centred
      // 5+ use the folder default (1.5), centred, solid
    },
  },
  // Buildings: solid base spans the full width, just the bottom row deep.
  "buildings/normal":   { display: "Buildings · Normal",   isDeco: true,  widthTiles: 2.5, footprintH: 1 },
  // Pakistan defaults to 1.3 × normal (2.5 → 3.25). Per-file overrides:
  //   1.png → 1.2 × normal (3.0)
  //   5.png → 2.0 × normal (5.0)
  "buildings/pakistan": {
    display: "Buildings · Pakistan", isDeco: true, widthTiles: 3.25, footprintH: 1,
    overrides: {
      "1.png": { widthTiles: 3.0 },   // 1.2 × normal
      "2.png": { widthTiles: 5.0 },   // 2.0 × normal (bigger)
      "3.png": { widthTiles: 3.0 },   // 1.2 × normal (slightly smaller)
      "4.png": { widthTiles: 3.0 },   // 1.2 × normal (slightly smaller)
      "5.png": { widthTiles: 5.0 },   // 2.0 × normal
    },
  },
  // Michigan source art reads much smaller → 2 × the normal set.
  "buildings/michigan": { display: "Buildings · Michigan", isDeco: true,  widthTiles: 5.0, footprintH: 1 },
};

// Fallback for folders we don't know about — assume a small decoration.
export const DEFAULT_META: FolderMeta = { display: "Other", isDeco: true, widthTiles: 1 };

const PREFIX = "/sprites/exterior/";

/** Extract the folder portion from a sprite src like
 *  "/sprites/exterior/buildings/normal/3.png" → "buildings/normal". */
export function folderOf(src: string): string {
  if (!src.startsWith(PREFIX)) return "";
  const rest = src.slice(PREFIX.length); // e.g. "buildings/normal/3.png"
  const last = rest.lastIndexOf("/");
  return last < 0 ? "" : rest.slice(0, last);
}

export function metaOf(src: string): FolderMeta {
  return FOLDER_META[folderOf(src)] ?? DEFAULT_META;
}

/** Effective widthTiles for a specific sprite, honouring per-file overrides. */
export function widthTilesOf(src: string): number {
  const m = metaOf(src);
  const file = src.slice(src.lastIndexOf("/") + 1);
  return m.overrides?.[file]?.widthTiles ?? m.widthTiles;
}

/** Jitter amount (fraction of a tile) for randomising this sprite's offset. */
export function jitterOf(src: string): number {
  const m = metaOf(src);
  const file = src.slice(src.lastIndexOf("/") + 1);
  return m.overrides?.[file]?.jitter ?? m.jitter ?? 0;
}

/** Whether the cat can walk over this sprite (true = no collision). */
export function isPassable(src: string): boolean {
  const m = metaOf(src);
  const file = src.slice(src.lastIndexOf("/") + 1);
  return m.overrides?.[file]?.passable ?? m.passable ?? false;
}

/**
 * Collision footprint in cells: how many cells wide × deep (at the base) the
 * object blocks, centred on its anchor cell. Defaults to ≈ widthTiles wide and
 * 1 deep so a multi-tile building blocks its whole span, not just one cell.
 */
export function footprintOf(src: string): { w: number; h: number } {
  const m = metaOf(src);
  const file = src.slice(src.lastIndexOf("/") + 1);
  const o = m.overrides?.[file];
  const w = Math.max(1, Math.round(o?.footprintW ?? m.footprintW ?? widthTilesOf(src)));
  const h = Math.max(1, Math.round(o?.footprintH ?? m.footprintH ?? 1));
  return { w, h };
}

/**
 * Deterministic 0..1 hash from (tx, ty, src, salt). Same inputs always yield
 * the same number so a sprite's randomised offset stays stable across reloads.
 */
export function tileHash(tx: number, ty: number, src: string, salt = 0): number {
  let s = 0;
  for (let i = 0; i < src.length; i++) s = (s * 31 + src.charCodeAt(i)) | 0;
  let h = Math.imul(tx | 0, 374761393) ^ Math.imul(ty | 0, 668265263) ^ s ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Signed jitter offset (in pixels) for the deco at (tx, ty) using `cellSize`. */
export function jitterOffset(
  tx: number, ty: number, src: string, cellSize: number,
): { dx: number; dy: number } {
  const j = jitterOf(src);
  if (j <= 0) return { dx: 0, dy: 0 };
  const dx = (tileHash(tx, ty, src, 0xa1) - 0.5) * j * cellSize;
  // Less vertical spread so rocks/etc stay anchored near the ground.
  const dy = (tileHash(tx, ty, src, 0xb2) - 0.5) * j * cellSize * 0.5;
  return { dx, dy };
}
