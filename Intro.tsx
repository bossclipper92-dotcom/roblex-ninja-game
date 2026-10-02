import { useEffect, useRef } from 'react';

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function ninja(g: CanvasRenderingContext2D, x: number, y: number, s: number, ph: number, air: boolean) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const a = air ? 0.9 : Math.sin(ph);
  g.strokeStyle = '#080b16';
  g.fillStyle = '#080b16';
  g.lineCap = 'round';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(0, -26);
  g.lineTo(-16 * a, air ? -6 : 0);
  g.moveTo(0, -26);
  g.lineTo(16 * a + (air ? -14 : 0), air ? -14 : 0);
  g.stroke();
  g.lineWidth = 15;
  g.beginPath();
  g.moveTo(0, -26);
  g.lineTo(7, -52);
  g.stroke();
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(5, -48);
  g.lineTo(20, -42);
  g.stroke();
  g.beginPath();
  g.arc(9, -62, 10, 0, 7);
  g.fill();
  g.strokeStyle = '#e63946';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-1, -64);
  g.lineTo(19, -64);
  g.stroke();
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(-1, -64);
  g.quadraticCurveTo(-18, -62 + Math.sin(ph * 2) * 6, -34, -56 + Math.sin(ph * 2 + 1) * 8);
  g.stroke();
  g.strokeStyle = '#dfe8f5';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(20, -42);
  g.lineTo(52, -66);
  g.stroke();
  g.restore();
}

