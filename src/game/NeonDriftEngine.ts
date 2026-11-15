import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SynthAudio } from './audio';
import {
  ParticlePool,
  PlayerCarHandle,
  SynthEnvironmentHandle,
  TrafficAssetLibrary,
  createContactShadowTexture,
  createPlayerCar,
  createSynthwaveEnvironment,
  createTrafficAssetLibrary,
} from './models';
import {
  BASE_SPEED,
  MAX_SPEED,
  ROAD_WIDTH,
  createInitialState,
  loadBestScore,
  resetForNewRun,
  saveBestScore,
  stepSimulation,
  toHudSnapshot,
} from './simulation';
import { GamePhase, HudSnapshot, SimulationState } from './types';

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class NeonDriftEngine {
  private readonly container: HTMLElement;
  private readonly onHudChange: (snapshot: HudSnapshot) => void;
  private readonly onContextStatus?: (lost: boolean) => void;

  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly audio: SynthAudio;
  private readonly state: SimulationState;

  private readonly shadowTex: THREE.CanvasTexture;
  private readonly env: SynthEnvironmentHandle;
  private readonly playerCar: PlayerCarHandle;
  private readonly assetLib: TrafficAssetLibrary;
  private readonly particles: ParticlePool;
  private readonly envMap: THREE.Texture;

  private readonly trafficMeshes = new Map<number, THREE.Group>();
  private readonly coinMeshes = new Map<number, THREE.Group>();

  private readonly keysPressed = new Set<string>();
  private touchSteer = 0; // -1, 0, +1
  private trauma = 0;
  private elapsedClock = 0;
  private lastTimeMs = 0;
  private lastHudSyncMs = 0;
  private lastSyncedPhase: GamePhase | null = null;
  private lastSyncedScore = -1;
  private lastSyncedCoins = -1;

  private rafId = 0;
  private timeoutId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  private readonly _camPosTarget = new THREE.Vector3();
  private readonly _camLookTarget = new THREE.Vector3();
  private readonly _camLookCurrent = new THREE.Vector3(0, 1.1, -18);

  constructor(
    container: HTMLElement,
    onHudChange: (snapshot: HudSnapshot) => void,
    initialAutostart: boolean,
    onContextStatus?: (lost: boolean) => void,
  ) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.onContextStatus = onContextStatus;
    this.isSoftwareGl = detectSoftwareGl();

    this.audio = new SynthAudio();
    const initialBest = loadBestScore();
    this.state = createInitialState(initialAutostart ? 'playing' : 'title', initialBest);
    document.body.dataset.state = this.state.phase;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const bgHex = 0x0b0518;
    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.FogExp2(bgHex, 0.0095);

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 400);
    this.camera.position.set(0, 3.6, 8.2);
    this.camera.lookAt(this._camLookCurrent);
    this.renderer.setSize(width, height, false);

    // Mandatory studio environment map for metallic & clearcoat reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    pmrem.dispose();

    // Warm/cool 3-point lighting rig
    const hemi = new THREE.HemisphereLight(0x88d4ff, 0x3b0b47, 1.05);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffb56b, 2.2);
    keyLight.position.set(12, 22, 16);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 65;
      keyLight.shadow.camera.left = -16;
      keyLight.shadow.camera.right = 16;
      keyLight.shadow.camera.top = 18;
      keyLight.shadow.camera.bottom = -18;
      keyLight.shadow.bias = -0.0005;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff2d95, 1.35);
    rimLight.position.set(-14, 10, -28);
    this.scene.add(rimLight);

    // Build procedural environment, player supercar, traffic library & particle pool
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.shadowTex = createContactShadowTexture();
    this.env = createSynthwaveEnvironment(maxAnisotropy, ROAD_WIDTH);
    this.scene.add(this.env.group);

    this.playerCar = createPlayerCar(this.shadowTex);
    this.scene.add(this.playerCar.group);

    this.assetLib = createTrafficAssetLibrary(this.shadowTex);
    this.particles = new ParticlePool(140);
    this.scene.add(this.particles.mesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.syncHud(true);

    this.lastTimeMs = performance.now();
    this.scheduleNextFrame();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.onContextStatus?.(true);
  };

  private handleContextRestored = (): void => {
    this.onContextStatus?.(false);
  };

  private handleBlur = (): void => {
    this.keysPressed.clear();
    this.touchSteer = 0;
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.keysPressed.clear();
      this.touchSteer = 0;
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    if (e.repeat) {
      this.keysPressed.add(code);
      return;
    }

    this.keysPressed.add(code);

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      if (this.state.phase === 'playing' && !this.state.crashing) {
        this.pauseGame();
      } else if (this.state.phase === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (code === 'Enter' || code === 'Space') {
      if (this.state.phase === 'title' || this.state.phase === 'gameover') {
        this.startOrRestart();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.code);
  };

  public setTouchSteer(dir: number): void {
    this.touchSteer = Math.max(-1, Math.min(1, dir));
  }

  public startOrRestart(): void {
    this.audio.unlock();
    this.audio.playUiConfirm();
    this.keysPressed.clear();
    this.touchSteer = 0;
    this.trauma = 0;

    this.clearDynamicMeshes();
    this.particles.clear();
    resetForNewRun(this.state);
    document.body.dataset.state = 'playing';

    this.audio.setEngineActive(true);
    this.syncHud(true);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  public pauseGame(): void {
    if (this.state.phase !== 'playing' || this.state.crashing) return;
    this.state.phase = 'paused';
    document.body.dataset.state = 'paused';
    this.audio.setEngineActive(false);
    this.keysPressed.clear();
    this.touchSteer = 0;
    this.syncHud(true);
  }

  public resumeGame(): void {
    if (this.state.phase !== 'paused') return;
    this.audio.unlock();
    this.state.phase = 'playing';
    document.body.dataset.state = 'playing';
    this.audio.setEngineActive(true);
    this.lastTimeMs = performance.now();
    this.syncHud(true);
  }

  public returnToTitle(): void {
    this.clearDynamicMeshes();
    this.particles.clear();
    const preservedBest = this.state.bestScore;
    Object.assign(this.state, createInitialState('title', preservedBest));
    document.body.dataset.state = 'title';
    this.audio.setEngineActive(false);
    this.keysPressed.clear();
    this.touchSteer = 0;
    this.trauma = 0;
    this.syncHud(true);
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    if (this.state.phase === 'playing' && !this.state.crashing && !this.audio.isMuted()) {
      this.audio.setEngineActive(true);
    }
    this.syncHud(true);
  }

  private clearDynamicMeshes(): void {
    for (const mesh of this.trafficMeshes.values()) {
      this.scene.remove(mesh);
    }
    this.trafficMeshes.clear();

    for (const mesh of this.coinMeshes.values()) {
      this.scene.remove(mesh);
    }
    this.coinMeshes.clear();
  }

  private getSteerInput(): number {
    let steer = 0;
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('KeyA')) {
      steer -= 1;
    }
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('KeyD')) {
      steer += 1;
    }
    if (steer === 0 && this.touchSteer !== 0) {
      steer = this.touchSteer;
    }
    return steer;
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.timeoutId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (status === gl.UNSIGNALED) {
        this.timeoutId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.timeoutId = window.setTimeout(cb, 80);
      }
    };
    this.timeoutId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const rawDt = Math.max(0, (nowMs - this.lastTimeMs) / 1000);
    this.lastTimeMs = nowMs;
    const dt = Math.min(rawDt, 0.05);
    this.elapsedClock += dt;

    const steer = this.getSteerInput();
    const events = stepSimulation(this.state, dt, { steer });

    // Trigger juice for coin pickups & crashes
    for (const pickup of events.pickedCoins) {
      this.audio.playCoin();
      this.particles.spawnBurst(
        pickup.x,
        0.85,
        pickup.z,
        14,
        [0xffd166, 0x00f5ff, 0xffffff],
        9.5,
        [0.25, 0.55],
      );
    }

    if (events.crashedAt) {
      this.audio.playCrash();
      this.trauma = 1.0;
      this.particles.spawnBurst(
        events.crashedAt.x,
        0.8,
        events.crashedAt.z,
        34,
        [0xff2d95, 0xff9e00, 0x00f5ff, 0xffffff],
        15,
        [0.45, 0.9],
      );
    }

    if (events.enteredGameOver) {
      document.body.dataset.state = 'gameover';
      saveBestScore(this.state.bestScore);
      this.syncHud(true);
    }

    this.updateSceneObjects(dt, steer);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);

    // Update engine audio pitch
    if (this.state.phase === 'playing' && !this.state.crashing) {
      const speedRatio = (this.state.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
      this.audio.updateEngine(Math.max(0, Math.min(1, speedRatio)), Math.abs(steer));
    }

    this.syncHud(false, nowMs);
    this.scheduleNextFrame();
  };

  private updateSceneObjects(dt: number, steer: number): void {
    const isMoving = this.state.phase === 'playing' || this.state.phase === 'title';
    const worldSpeed = isMoving ? this.state.speed : 0;

    // Scroll highway road & grid textures seamlessly
    if (worldSpeed > 0) {
      const roadUvDelta = (worldSpeed * dt) / 27.14;
      this.env.roadTexture.offset.y = (this.env.roadTexture.offset.y + roadUvDelta) % 1;
      const gridUvDelta = (worldSpeed * dt) / 12.66;
      this.env.gridTexture.offset.y = (this.env.gridTexture.offset.y + gridUvDelta) % 1;

      // Scroll flanking wireframe mountain chunks
      const chunkLength = 160;
      for (const seg of this.env.mountainSegments) {
        seg.position.z += worldSpeed * dt;
        if (seg.position.z > 90) {
          seg.position.z -= chunkLength * 2;
        }
      }
    }

    this.env.sunMaterial.uniforms.uTime.value = this.elapsedClock;

    // Update player car transform & wheel spin
    this.playerCar.group.position.set(this.state.playerX, 0, 0);
    this.playerCar.bodyGroup.rotation.z = this.state.playerRoll;
    this.playerCar.bodyGroup.rotation.y = this.state.playerYaw;
    const wheelSpin = worldSpeed * dt * 1.4;
    for (let i = 0; i < this.playerCar.wheels.length; i++) {
      this.playerCar.wheels[i].rotation.x -= wheelSpin;
      if (i < 2) {
        this.playerCar.wheels[i].rotation.y = -steer * 0.24;
      }
    }

    // Pulse boost flames slightly with speed
    const speedRatio = Math.max(0, (this.state.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    const flamePulse = 0.85 + Math.sin(this.elapsedClock * 38) * 0.2 + speedRatio * 0.6;
    for (const flame of this.playerCar.boostFlames) {
      flame.visible = isMoving && !this.state.crashing;
      flame.scale.set(1, 1, flamePulse);
    }

    // Sync traffic meshes
    const activeTrafficIds = new Set<number>();
    for (const car of this.state.traffic) {
      activeTrafficIds.add(car.id);
      let mesh = this.trafficMeshes.get(car.id);
      if (!mesh) {
        mesh = this.assetLib.buildVehicle(car.kind, car.colorIndex);
        this.trafficMeshes.set(car.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(car.x, 0, car.z);
    }
    for (const [id, mesh] of this.trafficMeshes.entries()) {
      if (!activeTrafficIds.has(id)) {
        this.scene.remove(mesh);
        this.trafficMeshes.delete(id);
      }
    }

    // Sync coin meshes
    const activeCoinIds = new Set<number>();
    for (const coin of this.state.coinItems) {
      activeCoinIds.add(coin.id);
      let mesh = this.coinMeshes.get(coin.id);
      if (!mesh) {
        mesh = this.assetLib.buildCoin();
        this.coinMeshes.set(coin.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(coin.x, 0, coin.z);
      const body = mesh.getObjectByName('coinBody');
      if (body) {
        body.rotation.y = this.elapsedClock * 3.4 + coin.phaseOffset;
        body.position.y = 0.82 + Math.sin(this.elapsedClock * 4.5 + coin.phaseOffset) * 0.14;
      }
    }
    for (const [id, mesh] of this.coinMeshes.entries()) {
      if (!activeCoinIds.has(id)) {
        this.scene.remove(mesh);
        this.coinMeshes.delete(id);
      }
    }

    // Update particle pool
    if (this.state.phase !== 'paused') {
      this.particles.update(dt, worldSpeed);
    }
  }

  private updateCamera(dt: number): void {
    if (this.state.phase === 'title') {
      // Sweeping hero showcase cruise angle
      const sway = Math.sin(this.elapsedClock * 0.45) * 1.6;
      this._camPosTarget.set(this.state.playerX * 0.55 + sway, 3.25, 7.8);
      this._camLookTarget.set(this.state.playerX * 0.35, 1.35, -24);
      const targetFov = 58;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    } else {
      // Dynamic chase cam with speed-scaled FOV and lateral damping
      const speedRatio = Math.max(0, (this.state.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
      const targetFov = 62 + speedRatio * 14;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this._camPosTarget.set(this.state.playerX * 0.72, 3.45 + speedRatio * 0.35, 7.6);
      this._camLookTarget.set(this.state.playerX * 0.52, 1.25, -22);
    }

    this.camera.updateProjectionMatrix();
    const k = 1 - Math.exp(-8.5 * dt);
    this.camera.position.lerp(this._camPosTarget, k);
    this._camLookCurrent.lerp(this._camLookTarget, k);

    // Trauma^2 crash shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
      const shake = this.trauma * this.trauma;
      this.camera.position.x += (Math.random() * 2 - 1) * 0.65 * shake;
      this.camera.position.y += (Math.random() * 2 - 1) * 0.45 * shake;
    }

    this.camera.lookAt(this._camLookCurrent);
    if (this.state.phase === 'playing') {
      this.camera.rotation.z += -this.state.playerRoll * 0.25;
    }
  }

  private syncHud(force: boolean, nowMs = performance.now()): void {
    const scoreChanged = this.state.score !== this.lastSyncedScore;
    const coinsChanged = this.state.coins !== this.lastSyncedCoins;
    const phaseChanged = this.state.phase !== this.lastSyncedPhase;
    const intervalElapsed = nowMs - this.lastHudSyncMs >= 85;

    if (force || phaseChanged || (intervalElapsed && (scoreChanged || coinsChanged || this.state.phase === 'playing'))) {
      this.lastHudSyncMs = nowMs;
      this.lastSyncedPhase = this.state.phase;
      this.lastSyncedScore = this.state.score;
      this.lastSyncedCoins = this.state.coins;
      this.onHudChange(toHudSnapshot(this.state, this.audio.isMuted()));
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.timeoutId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this.handleResize);
    }

    this.audio.dispose();
    this.clearDynamicMeshes();
    this.particles.dispose();
    this.assetLib.dispose();
    this.shadowTex.dispose();
    this.envMap.dispose();
    for (const d of this.env.disposables) d.dispose();
    for (const g of this.playerCar.geometries) g.dispose();
    for (const m of this.playerCar.materials) m.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
