"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { preloadedModels } from "@/lib/preload";

const CSS = `
.gal3d { position: fixed; inset: 0; z-index: 200; overflow: hidden; background: #0b0b10; animation: gal-in 1.2s ease both; }
@keyframes gal-in { from { opacity: 0; } to { opacity: 1; } }
.gal3d canvas { display: block; touch-action: none; }
.gal3d .gal-hint {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); pointer-events: none;
  font-family: var(--font-manrope), system-ui, sans-serif; font-weight: 600;
  font-size: 12px; letter-spacing: .04em; color: rgba(255,255,255,0.6);
  background: rgba(0,0,0,0.25); padding: 6px 14px; border-radius: 999px;
}
/* bottom-right, bottom-aligned with the joystick, on touch devices */
.gal3d .gal-hint.up { left: auto; right: 28px; bottom: 28px; transform: none; text-align: right; max-width: 56vw; white-space: normal; line-height: 1.5; }
.gal3d .gal-back {
  position: absolute; top: 16px; left: 16px; z-index: 12; cursor: pointer;
  font-family: var(--font-manrope), system-ui, sans-serif; font-weight: 700;
  font-size: 12px; letter-spacing: .04em; color: #ececf2;
  background: rgba(16,16,22,0.7); border: 1.5px solid rgba(255,255,255,0.18);
  border-radius: 8px; padding: 9px 13px; backdrop-filter: blur(8px);
}
.gal3d .gal-back:hover { background: rgba(40,40,52,0.85); border-color: rgba(255,255,255,0.35); }

.art-overlay {
  position: absolute; inset: 0; z-index: 10; display: flex;
  background: rgba(6,6,10,0.86); backdrop-filter: blur(12px);
  font-family: var(--font-cormorant), Georgia, serif; color: #ececf2;
  animation: art-fade .3s ease both;
}
@keyframes art-fade { from { opacity: 0; } to { opacity: 1; } }
.art-close {
  position: absolute; top: 16px; right: 18px; z-index: 3; cursor: pointer;
  width: 40px; height: 40px; border: 0; border-radius: 10px; font-size: 18px;
  background: rgba(255,255,255,0.1); color: #fff;
}
.art-close:hover { background: rgba(255,255,255,0.22); }
.art-stage { flex: 1; display: flex; align-items: center; justify-content: center; padding: 5vh 4vw; min-width: 0; }
.art-photo {
  max-width: 100%; max-height: 86vh; background: #fff; padding: 14px;
  border: 14px solid #1b1b22; border-radius: 3px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.6); animation: art-pop .35s cubic-bezier(.2,1.2,.4,1) both;
}
@keyframes art-pop { from { transform: scale(.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.art-side {
  width: min(400px, 86vw); flex-shrink: 0; padding: 78px 38px 38px;
  display: flex; flex-direction: column; gap: 15px; overflow-y: auto;
  background: linear-gradient(180deg, rgba(22,20,26,0.82), rgba(11,10,15,0.74));
  border-left: 1px solid rgba(201,161,74,0.3);
}
.art-side .art-kicker { font-style: italic; font-size: 17px; color: #c9a14a; letter-spacing: .01em; }
.art-side h2 { font-family: var(--font-playfair), Georgia, serif; margin: 0; font-size: clamp(28px, 3.4vw, 38px); font-weight: 600; letter-spacing: -0.01em; line-height: 1.1; color: #f6f1e7; }
.art-side .art-meta { font-size: 14px; letter-spacing: .24em; text-transform: uppercase; color: #c2a86a; font-weight: 600; }
.art-side .art-divider { height: 1px; background: linear-gradient(90deg, rgba(201,161,74,0.65), rgba(201,161,74,0)); margin: 8px 0; }
.art-side .art-desc { margin: 0; font-size: 20px; line-height: 1.6; color: rgba(240,236,228,0.82); }

/* On small screens: stack the artwork on top (big) with details below */
@media (max-width: 760px) {
  .art-overlay { flex-direction: column; }
  .art-stage { flex: 0 0 auto; padding: 46px 14px 8px; }
  .art-photo { max-width: 92vw; max-height: 58vh; padding: 8px; border-width: 8px; }
  .art-side {
    width: auto; flex: 1 1 auto; padding: 16px 22px 28px; gap: 9px;
    border-left: 0; border-top: 1px solid rgba(201,161,74,0.3);
  }
  .art-side .art-kicker { font-size: 15px; }
  .art-side h2 { font-size: 24px; }
  .art-side .art-meta { font-size: 12px; letter-spacing: .18em; }
  .art-side .art-desc { font-size: 17px; line-height: 1.5; }
  .art-close { top: 10px; right: 12px; width: 34px; height: 34px; font-size: 16px; }
}

/* Objective banner (top-right) */
.gal-objective {
  position: absolute; top: 16px; right: 16px; z-index: 12; display: flex; align-items: center; gap: 11px;
  font-family: var(--font-playfair), Georgia, serif; font-weight: 500; font-size: 15px; color: #f3ecde;
  background: linear-gradient(180deg, rgba(24,21,28,0.78), rgba(14,12,18,0.7));
  border: 1px solid rgba(201,161,74,0.4); border-radius: 10px; padding: 11px 15px;
  max-width: 320px; backdrop-filter: blur(8px); box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
.gal-blip { width: 10px; height: 10px; flex: none; border-radius: 50%; background: #e6b34a; box-shadow: 0 0 10px #e6b34a; animation: gal-blip 1.1s ease-in-out infinite; }
@keyframes gal-blip { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .25; transform: scale(.7); } }
@media (max-width: 640px) {
  .gal-objective { top: 10px; right: 10px; font-size: 11px; padding: 7px 10px; gap: 7px; max-width: 58vw; border-radius: 8px; }
  .gal-blip { width: 7px; height: 7px; }
  .gal-hint { font-size: 10px; padding: 5px 11px; bottom: 14px; max-width: 92vw; text-align: center; }
  .gal3d .gal-hint.up { right: 20px; bottom: 20px; font-size: 9px; padding: 5px 9px; max-width: 60vw; }
}

/* Touch joystick (bottom-left) — black leather pad with a brass-rimmed knob */
.joystick {
  position: absolute; left: 28px; bottom: 28px; z-index: 14; width: 128px; height: 128px; border-radius: 50%;
  touch-action: none;
  background-color: #0d0c0e;
  background-image:
    radial-gradient(circle at 30% 25%, rgba(120,110,95,0.10), transparent 45%),
    radial-gradient(circle at 72% 68%, rgba(90,80,70,0.10), transparent 42%),
    radial-gradient(circle at 50% 92%, rgba(0,0,0,0.55), transparent 55%),
    repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0 2px, transparent 2px 5px);
  border: 1.5px solid rgba(201,161,74,0.38);
  box-shadow: inset 0 3px 11px rgba(0,0,0,0.75), inset 0 -2px 6px rgba(201,161,74,0.06), 0 6px 18px rgba(0,0,0,0.55);
}
.joystick-knob {
  position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; border-radius: 50%;
  background: radial-gradient(circle at 38% 30%, #3a352e, #141210 72%), #141210;
  border: 2px solid rgba(201,161,74,0.6);
  box-shadow: inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -3px 7px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.6);
  transform: translate(-50%, -50%);
}
@media (max-width: 640px) { .joystick { width: 108px; height: 108px; left: 20px; bottom: 20px; } .joystick-knob { width: 48px; height: 48px; } }
`;

