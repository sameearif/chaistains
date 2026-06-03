"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FOLDER_META, DEFAULT_META, widthTilesOf, jitterOffset, type FolderMeta } from "@/lib/sprites";

// Default grid dimensions; user can resize via toolbar inputs.
const DEFAULT_GRID_W = 28;
const DEFAULT_GRID_H = 18;
const MIN_DIM = 1;
const MAX_DIM = 200;
const CELL_PX = 64;        // editor cell size on screen
const BASE_OFFSET = 0.05;  // deco base extends 5 % of a tile below cell bottom (matches game)
// Padding around the grid so tall buildings / trees can extend up & sideways.
const GRID_PAD_TOP = 260;
const GRID_PAD_SIDE = 160;

type TileInfo = { src: string; folder: string; name: string; meta: FolderMeta };

type Bbox = { x: number; y: number; w: number; h: number };
type TileMeta = { bbox: Bbox; naturalW: number; naturalH: number };
type Cell = { ground?: string; deco?: string };
type Tool = "paint" | "erase";

function emptyGrid(w: number, h: number): Cell[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ({})));
}
function growGrid(prev: Cell[][], minW: number, minH: number): Cell[][] {
  const curH = prev.length;
  const curW = prev[0]?.length ?? 0;
  const newH = Math.max(curH, minH);
  const newW = Math.max(curW, minW);
  if (newH === curH && newW === curW) return prev;
  return Array.from({ length: newH }, (_, y) =>
    Array.from({ length: newW }, (_, x) => prev[y]?.[x] ?? {}),
  );
}
const clampDim = (n: number) => Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(n) || MIN_DIM));

// Zoom: scales the whole stage so more (or fewer) tiles fit on screen.
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));

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

