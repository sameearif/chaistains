"use client";

import { useEffect, useState } from "react";

const BREW = ["Brewing", "Steeping", "Pouring"];

const CSS = `
#overlay {
  position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; padding: 24px;
  color: var(--ink); transition: opacity 1s ease; background: #f4efe5; overflow: hidden;
  font-family: var(--ui);
}
#overlay.hidden { opacity: 0; pointer-events: none; }

#overlay .stain {
  position: absolute; pointer-events: none;
  background: radial-gradient(circle at 50% 50%,
    transparent 55%,
    rgba(150,98,42,0.13) 58%,
    rgba(116,68,26,0.26) 63%,
    rgba(150,98,42,0.11) 69%,
    rgba(150,98,42,0.04) 73%,
    transparent 77%);
  filter: url(#chaiRough);
}
#overlay .stain.blot {
  background: radial-gradient(circle at 46% 44%,
    rgba(128,78,32,0.20), rgba(140,86,38,0.11) 52%, transparent 72%);
  filter: url(#chaiRough2);
}
#overlay .stain.s1 { width: 360px; height: 338px; top: -134px; right: -108px; transform: rotate(-9deg); }
#overlay .stain.s2 { width: 224px; height: 212px; bottom: 18px; left: -86px; transform: rotate(14deg); opacity: .92; }
#overlay .stain.s3 { width: 132px; height: 124px; bottom: 104px; right: 84px; transform: rotate(-5deg); opacity: .8; }
#overlay .stain.s4 { width: 168px; height: 178px; top: 54px; left: -58px; transform: rotate(7deg); opacity: .72; }
#overlay .stain.s5 { width: 92px;  height: 86px;  top: 88px; left: 210px; transform: rotate(18deg); opacity: .6; }
#overlay .stain.s6 { width: 196px; height: 184px; bottom: -64px; right: -44px; transform: rotate(10deg); opacity: .82; }
#overlay .stain.s7 { width: 74px;  height: 70px;  top: 46%; right: 58px; transform: rotate(-12deg); opacity: .68; }
#overlay .stain.s8 { width: 58px;  height: 62px;  bottom: 150px; left: 44%; transform: rotate(8deg); opacity: .6; }
#overlay .stain.s9 { width: 110px; height: 104px; top: 30px; right: 240px; transform: rotate(-16deg); opacity: .5; }

#overlay .inner { position: relative; display: flex; flex-direction: column; align-items: center; }

.chai-logo { width: 92px; height: auto; margin-bottom: 30px; display: block; }
.chai-logo .glass, .chai-logo .saucer { fill: none; stroke: #38322a; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.chai-logo .tea { fill: #c2873b; }
.chai-logo .glance { fill: rgba(255,255,255,0.5); }
.chai-logo .steam { fill: none; stroke: #b98a4e; stroke-width: 2.2; stroke-linecap: round; opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .chai-logo .s-a { animation: steam 3.4s ease-in-out infinite; }
  .chai-logo .s-b { animation: steam 3.4s ease-in-out .7s infinite; }
  .chai-logo .s-c { animation: steam 3.4s ease-in-out 1.4s infinite; }
}
@keyframes steam {
  0% { opacity: 0; transform: translateY(6px) scaleY(.6); }
  25% { opacity: .8; }
  60% { opacity: .35; }
  100% { opacity: 0; transform: translateY(-12px) scaleY(1.15); }
}

#overlay .eyebrow { font-size: 11px; letter-spacing: .42em; text-transform: uppercase; color: rgba(56,50,42,0.42); margin: 0 0 20px; padding-left: .42em; }
#overlay h1 { font-family: var(--display); font-weight: 600; font-size: clamp(50px, 9vw, 96px); line-height: 1; margin: 0; letter-spacing: -.01em; white-space: nowrap; }
#overlay h1 em { font-style: italic; font-weight: 500; color: #9a5a22; }
#overlay .sub { font-family: var(--ui); font-style: italic; font-weight: 500; font-size: clamp(16px, 2.1vw, 20px); color: rgba(56,50,42,0.62); margin: 22px 0 0; max-width: 40ch; line-height: 1.55; }

.loadslot { height: 60px; margin-top: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.loadwrap { display: flex; flex-direction: column; align-items: center; gap: 14px; transition: opacity .5s; }
.loadwrap.gone { opacity: 0; pointer-events: none; }
.bar { width: 180px; height: 1.5px; background: rgba(56,50,42,0.14); border-radius: 2px; overflow: hidden; }
.bar i { display: block; height: 100%; width: 0%; background: #b8782e; border-radius: 2px; transition: width .35s ease; }
.loadlabel { font-size: 10.5px; letter-spacing: .34em; text-transform: uppercase; color: rgba(56,50,42,0.4); }

#enterBtn {
  appearance: none; cursor: pointer; font-family: var(--ui); font-weight: 700;
  font-size: 12px; letter-spacing: .26em; text-transform: uppercase; color: var(--ink);
  background: transparent; border: 0; padding: 6px 2px; position: absolute;
  opacity: 0; transform: translateY(8px); transition: opacity .6s .1s, transform .6s .1s, letter-spacing .3s, color .3s;
  pointer-events: none;
}
#enterBtn::after { content: ''; position: absolute; left: 2px; right: 2px; bottom: -2px; height: 1.5px;
  background: var(--ink); transform: scaleX(.18); transform-origin: left; transition: transform .35s ease, background .3s; }
#enterBtn.ready { opacity: 1; transform: translateY(0); pointer-events: auto; }
#enterBtn:hover { color: #b8782e; letter-spacing: .3em; }
#enterBtn:hover::after { transform: scaleX(1); background: #b8782e; }
`;