// ── Room dimensions (metres) ────────────────────────────────────────────────
const W = 30, D = 22, H = 5.4, WALL_T = 0.3;
const CAT_YAW = -Math.PI / 2;     // cat.glb facing correction
const CAT_TARGET_H = 0.85;
const CAT_R = 0.34;               // cat collision radius (metres)

function shadows(o: THREE.Object3D) {
  o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}

// A Pakistani/Indian-style chai cup (ceramic cup + saucer + handle). Base at y=0.
function makeChaiCup(): THREE.Group {
  const g = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xfbf7f0, roughness: 0.3, metalness: 0.04 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x9c5b34, roughness: 0.4 });
  const chai = new THREE.MeshStandardMaterial({ color: 0xbd824c, roughness: 0.25, metalness: 0.1 });

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.095, 0.02, 40), ceramic);
  saucer.position.y = 0.01; g.add(saucer);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.01, 10, 40), accent);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.02; g.add(rim);

  const base = 0.024;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.058, 0.105, 40, 1, true), ceramic);
  body.position.y = base + 0.053; g.add(body);
  const floorOfCup = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.006, 40), ceramic);
  floorOfCup.position.y = base + 0.004; g.add(floorOfCup);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 10, 40), accent);
  band.rotation.x = Math.PI / 2; band.position.y = base + 0.098; g.add(band);

  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.08, 40), chai);
  tea.rotation.x = -Math.PI / 2; tea.position.y = base + 0.094; g.add(tea);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 12, 28), ceramic);
  handle.rotation.y = Math.PI / 2; handle.position.set(0.088, base + 0.052, 0); g.add(handle);

  return shadows(g) as THREE.Group;
}

// Soft round puff sprite for rising steam.
function makePuffTexture(): THREE.Texture {
  const S = 64;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!;
  const grd = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, "rgba(255,255,255,0.9)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = grd; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Rising steam — billboarded puffs animated each frame.
function makeSteam(tex: THREE.Texture, camera: THREE.Camera): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  const N = 7;
  const geo = new THREE.PlaneGeometry(1, 1);
  const puffs: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  for (let i = 0; i < N; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh); puffs.push({ mesh, mat, phase: i / N });
  }
  const update = (t: number) => {
    for (const p of puffs) {
      const local = (t * 0.45 + p.phase) % 1;
      p.mesh.position.set(Math.sin((local + p.phase) * 6.5) * 0.05, local * 0.55, 0);
      const sc = 0.07 + local * 0.16;
      p.mesh.scale.set(sc, sc, sc);
      p.mat.opacity = Math.sin(local * Math.PI) * 0.45;
      p.mesh.quaternion.copy(camera.quaternion);
    }
  };
  return { group, update };
}

// ── Procedural furniture (each built facing +Z, base at y=0) ────────────────
const WOOD_LEG = 0x2a1c11;

// Subtle woven-fabric texture (colour baked in) for upholstery.
function makeFabricTexture(base: string, hi: string, lo: string): THREE.Texture {
  const S = 256;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 3) for (let xx = 0; xx < S; xx += 3) {
    x.globalAlpha = 0.1; x.fillStyle = ((xx + y) >> 1) % 2 ? hi : lo; x.fillRect(xx, y, 2, 2);
  }
  x.globalAlpha = 0.06;
  for (let i = 0; i < 4000; i++) { x.fillStyle = Math.random() < 0.5 ? hi : lo; x.fillRect(Math.random() * S, Math.random() * S, 1, 1); }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 2); return t;
}

// Mottled leather texture.
function makeLeatherTexture(base: string, hi: string, lo: string): THREE.Texture {
  const S = 256;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 80; i++) {
    const g = x.createRadialGradient(Math.random() * S, Math.random() * S, 1, Math.random() * S, Math.random() * S, 16 + Math.random() * 30);
    g.addColorStop(0, Math.random() < 0.5 ? hi : lo); g.addColorStop(1, "rgba(0,0,0,0)");
    x.globalAlpha = 0.12; x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
  x.globalAlpha = 0.05;
  for (let i = 0; i < 6000; i++) { x.fillStyle = Math.random() < 0.5 ? hi : lo; x.fillRect(Math.random() * S, Math.random() * S, 1, 1); }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1.5, 1.5); return t;
}