const EDITOR_CSS = `
.ed {
  display: flex; height: 100vh; overflow: hidden; color: #e8ebf2;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  background:
    radial-gradient(1200px 600px at 80% -10%, #1b2230 0%, transparent 60%),
    radial-gradient(900px 500px at -10% 110%, #161d2a 0%, transparent 55%),
    #0c0f15;
}

/* ── Sidebar ─────────────────────────────────────────── */
.ed-side {
  width: 312px; flex-shrink: 0; overflow-y: auto;
  background: linear-gradient(180deg, #141925 0%, #10141d 100%);
  border-right: 1px solid #232a3a;
  box-shadow: inset -1px 0 0 rgba(255,255,255,0.02), 6px 0 24px rgba(0,0,0,0.35);
}
.ed-side::-webkit-scrollbar { width: 10px; }
.ed-side::-webkit-scrollbar-thumb { background: #2a3242; border-radius: 8px; border: 2px solid #10141d; }
.ed-brand {
  position: sticky; top: 0; z-index: 5; padding: 16px 16px 12px;
  background: linear-gradient(180deg, #161c28 0%, rgba(22,28,40,0.92) 100%);
  backdrop-filter: blur(8px); border-bottom: 1px solid #222a3a;
}
.ed-brand h1 {
  margin: 0; font-size: 17px; font-weight: 800; letter-spacing: .2px;
  display: flex; align-items: center; gap: 8px;
}
.ed-brand .logo {
  width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center;
  font-size: 15px; background: linear-gradient(145deg, #f4c862, #e0992f);
  box-shadow: 0 4px 12px rgba(224,153,47,0.4), inset 0 1px 0 rgba(255,255,255,0.5);
}
.ed-help { margin: 8px 0 0; font-size: 11.5px; line-height: 1.5; color: #8a93a8; }
.ed-help b { color: #cdd4e3; font-weight: 700; }
.ed-help kbd {
  font: inherit; font-size: 10.5px; font-weight: 700; color: #f4c862;
  background: #1c2230; border: 1px solid #2c3445; border-radius: 5px; padding: 1px 5px;
}
.ed-sections { padding: 12px; }
.ed-sec { margin-bottom: 18px; }
.ed-sec-h {
  display: flex; align-items: center; gap: 6px; margin: 0 2px 8px;
  font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #97a0b5;
}
.ed-sec-h .dot { width: 6px; height: 6px; border-radius: 50%; }
.ed-sec-h .badge {
  margin-left: auto; font-size: 9.5px; font-weight: 700; color: #748098;
  background: #181f2c; border: 1px solid #283044; border-radius: 999px;
  padding: 1px 7px; text-transform: none; letter-spacing: 0;
}
.ed-pal { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.ed-tile {
  position: relative; border: 1px solid #232b3b; border-radius: 10px; padding: 6px; cursor: pointer;
  background: #161c28;
  background-image:
    linear-gradient(45deg, #1a2130 25%, transparent 25%),
    linear-gradient(-45deg, #1a2130 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1a2130 75%),
    linear-gradient(-45deg, transparent 75%, #1a2130 75%);
  background-size: 14px 14px; background-position: 0 0, 0 7px, 7px -7px, -7px 0;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
}
.ed-tile:hover { transform: translateY(-2px); border-color: #3a455c; box-shadow: 0 6px 16px rgba(0,0,0,0.4); }
.ed-tile.sel {
  border-color: #f4c862;
  box-shadow: 0 0 0 1px #f4c862, 0 8px 20px rgba(244,200,98,0.25);
}
.ed-tile.sel::after {
  content: "✓"; position: absolute; top: -7px; right: -7px;
  width: 18px; height: 18px; border-radius: 50%; font-size: 11px; font-weight: 800; color: #1a1206;
  background: #f4c862; display: grid; place-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
.ed-tile img { width: 100%; height: 52px; object-fit: contain; image-rendering: pixelated; display: block; }
.ed-tile span { font-size: 9px; color: #8b94a8; font-weight: 600; }

/* ── Main / toolbar ──────────────────────────────────── */
.ed-main { flex: 1; overflow: auto; }
.ed-main::-webkit-scrollbar { width: 12px; height: 12px; }
.ed-main::-webkit-scrollbar-thumb { background: #2a3242; border-radius: 8px; border: 3px solid #0c0f15; }
.ed-bar {
  position: sticky; top: 0; z-index: 1000; display: flex; align-items: center; gap: 10px;
  flex-wrap: wrap; padding: 10px 14px;
  background: rgba(16,20,29,0.86); backdrop-filter: blur(10px);
  border-bottom: 1px solid #232a3a;
}
.ed-btn {
  border: 1px solid transparent; border-radius: 9px; padding: 7px 14px; cursor: pointer;
  font-size: 12.5px; font-weight: 700; letter-spacing: .2px; color: #e8ebf2; background: #222a39;
  display: inline-flex; align-items: center; gap: 6px;
  transition: transform .1s ease, filter .15s ease, background .15s ease;
}
.ed-btn:hover { filter: brightness(1.12); }
.ed-btn:active { transform: translateY(1px); }
.ed-btn.ghost { background: #1a2130; border-color: #2c3445; color: #b9c1d3; }
.ed-btn.primary { background: linear-gradient(145deg, #46c46a, #2e9b4e); color: #06210f; box-shadow: 0 4px 12px rgba(46,155,78,0.35); }
.ed-btn.danger { background: linear-gradient(145deg, #e0584f, #b23a33); color: #2a0908; box-shadow: 0 4px 12px rgba(178,58,51,0.3); }

.ed-seg { display: inline-flex; padding: 3px; gap: 3px; background: #161c28; border: 1px solid #2a3445; border-radius: 11px; }
.ed-seg button {
  border: 0; border-radius: 8px; padding: 6px 14px; cursor: pointer;
  font-size: 12.5px; font-weight: 700; color: #9aa3b7; background: transparent;
  display: inline-flex; align-items: center; gap: 6px; transition: all .14s ease;
}
.ed-seg button.on { color: #1a1206; background: linear-gradient(145deg, #f4c862, #e0992f); box-shadow: 0 3px 9px rgba(224,153,47,0.35); }
.ed-seg button:not(.on):hover { color: #d7dceb; background: #1f2735; }

.ed-dim { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #161c28; border: 1px solid #2a3445; border-radius: 11px; }
.ed-dim label { font-size: 11px; font-weight: 800; color: #748098; }
.ed-dim input {
  width: 50px; padding: 5px 7px; border-radius: 7px; border: 1px solid #2c3445;
  background: #0e131c; color: #e8ebf2; font-size: 12px; font-weight: 600; text-align: center;
  -moz-appearance: textfield;
}
.ed-dim input::-webkit-outer-spin-button, .ed-dim input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.ed-dim input:focus { outline: none; border-color: #f4c862; box-shadow: 0 0 0 2px rgba(244,200,98,0.18); }
.ed-dim .x { color: #4a5366; font-size: 11px; font-weight: 700; }

.ed-zoom { display: inline-flex; align-items: center; gap: 2px; padding: 3px; background: #161c28; border: 1px solid #2a3445; border-radius: 11px; }
.ed-zoom button {
  border: 0; background: transparent; color: #c2cad9; cursor: pointer;
  font-size: 14px; font-weight: 800; line-height: 1; padding: 5px 9px; border-radius: 8px;
  transition: background .14s ease, color .14s ease;
}
.ed-zoom button:hover { background: #232c3d; color: #fff; }
.ed-zoom button.pct { font-size: 11.5px; font-weight: 700; min-width: 44px; color: #9aa3b7; }

.ed-status {
  font-size: 11.5px; color: #8a93a8; padding: 5px 12px; border-radius: 999px;
  background: #141a26; border: 1px solid #232b3b; max-width: 360px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.ed-status b { color: #cdd4e3; }
.ed-back { margin-left: auto; color: #9aa3b7; text-decoration: none; font-size: 12.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; transition: color .15s; }
.ed-back:hover { color: #f4c862; }

.ed-stage-wrap { padding: ${GRID_PAD_TOP}px ${GRID_PAD_SIDE}px 80px; }
.ed-stage {
  position: relative; border-radius: 14px;
  background:
    repeating-linear-gradient(45deg, #131722 0 18px, #10131c 18px 36px);
  box-shadow: 0 24px 60px rgba(0,0,0,0.45), inset 0 0 0 1px #232a3a;
}
`;