export default function Loader({
  progress,
  ready,
  onEnter,
}: {
  progress: number;
  ready: boolean;
  onEnter: () => void;
}) {
  const [revealed, setRevealed] = useState(false); // Enter button shown
  const [fading, setFading] = useState(false);

  // Once assets are ready, fill the bar then swap it for the Enter button.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setRevealed(true), 520);
    return () => clearTimeout(t);
  }, [ready]);

  const pct = ready ? 100 : Math.min(95, Math.round(progress));
  const label = ready ? "Ready" : BREW[Math.min(2, Math.floor(pct / 32))];

  const handleEnter = () => {
    setFading(true);
    setTimeout(onEnter, 1000); // let the overlay fade before unmount
  };

  return (
    <div id="overlay" className={fading ? "hidden" : ""}>
      <style>{`:root{--ink:#38322a;--ui:var(--font-cormorant),Georgia,serif;--display:var(--font-playfair),Georgia,serif;}`}</style>
      <style>{CSS}</style>

      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id="chaiRough" x="-45%" y="-45%" width="190%" height="190%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.024" numOctaves={3} seed={11} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={54} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="chaiRough2" x="-55%" y="-55%" width="210%" height="210%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.038" numOctaves={3} seed={4} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={34} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <span className="stain s1" />
      <span className="stain s2" />
      <span className="stain s3" />
      <span className="stain s4" />
      <span className="stain s5" />
      <span className="stain s6" />
      <span className="stain blot s7" />
      <span className="stain blot s8" />
      <span className="stain s9" />

      <div className="inner">
        <svg className="chai-logo" viewBox="0 0 100 128" aria-label="Chai Stains logo">
          <path className="steam s-a" d="M40 40 C34 31 46 26 40 16 C36 9 44 6 41 1" />
          <path className="steam s-b" d="M50 40 C44 31 56 25 50 15 C46 8 54 5 51 0" />
          <path className="steam s-c" d="M60 40 C54 31 66 26 60 16 C56 9 64 6 61 1" />
          <clipPath id="glassClip">
            <path d="M33 50 L67 50 L62 112 Q50 118 38 112 Z" />
          </clipPath>
          <g clipPath="url(#glassClip)">
            <rect className="tea" x="30" y="64" width="40" height="56" />
            <ellipse className="glance" cx="44" cy="74" rx="8" ry="3" />
          </g>
          <path className="glass" d="M33 50 L67 50 L62 112 Q50 118 38 112 Z" />
          <ellipse className="glass" cx="50" cy="50" rx="17" ry="4.5" />
          <path className="saucer" d="M30 120 Q50 128 70 120" />
        </svg>

        <div className="eyebrow">An Interactive Gallery</div>
        <h1>Chai <em>Stains</em></h1>
        <p className="sub">An orange cat, a quiet afternoon, a cup of tea, and a roomful of pictures.</p>

        <div className="loadslot">
          <div className={`loadwrap${revealed ? " gone" : ""}`}>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <div className="loadlabel">{label}</div>
          </div>
          <button id="enterBtn" className={revealed ? "ready" : ""} onClick={handleEnter}>
            Enter the World
          </button>
        </div>
      </div>
    </div>
  );
}
