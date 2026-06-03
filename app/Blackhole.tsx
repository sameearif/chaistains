"use client";

import { useEffect, useRef } from "react";

const CSS = `
.void {
  position: fixed; inset: 0; z-index: 200; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-pixel), monospace;
  background: #06060f;
  animation: void-in 1.1s ease both;
}
@keyframes void-in { from { opacity: 0; } to { opacity: 1; } }
/* canvas is scaled to COVER the whole viewport — no gradient bars on the sides */
.void-stage { position: relative; image-rendering: pixelated; flex: none; }
.void canvas { display: block; image-rendering: pixelated; }
.void #vtitle {
  position: absolute; top: 18px; left: 50%; transform: translateX(-50%); z-index: 3;
  color: #ffd27a; text-align: center; pointer-events: none;
  text-shadow: 0 2px 0 #5a2a00; line-height: 2; font-size: 9px; letter-spacing: 1px; max-width: 92%;
}
.void #vscan {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 2px, rgba(0,0,0,0) 2px 4px);
  mix-blend-mode: multiply; opacity: .5;
}
`;

export default function Blackhole({ onComplete }: { onComplete?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const LOGW = 384, LOGH = 384;
    const canvas = canvasRef.current!;
    const stage = stageRef.current!;
    canvas.width = LOGW; canvas.height = LOGH;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const pixelFamily =
      getComputedStyle(document.documentElement).getPropertyValue("--font-pixel").trim() || "monospace";

    const fit = () => {
      // Original centred size — the surrounding area is solid dark space (set
      // on .void), so there are no coloured side bars.
      const s = Math.min(window.innerWidth, window.innerHeight) * 0.92;
      const px = Math.max(1, Math.floor(s));
      canvas.style.width = px + "px";
      canvas.style.height = px + "px";
      stage.style.width = px + "px";
      stage.style.height = px + "px";
    };
    window.addEventListener("resize", fit); fit();

    const CX = LOGW / 2, CY = LOGH / 2 - 6;
    const EH = 24, DISK = 132, BLOCK = 4, DISK_TILT = 0.46;

    // cat sprite (Boba) — use the front-facing idle frame
    const cat = new Image();
    let catReady = false;
    let CAT_AR = 156 / 272;
    cat.onload = () => { catReady = true; CAT_AR = cat.naturalWidth / cat.naturalHeight; };
    cat.src = "/sprites/idle/down/1.png";

    // starfield
    const stars: { a: number; r: number; bx: number; by: number; sz: number; tw: number; tws: number; hue: string }[] = [];
    for (let i = 0; i < 150; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * 260;
      stars.push({
        a, r, bx: CX + Math.cos(a) * r, by: CY + Math.sin(a) * r,
        sz: Math.random() < 0.18 ? 3 : (Math.random() < 0.5 ? 2 : 1),
        tw: Math.random() * Math.PI * 2, tws: 1.5 + Math.random() * 3,
        hue: Math.random() < 0.5 ? "#cfe3ff" : (Math.random() < 0.5 ? "#ffe6c2" : "#e7d3ff"),
      });
    }

    // accretion-disk particles
    const parts: { r: number; a0: number; sp: number; fl: number }[] = [];
    const ARMS = 3;
    for (let i = 0; i < 1400; i++) {
      const u = Math.random();
      const r = EH + 4 + (DISK - EH - 4) * (u * u);
      const arm = Math.floor(Math.random() * ARMS) * (Math.PI * 2 / ARMS);
      const a0 = arm + Math.log(r) * 1.7 + (Math.random() - 0.5) * 0.9;
      parts.push({ r, a0, sp: 0.9 + Math.random() * 0.5, fl: Math.random() });
    }

    const diskColor = (r: number, fl: number, boost: number) => {
      const t = (r - EH) / (DISK - EH);
      let col: number[];
      if (t < 0.12) col = [255, 252, 240];
      else if (t < 0.28) col = [180, 240, 255];
      else if (t < 0.5) col = [120, 170, 255];
      else if (t < 0.72) col = [150, 110, 240];
      else col = [120, 60, 170];
      const a = (0.5 + 0.5 * Math.sin(fl * 6.28 + boost)) * (1 - t * 0.45);
      return `rgba(${col[0]},${col[1]},${col[2]},${(0.35 + a * 0.6).toFixed(3)})`;
    };
    const px = (x: number, y: number, s: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.floor(Math.round(x) / s) * s, Math.floor(Math.round(y) / s) * s, s, s);
    };

    const CYCLE = 8.2, T_IDLE = 1.7, T_PULL = 5.6;
    const CAT_W = 92;
    const IDLE_OFFSET = 104;
    const startAng = Math.PI / 2;
    const SPINS = 2.6;
    const easeIn = (p: number) => p * p;

    const t0 = performance.now();
    const paused = false;
    let raf = 0;
    let fired = false;
    const oneShot = !!completeRef.current; // play once when used as a cutscene

    const draw = (now: number) => {
      const CAT_H = CAT_W / CAT_AR;
      const raw = (now - t0) / 1000;
      // Hand off near the "burp" flash so a white flash can cover the swap.
      if (oneShot && !fired && raw > T_PULL + 1.0) { fired = true; completeRef.current?.(); }
      const tt = oneShot ? raw : raw % CYCLE;

      ctx.fillStyle = "#06060f";
      ctx.fillRect(0, 0, LOGW, LOGH);
      const halo = ctx.createRadialGradient(CX, CY, EH, CX, CY, DISK * 1.25);
      halo.addColorStop(0, "rgba(90,60,180,0.30)");
      halo.addColorStop(0.5, "rgba(60,40,120,0.14)");
      halo.addColorStop(1, "rgba(10,8,24,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, LOGW, LOGH);

      for (const st of stars) {
        let sx = st.bx, sy = st.by;
        if (tt > T_IDLE) {
          const pp = Math.min(1, (tt - T_IDLE) / (CYCLE - T_IDLE));
          const rr = st.r * (1 - 0.12 * pp);
          const aa = st.a + pp * 0.6 * (120 / st.r);
          sx = CX + Math.cos(aa) * rr;
          sy = CY + Math.sin(aa) * rr;
        }
        const tw = 0.5 + 0.5 * Math.sin(now / 1000 * st.tws + st.tw);
        ctx.globalAlpha = 0.25 + tw * 0.75;
        px(sx, sy, st.sz, st.hue);
      }
      ctx.globalAlpha = 1;

      let boost = 0, flashRing = 0;
      if (tt > T_PULL) {
        const fp = (tt - T_PULL) / (CYCLE - T_PULL);
        boost = Math.sin(fp * Math.PI) * 3;
        flashRing = Math.sin(fp * Math.PI);
      }

      const spin = now / 1000;
      const plot = (behind: boolean) => {
        for (const p of parts) {
          const ang = p.a0 + spin * p.sp * (90 / p.r);
          const sortY = Math.sin(ang);
          if (behind ? sortY >= 0 : sortY < 0) continue;
          const x = CX + Math.cos(ang) * p.r;
          const y = CY + Math.sin(ang) * p.r * DISK_TILT;
          px(x, y, BLOCK, diskColor(p.r, p.fl + spin * 0.1, boost));
        }
      };
      plot(true);

      ctx.fillStyle = "#000007";
      ctx.beginPath();
      ctx.ellipse(CX, CY, EH, EH, 0, 0, 7); ctx.fill();
      const rimA = 0.7 + 0.3 * Math.sin(spin * 4) + flashRing * 0.5;
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * Math.PI * 2;
        px(CX + Math.cos(a) * (EH + 2), CY + Math.sin(a) * (EH + 2), 3, `rgba(190,240,255,${Math.min(1, rimA).toFixed(2)})`);
      }

      plot(false);

      ctx.globalAlpha = 0.8;
      for (let k = -1; k <= 1; k += 2) {
        for (let a = -0.7; a < 0.7; a += 0.08) {
          const rr = EH + 8;
          px(CX + Math.sin(a) * rr * 1.1, CY + k * Math.cos(a) * rr * 0.9, 3, "rgba(150,210,255,0.5)");
        }
      }
      ctx.globalAlpha = 1;

      if (catReady) {
        if (tt <= T_IDLE) {
          const bob = Math.sin(now / 1000 * 4) * 2;
          const tilt = Math.sin(now / 1000 * 2) * 0.04;
          ctx.save();
          ctx.translate(CX, CY + IDLE_OFFSET + bob);
          ctx.rotate(tilt);
          ctx.drawImage(cat, -CAT_W / 2, -CAT_H / 2, CAT_W, CAT_H);
          ctx.restore();
          if (tt > T_IDLE - 0.7) {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = "#fff";
            ctx.font = `9px ${pixelFamily}, monospace`;
            ctx.textAlign = "center";
            ctx.fillText("meow?!", CX + 60, CY + IDLE_OFFSET - CAT_H / 2 + 4);
            ctx.globalAlpha = 1;
          }
        } else if (tt < T_PULL) {
          const p = (tt - T_IDLE) / (T_PULL - T_IDLE);
          const pe = easeIn(p);
          const r = IDLE_OFFSET * (1 - pe);
          const ang = startAng + pe * SPINS * Math.PI * 2;
          const x = CX + Math.cos(ang) * r;
          const y = CY + Math.sin(ang) * r;
          const dirToC = Math.atan2(CY - y, CX - x);
          const shrink = 1 - 0.92 * pe;
          const spag = p > 0.35 ? (p - 0.35) / 0.65 : 0;
          const stretch = 1 + spag * spag * 3.4;
          const squash = 1 - spag * 0.62;
          const spin2 = pe * 6;
          let alpha = 1;
          if (p > 0.86) alpha = Math.max(0, 1 - (p - 0.86) / 0.14);

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(x, y);
          ctx.rotate(dirToC + Math.PI / 2 + spin2);
          ctx.scale(shrink * squash, shrink * stretch);
          ctx.drawImage(cat, -CAT_W / 2, -CAT_H / 2, CAT_W, CAT_H);
          ctx.restore();

          ctx.globalAlpha = alpha * 0.5;
          for (let s = 1; s <= 4; s++) {
            const tp = Math.max(0, pe - s * 0.03);
            const rr = IDLE_OFFSET * (1 - tp);
            const aa = startAng + tp * SPINS * Math.PI * 2;
            px(CX + Math.cos(aa) * rr, CY + Math.sin(aa) * rr, 3, `rgba(255,210,150,${(0.4 - s * 0.08).toFixed(2)})`);
          }
          ctx.globalAlpha = 1;

          if (p > 0.5 && p < 0.8) {
            ctx.globalAlpha = (0.8 - p) * 3;
            ctx.fillStyle = "#ffe0a0";
            ctx.font = `8px ${pixelFamily}, monospace`;
            ctx.textAlign = "center";
            ctx.fillText("meeeooo", x, y - 14);
            ctx.globalAlpha = 1;
          }
        }
      }

      const vg = ctx.createRadialGradient(CX, CY, 120, CX, CY, 280);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, LOGW, LOGH);

      if (!paused) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <div className="void">
      <style>{CSS}</style>
      <div id="vtitle">OH NO BOBA IS BEING SUCKED IN A BLACKHOLE!</div>
      <div className="void-stage" ref={stageRef}>
        <canvas ref={canvasRef} />
      </div>
      <div id="vscan" />
    </div>
  );
}
