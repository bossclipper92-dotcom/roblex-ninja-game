import * as THREE from 'three';

export type EType = 'ninja' | 'thrower' | 'bomber' | 'brute' | 'boss';

export interface PlayerRig {
  outer: THREE.Group;
  inner: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  sword: THREE.Group;
  guardFx: THREE.Mesh;
  bubble: THREE.Mesh;
  ponytail: THREE.Mesh;
}

const std = (color: number, rough = 0.7, emissive = 0) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
  if (emissive) m.emissive.setHex(emissive);
  return m;
};

const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
};

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** Kage - the wandering ronin ninja with a legendary blade */
export function buildHero(): PlayerRig {
  const outer = new THREE.Group();
  const inner = new THREE.Group();
  outer.add(inner);

  const gi = std(0xd6406a);
  const giDark = std(0xa82f52);
  const hakama = std(0xf1f1f4);
  const skin = std(0xf2c9a0, 0.6);
  const hair = std(0xb3201a, 0.5);
  const dark = std(0x1a1a1a);
  const scarMat = new THREE.MeshBasicMaterial({ color: 0x8a1010 });

  // legs
  const mkLeg = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 1.0, 0);
    mesh(box(0.42, 1.0, 0.46), hakama, 0, -0.5, 0, g);
    mesh(box(0.34, 0.16, 0.5), dark, 0, -0.95, 0.06, g);
    inner.add(g);
    return g;
  };
  const legL = mkLeg(0.22);
  const legR = mkLeg(-0.22);

  // torso + belt
  mesh(box(0.95, 0.95, 0.52), gi, 0, 1.5, 0, inner);
  mesh(box(0.97, 0.16, 0.54), hakama, 0, 1.08, 0, inner);
  mesh(box(0.2, 0.8, 0.54), giDark, 0, 1.55, 0.01, inner);

  // arms
  const mkArm = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 1.88, 0);
    mesh(box(0.3, 0.85, 0.32), gi, 0, -0.42, 0, g);
    mesh(new THREE.SphereGeometry(0.15, 10, 8), skin, 0, -0.9, 0, g);
    inner.add(g);
    return g;
  };
  const armL = mkArm(0.62);
  const armR = mkArm(-0.62);

  // sword in right hand
  const sword = new THREE.Group();
  sword.position.set(0, -0.9, 0);
  sword.rotation.x = 1.25;
  mesh(box(0.08, 0.34, 0.08), dark, 0, 0.0, 0, sword);
  mesh(box(0.24, 0.05, 0.24), std(0xc9a227, 0.4), 0, 0.2, 0, sword);
  const blade = mesh(box(0.06, 1.35, 0.12), std(0xdfe6ee, 0.15), 0, 0.9, 0, sword);
  blade.material = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.1, metalness: 0.8, emissive: 0x223344 });
  mesh(box(0.065, 1.35, 0.03), std(0x555a66, 0.3), 0, 0.9, 0.065, sword); // dull back edge
  armR.add(sword);

  // head
  mesh(new THREE.SphereGeometry(0.3, 16, 12), skin, 0, 2.28, 0, inner);
  // hair
  const hairCap = mesh(new THREE.SphereGeometry(0.34, 16, 12), hair, 0, 2.36, -0.05, inner);
  hairCap.scale.set(1, 0.95, 1.05);
  for (let i = -1; i <= 1; i++) {
    const b = mesh(box(0.14, 0.26, 0.1), hair, i * 0.18, 2.42, 0.27, inner);
    b.rotation.z = i * 0.25;
    b.rotation.x = 0.4;
  }
  mesh(box(0.1, 0.35, 0.1), hair, -0.3, 2.2, 0.05, inner);
  mesh(box(0.1, 0.35, 0.1), hair, 0.3, 2.2, 0.05, inner);
  // high ponytail
  const ponytail = mesh(box(0.14, 0.9, 0.14), hair, 0, 2.2, -0.42, inner);
  ponytail.geometry.translate(0, -0.35, 0);
  ponytail.position.set(0, 2.5, -0.3);
  ponytail.rotation.x = 0.5;
  // eyes
  mesh(box(0.08, 0.05, 0.04), dark, 0.11, 2.3, 0.29, inner);
  mesh(box(0.08, 0.05, 0.04), dark, -0.11, 2.3, 0.29, inner);
  // X-shaped cross scar on left cheek
  const s1 = mesh(box(0.2, 0.025, 0.02), scarMat, 0.14, 2.2, 0.295, inner);
  s1.rotation.z = Math.PI / 4;
  const s2 = mesh(box(0.2, 0.025, 0.02), scarMat, 0.14, 2.2, 0.296, inner);
  s2.rotation.z = -Math.PI / 4;

  // guard visual
  const guardFx = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 24),
    new THREE.MeshBasicMaterial({
      color: 0x66ddff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  guardFx.position.set(0, 1.5, 1.0);
  guardFx.visible = false;
  outer.add(guardFx);

  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 20, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffd54a,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  bubble.position.y = 1.3;
  bubble.visible = false;
  outer.add(bubble);

  return { outer, inner, legL, legR, armL, armR, sword, guardFx, bubble, ponytail };
}

export interface FoeRig {
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
}

const PALETTE: Record<EType, { body: number; accent: number; skin: number }> = {
  ninja: { body: 0x14141c, accent: 0xb01818, skin: 0x14141c },
  thrower: { body: 0x1a2a48, accent: 0x33aaff, skin: 0x1a2a48 },
  bomber: { body: 0x3a2a10, accent: 0xff8800, skin: 0x3a2a10 },
  brute: { body: 0x5a1212, accent: 0xffcc00, skin: 0xb03020 },
  boss: { body: 0x1c0a24, accent: 0xff2244, skin: 0x8c1a3a },
};

export const ACCENT = (t: EType) => PALETTE[t].accent;

export function buildFoe(type: EType, mats: THREE.MeshStandardMaterial[]): FoeRig {
  const pal = PALETTE[type];
  const g = new THREE.Group();
  const mk = (color: number, emissive = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
    if (emissive) {
      m.emissive.setHex(emissive);
      m.userData.base = emissive;
    }
    mats.push(m);
    return m;
  };
  const body = mk(pal.body);
  const accent = mk(pal.accent);
  const skin = mk(pal.skin);
  const eye = mk(0xff2020, 0xff2020);

  const mkLeg = (x: number) => {
    const l = new THREE.Group();
    l.position.set(x, 1.0, 0);
    mesh(box(0.32, 1.0, 0.36), body, 0, -0.5, 0, l);
    g.add(l);
    return l;
  };
  const legL = mkLeg(0.2);
  const legR = mkLeg(-0.2);

  mesh(box(0.84, 0.92, 0.46), body, 0, 1.46, 0, g);
  mesh(box(0.86, 0.14, 0.48), accent, 0, 1.08, 0, g);

  const mkArm = (x: number) => {
    const a = new THREE.Group();
    a.position.set(x, 1.86, 0);
    mesh(box(0.24, 0.85, 0.26), body, 0, -0.42, 0, a);
    g.add(a);
    return a;
  };
  const armL = mkArm(0.56);
  const armR = mkArm(-0.56);

  const head = mesh(box(0.52, 0.5, 0.5), skin, 0, 2.2, 0, g);
  head.castShadow = true;
  if (type === 'ninja' || type === 'thrower' || type === 'bomber') {
    mesh(box(0.54, 0.16, 0.52), accent, 0, 2.32, 0, g);
    mesh(box(0.54, 0.14, 0.52), accent, 0, 2.2, 0, g);
    mesh(box(0.1, 0.05, 0.05), eye, 0.12, 2.2, 0.27, g);
    mesh(box(0.1, 0.05, 0.05), eye, -0.12, 2.2, 0.27, g);
    // scarf tail
    const tail = mesh(box(0.14, 0.12, 0.7), accent, 0, 2.3, -0.5, g);
    tail.rotation.x = -0.3;
  } else {
    // oni face
    mesh(box(0.1, 0.06, 0.05), eye, 0.12, 2.25, 0.27, g);
    mesh(box(0.1, 0.06, 0.05), eye, -0.12, 2.25, 0.27, g);
    mesh(box(0.34, 0.08, 0.05), mk(0xffffff), 0, 2.08, 0.27, g); // teeth
    const horn = new THREE.ConeGeometry(0.1, 0.45, 6);
    const h1 = mesh(horn, mk(0xeeeeee), 0.2, 2.6, 0, g);
    h1.rotation.z = -0.25;
    const h2 = mesh(horn, mk(0xeeeeee), -0.2, 2.6, 0, g);
    h2.rotation.z = 0.25;
    mesh(box(0.9, 0.25, 0.6), accent, 0, 1.95, 0, g); // shoulder armor / collar
    mesh(box(1.1, 0.18, 0.6), accent, 0, 1.95, 0, g);
  }

  const steel = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.2 });
  const weapon = new THREE.Group();
  weapon.position.set(0, -0.9, 0);
  weapon.rotation.x = 1.25;

  if (type === 'ninja') {
    mesh(box(0.05, 1.1, 0.1), steel, 0, 0.7, 0, weapon);
    mesh(box(0.08, 0.3, 0.08), body, 0, 0.0, 0, weapon);
    armR.add(weapon);
  } else if (type === 'thrower') {
    const star = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 4), steel, 0, -0.95, 0.1, armR);
    star.rotation.x = 1.2;
  } else if (type === 'bomber') {
    const bomb = mesh(new THREE.SphereGeometry(0.42, 12, 10), mk(0x222222, 0x331100), 0, 1.5, -0.55, g);
    bomb.castShadow = true;
    mesh(box(0.05, 0.3, 0.05), mk(0xffaa00, 0xffaa00), 0, 1.95, -0.55, g);
    mesh(box(0.7, 0.16, 0.2), accent, 0, 1.5, -0.3, g);
  } else if (type === 'brute') {
    mesh(box(0.28, 1.8, 0.28), mk(0x4a2a10), 0, 0.9, 0, weapon);
    for (let i = 0; i < 6; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.08, 0.25, 5), steel, (i % 2 ? 0.17 : -0.17), 1.0 + i * 0.1, 0, weapon);
      sp.rotation.z = (i % 2 ? -1 : 1) * 1.57;
    }
    armR.add(weapon);
  } else {
    // boss: giant odachi with glowing blade + cape + crown of horns
    mesh(box(0.1, 0.5, 0.1), body, 0, 0.0, 0, weapon);
    mesh(box(0.08, 2.4, 0.2), mk(0xff3355, 0xaa1133), 0, 1.5, 0, weapon);
    armR.add(weapon);
    const cape = mesh(box(1.1, 1.7, 0.08), mk(0x7a0a1e), 0, 1.4, -0.35, g);
    cape.rotation.x = 0.12;
    for (let i = -2; i <= 2; i++) {
      const h = mesh(new THREE.ConeGeometry(0.09, 0.5 + (2 - Math.abs(i)) * 0.15, 5), mk(0xffd54a, 0x553300), i * 0.12, 2.65, -0.05, g);
      h.rotation.z = -i * 0.18;
    }
  }

  return { group: g, legL, legR, armL, armR };
}