// Rich walnut wood-grain texture for the table.
function makeWalnutTexture(): THREE.Texture {
  const S = 512;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.fillStyle = "#2a1c10"; x.fillRect(0, 0, S, S);
  for (let g = 0; g < 130; g++) {
    x.strokeStyle = `rgba(${70 + Math.random() * 40},${44 + Math.random() * 30},${20 + Math.random() * 16},${0.06 + Math.random() * 0.12})`;
    x.lineWidth = 0.8 + Math.random() * 2;
    const yy = Math.random() * S; x.beginPath(); x.moveTo(0, yy);
    x.bezierCurveTo(S * 0.3, yy + (Math.random() - 0.5) * 14, S * 0.6, yy + (Math.random() - 0.5) * 14, S, yy + (Math.random() - 0.5) * 10);
    x.stroke();
  }
  for (let k = 0; k < 4; k++) { // knots
    const kx = Math.random() * S, ky = Math.random() * S;
    for (let r = 2; r < 18; r += 3) { x.strokeStyle = `rgba(30,18,8,0.5)`; x.lineWidth = 1.5; x.beginPath(); x.ellipse(kx, ky, r, r * 0.7, 0.4, 0, 7); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// Dark, moody velvet sofa: rolled arms, plush continuous cushions, brass legs.
function makeSofa(): THREE.Group {
  const g = new THREE.Group();
  const fabA = makeFabricTexture("#16221f", "#243733", "#0e1714");
  const fabB = makeFabricTexture("#1b2a26", "#2a3f39", "#111b18");
  const velvet = new THREE.MeshStandardMaterial({ map: fabA, roughness: 0.72, metalness: 0.02 });
  const velvet2 = new THREE.MeshStandardMaterial({ map: fabB, roughness: 0.62, metalness: 0.02 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x9c7a42, roughness: 0.4, metalness: 0.9 });
  const Wd = 3.5, Dp = 1.5, seatY = 0.56;
  const base = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.18, 0.36, Dp - 0.1), velvet); base.position.set(0, 0.4, 0.02); g.add(base);
  // continuous plush seat (3 cushions that touch — no gap) with a rounded front roll
  const seatW = Wd - 0.7;
  for (let i = 0; i < 3; i++) {
    const cw = seatW / 3;
    const cx = (i - 1) * cw;
    const cu = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.012, 0.2, Dp - 0.55), velvet2); cu.position.set(cx, seatY, 0.1); g.add(cu);
  }
  const seatRoll = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, seatW, 8, 20), velvet2); seatRoll.rotation.z = Math.PI / 2; seatRoll.position.set(0, seatY - 0.02, Dp / 2 - 0.4); g.add(seatRoll);
  // back cushions (touching) + soft top bolster
  for (let i = 0; i < 3; i++) {
    const cw = seatW / 3;
    const bc = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.012, 0.6, 0.24), velvet); bc.position.set((i - 1) * cw, 0.88, -Dp / 2 + 0.24); g.add(bc);
  }
  const topRoll = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, seatW + 0.1, 8, 20), velvet2); topRoll.rotation.z = Math.PI / 2; topRoll.position.set(0, 1.18, -Dp / 2 + 0.26); g.add(topRoll);
  // rolled arms
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, Dp - 0.55, 8, 20), velvet); arm.rotation.x = Math.PI / 2; arm.position.set(s * (Wd / 2 - 0.2), 0.74, 0.0); g.add(arm);
    const armBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, Dp - 0.2), velvet); armBase.position.set(s * (Wd / 2 - 0.2), 0.5, 0.0); g.add(armBase);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.058, 0.28, 14), brass); l.position.set(sx * (Wd / 2 - 0.32), 0.12, sz * (Dp / 2 - 0.3)); l.rotation.x = sz * 0.12; l.rotation.z = -sx * 0.12; g.add(l); }
  return shadows(g) as THREE.Group;
}

// Matching dark oxblood-leather wing armchair.
function makeArmchair(): THREE.Group {
  const g = new THREE.Group();
  const leaA = makeLeatherTexture("#241318", "#3a2230", "#160a0f");
  const leaB = makeLeatherTexture("#2a1820", "#42283a", "#190d12");
  const leather = new THREE.MeshStandardMaterial({ map: leaA, roughness: 0.5, metalness: 0.12 });
  const leather2 = new THREE.MeshStandardMaterial({ map: leaB, roughness: 0.45, metalness: 0.12 });
  const wood = new THREE.MeshStandardMaterial({ color: WOOD_LEG, roughness: 0.45, metalness: 0.2 });
  const Wd = 1.3, Dp = 1.3, seatY = 0.56;
  const base = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.14, 0.34, Dp - 0.14), leather); base.position.set(0, 0.4, 0.02); g.add(base);
  const cu = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.4, 0.18, Dp - 0.48), leather2); cu.position.set(0, seatY, 0.07); g.add(cu);
  const seatRoll = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, Wd - 0.6, 8, 16), leather2); seatRoll.rotation.z = Math.PI / 2; seatRoll.position.set(0, seatY - 0.02, Dp / 2 - 0.34); g.add(seatRoll);
  const back = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.36, 0.66, 0.22), leather); back.position.set(0, 0.88, -Dp / 2 + 0.18); g.add(back);
  const topRoll = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, Wd - 0.56, 8, 18), leather2); topRoll.rotation.z = Math.PI / 2; topRoll.position.set(0, 1.16, -Dp / 2 + 0.2); g.add(topRoll);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, Dp - 0.55, 8, 18), leather); arm.rotation.x = Math.PI / 2; arm.position.set(s * (Wd / 2 - 0.15), 0.72, 0.0); g.add(arm);
    const armBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, Dp - 0.26), leather); armBase.position.set(s * (Wd / 2 - 0.15), 0.5, 0.0); g.add(armBase);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.05, 0.26, 14), wood); l.position.set(sx * (Wd / 2 - 0.26), 0.11, sz * (Dp / 2 - 0.26)); l.rotation.x = sz * 0.1; l.rotation.z = -sx * 0.1; g.add(l); }
  return shadows(g) as THREE.Group;
}

const COFFEE_TOP_Y = 0.48;
function makeCoffeeTable(): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.MeshStandardMaterial({ map: makeWalnutTexture(), roughness: 0.4, metalness: 0.12 });
  const leg = new THREE.MeshStandardMaterial({ color: WOOD_LEG, roughness: 0.45, metalness: 0.2 });
  const Wd = 1.65, Dp = 0.95;
  const surface = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.08, Dp), top); surface.position.y = COFFEE_TOP_Y - 0.04; g.add(surface);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.12, 0.06, Dp - 0.12), leg); apron.position.y = COFFEE_TOP_Y - 0.11; g.add(apron);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.28, 0.05, Dp - 0.28), top); shelf.position.y = 0.15; g.add(shelf);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, COFFEE_TOP_Y - 0.08, 12), leg); l.position.set(sx * (Wd / 2 - 0.11), (COFFEE_TOP_Y - 0.08) / 2, sz * (Dp / 2 - 0.11)); g.add(l); }
  return shadows(g) as THREE.Group;
}

