import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const MAP_PATH = path.join(process.cwd(), "public", "maps", "world.json");

export async function GET() {
  try {
    const data = await fs.readFile(MAP_PATH, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("invalid JSON", { status: 400 });
  }
  await fs.mkdir(path.dirname(MAP_PATH), { recursive: true });
  await fs.writeFile(MAP_PATH, JSON.stringify(body, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
