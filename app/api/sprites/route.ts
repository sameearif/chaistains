import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "sprites", "exterior");

// Recursively walk ROOT and return { "subfolder/path": ["1.png", "2.png", ...] }
// for every folder that directly contains .png files. Subfolders are flattened
// using forward-slash paths so the editor can address them as one bucket.
async function walk(rel: string, out: Record<string, string[]>) {
  const abs = path.join(ROOT, rel);
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }
  const pngs: string[] = [];
  for (const e of entries) {
    if (e.isFile() && e.name.toLowerCase().endsWith(".png")) pngs.push(e.name);
    else if (e.isDirectory()) await walk(path.posix.join(rel, e.name), out);
  }
  if (pngs.length) {
    // Sort by leading integer in the filename so "10.png" follows "9.png".
    pngs.sort((a, b) => {
      const na = parseInt(a, 10), nb = parseInt(b, 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.localeCompare(b);
    });
    out[rel.replace(/\\/g, "/")] = pngs;
  }
}

export async function GET() {
  const out: Record<string, string[]> = {};
  try {
    await walk("", out);
    return NextResponse.json(out);
  } catch (err) {
    return new NextResponse((err as Error).message, { status: 500 });
  }
}
