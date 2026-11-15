import * as THREE from 'three';
import { TrafficKind } from './types';

export interface PlayerCarHandle {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Mesh[];
  boostFlames: THREE.Mesh[];
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
}

export interface SynthEnvironmentHandle {
  group: THREE.Group;
  roadTexture: THREE.CanvasTexture;
  gridTexture: THREE.CanvasTexture;
  sunMaterial: THREE.ShaderMaterial;
  mountainSegments: THREE.Group[];
  disposables: Array<{ dispose: () => void }>;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(3, 1, 10, 0.85)');
  grad.addColorStop(0.55, 'rgba(3, 1, 10, 0.45)');
  grad.addColorStop(1, 'rgba(3, 1, 10, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian asphalt base
  ctx.fillStyle = '#0e0720';
  ctx.fillRect(0, 0, w, h);

  // Subtle longitudinal asphalt sheen streaks
  for (let i = 0; i < 64; i++) {
    const x = (i * 29) % w;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(38, 18, 72, 0.28)' : 'rgba(6, 2, 16, 0.35)';
    ctx.fillRect(x, 0, 5, h);
  }

  // Subtle horizontal synthwave micro-grid lines across asphalt
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.16)';
  ctx.lineWidth = 2;
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Outer glowing cyan/magenta edge rails
  const edgeGradL = ctx.createLinearGradient(0, 0, 26, 0);
  edgeGradL.addColorStop(0, '#00f5ff');
  edgeGradL.addColorStop(0.45, '#00c8ff');
  edgeGradL.addColorStop(1, 'rgba(0, 245, 255, 0)');
  ctx.fillStyle = edgeGradL;
  ctx.fillRect(0, 0, 26, h);

  const edgeGradR = ctx.createLinearGradient(w - 26, 0, w, 0);
  edgeGradR.addColorStop(0, 'rgba(0, 245, 255, 0)');
  edgeGradR.addColorStop(0.55, '#00c8ff');
  edgeGradR.addColorStop(1, '#00f5ff');
  ctx.fillStyle = edgeGradR;
  ctx.fillRect(w - 26, 0, 26, h);