// Muted Persian rug — deep teal field (echoing the sofa) with a tonal bronze
// border and a quiet central medallion. Complements the dark furniture.
function makeRugTexture(): THREE.Texture {
  const S = 512;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.fillStyle = "#28403c"; x.fillRect(0, 0, S, S);                 // deep teal field
  // subtle wool mottling for depth
  for (let i = 0; i < 5000; i++) { x.globalAlpha = 0.05; x.fillStyle = Math.random() < 0.5 ? "#33514b" : "#1c302c"; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  x.globalAlpha = 1;
  // tonal diagonal lattice in the field
  x.strokeStyle = "rgba(150,170,160,0.07)"; x.lineWidth = 1.2;
  for (let o = -S; o < S; o += 34) { x.beginPath(); x.moveTo(o, 0); x.lineTo(o + S, S); x.stroke(); x.beginPath(); x.moveTo(o, S); x.lineTo(o + S, 0); x.stroke(); }
  // refined bronze + ivory borders
  x.strokeStyle = "#7a6238"; x.lineWidth = 26; x.strokeRect(34, 34, S - 68, S - 68);
  x.strokeStyle = "#c7b384"; x.lineWidth = 3; x.strokeRect(20, 20, S - 40, S - 40);
  x.strokeStyle = "#c7b384"; x.lineWidth = 3; x.strokeRect(50, 50, S - 100, S - 100);
  // quiet central medallion (tone-on-tone)
  const cx = S / 2;
  x.strokeStyle = "rgba(199,179,132,0.5)"; x.lineWidth = 2.5;
  x.save(); x.translate(cx, cx); x.rotate(Math.PI / 4);
  for (let i = 0; i < 3; i++) { const r = 70 - i * 22; x.strokeRect(-r, -r, r * 2, r * 2); }
  x.restore();
  x.fillStyle = "rgba(199,179,132,0.45)"; x.beginPath(); x.ellipse(cx, cx, 16, 16, 0, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// Rug with actual pile thickness (not a paper-flat plane); dark woolly edges.
function makeRug(): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.MeshStandardMaterial({ map: makeRugTexture(), roughness: 0.98, metalness: 0, envMapIntensity: 0.4 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x162a26, roughness: 1 });
  const geo = new THREE.BoxGeometry(7.2, 0.06, 4.8);
  const m = new THREE.Mesh(geo, [edge, edge, top, edge, edge, edge]); // +X,-X,+Y(top),-Y,+Z,-Z
  m.position.y = 0.03; m.receiveShadow = true; m.castShadow = true; g.add(m);
  return g;
}

function makeFloorLamp(): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.5, metalness: 0.4 });
  const baseD = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 24), dark); baseD.position.y = 0.025; g.add(baseD);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.7, 16), metal); pole.position.y = 0.9; g.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.36, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffdca0, emissiveIntensity: 1.2, roughness: 0.7, side: THREE.DoubleSide }));
  shade.position.y = 1.74; g.add(shade);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshBasicMaterial({ color: 0xfff2cf })); glow.rotation.x = Math.PI / 2; glow.position.y = 1.57; g.add(glow);
  return shadows(g) as THREE.Group;
}

// Elegant indoor tree: sleek matte planter + a soft staggered foliage canopy.
function makePlant(seed: number): THREE.Group {
  const g = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 0.7, metalness: 0.1 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.6, 32), potMat); pot.position.y = 0.3; g.add(pot);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.21, 0.05, 32), potMat); lip.position.y = 0.6; g.add(lip);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 28), new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 1 })); soil.position.y = 0.61; g.add(soil);
  // slender trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 0.7, 12), new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 0.7 }));
  trunk.position.y = 0.95; trunk.rotation.z = 0.05; g.add(trunk);
  // soft canopy — staggered low-poly spheres, deep muted sage
  const greens = [0x46604a, 0x3d5742, 0x506e52];
  const blobs: [number, number, number, number][] = [
    [0, 1.35, 0, 0.34], [-0.22, 1.2, 0.05, 0.26], [0.2, 1.22, -0.05, 0.27],
    [0.04, 1.55, 0.02, 0.26], [-0.1, 1.42, 0.18, 0.2], [0.14, 1.46, 0.16, 0.18],
  ];
  blobs.forEach((b, i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(b[3], 1), new THREE.MeshStandardMaterial({ color: greens[i % 3], roughness: 0.85, flatShading: true }));
    const a = seed + i;
    m.position.set(b[0] + Math.cos(a) * 0.03, b[1], b[2] + Math.sin(a) * 0.03);
    m.scale.y = 0.92; g.add(m);
  });
  g.scale.setScalar(1.3); // a touch larger, base stays on the floor
  return shadows(g) as THREE.Group;
}

// A stack of antique leather-bound books with gilded spine bands.
function makeBookstack(): THREE.Group {
  const g = new THREE.Group();
  // deep, muted antiquarian tones
  const covers = [0x3a1d1d, 0x213524, 0x1d2740, 0x4a3520]; // oxblood, forest, navy, tan-brown
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.35, metalness: 0.85 });
  const sizes = [[0.46, 0.09, 0.32], [0.42, 0.08, 0.3], [0.4, 0.075, 0.28], [0.36, 0.07, 0.26]];
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const [w, h, d] = sizes[i];
    const cover = new THREE.MeshStandardMaterial({ color: covers[i], roughness: 0.55, metalness: 0.06 });
    const yaw = (i % 2 ? 1 : -1) * 0.12;
    const book = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cover); book.add(body);
    // pages (cream block, slightly inset on three sides)
    const pages = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.03, d - 0.04), new THREE.MeshStandardMaterial({ color: 0xe9e0c8, roughness: 0.9 }));
    pages.position.set(0.01, 0, 0); book.add(pages);
    // gilded bands + label on the spine (front +z face)
    for (const by of [h * 0.22, -h * 0.22]) { const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.012, 0.012), gold); band.position.set(0, by, d / 2 + 0.002); book.add(band); }
    const label = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, h * 0.34, 0.012), gold); label.position.set(0, 0, d / 2 + 0.002); book.add(label);
    book.position.set((i % 2 ? 0.025 : -0.025), y + h / 2, 0); book.rotation.y = yaw; g.add(book);
    y += h;
  }
  return shadows(g) as THREE.Group;
}

