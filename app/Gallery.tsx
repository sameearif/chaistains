"use client";

import { useEffect, useRef, useState } from "react";
import { widthTilesOf, jitterOffset, isPassable, footprintOf } from "@/lib/sprites";
import Blackhole from "./Blackhole";
import Blackhole3D from "./Blackhole3D";
import Gallery3D from "./Gallery3D";

// Dialogue shown when the cat steps on a building's marker pad. Keyed by the
// building's sprite src. May contain simple HTML (e.g. <em>…</em>).
const B = "/sprites/exterior/buildings";
const DIALOGUES: Record<string, string> = {
  [`${B}/normal/2.png`]: "Hi, I'm Boba! Let me give you a tour of this little sky island!",
  [`${B}/normal/4.png`]: "No one is home. They're taking the hobbits to Isengard!",
  [`${B}/normal/1.png`]: "Click the museum to teleport.",
  [`${B}/normal/3.png`]: "Nope. I got rejected from Hogwarts.",
  [`${B}/normal/5.png`]: "This is the bathhouse from <em>Spirited Away</em>, the movie that inspired me to draw.",
  [`${B}/normal/7.png`]: "Hungry already? Click the building to get some dumplings!",

  [`${B}/pakistan/1.png`]: "<em>Ghanta Ghar</em> (Clock Tower) from Faisalabad, the city where I was born.",
  [`${B}/pakistan/2.png`]: "Badshahi Masjid in Lahore, the city where I went to high school and did my undergrad.",
  [`${B}/pakistan/3.png`]: "Faisal Masjid in Islamabad, the capital of Pakistan.",
  [`${B}/pakistan/5.png`]: "Lahore University of Management Sciences, where I completed my undergrad.",

  [`${B}/michigan/1.png`]: "The Law School, the prettiest building in Ann Arbor.",
  [`${B}/michigan/2.png`]: "Michigan Stadium, the Big House. I still need to see a game here.",
  [`${B}/michigan/3.png`]: "BBB, University of Michigan, where I spend day and night working on language models.",
};

// Buildings that open a link when clicked.
const LINKS: Record<string, string> = {
  [`${B}/normal/7.png`]: "https://dumplings.sameearif.com/",
};

const DEFAULT_DIALOGUE = "A lovely little building.";
const isBuilding = (src: string) => src.includes("/buildings/");
const dialogueFor = (src: string) => DIALOGUES[src] ?? DEFAULT_DIALOGUE;

// ── Cat ────────────────────────────────────────────────────────────────────
const DIRECTIONS = ["down", "up", "left", "right"] as const;
type Direction = (typeof DIRECTIONS)[number];
const FRAMES_PER_DIR = 4;
const IDLE_FRAMES_PER_DIR = 2;
const ANIM_FPS = 8;
const IDLE_FPS = 2;
const CAT_DRAW_SIZE = 96;
const SPEED = 320; // 2× the original base speed

const WALK_SEQ: Record<Direction, number[]> = {
  down:  [1, 2, 3, 4],
  up:    [1, 2, 3, 4],
  left:  [1, 2, 3, 4, 3, 2],
  right: [1, 2, 3, 4, 3, 2],
};
const IDLE_SEQ: Record<Direction, number[]> = {
  down:  [1, 2],
  up:    [1, 2],
  left:  [1, 2],
  right: [1, 2],
};

// ── World ──────────────────────────────────────────────────────────────────
const TILE = 128;             // pixel size of one map cell in world units
const BASE_OFFSET = 0.05;     // deco base sits 5 % of a tile below the cell bottom
const CAT_HOUSE_SRC = "/sprites/exterior/buildings/normal/2.png"; // cat's home (spawn point)
const MUSEUM_SRC = "/sprites/exterior/buildings/normal/1.png";    // gets a soft glow

type Bbox = { x: number; y: number; w: number; h: number };
type Sprite = { img: HTMLImageElement; bbox: Bbox | null };
type Cell = { ground?: string; deco?: string };
type WorldMap = { width: number; height: number; cells: Cell[][] };

