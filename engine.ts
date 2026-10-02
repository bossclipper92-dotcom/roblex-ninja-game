import * as THREE from 'three';
import { ACCENT, buildFoe, buildHero, type EType, type PlayerRig } from './models';

export interface HudState {
  hp: number;
  maxHp: number;
  stamina: number;
  ki: number;
  wave: number;
  left: number;
  score: number;
  best: number;
  time: number;
  combo: number;
  kills: number;
  boss: { hp: number; max: number; name: string } | null;
  cdQ: number;
  cdE: number;
  cdR: number;
  guard: boolean;
  mist: number;
  buffs: string[];
  hurt: number;
  flash: number;
  banner: { text: string; sub: string; id: number };
  toast: { text: string; id: number };
  over: boolean;
  paused: boolean;
  locked: boolean;
  danger: boolean;
}

const ARENA = 42;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerpAngle = (a: number, b: number, t: number) => {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
};

let actx: AudioContext | null = null;
function tone(f: number, d: number, type: OscillatorType = 'square', v = 0.04, slide = 0) {
  try {
    if (!actx) actx = new AudioContext();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    o.stop(t + d);
  } catch {
    /* audio unavailable */
  }
}

interface Def {
  hp: number;
  speed: number;
  radius: number;
  dmg: number;
  scale: number;
  pts: number;
  armor: boolean;
  name: string;
}
const DEF: Record<EType, Def> = {
  ninja: { hp: 40, speed: 5.4, radius: 0.6, dmg: 9, scale: 1, pts: 100, armor: false, name: 'Shadow Ninja' },
  thrower: { hp: 30, speed: 4.6, radius: 0.6, dmg: 8, scale: 1, pts: 150, armor: false, name: 'Shuriken Ninja' },
  bomber: { hp: 22, speed: 8.2, radius: 0.6, dmg: 28, scale: 1, pts: 150, armor: false, name: 'Bomb Ninja' },
  brute: { hp: 180, speed: 3.1, radius: 1.1, dmg: 26, scale: 1.5, pts: 400, armor: true, name: 'Oni Brute' },
  boss: { hp: 700, speed: 4.2, radius: 2.0, dmg: 35, scale: 2.3, pts: 3000, armor: true, name: 'SHADOW SHOGUN' },
};

type EState = 'chase' | 'wind' | 'recover' | 'stun' | 'charge';

interface Enemy {
  type: EType;
  def: Def;
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armR: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  hp: number;
  max: number;
  dmg: number;
  speed: number;
  state: EState;
  atk: string;
  t: number;
  cd: number;
  vel: THREE.Vector3;
  hitFlash: number;
  glow: boolean;
  dead: boolean;
  tele: THREE.Mesh | null;
  bar: THREE.Group | null;
  barFg: THREE.Mesh | null;
  armT: number;
  walk: number;
  dir: number;
  chargeDir: THREE.Vector3;
  chargeHit: boolean;
}

interface Proj {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  dmg: number;
  life: number;
  owner: 'enemy' | 'player';
  fire: boolean;
}
interface Part {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size: number;
}
interface Fx {
  obj: THREE.Object3D;
  mat: THREE.MeshBasicMaterial;
  geo: THREE.BufferGeometry | null;
  life: number;
  max: number;
  s0: number;
  s1: number;
  op: number;
}
interface Meteor {
  x: number;
  z: number;
  r: number;
  t: number;
  delay: number;
  tele: THREE.Mesh;
  ball: THREE.Mesh;
}
interface Spike {
  x: number;
  z: number;
  off: number;
  plate: THREE.Mesh;
  spikes: THREE.Group;
  hitP: boolean;
  hitE: Set<Enemy>;
  lastPhase: number;
}
type PType = 'heal' | 'sake' | 'ki' | 'shield';
interface Pickup {
  type: PType;
  obj: THREE.Group;
  t: number;
  life: number;
}

export class Game {
  private container: HTMLElement;
  private onHud: (h: HudState) => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raf = 0;
  private last = 0;
  private disposed = false;
  private keys = new Set<string>();
  private lmb = false;
  private rmb = false;
  private locked = false;
  private yaw = 0;
  private pitch = 0.5;
  private shake = 0;
  private hitstop = 0;
  private time = 0;
  private paused = false;
  private over = false;
  private hudT = 0;
  private hurtFlash = 0;
  private ultFlash = 0;

  private pm: PlayerRig;
  private p = {
    pos: new THREE.Vector3(0, 0, 0),
    vy: 0,
    face: 0,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    ki: 30,
    imp: new THREE.Vector3(),
    atkCd: 0,
    comboT: 0,
    step: 0,
    swing: 0,
    swingStep: 0,
    invuln: 0,
    guard: false,
    guardT: 0,
    cdQ: 0,
    cdE: 0,
    cdR: 0,
    qT: 0,
    qDir: new THREE.Vector3(),
    qHit: new Set<Enemy>(),
    eAir: false,
    eFall: false,
    ultT: 0,
    ultTick: 0,
    dmgMul: 1,
    speedMul: 1,
    kiMul: 1,
    regenMul: 1,
    speedBuff: 0,
    shield: 0,
    walk: 0,
    dead: false,
  };

  private enemies: Enemy[] = [];
  private projs: Proj[] = [];
  private parts: Part[] = [];
  private fxs: Fx[] = [];
  private meteors: Meteor[] = [];
  private spikes: Spike[] = [];
  private pickups: Pickup[] = [];
  private queue: EType[] = [];
  private boss: Enemy | null = null;

  private wave = 0;
  private waveState: 'intermission' | 'fight' = 'intermission';
  private waveT = 3;
  private spawnT = 0;
  private meteorT = 4;
  private pickupT = 8;
  private kills = 0;
  private score = 0;
  private best = 0;
  private combo = 0;
  private comboReset = 0;
  private bannerS = { text: '', sub: '', id: 0 };
  private toastS = { text: '', id: 0 };
  private onOver: () => void;

