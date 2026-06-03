"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { preloadedModels } from "@/lib/preload";

// Radial accretion-disk texture: transparent hole → white-hot → amber → violet.
function makeDiskTexture(): THREE.Texture {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  const cx = S / 2;
  const g = x.createRadialGradient(cx, cx, S * 0.16, cx, cx, S * 0.5);
  g.addColorStop(0.0, "rgba(0,0,0,0)");
  g.addColorStop(0.30, "rgba(255,255,255,0)");
  g.addColorStop(0.34, "rgba(255,250,235,0.95)");
  g.addColorStop(0.42, "rgba(255,210,120,0.9)");
  g.addColorStop(0.56, "rgba(255,120,60,0.75)");
  g.addColorStop(0.74, "rgba(150,60,170,0.45)");
  g.addColorStop(0.9, "rgba(60,30,110,0.18)");
  g.addColorStop(1.0, "rgba(10,8,24,0)");
  x.fillStyle = g;
  x.beginPath(); x.arc(cx, cx, S * 0.5, 0, 7); x.fill();
  // spiral streaks so the spin reads as motion
  x.globalCompositeOperation = "lighter";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = S * 0.18, r1 = S * 0.48;
    x.strokeStyle = `rgba(255,${200 - i % 80},${120},${0.05 + (i % 5) * 0.02})`;
    x.lineWidth = 1 + (i % 3);
    x.beginPath();
    for (let t = 0; t <= 1; t += 0.05) {
      const rr = r0 + (r1 - r0) * t;
      const aa = a + t * 1.6;
      const px = cx + Math.cos(aa) * rr, py = cx + Math.sin(aa) * rr;
      t === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const CSS = `
.void3d { position: fixed; inset: 0; z-index: 200; overflow: hidden; background: #04030a; animation: v3-in 1s ease both; transition: opacity 1s ease; }
.void3d.fade-out { opacity: 0; }
@keyframes v3-in { from { opacity: 0; } to { opacity: 1; } }
.void3d canvas { display: block; }
.void3d .v3-title {
  position: absolute; top: 30px; left: 50%; transform: translateX(-50%);
  width: 90%; max-width: 820px; text-align: center; pointer-events: none;
  font-family: var(--font-playfair), Georgia, serif; font-weight: 500;
  font-size: clamp(17px, 3vw, 32px); letter-spacing: 0.005em; line-height: 1.35;
  color: #f3ecff; text-shadow: 0 2px 18px rgba(120,90,220,0.55);
}
.void3d .v3-title em { font-style: italic; font-weight: 600; color: #ffd27a; }
.void3d .v3-back {
  position: absolute; top: 16px; right: 18px; z-index: 5; cursor: pointer;
  font-family: var(--font-manrope), system-ui, sans-serif; font-weight: 700;
  font-size: 12px; letter-spacing: 0.04em;
  color: #cdb9ff; background: rgba(20,12,40,0.6); border: 1.5px solid #4a3a7a;
  border-radius: 8px; padding: 8px 12px;
}
.void3d .v3-back:hover { color: #fff; border-color: #7a6cff; }
`;

export default function Blackhole3D({ onComplete }: { onComplete?: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [fading, setFading] = useState(false);
  const setFadingRef = useRef(setFading);
  setFadingRef.current = setFading;

  useEffect(() => {
    const mount = mountRef.current!;
    let W = window.innerWidth, H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#04030a");
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
    // Pull the camera back on smaller screens so the cat + hole aren't huge.
    const camZ = W < 560 ? 17 : W < 820 ? 14.5 : 12;
    camera.position.set(0, 1.0, camZ);
    camera.lookAt(0, 0, 0); // aim at the hole centre so the cat reads dead-centre

    // ── Post-processing: bloom for the glowing disk ─────────────────────────
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 1.35, 0.75, 0.0);
    composer.addPass(bloom);

    // ── Starfield ───────────────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starN = 2200;
    const sp = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 40 + Math.random() * 120;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sp[i * 3] = r * Math.sin(ph) * Math.cos(th);
      sp[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      sp[i * 3 + 2] = r * Math.cos(ph);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.35, sizeAttenuation: true }));
    scene.add(stars);

    // ── Black hole ──────────────────────────────────────────────────────────
    const hole = new THREE.Group();
    scene.add(hole);

    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    hole.add(horizon);

    // accretion disk — a flat disc with a transparent centre hole
    const diskGroup = new THREE.Group();
    diskGroup.rotation.x = -1.15; // tilt toward camera
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 128),
      new THREE.MeshBasicMaterial({
        map: makeDiskTexture(), transparent: true, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    diskGroup.add(disk);
    hole.add(diskGroup);

    // bright photon ring, billboarded to the camera
    const photon = new THREE.Mesh(
      new THREE.RingGeometry(1.04, 1.18, 96),
      new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    );
    hole.add(photon);

    // ── Lights (for the cat) ────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x4466aa, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 4, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0xff8a4c, 3, 30, 2); // warm rim from the hole
    rim.position.set(0, 0, -1);
    scene.add(rim);

    // ── Cat (emerges from the hole) ─────────────────────────────────────────
    let cat: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let catReady = false;
    const loader = new GLTFLoader();
    const blob = preloadedModels.get("/models/cat.glb");
    const url = blob ? URL.createObjectURL(blob) : "/models/cat.glb";
    loader.load(url, (gltf) => {
      if (blob) URL.revokeObjectURL(url);
      cat = gltf.scene;
      cat.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = false; o.frustumCulled = false; } });
      const box = new THREE.Box3().setFromObject(cat);
      const size = new THREE.Vector3(); box.getSize(size);
      const s = 2.2 / Math.max(0.001, size.y);
      cat.scale.setScalar(s);
      const b2 = new THREE.Box3().setFromObject(cat);
      const c = new THREE.Vector3(); b2.getCenter(c);
      cat.position.sub(c); // centre on origin; we re-place each frame
      const holder = new THREE.Group();
      holder.add(cat);
      cat = holder;
      scene.add(cat);
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        // keep the cat idle (never the walk cycle) while it floats
        const walkClip = gltf.animations.find((c) => /walk|run|move|trot/i.test(c.name));
        const idle = gltf.animations.find((c) => /idle|stand|rest|breath|sit/i.test(c.name))
          || gltf.animations.find((c) => c !== walkClip)
          || gltf.animations[0];
        mixer.clipAction(idle).play();
      }
      catReady = true;
    }, undefined, (e) => console.error("cat.glb load failed", e));

    // ── Timeline ────────────────────────────────────────────────────────────
    const EMERGE_START = 1.1;   // hole settles first
    const EMERGE_DUR = 2.4;     // cat shoots out + settles
    const clock = new THREE.Clock();
    let elapsed = 0;
    const easeOutBack = (p: number) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    };

    // After the cat finishes emerging, hold 2s, then fade out and hand off
    // to the 3D gallery scene.
    const HANDOFF_AT = EMERGE_START + EMERGE_DUR + 2.0;
    let handedOff = false;

    let raf = 0;
    const tick = () => {
      const dt = Math.min(0.05, clock.getDelta());
      elapsed += dt;
      mixer?.update(dt);

      if (!handedOff && elapsed > HANDOFF_AT) {
        handedOff = true;
        setFadingRef.current(true);                       // CSS fade to black
        setTimeout(() => onCompleteRef.current?.(), 1000); // then swap scene
      }

      // disk swirl + photon billboard + slow star drift
      disk.rotation.z += dt * 0.5;
      photon.quaternion.copy(camera.quaternion);
      stars.rotation.y += dt * 0.01;

      // bloom flares at the moment the cat pops out, then eases back
      const pop = elapsed - EMERGE_START;
      bloom.strength = 1.35 + (pop > 0 && pop < 0.6 ? Math.sin((pop / 0.6) * Math.PI) * 1.8 : 0);

      if (catReady && cat) {
        const p = Math.min(1, Math.max(0, (elapsed - EMERGE_START) / EMERGE_DUR));
        const e = easeOutBack(p);
        // scale 0 → 1, fly from the hole forward a little. The camera (0,1,12)
        // looks at the hole (origin), so keeping y = z/12 puts the cat exactly
        // on the camera→hole line — i.e. visually centred on the black hole.
        cat.scale.setScalar(Math.max(0.0001, e));
        const zPos = -0.3 + e * 2.0;
        const lineY = zPos / camZ;                    // on the camera→hole sightline (camY = 1)
        cat.position.set(0, lineY + Math.sin(p * Math.PI) * 0.5, zPos);
        // tumble fast on exit, settle facing the camera (cat model's forward
        // is +X, so -PI/2 turns it to face +Z toward the camera)
        const FACE = -Math.PI / 2;
        const settle = Math.min(1, p * 1.3);
        cat.rotation.y = (1 - settle) * 14 + FACE; // spin → face camera
        cat.rotation.z = (1 - settle) * 3;
        // gentle float once settled, staying centred on the hole
        if (p >= 1) {
          cat.rotation.y = FACE + Math.sin(elapsed * 0.8) * 0.18;
          cat.position.y = (zPos / camZ) + Math.sin(elapsed * 1.2) * 0.1;
        }
        cat.visible = p > 0.001;
      }

      composer.render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H);
      composer.setSize(W, H);
      bloom.resolution.set(W, H);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      composer.dispose?.();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose?.();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((mm) => mm.dispose?.());
      });
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className={`void3d${fading ? " fade-out" : ""}`} ref={mountRef}>
      <style>{CSS}</style>
      <div className="v3-title">
        <em>Boba</em> was teleported from a 2D plane into 3D space.
      </div>
    </div>
  );
}