function measureBbox(img: HTMLImageElement): Bbox | null {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function loadSprite(src: string): Sprite {
  const img = new Image();
  const s: Sprite = { img, bbox: null };
  img.onload = () => { s.bbox = measureBbox(img); };
  img.src = src;
  return s;
}

export default function Gallery() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Speech bubble: keeps the last text while fading out (visible toggles it).
  const [bubble, setBubble] = useState<{ text: string; visible: boolean }>({ text: "", visible: false });
  // Museum cutscene: pixel "sucked in" → white flash → realistic 3D "emerges".
  const [voidPhase, setVoidPhase] = useState<"off" | "pixel" | "3d" | "gallery">("off");
  const [flash, setFlash] = useState(false);
  // Called when leaving the 3D gallery: drops the cat back in front of the museum.
  const exitToMuseumRef = useRef<(() => void) | null>(null);

  // Touch joystick for phones/tablets (feeds the render loop via a ref).
  const [isTouch] = useState(() => typeof window !== "undefined" && (("ontouchstart" in window) || navigator.maxTouchPoints > 0));
  const joyVecRef = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyActive = useRef(false);
  const joyFromEvent = (e: React.PointerEvent) => {
    const base = joyRef.current; if (!base) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    setKnob({ x: dx, y: dy });
    joyVecRef.current = { x: dx / max, y: dy / max };
  };
  const joyStart = (e: React.PointerEvent) => { joyActive.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); joyFromEvent(e); };
  const joyMove = (e: React.PointerEvent) => { if (joyActive.current) joyFromEvent(e); };
  const joyEnd = () => { joyActive.current = false; joyVecRef.current = { x: 0, y: 0 }; setKnob({ x: 0, y: 0 }); };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ZOOM = isTouch ? 0.85 : 1; // on phones, pull back a little so you can see more of the world
    const resize = () => {
      // logical (world-space) viewport is larger when zoomed out
      width = window.innerWidth / ZOOM;
      height = window.innerHeight / ZOOM;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Cat frames (walk + idle) ────────────────────────────────────────────
    type Frame = { img: HTMLImageElement; bbox: Bbox | null };
    const loadDirFrames = (folder: string, count: number) => {
      const r: Record<Direction, Frame[]> = { down: [], up: [], left: [], right: [] };
      for (const dir of DIRECTIONS) {
        for (let i = 1; i <= count; i++) {
          const img = new Image();
          const f: Frame = { img, bbox: null };
          img.onload = () => { f.bbox = measureBbox(img); };
          img.src = `/sprites/${folder}/${dir}/${i}.png`;
          r[dir].push(f);
        }
      }
      return r;
    };
    const walkFrames = loadDirFrames("walk", FRAMES_PER_DIR);
    const idleFrames = loadDirFrames("idle", IDLE_FRAMES_PER_DIR);

    // ── World map (loaded async from the editor's saved file) ───────────────
    let world: WorldMap | null = null;
    const sprites = new Map<string, Sprite>();
    let decorations: { x: number; y: number; src: string }[] = [];
    let markers: { x: number; y: number; text: string; src: string }[] = []; // interaction pads
    let blocked = new Set<string>(); // "tx,ty" keys for cells with deco (cat blocked)
    let posX = 0, posY = 0; // spawn until map loads
    let museumSpawn: { x: number; y: number } | null = null; // where to land on gallery exit
    let bounds = { minX: -10000, maxX: 10000, minY: -10000, maxY: 10000 };

    const spriteOf = (src: string) => {
      let s = sprites.get(src);
      if (!s) { s = loadSprite(src); sprites.set(src, s); }
      return s;
    };

    const applyMap = (m: WorldMap) => {
      world = m;
      decorations = [];
      markers = [];
      blocked = new Set<string>();
      for (let ty = 0; ty < m.height; ty++) {
        for (let tx = 0; tx < m.width; tx++) {
          const cell = m.cells[ty]?.[tx];
          if (!cell) continue;
          if (cell.ground) spriteOf(cell.ground);
          if (cell.deco) {
            spriteOf(cell.deco);
            // Buildings get an interaction pad in the free cell in front (below
            // their base row), with that building's dialogue.
            if (isBuilding(cell.deco) && ty + 1 < m.height) {
              markers.push({
                x: tx * TILE + TILE / 2,
                y: (ty + 1) * TILE + TILE / 2,
                text: dialogueFor(cell.deco),
                src: cell.deco,
              });
            }
            const { dx, dy } = jitterOffset(tx, ty, cell.deco, TILE);
            decorations.push({
              x: tx * TILE + TILE / 2 + dx,
              y: ty * TILE + TILE / 2 + dy,
              src: cell.deco,
            });
            // Small/medium rocks (and anything flagged passable) don't block.
            // Solid objects block their full footprint (full width × base depth)
            // centred on the anchor cell — not just the single placed cell.
            if (!isPassable(cell.deco)) {
              const fp = footprintOf(cell.deco);
              const startX = tx - Math.floor((fp.w - 1) / 2);
              for (let cx = startX; cx < startX + fp.w; cx++) {
                for (let cy = ty - (fp.h - 1); cy <= ty; cy++) {
                  if (cx >= 0 && cy >= 0 && cx < m.width && cy < m.height) {
                    blocked.add(`${cx},${cy}`);
                  }
                }
              }
            }
          }
        }
      }
      decorations.sort((a, b) => a.y - b.y);

      // Spawn point: prefer the cat house (normal/2.png). If several, use the
      // right-most one. Stand the cat just in front of (below) its door.
      let cxStart = Math.floor(m.width / 2);
      let cyStart = Math.floor(m.height / 2);
      let catHouse: { x: number; y: number } | null = null;
      let museum: { x: number; y: number } | null = null;
      for (let ty = 0; ty < m.height; ty++) {
        for (let tx = 0; tx < m.width; tx++) {
          const deco = m.cells[ty]?.[tx]?.deco;
          if (deco === CAT_HOUSE_SRC) {
            if (!catHouse || tx > catHouse.x) catHouse = { x: tx, y: ty };
          }
          if (deco === MUSEUM_SRC) {
            if (!museum || ty > museum.y) museum = { x: tx, y: ty };
          }
        }
      }
      // Land just in front of (below) the museum door when returning from the gallery.
      if (museum) {
        museumSpawn = {
          x: museum.x * TILE + TILE / 2,
          y: (museum.y + 1) * TILE + TILE / 2 - TILE * 0.35,
        };
      }
      let spawnTx = cxStart, spawnTy = cyStart;
      let nudgeY = 0;
      if (catHouse) {
        // Spawn in the free cell directly in front of the house, but nudge the
        // cat up toward the door so it stands right at the doorstep without
        // being trapped on the (blocked) base cell.
        spawnTx = catHouse.x;
        spawnTy = catHouse.y + 1;
        nudgeY = -TILE * 0.35;
      } else {
        // No cat house — search outward from the map centre for a free cell.
        outer: for (let r = 0; r < Math.max(m.width, m.height); r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const tx = cxStart + dx, ty = cyStart + dy;
              if (tx < 0 || ty < 0 || tx >= m.width || ty >= m.height) continue;
              if (!blocked.has(`${tx},${ty}`)) { spawnTx = tx; spawnTy = ty; break outer; }
            }
          }
        }
      }
      posX = spawnTx * TILE + TILE / 2;
      posY = spawnTy * TILE + TILE / 2 + nudgeY;
      bounds = {
        minX: TILE * 0.3,
        maxX: m.width * TILE - TILE * 0.3,
        minY: TILE * 0.3,
        maxY: m.height * TILE - TILE * 0.3,
      };
    };

    // Exposed so the gallery's exit button can drop the cat back at the museum.
    exitToMuseumRef.current = () => {
      if (museumSpawn) { posX = museumSpawn.x; posY = museumSpawn.y; }
    };

    fetch("/api/map")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.cells && data?.width && data?.height) applyMap(data as WorldMap);
      })
      .catch(() => {});

    // ── Sky clouds (fill the off-map area instead of flat green) ────────────
    type Cloud = { px: number; py: number; s: number; spd: number };
    const clouds: Cloud[] = Array.from({ length: 16 }, () => ({
      px: Math.random(),                    // 0..1 horizontal phase (wraps)
      py: Math.random() * 0.85,             // 0..1 vertical band
      s: 0.7 + Math.random() * 1.6,         // scale
      spd: 0.004 + Math.random() * 0.01,    // drift speed
    }));
    const cloudPuffs = [[0, 0, 46], [36, 8, 34], [-36, 10, 32], [20, -16, 30], [-20, -14, 28], [60, 12, 24], [-58, 14, 22]];
    function drawClouds(now: number, camX: number, camY: number) {
      // Sky gradient.
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#9fd3ee");
      g.addColorStop(0.55, "#bfe4f2");
      g.addColorStop(1, "#e6f4f7");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      const t = now / 1000;
      const M = 220;                       // off-screen margin so clouds wrap smoothly
      const spanX = width + 2 * M;
      const spanY = height + 2 * M;
      for (const c of clouds) {
        // Drift with time; gentle parallax against the camera (clouds are "far").
        const offX = t * c.spd - camX * 0.00006;
        const fracX = ((c.px + offX) % 1 + 1) % 1;
        const sx = fracX * spanX - M;
        const sy = c.py * spanY - M - camY * 0.02;
        for (const [ox, oy, r] of cloudPuffs) {
          const rr = r * c.s;
          const px = sx + ox * c.s, py = sy + oy * c.s;
          const grd = ctx.createRadialGradient(px, py, rr * 0.15, px, py, rr);
          grd.addColorStop(0, "rgba(255,255,255,0.92)");
          grd.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(px, py, rr, 0, 7); ctx.fill();
        }
      }
    }

    // ── Museum "look at me" FX: rising light streaks ────────────────────────
    type Streak = { rx: number; phase: number; spd: number; len: number; lw: number };
    const streaks: Streak[] = Array.from({ length: 22 }, () => ({
      rx: Math.random(),                  // 0..1 across the building width
      phase: Math.random(),               // 0..1 starting offset in the cycle
      spd: 0.22 + Math.random() * 0.28,   // cycles per second
      len: 10 + Math.random() * 18,       // streak length (px)
      lw: 1 + Math.random() * 1.8,        // line width
    }));
    function drawRisingFX(bx: number, by: number, bw: number, bh: number, now: number) {
      const t = now / 1000;
      const baseY = by + bh;              // bottom of the building
      const rise = bh * 1.05;            // how far up streaks travel
      ctx.save();
      ctx.globalCompositeOperation = "lighter"; // additive → glowy
      for (const s of streaks) {
        const prog = (t * s.spd + s.phase) % 1;
        const x = bx + s.rx * bw;
        const y = baseY - prog * rise;
        const a = Math.sin(prog * Math.PI) * 0.7; // fade in then out
        if (a <= 0.01) continue;
        // soft warm gold streak
        const grd = ctx.createLinearGradient(x, y, x, y - s.len);
        grd.addColorStop(0, `rgba(255,236,170,0)`);
        grd.addColorStop(0.5, `rgba(255,232,150,${a})`);
        grd.addColorStop(1, `rgba(255,250,210,0)`);
        ctx.strokeStyle = grd;
        ctx.lineWidth = s.lw;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - s.len);
        ctx.stroke();
        // bright tip dot
        ctx.fillStyle = `rgba(255,245,200,${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(x, y - s.len, s.lw * 0.9, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Animated marker pad in front of each building ───────────────────────
    function drawMarker(sx: number, sy: number, now: number) {
      const t = now / 1000;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 0.5); // perspective squash → reads as on the ground
      for (let k = 0; k < 2; k++) {
        const ph = ((t * 0.7) + k * 0.5) % 1;
        const r = TILE * 0.18 + ph * TILE * 0.42;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 7);
        ctx.strokeStyle = `rgba(150,100,210,${(1 - ph) * 0.5})`; // purple, fades out
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      const core = TILE * 0.16 * (1 + Math.sin(t * 3) * 0.12);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, core);
      g.addColorStop(0, "rgba(150,95,215,0.92)");   // solid purple centre
      g.addColorStop(0.55, "rgba(160,110,220,0.7)");
      g.addColorStop(1, "rgba(160,110,220,0)");      // fade to transparent edge
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, core, 0, 7);
      ctx.fill();
      ctx.restore();
    }

    // Bridge to the bubble state — only fire setState when the line changes.
    let lastBubbleKey = " ";
    const updateBubble = (text: string | null) => {
      const key = text ?? "";
      if (key === lastBubbleKey) return;
      lastBubbleKey = key;
      if (text) setBubble({ text, visible: true });
      else setBubble((b) => ({ text: b.text, visible: false }));
    };

    // ── Cat state ───────────────────────────────────────────────────────────
    let direction: Direction = "down";
    let walkIdx = 0; let walkTimer = 0;
    let idleIdx = 0; let idleTimer = 0;
    let moving = false;

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keys[k] = true;
        if (k.startsWith("arrow")) e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // The building whose marker pad the cat is currently standing on (null if
    // none). Clicks only act on this building.
    let activeBuildingSrc: string | null = null;
    const isClickable = (src: string) => src in LINKS || src === MUSEUM_SRC;

    // Click a building → run its action (e.g. open a link). Hit-test against
    // each building's on-screen rect, front-most (largest y) first.
    const buildingAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const camX = posX - width / 2, camY = posY - height / 2;
      // screen (CSS px) → world units (account for the touch zoom-out)
      const wx = (clientX - rect.left) / ZOOM + camX;
      const wy = (clientY - rect.top) / ZOOM + camY;
      const builds = decorations.filter((d) => isBuilding(d.src)).sort((a, b) => b.y - a.y);
      for (const d of builds) {
        const sp = sprites.get(d.src);
        if (!sp?.bbox) continue;
        const w = widthTilesOf(d.src) * TILE;
        const h = (sp.bbox.h / sp.bbox.w) * w;
        const left = d.x - w / 2;
        const top = d.y + TILE * (0.5 - BASE_OFFSET) - h;
        if (wx >= left && wx <= left + w && wy >= top && wy <= top + h) return d;
      }
      return null;
    };
    const onClick = (e: MouseEvent) => {
      const d = buildingAt(e.clientX, e.clientY);
      // Only act if the cat is standing on THIS building's pad.
      if (!d || d.src !== activeBuildingSrc) return;
      const url = LINKS[d.src];
      if (url) { window.open(url, "_blank", "noopener,noreferrer"); return; }
      if (d.src === MUSEUM_SRC) setVoidPhase("pixel"); // fade world → blackhole
    };
    const onMouseMove = (e: MouseEvent) => {
      const d = buildingAt(e.clientX, e.clientY);
      const active = !!d && d.src === activeBuildingSrc && isClickable(d.src);
      canvas.style.cursor = active ? "pointer" : "default";
    };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMouseMove);

    // ── Collision: don't enter a tile flagged as blocked ────────────────────
    const tileIsBlocked = (px: number, py: number) => {
      if (!world) return false;
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      return blocked.has(`${tx},${ty}`);
    };
    const tryMove = (nx: number, ny: number) => {
      nx = Math.max(bounds.minX, Math.min(bounds.maxX, nx));
      ny = Math.max(bounds.minY, Math.min(bounds.maxY, ny));
      // Resolve axis-by-axis so the cat slides along blocked edges.
      if (!tileIsBlocked(nx, posY)) posX = nx;
      if (!tileIsBlocked(posX, ny)) posY = ny;
    };

    // ── Game loop ───────────────────────────────────────────────────────────
    let prev = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      const upK = keys["w"] || keys["arrowup"] ? 1 : 0;
      const dnK = keys["s"] || keys["arrowdown"] ? 1 : 0;
      const ltK = keys["a"] || keys["arrowleft"] ? 1 : 0;
      const rtK = keys["d"] || keys["arrowright"] ? 1 : 0;
      const jv = joyVecRef.current; // touch joystick (-1..1)
      let mx = (rtK - ltK) + jv.x;
      let my = (dnK - upK) + jv.y;
      const mlen = Math.hypot(mx, my);
      if (mlen > 1) { mx /= mlen; my /= mlen; }
      moving = mlen > 0.12;

      if (moving) {
        const len = Math.hypot(mx, my) || 1;
        const nx = posX + (mx / len) * SPEED * dt;
        const ny = posY + (my / len) * SPEED * dt;
        tryMove(nx, ny);
        if (Math.abs(mx) >= Math.abs(my)) direction = mx > 0 ? "right" : "left";
        else direction = my > 0 ? "down" : "up";
        walkTimer += dt;
        if (walkTimer >= 1 / ANIM_FPS) { walkTimer -= 1 / ANIM_FPS; walkIdx += 1; }
        idleIdx = 0; idleTimer = 0;
      } else {
        walkIdx = 0; walkTimer = 0;
        idleTimer += dt;
        if (idleTimer >= 1 / IDLE_FPS) { idleTimer -= 1 / IDLE_FPS; idleIdx += 1; }
      }

      // ── Render ────────────────────────────────────────────────────────────
      const camX = posX - width / 2;
      const camY = posY - height / 2;
      drawClouds(now, camX, camY);

      // Cat screen rect (always centred) — computed here so it's available both
      // for depth-interleaving inside the world and as a fallback before load.
      const seq = moving ? WALK_SEQ[direction] : IDLE_SEQ[direction];
      const set = moving ? walkFrames : idleFrames;
      const fidx = (moving ? walkIdx : idleIdx) % seq.length;
      const frame = set[direction][seq[fidx] - 1];
      let catRect: { img: HTMLImageElement; b: Bbox; x: number; y: number; w: number; h: number } | null = null;
      if (frame?.bbox && frame.img.complete) {
        const b = frame.bbox;
        const scale = CAT_DRAW_SIZE / Math.max(b.w, b.h);
        const w = Math.round(b.w * scale);
        const h = Math.round(b.h * scale);
        catRect = { img: frame.img, b, w, h, x: Math.round((width - w) / 2), y: Math.round((height - h) / 2) };
      }
      const drawCat = () => {
        if (!catRect) return;
        ctx.drawImage(catRect.img, catRect.b.x, catRect.b.y, catRect.b.w, catRect.b.h, catRect.x, catRect.y, catRect.w, catRect.h);
      };

      if (world) {
        const startTX = Math.max(0, Math.floor(camX / TILE));
        const endTX   = Math.min(world.width - 1, Math.ceil((camX + width) / TILE));
        const startTY = Math.max(0, Math.floor(camY / TILE));
        const endTY   = Math.min(world.height - 1, Math.ceil((camY + height) / TILE));

        for (let ty = startTY; ty <= endTY; ty++) {
          for (let tx = startTX; tx <= endTX; tx++) {
            const cell = world.cells[ty]?.[tx];
            if (!cell?.ground) continue;
            const sp = sprites.get(cell.ground);
            if (!sp?.bbox || !sp.img.complete) continue;
            // bbox-aware cover-fit: scale the opaque region (not the padded
            // PNG) so it fills TILE + 2·PAD, centred. Excess in the longer
            // bbox dimension extends past the cell — later cells overlap and
            // hide the artwork's dark scalloped borders.
            const b = sp.bbox;
            const PAD = TILE * 0.045;
            const target = TILE + 2 * PAD;
            const scale = Math.max(target / b.w, target / b.h);
            const scaledW = b.w * scale;
            const scaledH = b.h * scale;
            const dx = tx * TILE - camX - PAD + (target - scaledW) / 2;
            const dy = ty * TILE - camY - PAD + (target - scaledH) / 2;
            ctx.drawImage(sp.img, b.x, b.y, b.w, b.h, dx, dy, scaledW, scaledH);
          }
        }

        // Marker pads (drawn on the ground, under decorations + cat) and
        // proximity check → show the building's dialogue when standing on one.
        let activeText: string | null = null;
        activeBuildingSrc = null;
        const reach = TILE * 0.55;
        for (const mk of markers) {
          if (Math.hypot(posX - mk.x, posY - mk.y) < reach) {
            activeText = mk.text;
            activeBuildingSrc = mk.src;
          }
          if (mk.x < camX - TILE || mk.x > camX + width + TILE) continue;
          if (mk.y < camY - TILE || mk.y > camY + height + TILE) continue;
          drawMarker(mk.x - camX, mk.y - camY, now);
        }
        updateBubble(activeText);

        // Depth line: decorations anchored above this (smaller world Y) render
        // BEHIND the cat; anchored below render in FRONT (cat walks "under" them
        // when approached from the top).
        const catDepthY = posY + CAT_DRAW_SIZE * 0.35;

        // Decorations are sorted by y ascending. Draw the cat once we cross the
        // depth line. Front objects overlapping the cat go slightly translucent.
        const padX = TILE * 3;
        const padY = TILE * 4;
        let catDrawn = false;
        for (const d of decorations) {
          if (!catDrawn && d.y > catDepthY) { drawCat(); catDrawn = true; }
          if (d.x < camX - padX || d.x > camX + width + padX) continue;
          if (d.y < camY - padY || d.y > camY + height + padY) continue;
          const sp = sprites.get(d.src);
          if (!sp?.bbox || !sp.img.complete) continue;
          const w = widthTilesOf(d.src) * TILE;
          const h = (sp.bbox.h / sp.bbox.w) * w;
          const screenX = d.x - camX - w / 2;
          const screenY = d.y - camY + TILE * (0.5 - BASE_OFFSET) - h;

          // Fade this object only when it hides almost the entire cat
          // (≥95 % of the cat's box is inside this object's box) — so it only
          // turns translucent when the cat would otherwise be invisible.
          let faded = false;
          if (catRect && d.y > catDepthY) {
            const ix = Math.max(screenX, catRect.x);
            const iy = Math.max(screenY, catRect.y);
            const ix2 = Math.min(screenX + w, catRect.x + catRect.w);
            const iy2 = Math.min(screenY + h, catRect.y + catRect.h);
            const interArea = Math.max(0, ix2 - ix) * Math.max(0, iy2 - iy);
            const catArea = catRect.w * catRect.h;
            if (catArea > 0 && interArea / catArea >= 0.95) {
              ctx.globalAlpha = 0.55;
              faded = true;
            }
          }
          ctx.drawImage(
            sp.img, sp.bbox.x, sp.bbox.y, sp.bbox.w, sp.bbox.h,
            screenX, screenY, w, h,
          );
          if (faded) ctx.globalAlpha = 1;
          // Animated rising light streaks around the museum to draw the eye.
          if (d.src === MUSEUM_SRC) drawRisingFX(screenX, screenY, w, h, now);
        }
        if (!catDrawn) drawCat(); // cat is in front of everything remaining
      } else {
        drawCat(); // map not loaded yet — still show the cat
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  // Hide the whole game while a cutscene plays so nothing leaks on the sides.
  const inVoid = voidPhase !== "off";

  return (
    <>
      <style>{SPEECH_CSS}</style>
      <canvas id="scene" ref={canvasRef} style={{ display: inVoid ? "none" : "block" }} />

      {/* Speech bubble above the (always-centred) cat. */}
      {!inVoid && (
        <div className={`speech${bubble.visible ? "" : " hide"}`}>
          <div className="speech-box" dangerouslySetInnerHTML={{ __html: bubble.text }} />
          <div className="speech-tail" />
        </div>
      )}

      {!inVoid && (
        <div className="objective">
          <span className="blip" />
          Objective: Explore and find the art studio.
        </div>
      )}

      {!inVoid && isTouch && (
        <div
          className="tjoy"
          ref={joyRef}
          onPointerDown={joyStart}
          onPointerMove={joyMove}
          onPointerUp={joyEnd}
          onPointerCancel={joyEnd}
        >
          <div className="tjoy-knob" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
      )}

      {!inVoid && (
        <div className={`hint2d${isTouch ? " up" : ""}`}>{isTouch ? "Use the joystick to move" : "WASD / Arrow keys to move"}</div>
      )}

      {voidPhase === "pixel" && (
        <Blackhole
          onComplete={() => {
            // white flash covers the swap from pixel → realistic 3D
            setFlash(true);
            setTimeout(() => setVoidPhase("3d"), 380);
            setTimeout(() => setFlash(false), 850);
          }}
        />
      )}
      {voidPhase === "3d" && <Blackhole3D onComplete={() => setVoidPhase("gallery")} />}
      {voidPhase === "gallery" && <Gallery3D onExit={() => { exitToMuseumRef.current?.(); setVoidPhase("off"); }} />}
      {flash && <div className="void-flash" />}
    </>
  );
}

const SPEECH_CSS = `
.objective {
  position: fixed; top: 14px; right: 14px; z-index: 60;
  display: flex; align-items: center; gap: 10px;
  font-family: var(--font-pixel), ui-monospace, monospace;
  font-size: 9px; line-height: 1.7; color: #38322a;
  background: #fffdf6; border: 3px solid #38322a; border-radius: 10px;
  padding: 10px 13px; box-shadow: 4px 4px 0 rgba(56,50,42,0.22);
  max-width: 260px; image-rendering: pixelated;
}
.objective .blip {
  width: 9px; height: 9px; flex: none; background: #d23b3b;
  border: 2px solid #38322a; animation: blip 1s steps(1) infinite;
}
@keyframes blip { 0%,49%{opacity:1} 50%,100%{opacity:0} }
@media (max-width: 640px) {
  .objective { font-size: 7px; line-height: 1.6; padding: 7px 9px; gap: 7px; max-width: 56vw; top: 10px; right: 10px; }
  .objective .blip { width: 7px; height: 7px; }
}

/* Touch joystick (bottom-left) — chunky pixel-art style to match the 2D world */
.tjoy {
  position: fixed; left: 20px; bottom: 20px; z-index: 70; width: 116px; height: 116px;
  touch-action: none; -webkit-user-select: none; user-select: none;
  background: #efe6d2; border: 4px solid #38322a; border-radius: 10px;
  box-shadow: 6px 6px 0 rgba(56,50,42,0.3), inset 0 0 0 3px #d8cbb0;
  image-rendering: pixelated;
}
.tjoy-knob {
  position: absolute; left: 50%; top: 50%; width: 52px; height: 52px;
  background: #c2873b; border: 4px solid #38322a; border-radius: 8px;
  box-shadow: inset -4px -4px 0 rgba(56,50,42,0.30), inset 4px 4px 0 rgba(255,255,255,0.38), 3px 3px 0 rgba(56,50,42,0.3);
  transform: translate(-50%, -50%); image-rendering: pixelated;
}
@media (max-width: 640px) { .tjoy { width: 104px; height: 104px; } .tjoy-knob { width: 46px; height: 46px; } }

/* Bottom-centre movement hint (grayish pill, pixel font) */
.hint2d {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 60; pointer-events: none;
  font-family: var(--font-pixel), ui-monospace, monospace; font-size: 8px; letter-spacing: .04em;
  color: rgba(255,255,255,0.82); background: rgba(40,36,30,0.5);
  padding: 9px 14px; border-radius: 8px; image-rendering: pixelated; white-space: nowrap;
}
/* bottom-right, bottom-aligned with the joystick, when touch controls are shown */
.hint2d.up { left: auto; right: 20px; bottom: 20px; transform: none; }
@media (max-width: 640px) { .hint2d { font-size: 7px; padding: 6px 9px; } }
.speech {
  position: fixed; left: 50%; top: 50%; z-index: 50; pointer-events: none;
  width: max-content; max-width: min(340px, 80vw);
  /* sit above the cat sprite (cat is centred, ~96px tall) */
  transform: translate(-50%, calc(-50% - 96px));
  transition: opacity .6s ease, transform .6s ease;
}
.speech.hide { opacity: 0; transform: translate(-50%, calc(-50% - 124px)); }
.speech-box {
  font-family: var(--font-pixel), ui-monospace, monospace;
  font-size: 10px; line-height: 1.85; color: #38322a; text-align: center;
  background: #fffdf6; border: 3px solid #38322a; border-radius: 12px;
  padding: 13px 15px; box-shadow: 5px 5px 0 rgba(56,50,42,0.22);
  image-rendering: pixelated;
  animation: speech-pop .42s cubic-bezier(.2,1.5,.4,1) both;
  transform-origin: bottom center;
}
.speech-tail {
  position: relative; width: 0; height: 0; margin: -1px auto 0;
  border-left: 11px solid transparent; border-right: 11px solid transparent;
  border-top: 13px solid #38322a;
  animation: speech-pop .42s cubic-bezier(.2,1.5,.4,1) both;
  transform-origin: top center;
}
.speech-tail::after {
  content: ""; position: absolute; left: -7px; top: -14px;
  border-left: 7px solid transparent; border-right: 7px solid transparent;
  border-top: 9px solid #fffdf6;
}
@keyframes speech-pop { from { transform: scale(.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
`;