  private light!: THREE.DirectionalLight;
  private mist!: THREE.Mesh;
  private mistRing!: THREE.Mesh;
  private petals!: THREE.Points;
  private circleGeo = new THREE.CircleGeometry(1, 40);
  private partGeo = new THREE.BoxGeometry(1, 1, 1);
  private partMats = new Map<number, THREE.MeshBasicMaterial>();
  private shurGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.06, 4);
  private shurMat = new THREE.MeshStandardMaterial({ color: 0xbbbbcc, metalness: 0.9, roughness: 0.2, emissive: 0x222244 });
  private fireGeo = new THREE.SphereGeometry(0.5, 12, 10);
  private fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
  private glowGeo = new THREE.SphereGeometry(0.9, 12, 10);
  private glowMat = new THREE.MeshBasicMaterial({ color: 0xff3a00, transparent: true, opacity: 0.35, depthWrite: false });

  private handlers: Array<[EventTarget, string, EventListener]> = [];

  constructor(container: HTMLElement, onHud: (h: HudState) => void, onOver: () => void) {
    this.container = container;
    this.onHud = onHud;
    this.onOver = onOver;
    try {
      this.best = Number(localStorage.getItem('kagerush_best') || 0);
    } catch {
      this.best = 0;
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 500);

    this.buildWorld();
    this.pm = buildHero();
    this.scene.add(this.pm.outer);
    this.bindInput();
    this.banner('SURVIVE', 'Wave 1 begins soon...');
    this.emitHud();
  }

  /* ---------------------------------------------------------------- world */

  private buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x0b1030);
    s.fog = new THREE.Fog(0x0b1030, 40, 150);

    s.add(new THREE.HemisphereLight(0x8899ff, 0x221122, 0.9));
    this.light = new THREE.DirectionalLight(0xbfd0ff, 1.7);
    this.light.position.set(20, 35, 10);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1536, 1536);
    const sc = this.light.shadow.camera;
    sc.left = -32;
    sc.right = 32;
    sc.top = 32;
    sc.bottom = -32;
    sc.near = 1;
    sc.far = 100;
    s.add(this.light);
    s.add(this.light.target);

    // arena floor texture
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#2b2b36';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(${rand(0, 255) > 128 ? 255 : 0},${rand(0, 255) > 128 ? 255 : 0},255,0.03)`;
      c.fillRect(rand(0, 256), rand(0, 256), rand(1, 6), rand(1, 6));
    }
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.lineWidth = 3;
    c.strokeRect(0, 0, 256, 256);
    c.strokeRect(0, 0, 128, 128);
    c.strokeRect(128, 128, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    tex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    const outer = new THREE.Mesh(new THREE.CircleGeometry(220, 48), new THREE.MeshStandardMaterial({ color: 0x0c1a14, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.05;
    s.add(outer);

    const edge = new THREE.Mesh(new THREE.RingGeometry(ARENA - 0.8, ARENA, 64), new THREE.MeshBasicMaterial({ color: 0x8a1818 }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.03;
    s.add(edge);
    const emblem = new THREE.Mesh(new THREE.RingGeometry(5.5, 6, 48), new THREE.MeshBasicMaterial({ color: 0xaa2233, transparent: true, opacity: 0.6 }));
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.y = 0.03;
    s.add(emblem);

    // torii gates
    const red = new THREE.MeshStandardMaterial({ color: 0xc41e1e, roughness: 0.6 });
    const blk = new THREE.MeshStandardMaterial({ color: 0x151515 });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const g = new THREE.Group();
      for (const x of [-4.5, 4.5]) {
        const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 9, 10), red);
        pl.position.set(x, 4.5, 0);
        pl.castShadow = true;
        g.add(pl);
      }
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(13, 0.8, 1), blk);
      b1.position.y = 9.2;
      g.add(b1);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.6, 0.8), red);
      b2.position.y = 7.6;
      g.add(b2);
      g.position.set(Math.sin(a) * (ARENA + 3), 0, Math.cos(a) * (ARENA + 3));
      g.rotation.y = a;
      s.add(g);
    }

    // stone lanterns around the arena
    const stone = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 1 });
    const lamp = new THREE.MeshBasicMaterial({ color: 0xffb060 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + 0.13;
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), stone);
      base.position.y = 0.8;
      base.castShadow = true;
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), lamp);
      top.position.y = 1.9;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 4), stone);
      cap.position.y = 2.45;
      cap.rotation.y = Math.PI / 4;
      g.add(base, top, cap);
      g.position.set(Math.sin(a) * (ARENA + 0.8), 0, Math.cos(a) * (ARENA + 0.8));
      s.add(g);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const pl = new THREE.PointLight(0xff8833, 220, 45, 2);
      pl.position.set(Math.sin(a) * (ARENA - 2), 4, Math.cos(a) * (ARENA - 2));
      s.add(pl);
    }

    // bamboo forest
    const bam = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8 });
    const bg = new THREE.CylinderGeometry(0.16, 0.2, 18, 5);
    for (let i = 0; i < 170; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(ARENA + 7, ARENA + 45);
      const m = new THREE.Mesh(bg, bam);
      m.position.set(Math.sin(a) * r, 9, Math.cos(a) * r);
      s.add(m);
    }

    // moon + stars
    const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff2d0, fog: false }));
    moon.position.set(-120, 110, -200);
    s.add(moon);
    const sp = new Float32Array(900);
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = rand(0.15, 1.4);
      sp[i * 3] = Math.cos(a) * Math.cos(e) * 400;
      sp[i * 3 + 1] = Math.sin(e) * 400;
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 400;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));

    // sakura petals
    const pp = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      pp[i * 3] = rand(-50, 50);
      pp[i * 3 + 1] = rand(0, 20);
      pp[i * 3 + 2] = rand(-50, 50);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    this.petals = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffb3d1, size: 0.3 }));
    s.add(this.petals);

    // oni mist (shrinking death zone)
    this.mist = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 16, 64, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9b30ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.mist.position.y = 8;
    s.add(this.mist);
    this.mistRing = new THREE.Mesh(
      new THREE.RingGeometry(1, 3, 64),
      new THREE.MeshBasicMaterial({ color: 0x7a1fd0, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.mistRing.rotation.x = -Math.PI / 2;
    this.mistRing.position.y = 0.05;
    s.add(this.mistRing);

    // spike traps
    const plateMat = () => new THREE.MeshBasicMaterial({ color: 0x553322, transparent: true, opacity: 0.6 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xcfd3dd, metalness: 0.8, roughness: 0.3 });
    const placed: Array<[number, number]> = [];
    let tries = 0;
    while (placed.length < 9 && tries++ < 200) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(9, ARENA - 6);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 9)) continue;
      placed.push([x, z]);
      const plate = new THREE.Mesh(new THREE.CircleGeometry(2.2, 6), plateMat());
      plate.rotation.x = -Math.PI / 2;
      plate.position.set(x, 0.04, z);
      s.add(plate);
      const sg2 = new THREE.Group();
      for (let k = 0; k < 13; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.4, 5), spikeMat);
        const ang = (k / 13) * Math.PI * 2;
        const rr = k === 0 ? 0 : 1.4;
        cone.position.set(Math.cos(ang) * rr, 0.7, Math.sin(ang) * rr);
        sg2.add(cone);
      }
      sg2.position.set(x, -1.6, z);
      s.add(sg2);
      this.spikes.push({ x, z, off: rand(0, 4), plate, spikes: sg2, hitP: false, hitE: new Set(), lastPhase: 0 });
    }
  }

  /* ---------------------------------------------------------------- input */

  private on(t: EventTarget, ev: string, fn: (e: any) => void) {
    t.addEventListener(ev, fn as EventListener);
    this.handlers.push([t, ev, fn as EventListener]);
  }

  private bindInput() {
    const cv = this.renderer.domElement;
    this.on(window, 'keydown', (e: KeyboardEvent) => {
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.over) return;
      if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
      if (this.paused) return;
      switch (e.code) {
        case 'Space':
          this.jump();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.dash();
          break;
        case 'KeyJ':
          this.attack();
          break;
        case 'KeyQ':
          this.skillQ();
          break;
        case 'KeyE':
          this.skillE();
          break;
        case 'KeyR':
          this.skillR();
          break;
      }
    });
    this.on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    this.on(cv, 'contextmenu', (e: Event) => e.preventDefault());
    this.on(cv, 'mousedown', (e: MouseEvent) => {
      if (this.over || this.paused) return;
      if (!this.locked) {
        try {
          const r = cv.requestPointerLock() as unknown;
          if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => undefined);
        } catch {
          /* ignore */
        }
      }
      if (e.button === 0) {
        this.lmb = true;
        this.attack();
      }
      if (e.button === 2) this.rmb = true;
    });
    this.on(window, 'mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2) this.rmb = false;
    });
    this.on(window, 'mousemove', (e: MouseEvent) => {
      if (this.locked || (this.rmb && !this.locked)) {
        this.yaw -= e.movementX * 0.0035;
        this.pitch = clamp(this.pitch + e.movementY * 0.003, 0.12, 1.25);
      }
    });
    this.on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === cv;
    });
    this.on(window, 'blur', () => {
      this.keys.clear();
      this.lmb = this.rmb = false;
    });
    this.on(window, 'resize', () => this.resize());
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
    if (this.paused && document.pointerLockElement) document.exitPointerLock();
    this.emitHud(true);
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        dt = 0;
      }
      if (!this.paused && !this.over) this.update(dt);
      else if (this.over) this.updateDeadAnim(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [t, ev, fn] of this.handlers) t.removeEventListener(ev, fn);
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
  }

  /* -------------------------------------------------------------- helpers */

  private banner(text: string, sub = '') {
    this.bannerS = { text, sub, id: this.bannerS.id + 1 };
  }
  private toast(text: string) {
    this.toastS = { text, id: this.toastS.id + 1 };
  }

  private mistR() {
    return Math.max(14, ARENA - this.time * 0.11);
  }

  private fwd(a: number) {
    return new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  }

  private burst(pos: THREE.Vector3, color: number, n: number, speed = 6, size = 0.18, up = 3) {
    if (this.parts.length > 420) return;
    let mat = this.partMats.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color });
      this.partMats.set(color, mat);
    }
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.partGeo, mat);
      m.position.copy(pos);
      const s = size * rand(0.5, 1.4);
      m.scale.setScalar(s);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = rand(0.3, 1) * speed;
      const life = rand(0.35, 0.8);
      this.parts.push({ mesh: m, vel: new THREE.Vector3(Math.cos(a) * sp, rand(0, up) + 1, Math.sin(a) * sp), life, max: life, size: s });
    }
  }

  private addFx(obj: THREE.Object3D, mat: THREE.MeshBasicMaterial, geo: THREE.BufferGeometry | null, life: number, s0: number, s1: number, op = 0.8) {
    this.scene.add(obj);
    this.fxs.push({ obj, mat, geo, life, max: life, s0, s1, op });
  }

  private arc(x: number, y: number, z: number, face: number, radius: number, len: number, color: number, life = 0.25) {
    const geo = new THREE.RingGeometry(radius * 0.3, radius, 28, 1, -len / 2, len);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.add(m);
    g.position.set(x, y, z);
    g.rotation.y = face - Math.PI / 2;
    this.addFx(g, mat, geo, life, 0.75, 1.15);
  }

  private shock(x: number, z: number, r: number, color: number, life = 0.45) {
    const geo = new THREE.RingGeometry(0.85, 1, 48);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.15, z);
    this.addFx(m, mat, geo, life, 0.3, r, 0.9);
  }

  private tele(x: number, z: number, r: number, color = 0xff2222) {
    const m = new THREE.Mesh(
      this.circleGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.07, z);
    m.scale.set(r, r, r);
    this.scene.add(m);
    return m;
  }
  private rmTele(m: THREE.Mesh | null) {
    if (!m) return;
    this.scene.remove(m);
    (m.material as THREE.Material).dispose();
  }

  private explosion(pos: THREE.Vector3, r: number) {
    this.burst(pos.clone().setY(0.6), 0xff8a1a, 40, 11, 0.3, 7);
    this.burst(pos.clone().setY(0.6), 0xffee88, 20, 8, 0.2, 6);
    this.burst(pos.clone().setY(0.6), 0x442200, 14, 6, 0.4, 4);
    this.shock(pos.x, pos.z, r, 0xff7722, 0.5);
    this.shake = Math.max(this.shake, 0.5);
    tone(120, 0.35, 'sawtooth', 0.07, -80);
  }

  /* --------------------------------------------------------------- player */

  private jump() {
    const p = this.p;
    if (p.ultT > 0 || p.qT > 0) return;
    if (p.pos.y <= 0.01) {
      p.vy = 10;
      tone(300, 0.12, 'sine', 0.03, 200);
    }
  }

  private dash() {
    const p = this.p;
    if (p.ultT > 0 || p.qT > 0 || p.eAir || p.stamina < 25) return;
    p.stamina -= 25;
    const d = this.inputDir();
    const dir = d.lengthSq() > 0 ? d.normalize() : this.fwd(p.face);
    p.imp.copy(dir).multiplyScalar(36);
    p.invuln = Math.max(p.invuln, 0.32);
    p.face = Math.atan2(dir.x, dir.z);
    this.burst(p.pos.clone().setY(0.5), 0x66ccff, 10, 3, 0.2, 1);
    tone(500, 0.15, 'triangle', 0.04, -300);
  }

  private inputDir() {
    const k = this.keys;
    const ix = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const iz = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    return new THREE.Vector3(fx * iz + rx * ix, 0, fz * iz + rz * ix);
  }

  private nearest(maxD: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxD;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.group.position.x - this.p.pos.x, e.group.position.z - this.p.pos.z) - e.def.radius;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private attack() {
    const p = this.p;
    if (p.dead || p.atkCd > 0 || p.guard || p.ultT > 0 || p.qT > 0 || p.eAir) return;
    p.step = p.comboT > 0 ? (p.step + 1) % 3 : 0;
    p.comboT = 0.9;
    const step = p.step;
    const target = this.nearest(7);
    if (target) p.face = Math.atan2(target.group.position.x - p.pos.x, target.group.position.z - p.pos.z);
    const range = [3.4, 3.4, 4.6][step];
    const arcLen = [2.3, 2.3, 3.6][step];
    const dmg = [22, 24, 40][step] * p.dmgMul;
    p.atkCd = step === 2 ? 0.46 : 0.3;
    p.swing = 0.28;
    p.swingStep = step;
    const f = this.fwd(p.face);
    p.imp.addScaledVector(f, step === 2 ? 10 : 6);
    this.arc(p.pos.x, 0.9 + step * 0.25, p.pos.z, p.face, range, arcLen, step === 2 ? 0xffdd66 : 0x88ddff, 0.26);
    tone(650 - step * 100, 0.12, 'sawtooth', 0.035, -350);

    let hit = false;
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      const dx = e.group.position.x - p.pos.x;
      const dz = e.group.position.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d - e.def.radius > range) continue;
      const diff = Math.abs(((Math.atan2(dx, dz) - p.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > arcLen / 2 + 0.2 && d > e.def.radius + 0.8) continue;
      hit = true;
      this.hitEnemy(e, dmg, new THREE.Vector3(dx / d, 0, dz / d), step === 2 ? 14 : 6, step === 2 ? 0.55 : 0.28, step === 2);
    }
    if (hit) {
      this.hitstop = step === 2 ? 0.07 : 0.035;
      this.shake = Math.max(this.shake, step === 2 ? 0.35 : 0.15);
    }
  }

  private skillQ() {
    const p = this.p;
    if (p.dead || p.cdQ > 0 || p.ki < 15 || p.ultT > 0 || p.qT > 0 || p.eAir) return;
    p.ki -= 15;
    p.cdQ = 1.5;
    const target = this.nearest(14);
    if (target) p.face = Math.atan2(target.group.position.x - p.pos.x, target.group.position.z - p.pos.z);
    p.qDir.copy(this.fwd(p.face));
    p.qT = 0.22;
    p.qHit.clear();
    p.invuln = Math.max(p.invuln, 0.3);
    this.arc(p.pos.x, 1.2, p.pos.z, p.face, 5.5, 2.6, 0xffffff, 0.35);
    this.banner('抜刀術', 'BATTŌJUTSU');
    tone(900, 0.2, 'sawtooth', 0.05, -700);
  }

  private skillE() {
    const p = this.p;
    if (p.dead || p.cdE > 0 || p.ki < 30 || p.ultT > 0 || p.qT > 0 || p.eAir) return;
    p.ki -= 30;
    p.cdE = 3.5;
    p.vy = 17;
    p.eAir = true;
    p.eFall = false;
    p.invuln = Math.max(p.invuln, 0.4);
    this.banner('龍槌閃', 'RYŪTSUISEN');
    tone(200, 0.3, 'triangle', 0.05, 400);
  }

  private skillR() {
    const p = this.p;
    if (p.dead || p.ki < 100 || p.ultT > 0 || p.qT > 0 || p.eAir) return;
    p.ki = 0;
    p.ultT = 1.5;
    p.ultTick = 0;
    p.invuln = 1.6;
    this.ultFlash = 1;
    this.banner('九牙嵐', 'NINE FANG STORM');
    tone(150, 0.6, 'sawtooth', 0.07, 500);
  }

  private hurtPlayer(dmg: number, src: THREE.Vector3, attacker: Enemy | null = null, unblockable = false): 'hit' | 'parry' | 'block' | 'none' {
    const p = this.p;
    if (p.dead || p.invuln > 0 || p.shield > 0) return 'none';
    if (p.guard && !unblockable) {
      const dx = src.x - p.pos.x;
      const dz = src.z - p.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const f = this.fwd(p.face);
      if (f.x * (dx / d) + f.z * (dz / d) > 0) {
        if (p.guardT < 0.25) {
          p.ki = Math.min(100, p.ki + 14 * p.kiMul);
          p.invuln = 0.35;
          this.burst(new THREE.Vector3(p.pos.x + f.x, 1.5, p.pos.z + f.z), 0xffffff, 18, 7, 0.16, 4);
          this.shock(p.pos.x + f.x, p.pos.z + f.z, 2.5, 0xffffff, 0.3);
          if (attacker && !attacker.dead) {
            attacker.state = 'stun';
            attacker.t = attacker.def.armor ? 0.9 : 1.6;
            attacker.vel.set(-dx / d, 0, -dz / d).multiplyScalar(-8);
            this.rmTele(attacker.tele);
            attacker.tele = null;
            attacker.glow = false;
          }
          this.hitstop = 0.1;
          this.toast('PARRY!  +Ki');
          tone(1200, 0.2, 'triangle', 0.06, 600);
          return 'parry';
        }
        const cost = dmg * 1.3;
        if (p.stamina >= cost) {
          p.stamina -= cost;
          p.invuln = 0.15;
          this.burst(new THREE.Vector3(p.pos.x + f.x, 1.5, p.pos.z + f.z), 0x88ddff, 8, 5, 0.14, 3);
          tone(300, 0.1, 'square', 0.05, -100);
          return 'block';
        }
        p.stamina = 0;
        p.guard = false;
        this.toast('GUARD BROKEN!');
      }
    }
    p.hp -= dmg;
    p.invuln = 0.5;
    this.hurtFlash = 1;
    this.combo = 0;
    this.shake = Math.max(this.shake, 0.45);
    this.burst(p.pos.clone().setY(1.4), 0xcc1122, 12, 5, 0.18, 4);
    tone(110, 0.25, 'sawtooth', 0.07, -50);
    if (p.hp <= 0) this.die();
    return 'hit';
  }

  private die() {
    const p = this.p;
    p.hp = 0;
    p.dead = true;
    this.over = true;
    if (this.score > this.best) {
      this.best = Math.floor(this.score);
      try {
        localStorage.setItem('kagerush_best', String(this.best));
      } catch {
        /* ignore */
      }
    }
    if (document.pointerLockElement) document.exitPointerLock();
    this.banner('YOU FELL', 'The ronin rests...');
    this.emitHud(true);
    this.onOver();
  }

  private updateDeadAnim(dt: number) {
    const m = this.pm;
    m.inner.rotation.x = lerp(m.inner.rotation.x, -Math.PI / 2, Math.min(1, dt * 5));
    m.inner.position.y = lerp(m.inner.position.y, 0.4, Math.min(1, dt * 5));
    m.bubble.visible = false;
    m.guardFx.visible = false;
  }

  private updatePlayer(dt: number) {
    const p = this.p;
    const m = this.pm;
    p.atkCd -= dt;
    p.comboT -= dt;
    p.invuln -= dt;
    p.cdQ -= dt;
    p.cdE -= dt;
    p.cdR -= dt;
    p.swing -= dt;
    p.speedBuff -= dt;
    p.shield -= dt;

    // guard
    const wantGuard = (this.keys.has('KeyK') || this.rmb) && p.ultT <= 0 && p.qT <= 0 && !p.eAir && p.swing <= 0;
    if (wantGuard && !p.guard) p.guardT = 0;
    p.guard = wantGuard && p.stamina > 0;
    if (p.guard) p.guardT += dt;

    // camera keys
    if (this.keys.has('ArrowLeft')) this.yaw += 2.2 * dt;
    if (this.keys.has('ArrowRight')) this.yaw -= 2.2 * dt;
    if (this.keys.has('ArrowUp')) this.pitch = clamp(this.pitch - 1.2 * dt, 0.12, 1.25);
    if (this.keys.has('ArrowDown')) this.pitch = clamp(this.pitch + 1.2 * dt, 0.12, 1.25);

    if (this.lmb) this.attack();

    // movement
    const dir = this.inputDir();
    const moving = dir.lengthSq() > 0.01 && p.ultT <= 0 && p.qT <= 0;
    if (moving) dir.normalize();
    const spd = 8.2 * p.speedMul * (p.speedBuff > 0 ? 1.4 : 1) * (p.guard ? 0.5 : 1) * (p.swing > 0 ? 0.55 : 1);
    if (moving) {
      p.pos.x += dir.x * spd * dt;
      p.pos.z += dir.z * spd * dt;
      if (p.guard) {
        p.face = lerpAngle(p.face, Math.atan2(-Math.sin(this.yaw), -Math.cos(this.yaw)), Math.min(1, 14 * dt));
      } else if (p.swing <= 0) {
        p.face = lerpAngle(p.face, Math.atan2(dir.x, dir.z), Math.min(1, 16 * dt));
      }
      p.walk += dt * spd * 1.3;
    } else if (p.guard) {
      p.face = lerpAngle(p.face, Math.atan2(-Math.sin(this.yaw), -Math.cos(this.yaw)), Math.min(1, 14 * dt));
    }
    p.pos.x += p.imp.x * dt;
    p.pos.z += p.imp.z * dt;
    p.imp.multiplyScalar(Math.exp(-7 * dt));

    // battōjutsu dash
    if (p.qT > 0) {
      p.qT -= dt;
      p.pos.x += p.qDir.x * 44 * dt;
      p.pos.z += p.qDir.z * 44 * dt;
      this.burst(p.pos.clone().setY(1), 0xaaddff, 2, 2, 0.2, 1);
      for (const e of [...this.enemies]) {
        if (e.dead || p.qHit.has(e)) continue;
        if (Math.hypot(e.group.position.x - p.pos.x, e.group.position.z - p.pos.z) < e.def.radius + 1.8) {
          p.qHit.add(e);
          this.hitEnemy(e, 55 * p.dmgMul, p.qDir.clone(), 14, 0.6, true);
          this.hitstop = 0.06;
        }
      }
      if (p.qT <= 0) this.arc(p.pos.x, 1.2, p.pos.z, p.face, 4.5, 3, 0xffffff, 0.3);
    }

    // nine fang ultimate
    if (p.ultT > 0) {
      p.ultT -= dt;
      p.ultTick -= dt;
      if (p.ultTick <= 0) {
        p.ultTick = 0.15;
        const targets = this.enemies.filter(
          (e) => !e.dead && Math.hypot(e.group.position.x - p.pos.x, e.group.position.z - p.pos.z) < 16,
        );
        if (targets.length) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          const a = Math.random() * Math.PI * 2;
          p.pos.x = t.group.position.x + Math.sin(a) * 2.2;
          p.pos.z = t.group.position.z + Math.cos(a) * 2.2;
          p.face = Math.atan2(t.group.position.x - p.pos.x, t.group.position.z - p.pos.z);
          p.swing = 0.15;
          p.swingStep = Math.floor(Math.random() * 3);
        }
        for (const e of targets) {
          if (e.dead) continue;
          const dx = e.group.position.x - p.pos.x;
          const dz = e.group.position.z - p.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          this.hitEnemy(e, 22 * p.dmgMul, new THREE.Vector3(dx / d, 0, dz / d), 3, 0.4, true);
          this.arc(e.group.position.x, 1 + Math.random(), e.group.position.z, Math.random() * 6.28, 2.8, 2.5, Math.random() > 0.5 ? 0xffffff : 0x66ccff, 0.3);
        }
        this.shake = Math.max(this.shake, 0.25);
        tone(700 + Math.random() * 400, 0.1, 'sawtooth', 0.04, -300);
      }
    }

    // vertical
    p.vy -= 28 * dt;
    if (p.eAir && !p.eFall && p.vy < 0) {
      p.eFall = true;
      p.vy = -42;
    }
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      if (p.eAir) {
        p.eAir = false;
        p.eFall = false;
        this.slamLand();
      }
      p.vy = 0;
    }

    // arena clamp
    const r = Math.hypot(p.pos.x, p.pos.z);
    if (r > ARENA - 1) {
      p.pos.x *= (ARENA - 1) / r;
      p.pos.z *= (ARENA - 1) / r;
    }

    // stamina
    if (!p.guard) p.stamina = Math.min(100, p.stamina + 20 * p.regenMul * (p.speedBuff > 0 ? 2 : 1) * dt);
    else p.stamina = Math.min(100, p.stamina + 3 * dt);

    // combo timer
    this.comboReset -= dt;
    if (this.comboReset <= 0) this.combo = 0;

    // oni mist damage
    const mr = this.mistR();
    if (Math.hypot(p.pos.x, p.pos.z) > mr && !p.dead) {
      p.hp -= (5 + this.wave * 0.8) * dt;
      this.hurtFlash = Math.max(this.hurtFlash, 0.35);
      if (p.hp <= 0) this.die();
    }

    // animate model
    m.outer.position.copy(p.pos);
    m.outer.rotation.y = p.face;
    const sw = Math.sin(p.walk) * (moving ? 0.9 : 0);
    m.legL.rotation.x = sw;
    m.legR.rotation.x = -sw;
    m.inner.rotation.x = moving ? 0.1 : 0;
    m.inner.position.y = Math.abs(Math.sin(p.walk)) * (moving ? 0.06 : 0);
    m.ponytail.rotation.x = 0.5 + Math.sin(this.time * 6) * 0.15 + (moving ? 0.3 : 0);
    m.armL.rotation.x = -sw * 0.8;
    m.armL.rotation.z = -0.08;
    if (p.swing > 0) {
      const t = 1 - p.swing / 0.28;
      const e = 1 - Math.pow(1 - t, 3);
      const sgn = p.swingStep === 1 ? -1 : 1;
      m.armR.rotation.x = lerp(-2.9, -0.4, e);
      m.armR.rotation.z = sgn * lerp(0.9, -0.9, e);
      m.sword.rotation.x = 1.25;
      m.inner.rotation.y = sgn * lerp(0.5, -0.6, e);
    } else if (p.guard) {
      m.armR.rotation.x = lerp(m.armR.rotation.x, -1.3, Math.min(1, dt * 20));
      m.armR.rotation.z = lerp(m.armR.rotation.z, 0.6, Math.min(1, dt * 20));
      m.inner.rotation.y = 0;
    } else {
      m.armR.rotation.x = lerp(m.armR.rotation.x, -0.5 + sw * 0.5, Math.min(1, dt * 14));
      m.armR.rotation.z = lerp(m.armR.rotation.z, 0.05, Math.min(1, dt * 14));
      m.inner.rotation.y = lerp(m.inner.rotation.y, 0, Math.min(1, dt * 14));
    }
    if (p.eAir) {
      m.armR.rotation.x = -3.0;
      m.armL.rotation.x = -2.6;
      m.inner.rotation.x = p.eFall ? 0.5 : -0.2;
    }
    if (p.qT > 0) {
      m.armR.rotation.x = -1.5;
      m.inner.rotation.x = 0.5;
    }
    m.guardFx.visible = p.guard;
    if (p.guard) {
      const s = 1 + Math.sin(this.time * 20) * 0.04;
      m.guardFx.scale.set(s, s, 1);
      (m.guardFx.material as THREE.MeshBasicMaterial).opacity = p.guardT < 0.25 ? 0.8 : 0.3;
    }
    m.bubble.visible = p.shield > 0;
    m.bubble.rotation.y += dt * 2;
    m.outer.visible = p.invuln > 0 && p.invuln < 0.5 && p.shield <= 0 && p.qT <= 0 && p.ultT <= 0 ? Math.floor(this.time * 30) % 2 === 0 : true;
    if (p.ultT > 0) m.outer.visible = Math.floor(this.time * 40) % 3 !== 0;
  }

  private slamLand() {
    const p = this.p;
    const r = 8;
    this.shock(p.pos.x, p.pos.z, r, 0xffcc44, 0.55);
    this.shock(p.pos.x, p.pos.z, r * 0.6, 0xffffff, 0.35);
    this.burst(p.pos.clone().setY(0.4), 0xffcc66, 36, 12, 0.25, 6);
    this.burst(p.pos.clone().setY(0.4), 0x886644, 24, 8, 0.35, 4);
    this.shake = 0.9;
    this.hitstop = 0.1;
    tone(90, 0.4, 'sawtooth', 0.08, -50);
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      const dx = e.group.position.x - p.pos.x;
      const dz = e.group.position.z - p.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < r + e.def.radius) {
        this.hitEnemy(e, 75 * p.dmgMul, new THREE.Vector3(dx / d, 0, dz / d), 18, 1.2, true);
      }
    }
  }

  /* -------------------------------------------------------------- enemies */

  private spawnEnemy(type: EType) {
    const def = DEF[type];
    const hpMul = 1 + 0.1 * (this.wave - 1);
    const mats: THREE.MeshStandardMaterial[] = [];
    const rig = buildFoe(type, mats);
    const g = rig.group;
    g.scale.setScalar(def.scale);
    const mr = this.mistR();
    let x = 0;
    let z = 0;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(Math.max(12, mr * 0.6), Math.max(14, mr - 2));
      x = Math.sin(a) * r;
      z = Math.cos(a) * r;
      if (Math.hypot(x - this.p.pos.x, z - this.p.pos.z) > 16) break;
    }
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(this.p.pos.x - x, this.p.pos.z - z);
    this.scene.add(g);

    let bar: THREE.Group | null = null;
    let barFg: THREE.Mesh | null = null;
    if (type !== 'boss') {
      bar = new THREE.Group();
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7, depthTest: false }));
      const fgGeo = new THREE.PlaneGeometry(1.2, 0.09);
      fgGeo.translate(0.6, 0, 0);
      barFg = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: type === 'brute' ? 0xffaa22 : 0xff3344, depthTest: false }));
      barFg.position.set(-0.6, 0, 0.01);
      bg.renderOrder = 10;
      barFg.renderOrder = 11;
      bar.add(bg, barFg);
      this.scene.add(bar);
    }
    const hp = def.hp * hpMul * (type === 'boss' ? 1 + this.wave * 0.12 : 1);
    const e: Enemy = {
      type,
      def,
      group: g,
      legL: rig.legL,
      legR: rig.legR,
      armR: rig.armR,
      mats,
      hp,
      max: hp,
      dmg: def.dmg * (1 + 0.04 * this.wave),
      speed: def.speed * (1 + Math.min(0.35, this.wave * 0.02)),
      state: 'chase',
      atk: '',
      t: 0,
      cd: rand(0.5, 2),
      vel: new THREE.Vector3(),
      hitFlash: 0,
      glow: false,
      dead: false,
      tele: null,
      bar,
      barFg,
      armT: -0.4,
      walk: Math.random() * 6,
      dir: Math.random() > 0.5 ? 1 : -1,
      chargeDir: new THREE.Vector3(),
      chargeHit: false,
    };
    this.enemies.push(e);
    this.burst(new THREE.Vector3(x, 0.5, z), ACCENT(type), 14, 4, 0.2, 5);
    if (type === 'boss') {
      this.boss = e;
      (this.scene.background as THREE.Color).setHex(0x2a0510);
      (this.scene.fog as THREE.Fog).color.setHex(0x2a0510);
    }
    return e;
  }

  private killEnemy(e: Enemy) {
    e.dead = true;
    this.scene.remove(e.group);
    if (e.bar) this.scene.remove(e.bar);
    this.rmTele(e.tele);
    e.tele = null;
    const pos = e.group.position.clone().setY(1.2);
    this.burst(pos, ACCENT(e.type), e.type === 'boss' ? 80 : 22, 8, 0.25, 6);
    this.burst(pos, 0xffffff, 8, 6, 0.15, 5);
    this.kills++;
    const mult = 1 + Math.floor(this.combo / 10) * 0.25;
    this.score += Math.round(e.def.pts * mult);
    tone(180, 0.2, 'square', 0.05, -100);
    if (e.type === 'boss') {
      this.boss = null;
      (this.scene.background as THREE.Color).setHex(0x0b1030);
      (this.scene.fog as THREE.Fog).color.setHex(0x0b1030);
      this.banner('SHADOW SHOGUN DEFEATED', 'The night grows quiet...');
      this.p.hp = this.p.maxHp;
      this.p.ki = 100;
      this.shake = 1;
      for (let i = 0; i < 3; i++) this.spawnPickup(['heal', 'ki', 'shield'][i] as PType, e.group.position.x + rand(-4, 4), e.group.position.z + rand(-4, 4));
    } else if (Math.random() < 0.13) {
      this.spawnPickup(['heal', 'sake', 'ki', 'shield'][Math.floor(Math.random() * 4)] as PType, e.group.position.x, e.group.position.z);
    }
  }

  private hitEnemy(e: Enemy, dmg: number, dir: THREE.Vector3, kb: number, stun: number, heavy: boolean) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitFlash = 0.15;
    const armored = e.def.armor && !heavy;
    e.vel.x += dir.x * kb * (armored ? 0.2 : e.type === 'boss' ? 0.15 : 1);
    e.vel.z += dir.z * kb * (armored ? 0.2 : e.type === 'boss' ? 0.15 : 1);
    if (stun > 0 && !armored) {
      e.state = 'stun';
      e.t = e.type === 'boss' ? Math.min(stun, 0.6) : stun;
      this.rmTele(e.tele);
      e.tele = null;
      e.glow = false;
    }
    this.burst(e.group.position.clone().setY(1.3), 0xff3344, 8, 5, 0.15, 4);
    this.burst(e.group.position.clone().setY(1.3), 0xffffff, 3, 6, 0.1, 3);
    this.p.ki = Math.min(100, this.p.ki + 4 * this.p.kiMul);
    this.combo++;
    this.comboReset = 3;
    this.score += 5;
    tone(260, 0.07, 'square', 0.04, -120);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private shoot(from: THREE.Vector3, dir: THREE.Vector3, speed: number, dmg: number, fire: boolean, owner: 'enemy' | 'player' = 'enemy') {
    let mesh: THREE.Object3D;
    if (fire) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.fireGeo, this.fireMat));
      g.add(new THREE.Mesh(this.glowGeo, this.glowMat));
      mesh = g;
    } else {
      mesh = new THREE.Mesh(this.shurGeo, this.shurMat);
    }
    mesh.position.set(from.x, 1.4, from.z);
    this.scene.add(mesh);
    this.projs.push({ mesh, vel: dir.clone().setY(0).normalize().multiplyScalar(speed), dmg, life: 4, owner, fire });
  }

  private updateEnemy(e: Enemy, dt: number) {
    const p = this.p;
    const g = e.group;
    const dx = p.pos.x - g.position.x;
    const dz = p.pos.z - g.position.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const nx = dx / dist;
    const nz = dz / dist;
    g.position.x += e.vel.x * dt;
    g.position.z += e.vel.z * dt;
    e.vel.multiplyScalar(Math.exp(-7 * dt));
    e.t -= dt;
    e.cd -= dt;
    e.hitFlash -= dt;
    let moving = false;
    const turn = (ax: number, az: number, k = 10) => {
      g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(ax, az), Math.min(1, k * dt));
    };
    const move = (ax: number, az: number, sp: number) => {
      g.position.x += ax * sp * dt;
      g.position.z += az * sp * dt;
      moving = true;
    };
    const teleOn = (r: number) => {
      e.tele = this.tele(g.position.x, g.position.z, r, 0xff2222);
    };
    e.armT = -0.4;

    if (e.state === 'stun') {
      e.armT = 0.4;
      if (e.t <= 0) {
        e.state = 'chase';
        e.cd = Math.max(e.cd, 0.4);
      }
    } else {
      switch (e.type) {
        case 'ninja': {
          if (e.state === 'chase') {
            turn(nx, nz);
            if (dist > 2.1) move(nx, nz, e.speed);
            else if (e.cd <= 0) {
              e.state = 'wind';
              e.t = 0.5;
              e.glow = true;
            }
          } else if (e.state === 'wind') {
            turn(nx, nz, 5);
            e.armT = -2.7;
            if (e.t <= 0) {
              e.glow = false;
              this.arc(g.position.x, 1.1, g.position.z, g.rotation.y, 3, 2, 0xff5555, 0.2);
              if (dist < 3.1) this.hurtPlayer(e.dmg, g.position, e);
              e.state = 'recover';
              e.t = 0.5;
              e.cd = rand(0.7, 1.4);
            }
          } else if (e.state === 'recover') {
            e.armT = -0.2;
            if (e.t <= 0) e.state = 'chase';
          }
          break;
        }
        case 'thrower': {
          turn(nx, nz);
          if (e.state === 'chase') {
            if (dist > 15) move(nx, nz, e.speed);
            else if (dist < 9) move(-nx, -nz, e.speed);
            else move(-nz * e.dir, nx * e.dir, e.speed * 0.7);
            if (e.cd <= 0 && dist < 24) {
              e.state = 'wind';
              e.t = 0.4;
              e.glow = true;
            }
          } else if (e.state === 'wind') {
            e.armT = -2.4;
            if (e.t <= 0) {
              e.glow = false;
              const n = this.wave >= 6 ? 3 : 1;
              const base = new THREE.Vector3(nx, 0, nz);
              for (let i = 0; i < n; i++) {
                const d = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * 0.22);
                this.shoot(g.position, d, 17, e.dmg, false);
              }
              tone(800, 0.08, 'triangle', 0.03, -300);
              e.state = 'chase';
              e.cd = rand(1.8, 3);
              if (Math.random() < 0.3) e.dir *= -1;
            }
          }
          break;
        }
        case 'bomber': {
          if (e.state === 'chase') {
            turn(nx, nz, 14);
            move(nx, nz, e.speed);
            if (dist < 3.4) {
              e.state = 'wind';
              e.t = 0.75;
              e.glow = true;
              teleOn(4.4);
            }
          } else if (e.state === 'wind') {
            e.armT = -2.5;
            if (e.tele) {
              e.tele.position.set(g.position.x, 0.07, g.position.z);
              (e.tele.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.2 * Math.sin(this.time * 40);
            }
            if (e.t <= 0) {
              this.detonate(e);
            }
          }
          break;
        }
        case 'brute': {
          if (e.state === 'chase') {
            turn(nx, nz, 6);
            if (dist > 4) move(nx, nz, e.speed);
            else if (e.cd <= 0) {
              e.state = 'wind';
              e.t = 1.0;
              e.glow = true;
              teleOn(6);
            }
          } else if (e.state === 'wind') {
            e.armT = -2.9;
            turn(nx, nz, 3);
            if (e.tele) e.tele.position.set(g.position.x, 0.07, g.position.z);
            if (e.t <= 0) {
              e.glow = false;
              this.rmTele(e.tele);
              e.tele = null;
              this.shock(g.position.x, g.position.z, 6, 0xff7733, 0.45);
              this.burst(g.position.clone().setY(0.3), 0x775533, 20, 7, 0.3, 4);
              this.shake = Math.max(this.shake, 0.6);
              tone(80, 0.3, 'sawtooth', 0.07, -30);
              if (dist < 6 + 0.3) this.hurtPlayer(e.dmg, g.position, e);
              e.state = 'recover';
              e.t = 1.2;
              e.cd = rand(1.5, 2.5);
            }
          } else if (e.state === 'recover') {
            e.armT = -0.1;
            if (e.t <= 0) e.state = 'chase';
          }
          break;
        }
        case 'boss': {
          this.updateBoss(e, dt, dist, nx, nz, turn, move, teleOn, (v) => (moving = v));
          break;
        }
      }
    }

    // keep inside arena
    const r = Math.hypot(g.position.x, g.position.z);
    if (r > ARENA - 1.5) {
      g.position.x *= (ARENA - 1.5) / r;
      g.position.z *= (ARENA - 1.5) / r;
    }
    // don't overlap player
    const minD = e.def.radius + 0.55;
    if (dist < minD && e.type !== 'bomber') {
      g.position.x -= nx * (minD - dist);
      g.position.z -= nz * (minD - dist);
    }

    // anim
    if (moving) e.walk += dt * e.speed * 1.4;
    const sw = moving ? Math.sin(e.walk) * 0.9 : 0;
    e.legL.rotation.x = sw;
    e.legR.rotation.x = -sw;
    e.armR.rotation.x = lerp(e.armR.rotation.x, e.armT, Math.min(1, dt * 16));

    // flash
    const f = e.hitFlash > 0 ? 0.9 : e.glow ? 0.35 + 0.3 * Math.sin(this.time * 35) : 0;
    for (const m of e.mats) {
      if (f > 0) m.emissive.setRGB(f, f * (e.hitFlash > 0 ? 1 : 0.2), f * (e.hitFlash > 0 ? 1 : 0.2));
      else m.emissive.setHex((m.userData.base as number) || 0);
    }

    // hp bar
    if (e.bar && e.barFg) {
      e.bar.position.set(g.position.x, 3.3 * e.def.scale + 0.2, g.position.z);
      e.bar.quaternion.copy(this.camera.quaternion);
      e.barFg.scale.x = Math.max(0, e.hp / e.max);
    }
  }

  private detonate(e: Enemy) {
    const pos = e.group.position.clone();
    this.explosion(pos, 4.4);
    if (Math.hypot(this.p.pos.x - pos.x, this.p.pos.z - pos.z) < 4.4 && this.p.pos.y < 2) this.hurtPlayer(e.dmg, pos, e, true);
    for (const o of [...this.enemies]) {
      if (o === e || o.dead) continue;
      if (Math.hypot(o.group.position.x - pos.x, o.group.position.z - pos.z) < 4.4) {
        this.hitEnemy(o, 30, new THREE.Vector3(o.group.position.x - pos.x, 0, o.group.position.z - pos.z).normalize(), 10, 0.5, false);
      }
    }
    e.dead = true;
    this.scene.remove(e.group);
    if (e.bar) this.scene.remove(e.bar);
    this.rmTele(e.tele);
    e.tele = null;
  }

  private updateBoss(
    e: Enemy,
    dt: number,
    dist: number,
    nx: number,
    nz: number,
    turn: (ax: number, az: number, k?: number) => void,
    move: (ax: number, az: number, sp: number) => void,
    teleOn: (r: number) => void,
    setMoving: (v: boolean) => void,
  ) {
    const g = e.group;
    void setMoving;
    const rage = e.hp < e.max * 0.5;
    if (e.state === 'chase') {
      turn(nx, nz, 6);
      if (dist > 7) move(nx, nz, e.speed * (rage ? 1.3 : 1));
      if (e.cd <= 0) {
        const opts = ['volley', 'slam', 'summon', 'charge'];
        e.atk = opts[Math.floor(Math.random() * opts.length)];
        if (e.atk === 'summon' && this.enemies.length > 14) e.atk = 'volley';
        e.state = 'wind';
        e.glow = true;
        e.t = e.atk === 'slam' ? 1.3 : e.atk === 'charge' ? 0.9 : 0.8;
        if (e.atk === 'slam') teleOn(11);
        this.toast(`⚠ ${e.atk === 'volley' ? 'FIREBALL VOLLEY' : e.atk === 'slam' ? 'SHOCKWAVE SLAM' : e.atk === 'summon' ? 'SUMMONING SHADOWS' : 'CHARGING!'}`);
      }
    } else if (e.state === 'wind') {
      e.armT = -2.9;
      if (e.atk !== 'charge' || e.t > 0.3) turn(nx, nz, 5);
      if (e.tele) e.tele.position.set(g.position.x, 0.07, g.position.z);
      if (e.t <= 0) {
        e.glow = false;
        if (e.atk === 'volley') {
          const n = rage ? 13 : 9;
          for (let i = 0; i < n; i++) {
            const d = new THREE.Vector3(nx, 0, nz).applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * 0.2);
            this.shoot(g.position, d, 15, e.dmg * 0.7, true);
          }
          tone(160, 0.4, 'sawtooth', 0.06, 200);
          e.state = 'recover';
          e.t = 0.8;
        } else if (e.atk === 'slam') {
          this.rmTele(e.tele);
          e.tele = null;
          this.shock(g.position.x, g.position.z, 11, 0xff3355, 0.6);
          this.burst(g.position.clone().setY(0.3), 0xff3355, 40, 12, 0.3, 6);
          this.shake = 1;
          tone(60, 0.5, 'sawtooth', 0.09, -20);
          if (dist < 11 + 0.3 && this.p.pos.y < 1.5) this.hurtPlayer(e.dmg, g.position, e, this.p.pos.y > 1.5);
          e.state = 'recover';
          e.t = 1.1;
        } else if (e.atk === 'summon') {
          const n = rage ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const k = this.spawnEnemy(Math.random() > 0.5 ? 'ninja' : 'thrower');
            const a = Math.random() * 6.28;
            k.group.position.set(g.position.x + Math.sin(a) * 4, 0, g.position.z + Math.cos(a) * 4);
          }
          this.shock(g.position.x, g.position.z, 6, 0xaa33ff, 0.5);
          e.state = 'recover';
          e.t = 0.8;
        } else {
          e.state = 'charge';
          e.t = 0.7;
          e.chargeDir.set(nx, 0, nz);
          e.chargeHit = false;
        }
      }
    } else if (e.state === 'charge') {
      g.rotation.y = Math.atan2(e.chargeDir.x, e.chargeDir.z);
      g.position.x += e.chargeDir.x * 24 * dt;
      g.position.z += e.chargeDir.z * 24 * dt;
      e.armT = -0.2;
      this.burst(g.position.clone().setY(0.4), 0xff3355, 2, 3, 0.3, 1);
      if (!e.chargeHit && dist < e.def.radius + 1.2) {
        e.chargeHit = true;
        this.hurtPlayer(e.dmg * 0.9, g.position, e);
        this.shake = 0.7;
      }
      if (e.t <= 0) {
        e.state = 'recover';
        e.t = 1.0;
      }
    } else if (e.state === 'recover') {
      e.armT = -0.1;
      if (e.t <= 0) {
        e.state = 'chase';
        e.cd = Math.max(0.8, (rage ? 1.4 : 2.4) - this.wave * 0.04);
      }
    }
  }

  /* --------------------------------------------------- hazards & pickups */

  private spawnMeteor() {
    const mr = this.mistR();
    let x: number;
    let z: number;
    if (Math.random() < 0.6) {
      x = this.p.pos.x + rand(-4, 4);
      z = this.p.pos.z + rand(-4, 4);
    } else {
      const a = Math.random() * 6.28;
      const r = Math.random() * (mr - 2);
      x = Math.sin(a) * r;
      z = Math.cos(a) * r;
    }
    const r = 3.6 + (this.wave > 8 ? 1 : 0);
    const tele = this.tele(x, z, r, 0xff5500);
    const ball = new THREE.Group() as unknown as THREE.Mesh;
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff6a00 })));
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.3, depthWrite: false })));
    ball.position.set(x, 40, z);
    this.scene.add(ball);
    this.meteors.push({ x, z, r, t: 0, delay: 1.7, tele, ball });
  }

  private spawnPickup(type: PType, x: number, z: number) {
    const col = { heal: 0xffffff, sake: 0xd0903a, ki: 0x44aaff, shield: 0xffd54a }[type];
    const g = new THREE.Group();
    let body: THREE.Mesh;
    if (type === 'heal') body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x555555 }));
    else if (type === 'sake') body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({ color: col, emissive: 0x442200 }));
    else if (type === 'ki') body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 10), new THREE.MeshStandardMaterial({ color: col, emissive: 0x114488 }));
    else body = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color: col, emissive: 0x886600 }));
    if (type === 'ki') body.rotation.z = Math.PI / 2;
    body.position.y = 1.2;
    g.add(body);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 8, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = 4;
    g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 24), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    g.add(ring);
    const r = Math.hypot(x, z);
    if (r > ARENA - 3) {
      x *= (ARENA - 3) / r;
      z *= (ARENA - 3) / r;
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.pickups.push({ type, obj: g, t: Math.random() * 6, life: 22 });
  }

  private collect(pk: Pickup) {
    const p = this.p;
    switch (pk.type) {
      case 'heal':
        p.hp = Math.min(p.maxHp, p.hp + 35);
        this.toast('🍙 Onigiri  +35 HP');
        break;
      case 'sake':
        p.speedBuff = 12;
        p.stamina = 100;
        this.toast('🍶 Sake  Speed & Stamina boost!');
        break;
      case 'ki':
        p.ki = Math.min(100, p.ki + 50);
        this.toast('📜 Ki Scroll  +50 Ki');
        break;
      case 'shield':
        p.shield = 6;
        this.toast('🛡 Divine Talisman  Invincible 6s');
        break;
    }
    tone(700, 0.15, 'sine', 0.05, 500);
    this.burst(pk.obj.position.clone().setY(1.2), 0xffffff, 12, 4, 0.15, 4);
  }

  /* ---------------------------------------------------------------- waves */

  private startWave() {
    this.wave++;
    this.waveState = 'fight';
    this.queue = [];
    const w = this.wave;
    const isBoss = w % 5 === 0;
    const n = Math.min(32, 4 + w * 2);
    const pool: EType[] = ['ninja', 'ninja'];
    if (w >= 2) pool.push('thrower');
    if (w >= 3) pool.push('bomber');
    if (w >= 4) pool.push('brute');
    if (w >= 7) pool.push('bomber', 'thrower');
    for (let i = 0; i < (isBoss ? Math.min(8, n / 2) : n); i++) this.queue.push(pool[Math.floor(Math.random() * pool.length)]);
    if (isBoss) this.queue.unshift('boss');
    this.spawnT = 0.5;
    this.banner(isBoss ? `WAVE ${w}  ⚠ BOSS` : `WAVE ${w}`, isBoss ? 'The Shadow Shogun descends!' : w >= 4 ? 'The Shadow Clan sends its elite...' : 'The Shadow Clan approaches...');
    tone(220, 0.5, 'sawtooth', 0.06, 200);
  }

  private clearWave() {
    this.waveState = 'intermission';
    this.waveT = 5;
    const p = this.p;
    const ups: Array<[string, () => void]> = [
      ['Sharper Blade: +15% damage', () => (p.dmgMul *= 1.15)],
      ['Wind Step: +8% speed', () => (p.speedMul *= 1.08)],
      ['Iron Body: +20 max HP', () => (p.maxHp += 20)],
      ['Ki Spring: +25% Ki gain', () => (p.kiMul *= 1.25)],
      ['Second Wind: faster stamina', () => (p.regenMul *= 1.2)],
    ];
    const u = ups[Math.floor(Math.random() * ups.length)];
    u[1]();
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.2);
    p.stamina = 100;
    this.score += 300 + this.wave * 100;
    this.banner(`WAVE ${this.wave} CLEARED`, `Upgrade — ${u[0]}`);
    this.spawnPickup('heal', rand(-8, 8), rand(-8, 8));
    this.spawnPickup(Math.random() > 0.5 ? 'ki' : 'sake', rand(-12, 12), rand(-12, 12));
  }

  /* --------------------------------------------------------------- update */

  private update(dt: number) {
    this.time += dt;
    const p = this.p;
    this.score += dt * 2;

    this.updatePlayer(dt);
    if (this.over) return;

    // enemies
    for (const e of [...this.enemies]) {
      if (!e.dead) this.updateEnemy(e, dt);
    }
    // separation
    const list = this.enemies.filter((e) => !e.dead);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i].group.position;
        const b = list[j].group.position;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const min = list[i].def.radius + list[j].def.radius;
        if (d < min) {
          const push = (min - d) * 0.5;
          a.x -= (dx / d) * push;
          a.z -= (dz / d) * push;
          b.x += (dx / d) * push;
          b.z += (dz / d) * push;
        }
      }
    }
    this.enemies = list;

    // projectiles
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.life -= dt;
      pr.mesh.position.x += pr.vel.x * dt;
      pr.mesh.position.z += pr.vel.z * dt;
      pr.mesh.rotation.y += dt * 25;
      let remove = pr.life <= 0 || Math.hypot(pr.mesh.position.x, pr.mesh.position.z) > ARENA + 4;
      if (pr.fire && Math.random() < 0.6) this.burst(pr.mesh.position, 0xff8800, 1, 1.5, 0.2, 1);
      if (!remove && pr.owner === 'enemy') {
        const d = Math.hypot(pr.mesh.position.x - p.pos.x, pr.mesh.position.z - p.pos.z);
        if (d < 1.0 && p.pos.y < 2.4) {
          const res = this.hurtPlayer(pr.dmg, pr.mesh.position, null, false);
          if (res === 'parry') {
            pr.vel.multiplyScalar(-1.4);
            pr.owner = 'player';
            pr.life = 3;
            pr.dmg *= 3;
          } else if (res !== 'none') remove = true;
        }
      } else if (!remove && pr.owner === 'player') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(pr.mesh.position.x - e.group.position.x, pr.mesh.position.z - e.group.position.z) < e.def.radius + 0.7) {
            this.hitEnemy(e, pr.dmg * p.dmgMul, pr.vel.clone().normalize(), 6, 0.4, pr.fire);
            remove = true;
            break;
          }
        }
      }
      if (remove) {
        this.scene.remove(pr.mesh);
        this.projs.splice(i, 1);
      }
    }

    // meteors
    if (this.wave >= 2 && this.waveState === 'fight') {
      this.meteorT -= dt;
      if (this.meteorT <= 0) {
        this.meteorT = Math.max(0.9, 4.6 - this.wave * 0.3) * rand(0.7, 1.2);
        this.spawnMeteor();
        if (this.wave >= 6 && Math.random() < 0.5) this.spawnMeteor();
      }
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t += dt;
      const k = Math.min(1, m.t / m.delay);
      m.ball.position.y = lerp(40, 1, k * k);
      (m.tele.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.25 * Math.abs(Math.sin(m.t * 12));
      if (m.t >= m.delay) {
        const pos = new THREE.Vector3(m.x, 0, m.z);
        this.explosion(pos, m.r);
        if (Math.hypot(p.pos.x - m.x, p.pos.z - m.z) < m.r && p.pos.y < 1.5) this.hurtPlayer(20 + this.wave, pos, null, true);
        for (const e of [...this.enemies]) {
          if (!e.dead && Math.hypot(e.group.position.x - m.x, e.group.position.z - m.z) < m.r + e.def.radius) {
            this.hitEnemy(e, 45, new THREE.Vector3(e.group.position.x - m.x, 0, e.group.position.z - m.z).normalize(), 10, 0.6, true);
          }
        }
        this.scene.remove(m.ball);
        this.rmTele(m.tele);
        this.meteors.splice(i, 1);
      }
    }

    // spike traps (4s cycle)
    for (const s of this.spikes) {
      const ph = (this.time + s.off) % 4;
      const mat = s.plate.material as THREE.MeshBasicMaterial;
      let h = -1.6;
      if (ph < 2.2) {
        mat.color.setHex(0x553322);
        mat.opacity = 0.5;
      } else if (ph < 3.0) {
        mat.color.setHex(Math.floor(this.time * 10) % 2 ? 0xff7700 : 0xffcc00);
        mat.opacity = 0.9;
        h = -1.0;
      } else if (ph < 3.7) {
        mat.color.setHex(0xff2200);
        mat.opacity = 0.9;
        h = 0;
        if (s.lastPhase < 3.0) {
          s.hitP = false;
          s.hitE.clear();
        }
        if (!s.hitP && p.pos.y < 0.8 && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 2.3) {
          s.hitP = true;
          this.hurtPlayer(16 + this.wave, new THREE.Vector3(s.x, 0, s.z), null, true);
        }
        for (const e of this.enemies) {
          if (!s.hitE.has(e) && Math.hypot(e.group.position.x - s.x, e.group.position.z - s.z) < 2.3) {
            s.hitE.add(e);
            this.hitEnemy(e, 25, new THREE.Vector3(0, 0, 0), 0, 0.5, false);
          }
        }
      } else {
        mat.color.setHex(0x553322);
        mat.opacity = 0.5;
        h = -0.8 - (ph - 3.7) * 2.6;
      }
      s.lastPhase = ph;
      s.spikes.position.y = lerp(s.spikes.position.y, h, Math.min(1, dt * 25));
    }

    // pickups
    this.pickupT -= dt;
    if (this.pickupT <= 0 && this.pickups.length < 4) {
      this.pickupT = rand(12, 18);
      const a = Math.random() * 6.28;
      const r = Math.random() * (this.mistR() - 4);
      this.spawnPickup(['heal', 'sake', 'ki', 'shield'][Math.floor(Math.random() * 4)] as PType, Math.sin(a) * r, Math.cos(a) * r);
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      pk.life -= dt;
      pk.obj.children[0].position.y = 1.2 + Math.sin(pk.t * 3) * 0.2;
      pk.obj.children[0].rotation.y += dt * 2.5;
      const d = Math.hypot(pk.obj.position.x - p.pos.x, pk.obj.position.z - p.pos.z);
      if (d < 2) {
        this.collect(pk);
        this.scene.remove(pk.obj);
        this.pickups.splice(i, 1);
      } else if (pk.life <= 0) {
        this.scene.remove(pk.obj);
        this.pickups.splice(i, 1);
      }
    }

    // particles & fx
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      q.vel.y -= 16 * dt;
      q.mesh.position.addScaledVector(q.vel, dt);
      if (q.mesh.position.y < 0.05) {
        q.mesh.position.y = 0.05;
        q.vel.y *= -0.3;
        q.vel.x *= 0.7;
        q.vel.z *= 0.7;
      }
      q.mesh.scale.setScalar(q.size * Math.max(0.05, q.life / q.max));
      if (q.life <= 0) {
        this.scene.remove(q.mesh);
        this.parts.splice(i, 1);
      }
    }
    for (let i = this.fxs.length - 1; i >= 0; i--) {
      const f = this.fxs[i];
      f.life -= dt;
      const k = 1 - Math.max(0, f.life) / f.max;
      f.obj.scale.setScalar(lerp(f.s0, f.s1, 1 - Math.pow(1 - k, 2)));
      f.mat.opacity = f.op * (1 - k);
      if (f.life <= 0) {
        this.scene.remove(f.obj);
        f.mat.dispose();
        if (f.geo) f.geo.dispose();
        this.fxs.splice(i, 1);
      }
    }

    // petals
    const arr = this.petals.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < arr.count; i++) {
      let y = arr.getY(i) - dt * 1.2;
      let x = arr.getX(i) + Math.sin(this.time + i) * dt * 1.2 + dt * 0.8;
      if (y < 0) y = 20;
      if (x > 50) x = -50;
      arr.setXYZ(i, x, y, arr.getZ(i));
    }
    arr.needsUpdate = true;
    this.petals.position.set(p.pos.x, 0, p.pos.z);

    // mist visuals
    const mr = this.mistR();
    this.mist.scale.set(mr, 1, mr);
    (this.mist.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(this.time * 2) * 0.06;
    this.mistRing.scale.set(mr, mr, 1);

    // waves
    if (this.waveState === 'intermission') {
      this.waveT -= dt;
      if (this.waveT <= 0) this.startWave();
    } else {
      this.spawnT -= dt;
      const alive = this.enemies.length;
      if (this.queue.length && this.spawnT <= 0 && alive < 10 + this.wave) {
        this.spawnEnemy(this.queue.shift()!);
        this.spawnT = Math.max(0.35, 1.0 - this.wave * 0.04);
      }
      if (!this.queue.length && this.enemies.length === 0) this.clearWave();
    }

    // camera
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    this.ultFlash = Math.max(0, this.ultFlash - dt * 2.5);
    const target = new THREE.Vector3(p.pos.x, p.pos.y * 0.5 + 1.7, p.pos.z);
    const d = 9.5 * (p.ultT > 0 ? 0.8 : 1);
    const cp = Math.cos(this.pitch) * d;
    this.camera.position.set(
      target.x + Math.sin(this.yaw) * cp + rand(-1, 1) * this.shake * 0.4,
      Math.max(0.6, target.y + Math.sin(this.pitch) * d) + rand(-1, 1) * this.shake * 0.4,
      target.z + Math.cos(this.yaw) * cp + rand(-1, 1) * this.shake * 0.4,
    );
    this.camera.lookAt(target);
    this.light.position.set(p.pos.x + 20, 35, p.pos.z + 10);
    this.light.target.position.copy(p.pos);

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.07;
      this.emitHud();
    }
  }

  private emitHud(force = false) {
    void force;
    const p = this.p;
    const buffs: string[] = [];
    if (p.speedBuff > 0) buffs.push(`🍶 ${Math.ceil(p.speedBuff)}s`);
    if (p.shield > 0) buffs.push(`🛡 ${Math.ceil(p.shield)}s`);
    const mr = this.mistR();
    this.onHud({
      hp: Math.max(0, p.hp),
      maxHp: p.maxHp,
      stamina: p.stamina,
      ki: p.ki,
      wave: Math.max(1, this.wave),
      left: this.enemies.length + this.queue.length,
      score: Math.floor(this.score),
      best: Math.max(this.best, Math.floor(this.score)),
      time: this.time,
      combo: this.combo,
      kills: this.kills,
      boss: this.boss ? { hp: Math.max(0, this.boss.hp), max: this.boss.max, name: this.boss.def.name } : null,
      cdQ: Math.max(0, p.cdQ),
      cdE: Math.max(0, p.cdE),
      cdR: p.ki >= 100 ? 0 : 1,
      guard: p.guard,
      mist: mr,
      buffs,
      hurt: this.hurtFlash,
      flash: this.ultFlash,
      banner: this.bannerS,
      toast: this.toastS,
      over: this.over,
      paused: this.paused,
      locked: this.locked,
      danger: Math.hypot(p.pos.x, p.pos.z) > mr - 1.5,
    });
  }
}