// Engraved brushed-brass plaque for the door.
function makeExitSignTexture(): THREE.Texture {
  const w = 320, h = 100;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#e7c987"); g.addColorStop(0.5, "#c79a4f"); g.addColorStop(1, "#a87f3c");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // fine brushed lines
  x.strokeStyle = "rgba(255,255,255,0.10)"; x.lineWidth = 1;
  for (let i = 0; i < h; i += 3) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
  // engraved inner bevel
  x.strokeStyle = "rgba(60,40,15,0.55)"; x.lineWidth = 3; x.strokeRect(10, 10, w - 20, h - 20);
  x.strokeStyle = "rgba(255,240,200,0.5)"; x.lineWidth = 1; x.strokeRect(13, 13, w - 26, h - 26);
  // serif letters with engraved shadow
  x.textAlign = "center"; x.textBaseline = "middle";
  x.font = "600 46px Georgia, 'Times New Roman', serif";
  x.fillStyle = "rgba(60,42,16,0.85)"; x.fillText("E X I T", w / 2 + 1.5, h / 2 + 2.5);
  x.fillStyle = "#4a3411"; x.fillText("E X I T", w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

type ArtEntry = { file: string; title: string; medium: string; year: number; desc: string };
type ArtInfo = { img: string; title: string; meta: string; desc: string };

function modelURL(path: string): { url: string; revoke: boolean } {
  const blob = preloadedModels.get(path);
  if (blob) return { url: URL.createObjectURL(blob), revoke: true };
  return { url: path, revoke: false };
}

const TAU = Math.PI * 2;
function angLerp(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

// Dark walnut wooden-plank floor texture (procedural).
function makeWoodTexture(): THREE.Texture {
  const S = 1024;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!;
  const planks = 8, ph = S / planks;
  const tones = ["#3a2817", "#42301c", "#332210", "#48341f", "#2e2010"];
  for (let i = 0; i < planks; i++) {
    x.fillStyle = tones[i % tones.length];
    x.fillRect(0, i * ph, S, ph);
    // grain streaks
    for (let g = 0; g < 70; g++) {
      x.strokeStyle = `rgba(${18 + Math.random() * 26},${12 + Math.random() * 16},6,${0.06 + Math.random() * 0.1})`;
      x.lineWidth = 0.8 + Math.random() * 1.6;
      x.beginPath();
      const yy = i * ph + Math.random() * ph;
      x.moveTo(0, yy);
      x.bezierCurveTo(S * 0.3, yy + (Math.random() - 0.5) * 7, S * 0.6, yy + (Math.random() - 0.5) * 7, S, yy + (Math.random() - 0.5) * 5);
      x.stroke();
    }
    // subtle highlight + dark plank seams
    x.fillStyle = "rgba(255,230,200,0.04)"; x.fillRect(0, i * ph + 3, S, 1);
    x.fillStyle = "rgba(0,0,0,0.45)"; x.fillRect(0, i * ph, S, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(W / 5, D / 5);
  return t;
}

// Subtle plaster wall texture (off-white with faint mottling).
function makePlasterTexture(base: string): THREE.Texture {
  const S = 512;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random();
    x.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.015 + Math.random() * 0.03})` : `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
    const r = 0.6 + Math.random() * 1.8;
    x.beginPath(); x.arc(Math.random() * S, Math.random() * S, r, 0, 7); x.fill();
  }
  // a few soft broad blotches
  for (let i = 0; i < 18; i++) {
    const g = x.createRadialGradient(Math.random() * S, Math.random() * S, 2, Math.random() * S, Math.random() * S, 40 + Math.random() * 60);
    g.addColorStop(0, "rgba(0,0,0,0.03)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export default function Gallery3D({ onExit }: { onExit: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [art, setArt] = useState<ArtInfo | null>(null);
  const setArtRef = useRef(setArt);
  setArtRef.current = setArt;
  const artOpenRef = useRef(false);
  useEffect(() => { artOpenRef.current = !!art; }, [art]);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // Touch controls (joystick) — moveVecRef feeds the render loop without re-renders.
  const [isTouch] = useState(() => typeof window !== "undefined" && (("ontouchstart" in window) || navigator.maxTouchPoints > 0));
  const moveVecRef = useRef({ x: 0, y: 0 });
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
    moveVecRef.current = { x: dx / max, y: dy / max };
  };
  const joyStart = (e: React.PointerEvent) => { joyActive.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); joyFromEvent(e); };
  const joyMove = (e: React.PointerEvent) => { if (joyActive.current) joyFromEvent(e); };
  const joyEnd = () => { joyActive.current = false; moveVecRef.current = { x: 0, y: 0 }; setKnob({ x: 0, y: 0 }); };

  useEffect(() => {
    const mount = mountRef.current!;
    let VW = window.innerWidth, VH = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(VW, VH);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    const dom = renderer.domElement;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0c10");
    const camera = new THREE.PerspectiveCamera(55, VW / VH, 0.03, 500);

    // ── Studio lighting ─────────────────────────────────────────────────────
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // Dim, moody ambient so the picture spotlights read strongly.
    scene.add(new THREE.AmbientLight(0xffffff, 0.14));
    const fill = new THREE.HemisphereLight(0xcad6e0, 0x3a3026, 0.2);
    scene.add(fill);
    const key = new THREE.DirectionalLight(0xfff6e8, 0.45);
    key.position.set(6, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -W; key.shadow.camera.right = W;
    key.shadow.camera.top = D; key.shadow.camera.bottom = -D;
    key.shadow.camera.near = 1; key.shadow.camera.far = 60;
    key.shadow.bias = -0.0004;
    scene.add(key);

    // ── Room ────────────────────────────────────────────────────────────────
    const wallTex = makePlasterTexture("#cfc9bd"); wallTex.repeat.set(4, 2);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xffffff, roughness: 0.97, metalness: 0, envMapIntensity: 0.35 });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.5, metalness: 0.06, envMapIntensity: 0.3 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceilTex = makePlasterTexture("#d7d3cb"); ceilTex.repeat.set(5, 4);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1, envMapIntensity: 0.25 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
    scene.add(ceil);

    const mkWall = (w: number, x: number, z: number, rotY: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, WALL_T), wallMat);
      m.position.set(x, H / 2, z); m.rotation.y = rotY;
      m.receiveShadow = true; scene.add(m);
    };
    mkWall(W, 0, -D / 2, 0);
    mkWall(W, 0, D / 2, 0);
    mkWall(D, -W / 2, 0, Math.PI / 2);
    mkWall(D, W / 2, 0, Math.PI / 2);

    // skirting boards + crown trim for polish
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7 });
    const mkTrim = (w: number, x: number, z: number, rotY: number, y: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), trimMat);
      m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
    };
    for (const [w, x, z, r] of [[W, 0, -D / 2 + 0.16, 0], [W, 0, D / 2 - 0.16, 0], [D, -W / 2 + 0.16, 0, Math.PI / 2], [D, W / 2 - 0.16, 0, Math.PI / 2]] as const) {
      mkTrim(w, x, z, r, 0.08, 0.16); // skirting
    }

    // warm ceiling light strips (emissive) — kept dim so they only suggest fixtures
    const stripMat = new THREE.MeshStandardMaterial({ color: 0xffeccb, emissive: 0xffe0a8, emissiveIntensity: 0.55, roughness: 0.5 });
    for (const sx of [-W / 4, W / 4]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, D - 4), stripMat);
      s.position.set(sx, H - 0.08, 0); scene.add(s);
      const pl = new THREE.PointLight(0xffe9c4, 0.16, 16, 2); pl.position.set(sx, H - 0.4, 0); scene.add(pl);
    }

    // ── Furniture (built in three.js) + collision ─────────────────────────────
    const obstacles: { x: number; z: number; r: number }[] = []; // circle colliders
    const updaters: ((t: number) => void)[] = [];                // per-frame (steam)
    const faceToward = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
    const addPiece = (obj: THREE.Object3D, x: number, z: number, rotY: number, colR?: number) => {
      obj.position.set(x, 0, z); obj.rotation.y = rotY; scene.add(obj);
      if (colR) obstacles.push({ x, z, r: colR });
    };

    // central lounge, facing inward (each piece is built facing +Z)
    addPiece(makeRug(), 0, 0, 0);
    addPiece(makeCoffeeTable(), 0, 0, 0, 1.1);
    // books + chai cup (with rising steam) resting on the table top
    const books = makeBookstack(); books.position.set(-0.36, COFFEE_TOP_Y, 0.06); books.rotation.y = 0.4; scene.add(books);
    const cup = makeChaiCup(); cup.scale.setScalar(1.25); cup.position.set(0.42, COFFEE_TOP_Y, -0.04); scene.add(cup);
    const steam = makeSteam(makePuffTexture(), camera);
    steam.group.position.set(0.42, COFFEE_TOP_Y + 0.2, -0.04); scene.add(steam.group);
    updaters.push(steam.update);

    addPiece(makeSofa(), 0, -3.1, faceToward(0, -3.1, 0, 0), 1.85);
    addPiece(makeArmchair(), -3.4, 2.4, faceToward(-3.4, 2.4, 0, 0), 0.78);
    addPiece(makeArmchair(), 3.4, 2.4, faceToward(3.4, 2.4, 0, 0), 0.78);
    addPiece(makeFloorLamp(), -5.0, -3.6, 0, 0.32);
    const lampGlow = new THREE.PointLight(0xffdca0, 0.9, 11, 2); lampGlow.position.set(-5.0, 1.65, -3.6); scene.add(lampGlow);

    // potted plants in the four corners
    ([[-W / 2 + 1.8, -D / 2 + 1.8], [W / 2 - 1.8, -D / 2 + 1.8], [-W / 2 + 1.8, D / 2 - 1.8], [W / 2 - 1.8, D / 2 - 1.8]] as const)
      .forEach(([cx, cz], i) => addPiece(makePlant(i * 1.7), cx, cz, Math.random() * Math.PI * 2, 0.5));

    // ── Exit door (click to return to the game) — elegant panelled walnut ──────
    const door = new THREE.Group();
    const inWallZ = D / 2 - WALL_T / 2;
    const dW = 1.45, dH = 2.75;
    const casing = new THREE.MeshStandardMaterial({ color: 0xece7dd, roughness: 0.9 });    // painted architrave
    const walnut = new THREE.MeshStandardMaterial({ color: 0x4a331f, roughness: 0.5, metalness: 0.12 });
    const walnut2 = new THREE.MeshStandardMaterial({ color: 0x5a4026, roughness: 0.45, metalness: 0.12 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.95, roughness: 0.25 });
    // moulded casing (outer + stepped reveal)
    const caseOuter = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.5, dH + 0.36, 0.1), casing);
    caseOuter.position.set(0, (dH + 0.36) / 2, inWallZ - 0.04); door.add(caseOuter);
    const caseInner = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.22, dH + 0.16, 0.14), casing);
    caseInner.position.set(0, (dH + 0.16) / 2, inWallZ - 0.08); door.add(caseInner);
    // slab (the clickable target)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(dW, dH, 0.1), walnut);
    panel.position.set(0, dH / 2, inWallZ - 0.14); panel.userData.isDoor = true; door.add(panel);
    // two recessed raised panels with thin mouldings
    for (const py of [dH * 0.70, dH * 0.28]) {
      const moulding = new THREE.Mesh(new THREE.BoxGeometry(dW - 0.26, dH * 0.34, 0.03), walnut2);
      moulding.position.set(0, py, inWallZ - 0.185); door.add(moulding);
      const recess = new THREE.Mesh(new THREE.BoxGeometry(dW - 0.42, dH * 0.34 - 0.16, 0.02), walnut);
      recess.position.set(0, py, inWallZ - 0.20); door.add(recess);
    }
    // brass back-plate + knob
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.02), brass);
    plate.position.set(dW / 2 - 0.18, dH * 0.45, inWallZ - 0.2); door.add(plate);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 14), brass);
    knob.position.set(dW / 2 - 0.18, dH * 0.45, inWallZ - 0.26); door.add(knob);
    // brass plaque above the door — unlit (MeshBasic) so it always reads clearly
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.3), new THREE.MeshBasicMaterial({ map: makeExitSignTexture() }));
    sign.position.set(0, dH + 0.32, inWallZ - 0.12); sign.rotation.y = Math.PI; door.add(sign);
    door.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    scene.add(door);

    // ── Cat ─────────────────────────────────────────────────────────────────
    let cat: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let walkAction: THREE.AnimationAction | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let walkW = 0;
    const loader = new GLTFLoader();
    const cReq = modelURL("/models/cat.glb");
    loader.load(cReq.url, (gltf) => {
      if (cReq.revoke) URL.revokeObjectURL(cReq.url);
      const root = gltf.scene;
      root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = true; o.frustumCulled = false; } });
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3(); box.getSize(size);
      root.scale.setScalar(CAT_TARGET_H / Math.max(0.001, size.y));
      const holder = new THREE.Group(); holder.add(root); cat = holder; scene.add(holder);
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(root);
        const find = (re: RegExp) => gltf.animations.find((c) => re.test(c.name));
        const walkClip = find(/walk|run|move|trot/i) || gltf.animations[0];
        const idleClip = find(/idle|stand|rest|breath|sit/i) || (gltf.animations.length > 1 ? gltf.animations.find((c) => c !== walkClip) : undefined);
        walkAction = mixer.clipAction(walkClip); walkAction.play(); walkAction.weight = 0;
        walkAction.timeScale = 1.7; // step faster so the cat doesn't look like it's sliding
        if (idleClip && idleClip !== walkClip) { idleAction = mixer.clipAction(idleClip); idleAction.play(); idleAction.weight = 1; }
      }
    }, undefined, (e) => console.error("cat.glb load failed", e));

    // ── Hang artworks + spotlights ──────────────────────────────────────────
    const artMeshes: THREE.Mesh[] = [];
    const texLoader = new THREE.TextureLoader();
    const ART_Y = 2.2;
    const hang = (a: ArtEntry, x: number, z: number, rotY: number, nx: number, nz: number) => {
      texLoader.load(`/art/${a.file}`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const ar = (tex.image.width || 3) / (tex.image.height || 4);
        const ph = 2.3, pw = ph * ar;
        const g = new THREE.Group(); g.position.set(x, ART_Y, z); g.rotation.y = rotY;
        const fr = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.22, ph + 0.22, 0.08), new THREE.MeshStandardMaterial({ color: 0x141118, roughness: 0.5, metalness: 0.3 }));
        fr.position.z = 0.04; fr.castShadow = true; g.add(fr);
        const mt = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.1, ph + 0.1), new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.9 }));
        mt.position.z = 0.085; g.add(mt);
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex }));
        pic.position.z = 0.09; pic.userData = { art: a }; g.add(pic);
        scene.add(g); artMeshes.push(pic);

        // ── visible ceiling spotlight fixture aimed at the painting ──────────
        const fx = x + nx * 1.5, fz = z + nz * 1.5;
        const fixture = new THREE.Group();
        fixture.position.set(fx, H - 0.18, fz);
        fixture.lookAt(x, ART_Y, z); // aim the can toward the art
        const canMat = new THREE.MeshStandardMaterial({ color: 0x202024, roughness: 0.4, metalness: 0.8 });
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.34, 20), canMat);
        can.rotation.x = Math.PI / 2; // cylinder axis → local +z (toward art)
        fixture.add(can);
        const bulb = new THREE.Mesh(
          new THREE.CircleGeometry(0.1, 20),
          new THREE.MeshBasicMaterial({ color: 0xfff3d6 }),
        );
        bulb.position.z = 0.18; // glowing lens at the front of the can
        fixture.add(bulb);
        scene.add(fixture);

        const sp = new THREE.SpotLight(0xfff2dc, 52, 11, 0.6, 0.55, 1.3);
        sp.position.set(fx, H - 0.2, fz);
        sp.target.position.set(x, ART_Y, z);
        scene.add(sp); scene.add(sp.target);
        // soft warm wash on the wall around each piece so it glows out of the dark
        const wash = new THREE.PointLight(0xffeccb, 0.5, 4.5, 2); wash.position.set(x + nx * 0.5, ART_Y, z + nz * 0.5); scene.add(wash);
      });
    };
    fetch("/art/art.json").then((r) => (r.ok ? r.json() : [])).then((arts: ArtEntry[]) => {
      if (!Array.isArray(arts) || !arts.length) return;
      const inX = W / 2 - WALL_T / 2 - 0.02, inZ = D / 2 - WALL_T / 2 - 0.02;
      const walls = [
        { fixed: -inZ, axis: "z" as const, rotY: 0,          nx: 0, nz: 1,  len: W },
        { fixed: inZ,  axis: "z" as const, rotY: Math.PI,    nx: 0, nz: -1, len: W },
        { fixed: -inX, axis: "x" as const, rotY: Math.PI / 2, nx: 1, nz: 0,  len: D },
        { fixed: inX,  axis: "x" as const, rotY: -Math.PI / 2, nx: -1, nz: 0, len: D },
      ];
      const perWall: ArtEntry[][] = [[], [], [], []];
      arts.forEach((a, i) => perWall[i % 4].push(a));
      perWall.forEach((list, w) => {
        const wd = walls[w]; const usable = wd.len * 0.72;
        list.forEach((a, j) => {
          const t = list.length === 1 ? 0.5 : j / (list.length - 1);
          const along = (t - 0.5) * usable;
          if (wd.axis === "z") hang(a, along, wd.fixed, wd.rotY, wd.nx, wd.nz);
          else hang(a, wd.fixed, along, wd.rotY, wd.nx, wd.nz);
        });
      });
    }).catch(() => {});

    // ── Controls / state ────────────────────────────────────────────────────
    const pos = new THREE.Vector3(0, 0, 6.0); // spawn in clear floor, facing the lounge
    let heading = Math.atan2(-pos.x, -pos.z);
    // camPitch is the camera's elevation above the cat (bigger = more top-down).
    // Pull the camera back further on smaller screens so more of the room fits.
    const baseDist = VW < 560 ? 9.4 : VW < 820 ? 7.8 : VW < 1100 ? 6.6 : 5.6;
    let camYaw = heading, camPitch = 0.40, camDist = baseDist;
    const bounds = { minX: -W / 2 + 0.6, maxX: W / 2 - 0.6, minZ: -D / 2 + 0.6, maxZ: D / 2 - 0.6 };

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { keys[k] = true; if (k.startsWith("arrow")) e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const pickRay = new THREE.Raycaster();
    const ndcFrom = (clientX: number, clientY: number) => {
      const rect = dom.getBoundingClientRect();
      return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    };
    // raycast against paintings + the door; returns what was hit
    const castInteractive = (clientX: number, clientY: number): { kind: "art"; art: ArtEntry } | { kind: "door" } | null => {
      pickRay.setFromCamera(ndcFrom(clientX, clientY), camera);
      const hits = pickRay.intersectObjects([...artMeshes, panel], false);
      if (!hits.length) return null;
      const o = hits[0].object;
      if (o === panel) return { kind: "door" };
      return { kind: "art", art: o.userData.art as ArtEntry };
    };
    const handlePick = (clientX: number, clientY: number) => {
      const hit = castInteractive(clientX, clientY);
      if (!hit) return;
      if (hit.kind === "door") { onExitRef.current(); return; }
      const a = hit.art;
      setArtRef.current({ img: `/art/${a.file}`, title: a.title, meta: `${a.medium} · ${a.year}`, desc: a.desc });
    };

    let dragging = false, lastX = 0, lastY = 0, sinceDrag = 99, downX = 0, downY = 0, movedPtr = false;
    const onDown = (e: PointerEvent) => { dragging = true; movedPtr = false; lastX = downX = e.clientX; lastY = downY = e.clientY; dom.setPointerCapture?.(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (dragging) {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) movedPtr = true;
        camYaw -= (e.clientX - lastX) * 0.005;
        camPitch = Math.max(0.2, Math.min(1.4, camPitch + (e.clientY - lastY) * 0.004));
        lastX = e.clientX; lastY = e.clientY; sinceDrag = 0;
        return;
      }
      // hover → pointer cursor over paintings / door
      dom.style.cursor = castInteractive(e.clientX, e.clientY) ? "pointer" : "";
    };
    const onUp = (e: PointerEvent) => { if (dragging && !movedPtr) handlePick(e.clientX, e.clientY); dragging = false; };
    const onLeave = () => { dragging = false; };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointerleave", onLeave);
    const onWheel = (e: WheelEvent) => { e.preventDefault(); camDist = Math.max(2.5, Math.min(13, camDist + Math.sign(e.deltaY) * 0.5)); };
    dom.addEventListener("wheel", onWheel, { passive: false });

    // ── Loop ────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0, elapsed = 0;
    const tmpDir = new THREE.Vector3();
    const tick = () => {
      const dt = Math.min(0.05, clock.getDelta());
      elapsed += dt;
      sinceDrag += dt;
      for (const u of updaters) u(elapsed);
      const locked = artOpenRef.current;
      const jv = moveVecRef.current;
      const fwd = locked ? 0 : (keys["w"] || keys["arrowup"] ? 1 : 0) - (keys["s"] || keys["arrowdown"] ? 1 : 0) - jv.y;
      const str = locked ? 0 : (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0) + jv.x;

      const fX = Math.sin(camYaw), fZ = Math.cos(camYaw);
      const rX = -Math.cos(camYaw), rZ = Math.sin(camYaw);
      let mx = fX * fwd + rX * str, mz = fZ * fwd + rZ * str;
      const mlen = Math.hypot(mx, mz);
      const moving = mlen > 0.05;
      if (moving) {
        mx /= mlen; mz /= mlen;
        heading = angLerp(heading, Math.atan2(mx, mz), Math.min(1, 12 * dt));
        const step = 4.2 * dt;
        pos.x += mx * step; pos.z += mz * step;
        // push out of furniture colliders
        for (const ob of obstacles) {
          const dx = pos.x - ob.x, dz = pos.z - ob.z;
          const dist = Math.hypot(dx, dz), min = ob.r + CAT_R;
          if (dist < min) {
            if (dist > 1e-3) { pos.x = ob.x + (dx / dist) * min; pos.z = ob.z + (dz / dist) * min; }
            else { pos.x = ob.x + min; }
          }
        }
        // keep inside the room
        pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x));
        pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z));
        if (sinceDrag > 0.5) camYaw = angLerp(camYaw, heading, Math.min(1, 2.2 * dt));
      }

      if (cat) { cat.position.set(pos.x, 0, pos.z); cat.rotation.y = heading + CAT_YAW; }
      if (mixer) {
        mixer.update(dt);
        walkW += ((moving ? 1 : 0) - walkW) * Math.min(1, dt * 10);
        if (walkAction) walkAction.weight = walkW;
        if (idleAction) idleAction.weight = 1 - walkW;
      }

      // Aim at the cat's body centre so it sits in the middle of the screen.
      const targetPt = new THREE.Vector3(pos.x, CAT_TARGET_H * 0.55, pos.z);
      // camera sits behind the cat (-forward) and ABOVE it (camPitch elevation)
      tmpDir.set(-Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), -Math.cos(camYaw) * Math.cos(camPitch));
      const camPos = targetPt.clone().add(tmpDir.multiplyScalar(camDist));
      // keep camera inside the room & under the ceiling
      camPos.x = Math.max(-W / 2 + 0.3, Math.min(W / 2 - 0.3, camPos.x));
      camPos.z = Math.max(-D / 2 + 0.3, Math.min(D / 2 - 0.3, camPos.z));
      camPos.y = Math.max(0.8, Math.min(H - 0.25, camPos.y));
      camera.position.lerp(camPos, Math.min(1, 8 * dt));
      camera.lookAt(targetPt);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      VW = window.innerWidth; VH = window.innerHeight;
      camera.aspect = VW / VH; camera.updateProjectionMatrix();
      renderer.setSize(VW, VH);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("wheel", onWheel);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((mm) => mm.dispose?.());
      });
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="gal3d" ref={mountRef}>
      <style>{CSS}</style>

      {!art && (
        <div className="gal-objective">
          <span className="gal-blip" />
          Objective: Explore and tap on the artwork to view closely.
        </div>
      )}

      <div className={`gal-hint${isTouch ? " up" : ""}`}>
        {isTouch ? "Joystick to move · swipe to look · tap art · tap the door"
          : "WASD / arrows to move · drag to look around · tap art · tap the door to leave"}
      </div>

      {isTouch && !art && (
        <div
          className="joystick"
          ref={joyRef}
          onPointerDown={joyStart}
          onPointerMove={joyMove}
          onPointerUp={joyEnd}
          onPointerCancel={joyEnd}
        >
          <div className="joystick-knob" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
      )}

      {art && (
        <div className="art-overlay">
          <button className="art-close" onClick={() => setArt(null)} aria-label="Close">✕</button>
          <div className="art-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="art-photo" src={art.img} alt={art.title} />
          </div>
          <aside className="art-side">
            <div className="art-kicker">From Boba&apos;s Collection</div>
            <h2>{art.title}</h2>
            <div className="art-meta">{art.meta}</div>
            <div className="art-divider" />
            <p className="art-desc">{art.desc}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