  // Crisp 4-lane dashed dividers (at 25%, 50%, 75%)
  const laneXs = [w * 0.25, w * 0.5, w * 0.75];
  for (let idx = 0; idx < laneXs.length; idx++) {
    const lx = laneXs[idx];
    const isCenter = idx === 1;
    ctx.fillStyle = isCenter ? '#ff2d95' : '#9d4edd';
    for (let y = 18; y < h; y += 128) {
      ctx.fillRect(lx - (isCenter ? 4 : 3), y, isCenter ? 8 : 6, 72);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createGridFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070312';
  ctx.fillRect(0, 0, size, size);

  // Primary neon synthwave grid
  ctx.strokeStyle = '#d91b8a';
  ctx.lineWidth = 4;
  const step = 64;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Secondary glow pass
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.22)';
  ctx.lineWidth = 1.5;
  for (let i = step / 2; i < size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 30);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPlayerCar(shadowTex: THREE.Texture): PlayerCarHandle {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const wheels: THREE.Mesh[] = [];
  const boostFlames: THREE.Mesh[] = [];

  // Contact shadow disc grounded at y = 0.015
  const shadowGeo = new THREE.PlaneGeometry(2.5, 4.7);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.015;
  group.add(shadowMesh);
  geometries.push(shadowGeo);
  materials.push(shadowMat);

  // Materials (varied roughness & metalness)
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e0622,
    metalness: 0.78,
    roughness: 0.34,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x261a44,
    metalness: 0.55,
    roughness: 0.62,
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x050914,
    metalness: 0.2,
    roughness: 0.08,
    clearcoat: 1.0,
    emissive: 0x051f33,
    emissiveIntensity: 0.4,
  });
  const cyanNeonMat = new THREE.MeshStandardMaterial({
    color: 0x70f8ff,
    emissive: 0x00f5ff,
    emissiveIntensity: 2.4,
    roughness: 0.2,
    metalness: 0.1,
  });
  const magentaNeonMat = new THREE.MeshStandardMaterial({
    color: 0xff7ad9,
    emissive: 0xff1e8a,
    emissiveIntensity: 2.6,
    roughness: 0.2,
    metalness: 0.1,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x101018,
    roughness: 0.82,
    metalness: 0.1,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.push(hullMat, trimMat, canopyMat, cyanNeonMat, magentaNeonMat, tireMat, flameMat);

  // 1. Primary sculpted wedge hull via ExtrudeGeometry (side profile extruded along X)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.0, 0.24);
  hullShape.lineTo(1.95, 0.24);
  hullShape.lineTo(2.05, 0.5);
  hullShape.lineTo(1.3, 0.68);
  hullShape.lineTo(0.45, 1.06);
  hullShape.lineTo(-0.9, 1.08);
  hullShape.lineTo(-1.82, 0.78);
  hullShape.lineTo(-2.02, 0.55);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.66,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  hullGeo.center();
  // Rotate so length runs along Z (front toward -Z)
  hullGeo.rotateY(Math.PI / 2);
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.position.y = 0.64;
  hullMesh.castShadow = true;
  bodyGroup.add(hullMesh);
  geometries.push(hullGeo);

  // 2. Lower aerodynamic splitter / side skirts
  const skirtGeo = new THREE.BoxGeometry(1.9, 0.16, 4.15);
  const skirtMesh = new THREE.Mesh(skirtGeo, trimMat);
  skirtMesh.position.set(0, 0.28, 0.02);
  bodyGroup.add(skirtMesh);
  geometries.push(skirtGeo);

  // 3. Tinted glass cabin canopy + sleek neon roof stripes
  const canopyGeo = new THREE.BoxGeometry(1.32, 0.36, 1.78);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.position.set(0, 0.96, 0.08);
  bodyGroup.add(canopyMesh);
  geometries.push(canopyGeo);

  const hoodStripeGeo = new THREE.BoxGeometry(0.11, 0.03, 1.45);
  const hoodStripeL = new THREE.Mesh(hoodStripeGeo, cyanNeonMat);
  hoodStripeL.position.set(-0.36, 0.82, -1.18);
  const hoodStripeR = new THREE.Mesh(hoodStripeGeo, cyanNeonMat);
  hoodStripeR.position.set(0.36, 0.82, -1.18);
  const rearDeckStripeL = new THREE.Mesh(hoodStripeGeo, magentaNeonMat);
  rearDeckStripeL.scale.z = 0.65;
  rearDeckStripeL.position.set(-0.36, 0.99, 1.25);
  const rearDeckStripeR = new THREE.Mesh(hoodStripeGeo, magentaNeonMat);
  rearDeckStripeR.scale.z = 0.65;
  rearDeckStripeR.position.set(0.36, 0.99, 1.25);
  bodyGroup.add(hoodStripeL, hoodStripeR, rearDeckStripeL, rearDeckStripeR);
  geometries.push(hoodStripeGeo);

  // 4. Side neon trim strips (cyan)
  const sideStripGeo = new THREE.BoxGeometry(0.05, 0.06, 3.3);
  const leftStrip = new THREE.Mesh(sideStripGeo, cyanNeonMat);
  leftStrip.position.set(-0.96, 0.36, 0);
  const rightStrip = new THREE.Mesh(sideStripGeo, cyanNeonMat);
  rightStrip.position.set(0.96, 0.36, 0);
  bodyGroup.add(leftStrip, rightStrip);
  geometries.push(sideStripGeo);

  // 5. Rear spoiler wing + pylons
  const wingGeo = new THREE.BoxGeometry(1.98, 0.07, 0.36);
  const wingMesh = new THREE.Mesh(wingGeo, hullMat);
  wingMesh.position.set(0, 1.15, 1.76);
  const wingEdgeGeo = new THREE.BoxGeometry(2.0, 0.04, 0.06);
  const wingEdge = new THREE.Mesh(wingEdgeGeo, magentaNeonMat);
  wingEdge.position.set(0, 1.15, 1.94);
  const pylonGeo = new THREE.BoxGeometry(0.08, 0.32, 0.24);
  const pylonL = new THREE.Mesh(pylonGeo, trimMat);
  pylonL.position.set(-0.62, 0.98, 1.72);
  const pylonR = new THREE.Mesh(pylonGeo, trimMat);
  pylonR.position.set(0.62, 0.98, 1.72);
  bodyGroup.add(wingMesh, wingEdge, pylonL, pylonR);
  geometries.push(wingGeo, wingEdgeGeo, pylonGeo);

  // 6. Iconic rear synthwave taillight bar + twin exhaust nozzles
  const tailBarGeo = new THREE.BoxGeometry(1.56, 0.12, 0.08);
  const tailBar = new THREE.Mesh(tailBarGeo, magentaNeonMat);
  tailBar.position.set(0, 0.62, 2.04);
  bodyGroup.add(tailBar);
  geometries.push(tailBarGeo);

  const exhaustGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.22, 12);
  exhaustGeo.rotateX(Math.PI / 2);
  const flameGeo = new THREE.ConeGeometry(0.1, 0.45, 10);
  flameGeo.rotateX(Math.PI / 2);
  for (const sx of [-0.46, 0.46]) {
    const ex = new THREE.Mesh(exhaustGeo, trimMat);
    ex.position.set(sx, 0.34, 2.05);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(sx, 0.34, 2.3);
    bodyGroup.add(ex, flame);
    boostFlames.push(flame);
  }
  geometries.push(exhaustGeo, flameGeo);

  // 7. Front glowing headlights
  const headGeo = new THREE.BoxGeometry(0.38, 0.09, 0.08);
  const headL = new THREE.Mesh(headGeo, cyanNeonMat);
  headL.position.set(-0.62, 0.52, -2.04);
  const headR = new THREE.Mesh(headGeo, cyanNeonMat);
  headR.position.set(0.62, 0.52, -2.04);
  bodyGroup.add(headL, headR);
  geometries.push(headGeo);

  // 8. 4 sport wheels with glowing neon rim rings
  const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(0.22, 0.03, 8, 18);
  rimGeo.rotateY(Math.PI / 2);

  const wheelCoords: Array<[number, number, number]> = [
    [-0.92, 0.35, -1.25],
    [0.92, 0.35, -1.25],
    [-0.94, 0.35, 1.25],
    [0.94, 0.35, 1.25],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const wheel = new THREE.Mesh(tireGeo, tireMat);
    wheel.position.set(wx, wy, wz);
    const rim = new THREE.Mesh(rimGeo, cyanNeonMat);
    rim.position.x = wx < 0 ? -0.15 : 0.15;
    wheel.add(rim);
    group.add(wheel);
    wheels.push(wheel);
  }
  geometries.push(tireGeo, rimGeo);

  return { group, bodyGroup, wheels, boostFlames, materials, geometries };
}

export interface TrafficAssetLibrary {
  buildVehicle: (kind: TrafficKind, colorIndex: number) => THREE.Group;
  buildCoin: () => THREE.Group;
  dispose: () => void;
}

export function createTrafficAssetLibrary(shadowTex: THREE.Texture): TrafficAssetLibrary {
  const disposables: Array<{ dispose: () => void }> = [];

  const bodyColors = [0x1c1438, 0x261233, 0x10203a, 0x2a1826];
  const accentColors = [0xff3366, 0xff9e00, 0xbd00ff, 0x00e5ff];

  const bodyMats = bodyColors.map((c) => {
    const m = new THREE.MeshPhysicalMaterial({
      color: c,
      metalness: 0.72,
      roughness: 0.32,
      clearcoat: 0.65,
    });
    disposables.push(m);
    return m;
  });

  const accentMats = accentColors.map((c) => {
    const m = new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 2.1,
      roughness: 0.25,
    });
    disposables.push(m);
    return m;
  });

  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x080c18,
    metalness: 0.3,
    roughness: 0.14,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e14,
    roughness: 0.85,
    metalness: 0.08,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2a55,
    emissive: 0xff1e4d,
    emissiveIntensity: 2.3,
    roughness: 0.2,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  disposables.push(cabinMat, tireMat, tailMat, shadowMat);

  const shadowGeo = new THREE.PlaneGeometry(2.5, 4.9);
  shadowGeo.rotateX(-Math.PI / 2);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);

  // Sedan geometries
  const sedanBodyGeo = new THREE.BoxGeometry(1.78, 0.56, 3.85);
  const sedanCabGeo = new THREE.BoxGeometry(1.44, 0.42, 1.85);
  const sedanTailGeo = new THREE.BoxGeometry(1.48, 0.12, 0.08);
  const sedanStripGeo = new THREE.BoxGeometry(0.06, 0.07, 2.8);

  // Van geometries
  const vanBodyGeo = new THREE.BoxGeometry(1.96, 1.02, 4.65);
  const vanCabGeo = new THREE.BoxGeometry(1.8, 0.55, 1.25);
  const vanRoofStripeGeo = new THREE.BoxGeometry(1.65, 0.08, 0.22);

  // Coupe geometries
  const coupeBodyGeo = new THREE.BoxGeometry(1.72, 0.46, 3.7);
  const coupeCabGeo = new THREE.BoxGeometry(1.3, 0.34, 1.55);
  const coupeWingGeo = new THREE.BoxGeometry(1.76, 0.06, 0.3);

  // Coin geometries & materials
  const coinRimGeo = new THREE.TorusGeometry(0.46, 0.09, 10, 20);
  const coinCoreGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.12, 12);
  coinCoreGeo.rotateX(Math.PI / 2);
  const coinDiamondGeo = new THREE.OctahedronGeometry(0.2, 0);
  const coinShadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
  coinShadowGeo.rotateX(-Math.PI / 2);

  const coinGoldMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    emissive: 0xff9f1c,
    emissiveIntensity: 0.9,
    metalness: 0.85,
    roughness: 0.18,
  });
  const coinCoreMat = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00d9ff,
    emissiveIntensity: 1.5,
    metalness: 0.35,
    roughness: 0.25,
  });
  disposables.push(
    shadowGeo,
    wheelGeo,
    sedanBodyGeo,
    sedanCabGeo,
    sedanTailGeo,
    sedanStripGeo,
    vanBodyGeo,
    vanCabGeo,
    vanRoofStripeGeo,
    coupeBodyGeo,
    coupeCabGeo,
    coupeWingGeo,
    coinRimGeo,
    coinCoreGeo,
    coinDiamondGeo,
    coinShadowGeo,
    coinGoldMat,
    coinCoreMat,
  );

  function attachWheels(parent: THREE.Group, xOffset: number, zOffset: number): void {
    const coords: Array<[number, number]> = [
      [-xOffset, -zOffset],
      [xOffset, -zOffset],
      [-xOffset, zOffset],
      [xOffset, zOffset],
    ];
    for (const [wx, wz] of coords) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(wx, 0.34, wz);
      parent.add(w);
    }
  }

  function buildVehicle(kind: TrafficKind, colorIndex: number): THREE.Group {
    const g = new THREE.Group();
    const bMat = bodyMats[colorIndex % bodyMats.length];
    const aMat = accentMats[colorIndex % accentMats.length];

    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.015;
    g.add(shadow);

    if (kind === 'van') {
      const body = new THREE.Mesh(vanBodyGeo, bMat);
      body.position.set(0, 0.78, 0.15);
      const cab = new THREE.Mesh(vanCabGeo, cabinMat);
      cab.position.set(0, 1.0, -1.65);
      const bar = new THREE.Mesh(vanRoofStripeGeo, aMat);
      bar.position.set(0, 1.33, -1.35);
      const tail = new THREE.Mesh(sedanTailGeo, tailMat);
      tail.position.set(0, 0.65, 2.49);
      g.add(body, cab, bar, tail);
      attachWheels(g, 0.94, 1.48);
    } else if (kind === 'coupe') {
      const body = new THREE.Mesh(coupeBodyGeo, bMat);
      body.position.set(0, 0.46, 0);
      const cab = new THREE.Mesh(coupeCabGeo, cabinMat);
      cab.position.set(0, 0.82, 0.12);
      const wing = new THREE.Mesh(coupeWingGeo, aMat);
      wing.position.set(0, 0.94, 1.68);
      const tail = new THREE.Mesh(sedanTailGeo, tailMat);
      tail.position.set(0, 0.54, 1.86);
      const stripL = new THREE.Mesh(sedanStripGeo, aMat);
      stripL.position.set(-0.88, 0.34, 0);
      const stripR = new THREE.Mesh(sedanStripGeo, aMat);
      stripR.position.set(0.88, 0.34, 0);
      g.add(body, cab, wing, tail, stripL, stripR);
      attachWheels(g, 0.86, 1.18);
    } else {
      const body = new THREE.Mesh(sedanBodyGeo, bMat);
      body.position.set(0, 0.52, 0);
      const cab = new THREE.Mesh(sedanCabGeo, cabinMat);
      cab.position.set(0, 0.94, 0.1);
      const tail = new THREE.Mesh(sedanTailGeo, tailMat);
      tail.position.set(0, 0.58, 1.94);
      const stripL = new THREE.Mesh(sedanStripGeo, aMat);
      stripL.position.set(-0.91, 0.38, 0);
      const stripR = new THREE.Mesh(sedanStripGeo, aMat);
      stripR.position.set(0.91, 0.38, 0);
      g.add(body, cab, tail, stripL, stripR);
      attachWheels(g, 0.88, 1.24);
    }

    return g;
  }

  function buildCoin(): THREE.Group {
    const g = new THREE.Group();
    const spinGroup = new THREE.Group();
    spinGroup.name = 'coinBody';
    spinGroup.position.y = 0.82;

    const rim = new THREE.Mesh(coinRimGeo, coinGoldMat);
    const core = new THREE.Mesh(coinCoreGeo, coinCoreMat);
    const gem = new THREE.Mesh(coinDiamondGeo, coinGoldMat);
    gem.position.z = 0;

    spinGroup.add(rim, core, gem);

    const shadow = new THREE.Mesh(coinShadowGeo, shadowMat);
    shadow.position.y = 0.015;
    g.add(spinGroup, shadow);

    return g;
  }

  return {
    buildVehicle,
    buildCoin,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

export function createSynthwaveEnvironment(
  maxAnisotropy: number,
  roadWidth: number,
): SynthEnvironmentHandle {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Infinite synthwave grid ground plane at y = 0
  const gridTexture = createGridFloorTexture(maxAnisotropy);
  const gridGeo = new THREE.PlaneGeometry(340, 380);
  gridGeo.rotateX(-Math.PI / 2);
  const gridMat = new THREE.MeshBasicMaterial({
    map: gridTexture,
  });
  const gridMesh = new THREE.Mesh(gridGeo, gridMat);
  gridMesh.position.set(0, 0, -140);
  group.add(gridMesh);
  disposables.push(gridTexture, gridGeo, gridMat);

  // 2. Elevated highway deck at y = 0.03 (offset >= 0.02 from grid)
  const roadTexture = createRoadTexture(maxAnisotropy);
  const roadGeo = new THREE.PlaneGeometry(roadWidth, 380);
  roadGeo.rotateX(-Math.PI / 2);
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTexture,
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.25,
    emissive: 0x160a2e,
    emissiveIntensity: 0.35,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.position.set(0, 0.03, -140);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  disposables.push(roadTexture, roadGeo, roadMat);

  // 3. Glowing side barrier rails along highway edges
  const railGeo = new THREE.BoxGeometry(0.18, 0.26, 380);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00d9ff,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.4,
  });
  const railL = new THREE.Mesh(railGeo, railMat);
  railL.position.set(-roadWidth / 2 - 0.1, 0.14, -140);
  const railR = new THREE.Mesh(railGeo, railMat);
  railR.position.set(roadWidth / 2 + 0.1, 0.14, -140);
  group.add(railL, railR);
  disposables.push(railGeo, railMat);

  // 4. Segmented Synthwave Horizon Sun (custom shader with scanline cutouts)
  const sunGeo = new THREE.CircleGeometry(46, 64);
  const sunMaterial = new THREE.ShaderMaterial({
    transparent: true,
    fog: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float y = vUv.y;
        // Sunset gradient: warm gold top -> vibrant orange mid -> hot magenta bottom
        vec3 topCol = vec3(1.0, 0.92, 0.36);
        vec3 midCol = vec3(1.0, 0.36, 0.28);
        vec3 botCol = vec3(0.95, 0.08, 0.58);
        vec3 col = mix(botCol, midCol, smoothstep(0.08, 0.52, y));
        col = mix(col, topCol, smoothstep(0.52, 0.94, y));

        // Retro scanline slices in the lower 58% of the sun
        float alpha = 1.0;
        if (y < 0.58) {
          float band = fract((y - uTime * 0.025) * 14.0);
          float cutWidth = mix(0.46, 0.08, y / 0.58);
          if (band < cutWidth) {
            discard;
          }
        }
        gl_FragColor = vec4(col * 1.15, alpha);
      }
    `,
  });
  const sunMesh = new THREE.Mesh(sunGeo, sunMaterial);
  sunMesh.position.set(0, 28, -255);
  group.add(sunMesh);

  // Soft outer glow halo around sun
  const haloGeo = new THREE.CircleGeometry(72, 48);
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 256;
  haloCanvas.height = 256;
  const hctx = haloCanvas.getContext('2d')!;
  const hGrad = hctx.createRadialGradient(128, 128, 36, 128, 128, 128);
  hGrad.addColorStop(0, 'rgba(255, 55, 145, 0.55)');
  hGrad.addColorStop(0.5, 'rgba(168, 35, 195, 0.18)');
  hGrad.addColorStop(1, 'rgba(11, 5, 24, 0)');
  hctx.fillStyle = hGrad;
  hctx.fillRect(0, 0, 256, 256);
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  const haloMat = new THREE.MeshBasicMaterial({
    map: haloTex,
    transparent: true,
    fog: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.set(0, 28, -258);
  group.add(haloMesh);
  disposables.push(sunGeo, sunMaterial, haloGeo, haloTex, haloMat);

  // 5. Flanking Synthwave Wireframe Mountains (scrolling 2-chunk loop)
  const mountainSegments: THREE.Group[] = [];
  const mountainBodyMat = new THREE.MeshStandardMaterial({
    color: 0x0b051c,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
  });
  const mountainWireMat = new THREE.MeshBasicMaterial({
    color: 0x9d4edd,
    wireframe: true,
    transparent: true,
    opacity: 0.62,
  });
  disposables.push(mountainBodyMat, mountainWireMat);

  const chunkLength = 160;
  const segWidth = 64;
  const cols = 12;
  const rows = 16;
  const mGeo = new THREE.PlaneGeometry(segWidth, chunkLength, cols, rows);
  mGeo.rotateX(-Math.PI / 2);
  const pos = mGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    // vx goes from -32 (outer edge) to +32 (inner road-facing edge when placed at x=-46)
    const distFromInnerEdge = Math.max(0, 32 - vx); // 0 at road edge, 64 at outer edge
    const edgeFactor = Math.min(1, Math.max(0, (distFromInnerEdge - 6) / 34));
    const phaseZ = (vz / chunkLength) * Math.PI * 2;
    const ridge =
      Math.sin(phaseZ * 2 + vx * 0.16) * 5.2 +
      Math.cos(phaseZ * 3 - vx * 0.22) * 3.8 +
      Math.sin(phaseZ + vx * 0.1) * 3.0;
    const h = Math.max(0, (ridge + 7.2) * edgeFactor * 1.3);
    pos.setY(i, h);
  }
  mGeo.computeVertexNormals();
  disposables.push(mGeo);

  for (let c = 0; c < 2; c++) {
    const seg = new THREE.Group();
    const leftM = new THREE.Mesh(mGeo, mountainBodyMat);
    leftM.position.set(-46, 0.02, 0);
    const leftW = new THREE.Mesh(mGeo, mountainWireMat);
    leftW.position.set(-46, 0.05, 0);

    const rightM = new THREE.Mesh(mGeo, mountainBodyMat);
    rightM.position.set(46, 0.02, 0);
    rightM.scale.x = -1;
    const rightW = new THREE.Mesh(mGeo, mountainWireMat);
    rightW.position.set(46, 0.05, 0);
    rightW.scale.x = -1;

    seg.add(leftM, leftW, rightM, rightW);
    seg.position.z = -60 - c * chunkLength;
    group.add(seg);
    mountainSegments.push(seg);
  }

  // 6. Night Starfield
  const starCount = 360;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 360;
    starPositions[i * 3 + 1] = 28 + Math.random() * 110;
    starPositions[i * 3 + 2] = -120 - Math.random() * 190;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xd8f3ff,
    size: 1.15,
    sizeAttenuation: true,
    fog: false,
    transparent: true,
    opacity: 0.78,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);
  disposables.push(starGeo, starMat);

  return {
    group,
    roadTexture,
    gridTexture,
    sunMaterial,
    mountainSegments,
    disposables,
  };
}

interface ParticleSlot {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
}

export class ParticlePool {
  public readonly mesh: THREE.InstancedMesh;
  private readonly capacity: number;
  private readonly slots: ParticleSlot[] = [];
  private cursor = 0;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.Material;

  constructor(capacity = 140) {
    this.capacity = capacity;
    this.geometry = new THREE.OctahedronGeometry(0.18, 0);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < capacity; i++) {
      this.slots.push({
        active: false,
        life: 0,
        maxLife: 1,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      this.mesh.setColorAt(i, _color.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    hexColors: number[],
    speedScale: number,
    lifeRange: [number, number],
  ): void {
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const slot = this.slots[idx];

      const angle = Math.random() * Math.PI * 2;
      const up = 0.35 + Math.random() * 0.95;
      const spd = (0.45 + Math.random() * 0.85) * speedScale;

      slot.active = true;
      slot.life = 0;
      slot.maxLife = lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0]);
      slot.x = x + (Math.random() - 0.5) * 0.4;
      slot.y = y + Math.random() * 0.3;
      slot.z = z + (Math.random() - 0.5) * 0.4;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = up * spd;
      slot.vz = Math.sin(angle) * spd;
      slot.scale = 0.8 + Math.random() * 0.9;

      const hex = hexColors[i % hexColors.length];
      _color.setHex(hex);
      this.mesh.setColorAt(idx, _color);
    }
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  public update(dt: number, roadSpeed: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.capacity; i++) {
      const slot = this.slots[i];
      if (!slot.active) continue;

      anyChanged = true;
      slot.life += dt;
      if (slot.life >= slot.maxLife) {
        slot.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      slot.vy -= 14 * dt;
      slot.x += slot.vx * dt;
      slot.y = Math.max(0.08, slot.y + slot.vy * dt);
      slot.z += (slot.vz + roadSpeed * 0.35) * dt;

      const t = 1 - slot.life / slot.maxLife;
      _dummy.position.set(slot.x, slot.y, slot.z);
      _dummy.rotation.set(slot.life * 7, slot.life * 5, 0);
      _dummy.scale.setScalar(slot.scale * t);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }

    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.slots[i].active = false;
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
