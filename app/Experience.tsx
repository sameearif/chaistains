"use client";

import { useEffect, useState } from "react";
import Gallery from "./Gallery";
import Loader from "./Loader";
import { MODEL_URLS, fetchWithProgress } from "@/lib/preload";

const DIRECTIONS = ["down", "up", "left", "right"] as const;

// Build the list of 2D sprites the game needs up front (cat frames + every
// tile referenced by the saved map) so the world appears instantly.
async function collectImageUrls(): Promise<string[]> {
  const urls = new Set<string>();
  for (const dir of DIRECTIONS) {
    for (let i = 1; i <= 4; i++) urls.add(`/sprites/walk/${dir}/${i}.png`);
    for (let i = 1; i <= 2; i++) urls.add(`/sprites/idle/${dir}/${i}.png`);
  }
  try {
    const res = await fetch("/api/map");
    if (res.ok) {
      const data = await res.json();
      for (const row of data.cells ?? []) {
        for (const cell of row) {
          if (cell?.ground) urls.add(cell.ground);
          if (cell?.deco) urls.add(cell.deco);
        }
      }
    }
  } catch {
    /* map optional for preloading */
  }
  // Gallery wall artwork (warms the HTTP cache so paintings appear instantly).
  try {
    const res = await fetch("/art/art.json");
    if (res.ok) {
      const arts = await res.json();
      if (Array.isArray(arts)) for (const a of arts) if (a?.file) urls.add(`/art/${a.file}`);
    }
  } catch {
    /* art optional for preloading */
  }
  return [...urls];
}

function loadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

const MODEL_WEIGHT = 0.7; // big 3D files dominate the progress bar
const IMAGE_WEIGHT = 0.3;

export default function Experience() {
  const [progress, setProgress] = useState(0); // 0..100, real load
  const [ready, setReady] = useState(false);   // assets done → show Enter
  const [hidden, setHidden] = useState(false);  // loader unmounted

  // ── Preload assets; progress reflects the real download (no fake delay) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const modelFrac = new Map<string, number>(MODEL_URLS.map((u) => [u, 0]));
      let imagesLoaded = 0;
      let imagesTotal = 1;
      const recompute = () => {
        if (cancelled) return;
        const mAvg = [...modelFrac.values()].reduce((a, b) => a + b, 0) / MODEL_URLS.length;
        const iFrac = imagesLoaded / imagesTotal;
        setProgress(Math.min(99, (mAvg * MODEL_WEIGHT + iFrac * IMAGE_WEIGHT) * 100));
      };

      const modelJobs = MODEL_URLS.map((url) =>
        fetchWithProgress(url, (loaded, total) => {
          modelFrac.set(url, total > 0 ? Math.min(1, loaded / total) : 0);
          recompute();
        }).then(() => { modelFrac.set(url, 1); recompute(); }),
      );

      const imageUrls = await collectImageUrls();
      imagesTotal = Math.max(1, imageUrls.length);
      const imageJobs = imageUrls.map((u) =>
        loadImage(u).then(() => { imagesLoaded++; recompute(); }),
      );

      await Promise.all([...modelJobs, ...imageJobs]);
      if (cancelled) return;
      setProgress(100);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Gallery />
      {!hidden && (
        <Loader progress={progress} ready={ready} onEnter={() => setHidden(true)} />
      )}
    </>
  );
}
