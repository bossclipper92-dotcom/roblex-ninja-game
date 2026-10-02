import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type HudState } from './game/engine';
import Intro from './Intro';
import Touch from './Touch';

function Bar({ value, max, from, to, label, h = 'h-4' }: { value: number; max: number; from: string; to: string; label: string; h?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-64">
      <div className={`relative ${h} overflow-hidden rounded-sm border border-white/30 bg-black/60`}>
        <div className="h-full transition-[width] duration-100" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
        <div className="absolute inset-0 flex items-center px-2 text-[10px] font-bold tracking-widest text-white drop-shadow">
          {label} <span className="ml-auto">{Math.ceil(value)}/{Math.round(max)}</span>
        </div>
      </div>
    </div>
  );
}

function Skill({ k, name, jp, cost, ready, cd }: { k: string; name: string; jp: string; cost: string; ready: boolean; cd: number }) {
  return (
    <div
      className={`relative flex w-24 flex-col items-center rounded-md border px-2 py-1.5 text-center backdrop-blur ${
        ready ? 'border-amber-300 bg-black/60 shadow-[0_0_14px_rgba(255,200,80,0.5)]' : 'border-white/20 bg-black/50 opacity-60'
      }`}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-red-600 px-1.5 text-[11px] font-black text-white">{k}</div>
      <div className="mt-1 text-lg font-black leading-none text-amber-200">{jp}</div>
      <div className="text-[10px] font-semibold leading-tight text-white">{name}</div>
      <div className="text-[10px] text-sky-300">{cost}</div>
      {cd > 0 && <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 text-lg font-bold text-white">{cd.toFixed(1)}</div>}
    </div>
  );
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [phase, setPhase] = useState<'intro' | 'menu' | 'play'>('intro');
  const [hud, setHud] = useState<HudState | null>(null);
  const [runId, setRunId] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem('kagerush_best') || 0));
    } catch {
      /* ignore */
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play' || !mountRef.current) return;
    const g = new Game(mountRef.current, setHud, () => undefined);
    gameRef.current = g;
    g.start();
    return () => {
      g.dispose();
      gameRef.current = null;
    };
  }, [phase, runId]);

  const restart = useCallback(() => {
    setHud(null);
    setRunId((n) => n + 1);
  }, []);

  const h = hud;
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-black font-sans text-white">
      <style>{`
        @keyframes bannerIn { 0%{opacity:0; transform:scale(1.6)} 12%{opacity:1; transform:scale(1)} 80%{opacity:1} 100%{opacity:0; transform:scale(0.98)} }
        @keyframes toastIn { 0%{opacity:0; transform:translateY(10px)} 10%{opacity:1; transform:none} 80%{opacity:1} 100%{opacity:0} }
        @keyframes pulseRed { 0%,100%{opacity:.25} 50%{opacity:.55} }
      `}</style>

      <div ref={mountRef} className="absolute inset-0" />
      {phase === 'intro' && <Intro onDone={() => setPhase('menu')} />}

      {phase === 'menu' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,#3a0a1a_0%,#0a0612_70%)] p-4">
          <div className="w-full max-w-3xl text-center">
            <div className="text-sm font-bold tracking-[0.5em] text-red-400">忍者サバイバル</div>
            <h1 className="mt-1 text-5xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,60,90,0.7)] md:text-6xl">
              KAGE RUSH <span className="text-red-500">: Ninja Survival</span>
            </h1>
            <div className="mt-1 text-xl font-bold text-amber-300">浪人 — The Wandering Ninja</div>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
              You are a wandering ronin ninja, wielding a legendary blade. Survive endless waves of the Shadow Clan, dodge falling meteors,
              spike traps and the creeping Oni Mist — and defeat the Shadow Shogun every 5th wave.
            </p>

            <div className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-2 text-left text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-white/15 bg-black/50 p-3">
                <div className="mb-1 font-bold text-amber-300">CONTROLS</div>
                <ul className="space-y-0.5 text-slate-200">
                  <li><b>W A S D</b> — move &nbsp; <b>Space</b> — jump</li>
                  <li><b>Mouse</b> — camera (click to lock) &nbsp; <b>←→↑↓</b> — camera</li>
                  <li><b>Left Click / J</b> — 3-hit sword combo</li>
                  <li><b>Right Click / K</b> — guard (tap just before a hit to PARRY)</li>
                  <li><b>Shift</b> — dodge dash (invincible, 25 stamina)</li>
                  <li><b>P / Esc</b> — pause</li>
                </ul>
              </div>
              <div className="rounded-lg border border-white/15 bg-black/50 p-3">
                <div className="mb-1 font-bold text-amber-300">SHADOW BLADE ARTS</div>
                <ul className="space-y-0.5 text-slate-200">
                  <li><b className="text-red-400">Q</b> 抜刀術 Battōjutsu — lightning dash slash (15 Ki)</li>
                  <li><b className="text-red-400">E</b> 龍落 Dragon Drop — leaping slam AoE (30 Ki)</li>
                  <li><b className="text-red-400">R</b> 九牙嵐 Nine Fang Storm — nine strikes at once (100 Ki)</li>
                  <li className="text-sky-300">Hitting & parrying builds Ki.</li>
                  <li className="text-emerald-300">Grab 🍙 heal, 🍶 speed, 📜 Ki, 🛡 talisman.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 sm:col-span-2">
                <div className="mb-1 font-bold text-red-400">DANGERS</div>
                <div className="grid grid-cols-2 gap-x-4 text-slate-200 md:grid-cols-3">
                  <span>🥷 Shadow Ninjas</span>
                  <span>🌟 Shuriken throwers</span>
                  <span>💣 Suicide bomb ninjas</span>
                  <span>👹 Oni Brutes (ground slam)</span>
                  <span>☄️ Meteor rain</span>
                  <span>🗡️ Spike traps</span>
                  <span>🟣 Closing Oni Mist</span>
                  <span>👑 Shadow Shogun boss</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setPhase('play')}
              className="mt-6 rounded-md border-2 border-red-400 bg-red-600 px-10 py-3 text-xl font-black tracking-widest text-white shadow-[0_0_25px_rgba(255,50,80,0.6)] transition hover:scale-105 hover:bg-red-500"
            >
              BEGIN THE WANDER
            </button>
            {best > 0 && <div className="mt-3 text-sm text-amber-200">Best score: {best.toLocaleString()}</div>}
            <button onClick={() => setPhase('intro')} className="mt-3 rounded border border-white/30 bg-black/40 px-5 py-1.5 text-sm font-bold text-slate-200 hover:bg-white/10">🎬 WATCH INTRO</button>
          </div>
        </div>
      )}

      {phase === 'play' && h && (
        <>
          {coarse && <Touch />}
          {/* damage / mist / ultimate overlays */}
          <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: `inset 0 0 160px 40px rgba(220,0,30,${h.hurt * 0.75})` }} />
          {h.danger && (
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{ boxShadow: 'inset 0 0 200px 60px rgba(150,40,255,0.55)', animation: 'pulseRed 1s infinite' }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 z-10 bg-white" style={{ opacity: h.flash * 0.7 }} />
          {h.hp / h.maxHp < 0.3 && !h.over && (
            <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: 'inset 0 0 120px 20px rgba(200,0,0,0.5)', animation: 'pulseRed 0.8s infinite' }} />
          )}

          {/* top-left bars */}
          <div className="pointer-events-none absolute left-4 top-4 z-20 space-y-1">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-300 bg-red-700 text-lg">⚔</div>
              <div>
                <div className="text-sm font-black leading-none text-red-200">KAGE</div>
                <div className="text-[10px] tracking-widest text-slate-300">WANDERING RONIN</div>
              </div>
            </div>
            <Bar value={h.hp} max={h.maxHp} from="#ef4444" to="#fb7185" label="HP" h="h-5" />
            <Bar value={h.stamina} max={100} from="#22c55e" to="#a3e635" label="STAMINA" />
            <Bar value={h.ki} max={100} from="#38bdf8" to="#a78bfa" label="KI" />
            {h.buffs.length > 0 && <div className="flex gap-2 text-xs font-bold text-amber-200">{h.buffs.map((b) => <span key={b} className="rounded bg-black/60 px-2 py-0.5">{b}</span>)}</div>}
          </div>

          {/* top center wave */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 text-center">
            <div className="rounded-md border border-white/20 bg-black/60 px-6 py-1.5 backdrop-blur">
              <div className="text-xs tracking-[0.3em] text-red-300">WAVE</div>
              <div className="text-3xl font-black leading-none">{h.wave}</div>
              <div className="text-[11px] text-slate-300">Enemies left: <b className="text-white">{h.left}</b></div>
            </div>
            {h.boss && (
              <div className="mt-2 w-[420px] max-w-[70vw]">
                <div className="mb-0.5 text-sm font-black tracking-widest text-red-400 drop-shadow">👑 {h.boss.name}</div>
                <div className="h-4 overflow-hidden rounded-sm border border-red-300/60 bg-black/70">
                  <div className="h-full bg-gradient-to-r from-red-700 to-pink-500 transition-[width] duration-100" style={{ width: `${(h.boss.hp / h.boss.max) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* top right */}
          <div className="pointer-events-none absolute right-4 top-4 z-20 text-right">
            <div className="text-3xl font-black tabular-nums text-amber-300 drop-shadow">{h.score.toLocaleString()}</div>
            <div className="text-[11px] tracking-widest text-slate-300">BEST {h.best.toLocaleString()}</div>
            <div className="mt-1 text-sm text-slate-200">⏱ {fmt(h.time)} &nbsp; ☠ {h.kills}</div>
            <div className="mt-1 text-[11px] text-purple-300">🟣 Oni Mist radius: {Math.round(h.mist)}m</div>
            {h.combo >= 3 && (
              <div className="mt-2">
                <div className="text-4xl font-black italic text-red-400 drop-shadow-[0_0_10px_rgba(255,0,60,0.8)]">{h.combo}</div>
                <div className="text-xs font-bold tracking-widest text-red-200">COMBO{h.combo >= 10 ? ` ×${(1 + Math.floor(h.combo / 10) * 0.25).toFixed(2)}` : ''}</div>
              </div>
            )}
          </div>

          {/* skills */}
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-3">
            <Skill k="Q" jp="抜刀術" name="Battōjutsu" cost="15 Ki" ready={h.ki >= 15 && h.cdQ <= 0} cd={h.cdQ} />
            <Skill k="E" jp="龍落" name="Dragon Drop" cost="30 Ki" ready={h.ki >= 30 && h.cdE <= 0} cd={h.cdE} />
            <Skill k="R" jp="九牙嵐" name="Nine Fang Storm" cost="100 Ki" ready={h.ki >= 100} cd={0} />
            <Skill k="K" jp="防" name={h.guard ? 'Guarding' : 'Guard / Parry'} cost="Hold" ready={h.guard} cd={0} />
          </div>

          {/* banner */}
          {h.banner.text && (
            <div key={h.banner.id} className="pointer-events-none absolute left-1/2 top-[28%] z-20 -translate-x-1/2 text-center" style={{ animation: 'bannerIn 2.6s ease-out forwards' }}>
              <div className="whitespace-nowrap text-4xl font-black tracking-widest text-white drop-shadow-[0_0_18px_rgba(255,60,90,0.9)] md:text-6xl">{h.banner.text}</div>
              <div className="mt-1 text-base font-semibold tracking-wider text-amber-200 md:text-xl">{h.banner.sub}</div>
            </div>
          )}
          {h.toast.text && (
            <div key={h.toast.id} className="pointer-events-none absolute left-1/2 top-[42%] z-20 -translate-x-1/2 rounded bg-black/60 px-4 py-1.5 text-lg font-bold text-amber-200" style={{ animation: 'toastIn 1.8s ease-out forwards' }}>
              {h.toast.text}
            </div>
          )}

          {!coarse && !h.locked && !h.paused && !h.over && (
            <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 text-xs text-slate-300/80">Click the screen to lock the mouse for camera control · P to pause</div>
          )}

          {/* pause */}
          {h.paused && !h.over && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
              <div className="text-center">
                <div className="text-5xl font-black tracking-widest">PAUSED</div>
                <div className="mt-4 flex justify-center gap-3">
                  <button onClick={() => gameRef.current?.togglePause()} className="rounded border-2 border-amber-300 bg-amber-500/80 px-6 py-2 font-bold hover:bg-amber-400">RESUME</button>
                  <button onClick={restart} className="rounded border-2 border-white/40 bg-black/50 px-6 py-2 font-bold hover:bg-white/10">RESTART</button>
                  <button onClick={() => { setHud(null); setPhase('menu'); }} className="rounded border-2 border-white/40 bg-black/50 px-6 py-2 font-bold hover:bg-white/10">MENU</button>
                </div>
              </div>
            </div>
          )}

          {/* game over */}
          {h.over && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-black/60 to-red-950/90">
              <div className="text-center">
                <div className="text-sm tracking-[0.5em] text-red-400">浪人倒れる</div>
                <div className="text-6xl font-black tracking-widest text-red-500 drop-shadow-[0_0_20px_rgba(255,0,60,0.8)]">YOU FELL</div>
                <div className="mx-auto mt-5 grid w-80 grid-cols-2 gap-2 text-left text-sm">
                  <div className="rounded bg-black/50 p-2">Score<div className="text-xl font-black text-amber-300">{h.score.toLocaleString()}</div></div>
                  <div className="rounded bg-black/50 p-2">Best<div className="text-xl font-black text-amber-300">{h.best.toLocaleString()}</div></div>
                  <div className="rounded bg-black/50 p-2">Wave reached<div className="text-xl font-black">{h.wave}</div></div>
                  <div className="rounded bg-black/50 p-2">Enemies defeated<div className="text-xl font-black">{h.kills}</div></div>
                  <div className="col-span-2 rounded bg-black/50 p-2">Survived<div className="text-xl font-black">{fmt(h.time)}</div></div>
                </div>
                <div className="mt-6 flex justify-center gap-3">
                  <button onClick={restart} className="rounded border-2 border-red-300 bg-red-600 px-8 py-3 text-lg font-black tracking-widest hover:bg-red-500">WANDER AGAIN</button>
                  <button onClick={() => { setHud(null); setPhase('menu'); }} className="rounded border-2 border-white/40 bg-black/50 px-6 py-3 font-bold hover:bg-white/10">MENU</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