export default function EditorPage() {
  const [selected, setSelected] = useState<TileInfo | null>(null);
  const [tool, setTool] = useState<Tool>("paint");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [gridW, setGridW] = useState(DEFAULT_GRID_W);
  const [gridH, setGridH] = useState(DEFAULT_GRID_H);
  const [draftW, setDraftW] = useState<string>(String(DEFAULT_GRID_W));
  const [draftH, setDraftH] = useState<string>(String(DEFAULT_GRID_H));
  const [cells, setCells] = useState<Cell[][]>(() => emptyGrid(DEFAULT_GRID_W, DEFAULT_GRID_H));
  const [meta, setMeta] = useState<Record<string, TileMeta>>({});
  const [tiles, setTiles] = useState<TileInfo[]>([]);
  const [saved, setSaved] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const zoomBy = (d: number) => setZoom((z) => clampZoom(z + d));

  // Ctrl/Cmd + wheel zooms (native non-passive listener so we can preventDefault).
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Fetch the live list of sprites from disk every time the editor loads ─
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sprites")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string[]>) => {
        if (cancelled) return;
        const list: TileInfo[] = [];
        const seenFolders = new Set(Object.keys(FOLDER_META));
        // Preserve FOLDER_META order, then any unknown folders.
        const ordered: string[] = [
          ...Object.keys(FOLDER_META).filter((f) => data[f]),
          ...Object.keys(data).filter((f) => !seenFolders.has(f)),
        ];
        for (const folder of ordered) {
          const files = data[folder] ?? [];
          const m = FOLDER_META[folder] ?? DEFAULT_META;
          for (const file of files) {
            list.push({
              src: `/sprites/exterior/${folder}/${file}`,
              folder,
              name: file,
              meta: m,
            });
          }
        }
        setTiles(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Measure each tile's opaque bbox once it loads, in batches ───────────
  useEffect(() => {
    if (!tiles.length) return;
    let cancelled = false;
    const results: Record<string, TileMeta> = { ...meta };
    let pending = 0;
    const toLoad = tiles.filter((t) => !results[t.src]);
    if (toLoad.length === 0) return;
    const flush = () => { if (!cancelled) setMeta({ ...results }); };
    for (const t of toLoad) {
      const img = new Image();
      img.onload = () => {
        const b = measureBbox(img);
        if (b) results[t.src] = { bbox: b, naturalW: img.naturalWidth, naturalH: img.naturalHeight };
        pending++;
        if (pending % 10 === 0 || pending === toLoad.length) flush();
      };
      img.onerror = () => { pending++; };
      img.src = t.src;
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

  // ── Try to load any previously-saved map — adopt its dimensions ─────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/map")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.cells) return;
        const w = clampDim(data.width ?? DEFAULT_GRID_W);
        const h = clampDim(data.height ?? DEFAULT_GRID_H);
        const next = emptyGrid(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const c = data.cells?.[y]?.[x];
            if (c) next[y][x] = { ground: c.ground, deco: c.deco };
          }
        }
        setGridW(w); setGridH(h);
        setDraftW(String(w)); setDraftH(String(h));
        setCells(next);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setDraftW(String(gridW)); }, [gridW]);
  useEffect(() => { setDraftH(String(gridH)); }, [gridH]);

  // Grow the backing array only — shrinking is purely a viewport change.
  const applyDimensions = (w: number, h: number) => {
    const nw = clampDim(w), nh = clampDim(h);
    setGridW(nw); setGridH(nh);
    setCells((prev) => growGrid(prev, nw, nh));
  };
  const commitW = () => applyDimensions(Number(draftW), gridH);
  const commitH = () => applyDimensions(gridW, Number(draftH));

  const applyTo = useCallback((x: number, y: number) => {
    setCells((prev) => {
      const cur = prev[y][x];
      let nextCell: Cell;
      if (tool === "erase") {
        if (!cur.ground && !cur.deco) return prev;
        nextCell = {};
      } else {
        if (!selected) return prev;
        nextCell = { ...cur };
        if (selected.meta.isDeco) nextCell.deco = selected.src;
        else nextCell.ground = selected.src;
        if (nextCell.ground === cur.ground && nextCell.deco === cur.deco) return prev;
      }
      const next = prev.map((row, ry) => (ry === y ? row.slice() : row));
      next[y][x] = nextCell;
      return next;
    });
  }, [selected, tool]);

  const eraseAt = useCallback((x: number, y: number) => {
    setCells((prev) => {
      if (!prev[y][x].ground && !prev[y][x].deco) return prev;
      const next = prev.map((row, ry) => (ry === y ? row.slice() : row));
      next[y][x] = {};
      return next;
    });
  }, []);

  const onCellDown = (x: number, y: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    if (e.button === 2) eraseAt(x, y);
    else applyTo(x, y);
  };
  const onCellEnter = (x: number, y: number, e: React.MouseEvent) => {
    if (!dragging.current) return;
    if (e.buttons & 2) eraseAt(x, y);
    else applyTo(x, y);
  };

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const save = async () => {
    setSaved("…");
    const trimmed = cells.slice(0, gridH).map((row) => row.slice(0, gridW));
    try {
      const res = await fetch("/api/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: gridW, height: gridH, cells: trimmed }),
      });
      setSaved(res.ok
        ? `Saved at ${new Date().toLocaleTimeString()} → public/maps/world.json`
        : `Save failed: ${await res.text()}`);
    } catch (e) {
      setSaved(`Save error: ${(e as Error).message}`);
    }
  };

  const clearAll = () => {
    if (confirm("Clear the entire map?")) setCells(emptyGrid(gridW, gridH));
  };

  // ── CSS helpers — sized to match the game's renderer ────────────────────
  // bbox-aware cover-fit: scale the opaque region (not the padded PNG) so it
  // fills the cell plus GROUND_PAD on each side. Adjacent ground tiles
  // overlap in the pad region → no visible seams or shrunken inner tiles
  // (the "flower" tiles 7-9 / 16-18 used to leave horizontal gaps).
  const GROUND_PAD = 3; // px each side of overlap
  const groundStyle = (src: string): React.CSSProperties => {
    const target = CELL_PX + 2 * GROUND_PAD;
    const m = meta[src];
    if (!m) {
      return {
        position: "absolute",
        left: -GROUND_PAD, top: -GROUND_PAD, right: -GROUND_PAD, bottom: -GROUND_PAD,
        backgroundImage: `url(${src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        imageRendering: "pixelated",
        pointerEvents: "none",
      };
    }
    const scale = Math.max(target / m.bbox.w, target / m.bbox.h);
    const bgW = m.naturalW * scale;
    const bgH = m.naturalH * scale;
    // Centre the bbox inside the (target × target) ground div.
    const bgX = target / 2 - (m.bbox.x + m.bbox.w / 2) * scale;
    const bgY = target / 2 - (m.bbox.y + m.bbox.h / 2) * scale;
    return {
      position: "absolute",
      left: -GROUND_PAD, top: -GROUND_PAD, right: -GROUND_PAD, bottom: -GROUND_PAD,
      backgroundImage: `url(${src})`,
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `${bgX}px ${bgY}px`,
      imageRendering: "pixelated",
      pointerEvents: "none",
    };
  };

  const decoStyle = (src: string, tx: number, ty: number): React.CSSProperties | null => {
    const m = meta[src];
    if (!m) return null;
    const w = widthTilesOf(src) * CELL_PX;
    const h = (m.bbox.h / m.bbox.w) * w;
    const sx = w / m.bbox.w;
    const sy = h / m.bbox.h;
    const { dx, dy } = jitterOffset(tx, ty, src, CELL_PX);
    return {
      position: "absolute",
      bottom: -CELL_PX * BASE_OFFSET - dy,
      left: (CELL_PX - w) / 2 + dx,
      width: w,
      height: h,
      backgroundImage: `url(${src})`,
      backgroundSize: `${m.naturalW * sx}px ${m.naturalH * sy}px`,
      backgroundPosition: `${-m.bbox.x * sx}px ${-m.bbox.y * sy}px`,
      imageRendering: "pixelated",
      pointerEvents: "none",
    };
  };

  const grouped = useMemo(() => {
    const g = new Map<string, TileInfo[]>();
    for (const t of tiles) {
      if (!g.has(t.folder)) g.set(t.folder, []);
      g.get(t.folder)!.push(t);
    }
    return g;
  }, [tiles]);

  return (
    <div className="ed" onContextMenu={(e) => e.preventDefault()}>
      <style>{EDITOR_CSS}</style>
      <aside className="ed-side">
        <div className="ed-brand">
          <h1><span className="logo">🐈</span> Map Editor</h1>
          <p className="ed-help">
            Pick a tile, then click &amp; drag to paint.<br />
            <kbd>L-click</kbd> paint &nbsp;·&nbsp; <kbd>R-click</kbd> erase
          </p>
        </div>
        <div className="ed-sections">
          {[...grouped.entries()].map(([folder, list]) => {
            const m = FOLDER_META[folder] ?? DEFAULT_META;
            const dot = m.isDeco ? "#e0992f" : "#5fbf6e";
            return (
              <section key={folder} className="ed-sec">
                <div className="ed-sec-h">
                  <span className="dot" style={{ background: dot }} />
                  {m.display}
                  <span className="badge">{m.isDeco ? "deco" : "ground"} · {list.length}</span>
                </div>
                <div className="ed-pal">
                  {list.map((t) => {
                    const isSel = selected?.src === t.src;
                    return (
                      <button
                        key={t.src}
                        onClick={() => setSelected(t)}
                        title={`${folder}/${t.name}`}
                        className={isSel ? "ed-tile sel" : "ed-tile"}
                      >
                        <img src={t.src} alt={t.name} draggable={false} />
                        <span>{t.name.replace(".png", "")}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </aside>

      <main className="ed-main" ref={mainRef}>
        <div className="ed-bar">
          <div className="ed-seg" role="group" aria-label="Tool">
            <button className={tool === "paint" ? "on" : ""} onClick={() => setTool("paint")}>🖌 Paint</button>
            <button className={tool === "erase" ? "on" : ""} onClick={() => setTool("erase")}>🧽 Erase</button>
          </div>
          <button className="ed-btn primary" onClick={save}>💾 Save</button>
          <button className="ed-btn danger" onClick={clearAll}>🗑 Clear</button>
          <button className="ed-btn ghost" onClick={() => setShowGrid((g) => !g)}>
            {showGrid ? "▦ Grid on" : "▢ Grid off"}
          </button>
          <span className="ed-zoom" title="Zoom (Ctrl/⌘ + scroll)">
            <button onClick={() => zoomBy(-ZOOM_STEP)} aria-label="Zoom out">−</button>
            <button className="pct" onClick={() => setZoom(1)} title="Reset to 100%">{Math.round(zoom * 100)}%</button>
            <button onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom in">+</button>
          </span>
          <span className="ed-dim" title="Resize is non-destructive: shrinking hides cells but keeps them in memory.">
            <label>W</label>
            <input
              type="number" min={MIN_DIM} max={MAX_DIM} value={draftW}
              onChange={(e) => setDraftW(e.target.value)}
              onBlur={commitW}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
            <span className="x">×</span>
            <label>H</label>
            <input
              type="number" min={MIN_DIM} max={MAX_DIM} value={draftH}
              onChange={(e) => setDraftH(e.target.value)}
              onBlur={commitH}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </span>
          <span className="ed-status">
            {selected ? <>Selected: <b>{selected.folder}/{selected.name}</b></> : "No tile selected"}
            {saved && ` · ${saved}`}
          </span>
          <a href="/" className="ed-back">← back to game</a>
        </div>
        <div className="ed-stage-wrap">
          {/* Sizer reserves the SCALED footprint so scrollbars match the zoom. */}
          <div style={{ width: gridW * CELL_PX * zoom, height: gridH * CELL_PX * zoom }}>
          {/* Stacked layers so ground is one continuous carpet and decorations
              float above it (no per-cell boxes around grass+object cells). */}
          <div
            className="ed-stage"
            style={{
              width: gridW * CELL_PX,
              height: gridH * CELL_PX,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {/* Layer 1 — continuous ground */}
            <div
              style={{
                position: "absolute", inset: 0,
                display: "grid",
                gridTemplateColumns: `repeat(${gridW}, ${CELL_PX}px)`,
                gridAutoRows: `${CELL_PX}px`,
              }}
            >
              {cells.slice(0, gridH).map((row, y) =>
                row.slice(0, gridW).map((cell, x) => (
                  <div key={`g-${x}-${y}`} style={{ position: "relative" }}>
                    {cell.ground && <div style={groundStyle(cell.ground)} />}
                  </div>
                )),
              )}
            </div>

            {/* Layer 2 — decorations, depth-sorted by row via z-index */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {cells.slice(0, gridH).flatMap((row, y) =>
                row.slice(0, gridW).map((cell, x) => {
                  if (!cell.deco) return null;
                  const decoSt = decoStyle(cell.deco, x, y);
                  if (!decoSt) return null;
                  return (
                    <div
                      key={`d-${x}-${y}`}
                      style={{
                        position: "absolute",
                        left: x * CELL_PX, top: y * CELL_PX,
                        width: CELL_PX, height: CELL_PX,
                        zIndex: y + 1,
                      }}
                    >
                      <div style={decoSt} />
                    </div>
                  );
                }),
              )}
            </div>

            {/* Layer 3 — grid overlay (toggleable) */}
            {showGrid && (
              <div
                style={{
                  position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5000,
                  backgroundImage:
                    "linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px), " +
                    "linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)",
                  backgroundSize: `${CELL_PX}px ${CELL_PX}px`,
                }}
              />
            )}

            {/* Layer 4 — interaction + hover (on top, transparent) */}
            <div
              style={{
                position: "absolute", inset: 0, zIndex: 6000,
                display: "grid",
                gridTemplateColumns: `repeat(${gridW}, ${CELL_PX}px)`,
                gridAutoRows: `${CELL_PX}px`,
              }}
            >
              {cells.slice(0, gridH).map((row, y) =>
                row.slice(0, gridW).map((_cell, x) => {
                  const isHover = hover?.x === x && hover?.y === y;
                  return (
                    <div
                      key={`i-${x}-${y}`}
                      onMouseDown={(e) => onCellDown(x, y, e)}
                      onMouseEnter={(e) => { setHover({ x, y }); onCellEnter(x, y, e); }}
                      onMouseLeave={() => setHover((h) => (h?.x === x && h?.y === y ? null : h))}
                      style={{ ...styles.cell, width: CELL_PX, height: CELL_PX }}
                    >
                      {isHover && <div style={styles.hover} />}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Interaction cell — transparent so the ground layer shows through. Hover
  // highlight is the editing reference (no persistent borders that would read
  // as cuts across building / tree sprites).
  cell: { position: "relative", background: "transparent", cursor: "crosshair", overflow: "visible" },
  hover: { position: "absolute", inset: 0, borderRadius: 3, outline: "2px solid #f4c862", outlineOffset: -2, background: "rgba(244,200,98,0.12)", pointerEvents: "none", zIndex: 9999 },
};