function draw(g: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const s = h / 540;
  const gy = h * 0.8;
  const k = clamp((t - 3) / 1.5);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#070a1c');
  sky.addColorStop(1, `rgb(${26 + 48 * k},${42 - 27 * k},${92 - 62 * k})`);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(i + t * (1 + (i % 3))))})`;
    g.fillRect(((i * 137) % 1000) * (w / 1000), ((i * 71) % 300) * s, 2, 2);
  }
  const mx = w * 0.78, my = h * 0.2;
  const m = g.createRadialGradient(mx, my, 4, mx, my, 90 * s);
  m.addColorStop(0, '#fffbe0');
  m.addColorStop(0.3, k > 0.5 ? '#ffb0a0' : '#fff3b0');
  m.addColorStop(1, 'rgba(255,200,170,0)');
  g.fillStyle = m;
  g.beginPath();
  g.arc(mx, my, 90 * s, 0, 7);
  g.fill();
  for (let l = 0; l < 2; l++) {
    const sp = (l ? 150 : 70) * s * t;
    g.fillStyle = l ? '#04060d' : '#0b1124';
    for (let i = -1; i < w / (200 * s) + 2; i++) {
      const x = i * 200 * s - (sp % (200 * s));
      const bh = (70 + (((i + 400) * 37) % 5) * 18 + l * 25) * s;
      const y = gy + 40 * s - bh - l * 10 * s;
      g.fillRect(x, y, 150 * s, bh + 200 * s);
      g.beginPath();
      g.moveTo(x - 20 * s, y);
      g.lineTo(x + 75 * s, y - 40 * s);
      g.lineTo(x + 170 * s, y);
      g.fill();
    }
  }
  if (t > 3.5) {
    g.shadowColor = '#f22';
    g.shadowBlur = 12;
    g.fillStyle = '#ff2a2a';
    const n = Math.min(7, Math.floor((t - 3.5) * 2));
    for (let i = 0; i < n; i++) {
      const x = ((i * 230 * s + 600 * s - t * 90 * s) % (w + 120)) + (t * 90 * s > 0 ? 0 : 0);
      const xx = ((x % (w + 120)) + (w + 120)) % (w + 120) - 60;
      const y = gy - (50 + (i % 3) * 30) * s;
      const bl = Math.sin(t * 3 + i) > 0.92 ? 0 : 1;
      g.fillRect(xx, y, 8 * s, 5 * s * bl);
      g.fillRect(xx + 18 * s, y, 8 * s, 5 * s * bl);
    }
    g.shadowBlur = 0;
  }
  if (t > 3.5) {
    for (let i = 0; i < 5; i++) {
      const x = (((t - 3.5) * 700 * s + i * 260 * s) % (w + 300)) - 150;
      const y = h * 0.2 + i * 52 * s;
      g.strokeStyle = 'rgba(220,235,255,.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(w - x + 60, y);
      g.lineTo(w - x, y);
      g.stroke();
      g.save();
      g.translate(w - x, y);
      g.rotate(-t * 20);
      g.fillStyle = '#dfe6f0';
      g.beginPath();
      for (let j = 0; j < 8; j++) {
        const an = (j * Math.PI) / 4;
        const r = (j % 2 ? 4 : 11) * s;
        g.lineTo(Math.cos(an) * r, Math.sin(an) * r);
      }
      g.fill();
      g.restore();
    }
  }
  const px = w * (0.08 + 0.7 * clamp((t - 0.3) / 8));
  const jh = Math.abs(Math.sin(t * 2.2)) * 90 * s;
  const py = gy - 20 * s - jh;
  ninja(g, px, py, 1.7 * s, t * 14, jh > 8 * s);
  if (t > 7 && t < 7.8) {
    const p = (t - 7) / 0.8;
    g.strokeStyle = `rgba(255,255,255,${1 - p * 0.6})`;
    g.lineWidth = 12 * s * (1 - p * 0.5);
    g.beginPath();
    g.arc(px + 40 * s, py - 90 * s, 120 * s, -1.5 + p * 0.8, -0.5 + p * 1.6);
    g.stroke();
  }
  if (t > 4.9 && t < 5.15) {
    g.fillStyle = `rgba(255,255,255,${(5.15 - t) * 3.5})`;
    g.fillRect(0, 0, w, h);
  }
  const bar = h * 0.1 * clamp(t);
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, bar);
  g.fillRect(0, h - bar, w, bar);
  g.textAlign = 'center';
  const caps: [number, number, string][] = [
    [0.6, 3.4, 'Night falls over the village...'],
    [3.6, 6.6, 'The Shadow Clan rises.'],
    [6.8, 8.6, 'One lone ninja stands against them.'],
  ];
  for (const [a, b, txt] of caps) {
    if (t > a && t < b) {
      g.globalAlpha = Math.min(1, (t - a) / 0.5, (b - t) / 0.5);
      g.fillStyle = '#fff';
      g.font = `italic ${28 * s}px Georgia, serif`;
      g.fillText(txt, w / 2, h - bar - 24 * s);
      g.globalAlpha = 1;
    }
  }
  if (t > 8.8) {
    const q = clamp((t - 8.8) / 0.4);
    const sc = 2.2 - 1.2 * q;
    g.save();
    g.translate(w / 2, h * 0.42);
    g.scale(sc, sc);
    g.globalAlpha = q;
    g.lineJoin = 'round';
    g.lineWidth = 10 * s;
    g.font = `900 ${68 * s}px system-ui, sans-serif`;
    g.strokeStyle = '#3a0a1a';
    g.strokeText('KAGE RUSH', 0, 0);
    g.fillStyle = '#ffd23a';
    g.fillText('KAGE RUSH', 0, 0);
    g.font = `900 ${42 * s}px system-ui, sans-serif`;
    g.strokeText(': Ninja Survival', 0, 58 * s);
    g.fillStyle = '#ff4a5a';
    g.fillText(': Ninja Survival', 0, 58 * s);
    g.restore();
    g.globalAlpha = 1;
  }
  g.textAlign = 'right';
  g.font = `${13 * s + 3}px system-ui, sans-serif`;
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.fillText('Tap or press any key to skip', w - 14, h - bar / 2 + 4);
  g.textAlign = 'left';
}

export default function Intro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cb = useRef(onDone);
  cb.current = onDone;
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    const fit = () => {
      c.width = innerWidth;
      c.height = innerHeight;
    };
    fit();
    let raf = 0;
    let fin = false;
    const t0 = performance.now();
    const finish = () => {
      if (!fin) {
        fin = true;
        cb.current();
      }
    };
    const loop = (n: number) => {
      const t = (n - t0) / 1000;
      draw(g, c.width, c.height, t);
      if (t > 12) finish();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    addEventListener('resize', fit);
    addEventListener('keydown', finish);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', fit);
      removeEventListener('keydown', finish);
    };
  }, []);
  return <canvas ref={ref} onPointerDown={() => cb.current()} className="absolute inset-0 z-50 h-full w-full cursor-pointer bg-black" />;
}
