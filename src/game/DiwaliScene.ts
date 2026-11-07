import * as Phaser from "phaser";
import { FireworksSequence } from "./FireworksSequence";
import type { GiftAudio } from "../lib/audio";

interface GameCallbacks {
  audio: GiftAudio;
  reducedMotion: boolean;
  lowPower: boolean;
  onReady: () => void;
  onLoadProgress: (progress: number) => void;
  onLoadError: (resource: string) => void;
  onFireworksStart: () => void;
  onGreeting: () => void;
  onFade: () => void;
}

type GamePhase = "sparkler" | "fuse" | "launching" | "fireworks" | "firework-fade" | "complete";

const FUSE_BURN_DURATION = 2500;
const ROCKET_FLIGHT_DURATION = 5000;
const FIREWORKS_FADE_DURATION = 2000;
const ROCKET_FIREWORKS_AUDIO_FADE_DURATION = 1750;
const ROCKET_FADE_START_PROGRESS = 0.72;
const ROCKET_TOP_MARGIN_REM = 3;
const FUSE_COLLISION_RADIUS = 22;
const DIWALI_BACKGROUND_URL = new URL("../../assets/game-background.png", import.meta.url).href;
const ROCKET_ART_URL = new URL("../../assets/rocket-game.png", import.meta.url).href;
const SPARKLER_ART_URL = new URL("../../assets/fuljari-game.png", import.meta.url).href;
const ROCKET_FIREWORKS_AUDIO_URL = new URL(
  "../../assets/rocket-after-lauch-sound.mp3",
  import.meta.url,
).href;
const JETHALAL_FIREWORKS_AUDIO_URL = new URL(
  "../../assets/jethalal-sings-happy-diwali-dialogue-with-beats-heppy-diwali-2020-akshayediting_GzcHRFnA.mp3",
  import.meta.url,
).href;
const ROCKET_FUSE_PATH = [
  { x: 0.38, y: 0.6 },
  { x: 0.405, y: 0.58 },
  { x: 0.385, y: 0.56 },
  { x: 0.405, y: 0.54 },
  { x: 0.405, y: 0.52 },
] as const;
const SPARKLER_TIP = { x: 0.525, y: 0.36 };
const EMULATED_MOUSE_GUARD_MS = 750;

export class DiwaliScene extends Phaser.Scene {
  private readonly callbacks: GameCallbacks;
  private phase: GamePhase = "sparkler";
  private width = 0;
  private height = 0;
  private groundY = 0;
  private rocketHeight = 0;
  private launchProgress = 0;
  private rocketTargetY = 0;
  private rocketLaunchStartTop = 0;
  private launchComplete = false;
  private blackoutComplete = false;
  private fireworkVisualFadeComplete = false;
  private fireworksAudioFadeComplete = false;
  private fadeStarted = false;
  private smokeElapsed = 0;
  private fuseElapsed = 0;
  private fuseBurnProgress = 0;
  private pointerActive = false;
  private activePointerId: number | null = null;
  private lastTouchTime = Number.NEGATIVE_INFINITY;
  private spaceDown = false;
  private targetX = 0;
  private targetY = 0;
  private lastX = 0;
  private lastY = 0;
  private sparkler!: Phaser.GameObjects.Image;
  private rocket!: Phaser.GameObjects.Image;
  private blackoutOverlay!: Phaser.GameObjects.Rectangle;
  private fuseBurn!: Phaser.GameObjects.Graphics;
  private fuseFlame!: Phaser.GameObjects.Ellipse;
  private fuseGlow!: Phaser.GameObjects.Arc;
  private background!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.Graphics;
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fuseEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireworks!: FireworksSequence;
  private stars: Phaser.GameObjects.Arc[] = [];
  private diyas: Phaser.GameObjects.Arc[] = [];
  private diyaBases: Phaser.GameObjects.Ellipse[] = [];
  private rocketStartY = 0;
  private rocketX = 0;
  private fuseX = 0;
  private fuseY = 0;
  private essentialAssetFailed = false;
  private keyboardRelease?: Phaser.Time.TimerEvent;
  private readonly onPointerCancel = () => this.onPointerUp();
  private readonly onInterruption = () => this.onPointerUp();
  private readonly onVisibilityChange = () => {
    if (document.visibilityState !== "visible") this.onPointerUp();
  };

  constructor(callbacks: GameCallbacks) {
    super({ key: "DiwaliScene" });
    this.callbacks = callbacks;
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.PROGRESS, this.callbacks.onLoadProgress);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.type === "audio") {
        console.error(`The fireworks audio could not be loaded: ${file.src}`);
        return;
      }
      this.essentialAssetFailed = true;
      this.callbacks.onLoadError(file.src);
    });
    this.load.image("diwali-background", DIWALI_BACKGROUND_URL);
    this.load.image("rocket-art", ROCKET_ART_URL);
    this.load.image("sparkler-art", SPARKLER_ART_URL);
  }

  create(): void {
    if (this.essentialAssetFailed) {
      this.scene.stop();
      return;
    }

    this.width = this.scale.width;
    this.height = this.scale.height;

    this.background = this.add.tileSprite(0, 0, this.width, this.height, "diwali-background")
      .setOrigin(0)
      .setAlpha(0.42);
    this.ground = this.add.graphics();
    this.createStars();
    this.createDiyas();
    this.createSparkTexture();
    this.createEmitters();
    this.fireworks = new FireworksSequence(this, {
      audio: this.callbacks.audio,
      lowPower: this.callbacks.lowPower,
      reducedMotion: this.callbacks.reducedMotion,
    });
    this.load.audio("rocket-fireworks", ROCKET_FIREWORKS_AUDIO_URL);
    this.load.audio("jethalal-fireworks", JETHALAL_FIREWORKS_AUDIO_URL);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.cache.audio.exists("rocket-fireworks")) {
        this.fireworks.setRocketFireworksSound(this.sound.add("rocket-fireworks"));
      }
      if (this.cache.audio.exists("jethalal-fireworks")) {
        this.fireworks.setJethalalFireworksSound(this.sound.add("jethalal-fireworks"));
      }
    });
    this.load.start();

    this.rocket = this.add.image(0, 0, "rocket-art").setOrigin(0.5, 0.5);
    this.fuseBurn = this.add.graphics().setDepth(3);
    this.sparkler = this.add.image(0, 0, "sparkler-art")
      .setOrigin(SPARKLER_TIP.x, SPARKLER_TIP.y)
      .setDepth(5);
    this.fuseFlame = this.add.ellipse(0, 0, 8, 14, 0xff762e, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false)
      .setDepth(5);
    this.fuseGlow = this.add.circle(0, 0, 8, 0xffa52f, 0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false)
      .setDepth(4);
    this.blackoutOverlay = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
      .setOrigin(0)
      .setAlpha(0)
      .setVisible(false)
      .setDepth(10);

    this.layout(this.width, this.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.keyboard?.on("keydown", this.onKeyDown, this);
    this.input.keyboard?.on("keyup", this.onKeyUp, this);
    this.game.canvas.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("blur", this.onInterruption);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.callbacks.onReady();
  }

  update(_time: number, delta: number): void {
    if (this.phase === "fuse") {
      this.fuseElapsed = Math.min(this.fuseElapsed + delta, FUSE_BURN_DURATION);
      this.fuseBurnProgress = this.fuseElapsed / FUSE_BURN_DURATION;
      const burnPoint = this.drawFuseBurn();
      this.fuseEmitter.emitParticleAt(burnPoint.x, burnPoint.y, this.callbacks.lowPower ? 2 : 3);
      this.smokeElapsed += delta;
      if (this.smokeElapsed >= 120) {
        this.smokeEmitter.emitParticleAt(burnPoint.x, burnPoint.y, 1);
        this.smokeElapsed %= 120;
      }
      return;
    }
    if (this.phase === "fireworks") {
      this.fireworks.update(delta);
      if (this.fireworks.isComplete) {
        this.phase = "firework-fade";
        this.callbacks.onFade();
        this.fireworksAudioFadeComplete = false;
        this.fireworkVisualFadeComplete = false;
        void this.callbacks.audio
          .fadeOutFireworksAudio(this.tweens, ROCKET_FIREWORKS_AUDIO_FADE_DURATION)
          .then(() => {
            this.fireworksAudioFadeComplete = true;
            this.tryCompleteFireworksFade();
          });
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.fireworkVisualFadeComplete = true;
          this.tryCompleteFireworksFade();
        });
        this.cameras.main.fadeOut(FIREWORKS_FADE_DURATION, 0, 0, 0);
      }
      return;
    }
    if (this.phase !== "sparkler") return;

    const smoothing = 1 - Math.exp(-delta * 0.018);
    this.sparkler.x = Phaser.Math.Linear(this.sparkler.x, this.targetX, smoothing);
    this.sparkler.y = Phaser.Math.Linear(this.sparkler.y, this.targetY, smoothing);
    const dx = this.targetX - this.lastX;
    const dy = this.targetY - this.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 0.4) {
      const desiredRotation = Math.atan2(dx, -dy);
      this.sparkler.rotation = Phaser.Math.Angle.RotateTo(this.sparkler.rotation, desiredRotation, 0.055);
      this.lastX = this.targetX;
      this.lastY = this.targetY;
    }
    if (this.pointerActive) {
      this.sparkEmitter.emitParticleAt(this.sparkler.x, this.sparkler.y, this.callbacks.lowPower ? 1 : 2);
    }

    if (
      this.pointerActive &&
      Phaser.Math.Distance.Between(this.sparkler.x, this.sparkler.y, this.fuseX, this.fuseY) <
        Math.max(FUSE_COLLISION_RADIUS, this.width * 0.035)
    ) {
      this.igniteFuse();
    }
  }

  private createStars(): void {
    const count = this.callbacks.lowPower ? 28 : 48;
    for (let index = 0; index < count; index += 1) {
      const star = this.add.circle(
        Math.random() * this.width,
        Math.random() * this.height * 0.74,
        Math.random() < 0.16 ? 1.7 : 1,
        0xffe6ad,
        0.25 + Math.random() * 0.55,
      );
      star.setData("xRatio", star.x / this.width);
      star.setData("yRatio", star.y / this.height);
      this.stars.push(star);
    }
  }

  private createDiyas(): void {
    for (const ratio of [0.11, 0.89]) {
      const base = this.add.ellipse(0, 0, 42, 13, 0xa84b33);
      base.setData("ratio", ratio);
      this.diyaBases.push(base);
      const glow = this.add.circle(0, 0, 27, 0xff9d35, 0.13).setBlendMode(Phaser.BlendModes.ADD);
      const flame = this.add.circle(0, 0, 6, 0xffdc77, 0.95).setBlendMode(Phaser.BlendModes.ADD);
      glow.setData("ratio", ratio);
      flame.setData("ratio", ratio);
      this.diyas.push(glow, flame);
    }
  }

  private createSparkTexture(): void {
    const spark = this.make.graphics({ x: 0, y: 0 });
    spark.fillStyle(0xffffff, 1);
    spark.fillCircle(5, 5, 5);
    spark.generateTexture("gift-spark", 10, 10);
    spark.destroy();
  }

  private createEmitters(): void {
    this.sparkEmitter = this.add.particles(0, 0, "gift-spark", {
      speed: { min: 20, max: 125 },
      angle: { min: 70, max: 285 },
      lifespan: { min: 220, max: 620 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe59a, 0xffaa36, 0xff7651],
      gravityY: 80,
      maxParticles: this.callbacks.lowPower ? 34 : 64,
      frequency: -1,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(4);
    this.sparkEmitter.stop();

    this.fuseEmitter = this.add.particles(0, 0, "gift-spark", {
      speed: { min: 24, max: 175 },
      angle: { min: 205, max: 335 },
      lifespan: { min: 360, max: 850 },
      scale: { start: 1.05, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe79a, 0xffad39, 0xf45c31],
      gravityY: 120,
      maxParticles: this.callbacks.lowPower ? 48 : 80,
      frequency: -1,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(4);
    this.fuseEmitter.stop();

    this.smokeEmitter = this.add.particles(0, 0, "gift-spark", {
      speed: { min: 8, max: 32 },
      angle: { min: 248, max: 292 },
      lifespan: { min: 650, max: 1250 },
      scale: { start: 0.3, end: 1.1 },
      alpha: { start: 0.35, end: 0 },
      tint: [0x9e9aaa, 0x6f6a7d],
      gravityY: -10,
      maxParticles: this.callbacks.lowPower ? 18 : 28,
      frequency: -1,
      blendMode: Phaser.BlendModes.NORMAL,
    }).setDepth(4);
    this.smokeEmitter.stop();

    this.trailEmitter = this.add.particles(0, 0, "gift-spark", {
      speed: { min: 18, max: 105 },
      angle: { min: 70, max: 110 },
      lifespan: { min: 350, max: 820 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: [0xffe598, 0xffa233, 0xd8d7e8],
      gravityY: 45,
      maxParticles: this.callbacks.lowPower ? 52 : 88,
      frequency: -1,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(3);
    this.trailEmitter.stop();

  }

  private layout(width: number, height: number): void {
    const previousWidth = this.width;
    const previousHeight = this.height;
    this.width = width;
    this.height = height;
    const portrait = height >= width;
    this.groundY = height * (portrait ? 0.84 : 0.82);
    this.blackoutOverlay.setSize(width, height);
    this.background.setSize(width, height);
    this.background.setPosition(0, 0);

    this.stars.forEach((star) => {
      star.setPosition(star.getData("xRatio") * width, star.getData("yRatio") * height);
    });

    this.ground.clear();
    this.ground.fillStyle(0x171628, 0.96);
    this.ground.fillRect(0, this.groundY, width, height - this.groundY);
    this.ground.lineStyle(2, 0x8b5963, 0.55);
    this.ground.lineBetween(0, this.groundY, width, this.groundY);
    this.ground.lineStyle(1, 0xf0b968, 0.13);
    this.ground.lineBetween(0, this.groundY + 9, width, this.groundY + 9);

    this.diyas.forEach((diya) => {
      const ratio = diya.getData("ratio");
      diya.setPosition(width * ratio, this.groundY - (diya.radius > 10 ? 9 : 23));
    });
    this.diyaBases.forEach((base) => base.setPosition(width * base.getData("ratio"), this.groundY - 5));

    this.rocketHeight = Math.min(height * (portrait ? 0.3 : 0.46), width * (portrait ? 0.39 : 0.25), 300);
    this.rocket.setDisplaySize(this.rocketHeight * (512 / 768), this.rocketHeight);
    this.rocketX = width * (portrait ? 0.74 : 0.79);
    this.rocketStartY = this.groundY - this.rocketHeight * 0.5;
    this.rocket.setPosition(this.rocketX, this.rocketStartY);
    this.rocketTargetY = this.rocket.y + this.rocketTopMargin() - this.rocket.getBounds().top;
    this.fuseX = this.rocketX + (ROCKET_FUSE_PATH[0].x - 0.5) * this.rocket.displayWidth;
    this.fuseY = this.rocketStartY + (ROCKET_FUSE_PATH[0].y - 0.5) * this.rocket.displayHeight;
    this.fuseGlow.setPosition(this.fuseX, this.fuseY);
    if (this.phase === "fuse") this.drawFuseBurn();

    const sparklerHeight = Math.min(height * 0.2, 154);
    this.sparkler.setDisplaySize(sparklerHeight * (640 / 714), sparklerHeight);
    if (this.targetX === 0 && this.targetY === 0) {
      const boundary = this.sparklerBoundary();
      this.targetX = Phaser.Math.Clamp(width * 0.2, boundary, width - boundary);
      this.targetY = Phaser.Math.Clamp(height * 0.71, boundary, height - boundary);
      this.sparkler.setPosition(this.targetX, this.targetY);
      this.lastX = this.targetX;
      this.lastY = this.targetY;
    } else {
      const boundary = this.sparklerBoundary();
      this.targetX = Phaser.Math.Clamp((this.targetX / previousWidth) * width, boundary, width - boundary);
      this.targetY = Phaser.Math.Clamp((this.targetY / previousHeight) * height, boundary, height - boundary);
      this.sparkler.setPosition(this.targetX, this.targetY);
      this.lastX = this.targetX;
      this.lastY = this.targetY;
    }
    if (this.phase === "launching") {
      this.rocket.y = Phaser.Math.Linear(this.rocketStartY, this.rocketTargetY, this.launchProgress);
      const currentTop = this.rocket.getBounds().top;
      this.rocketLaunchStartTop = this.launchProgress < 1
        ? (currentTop - this.rocketTopMargin() * this.launchProgress) / (1 - this.launchProgress)
        : currentTop;
      this.updateRocketFade();
    }
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.onPointerUp();
    this.layout(gameSize.width, gameSize.height);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (
      this.phase !== "sparkler" ||
      !this.pointerActive ||
      pointer.id !== this.activePointerId ||
      !pointer.isDown
    ) return;
    this.updateSparklerTarget(pointer);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.phase !== "sparkler" || this.activePointerId !== null || pointer.button !== 0) return;
    if (pointer.wasTouch) {
      this.lastTouchTime = Date.now();
    } else if (Date.now() - this.lastTouchTime < EMULATED_MOUSE_GUARD_MS) {
      return;
    }

    this.activePointerId = pointer.id;
    this.game.canvas.focus({ preventScroll: true });
    this.pointerActive = true;
    this.updateSparklerTarget(pointer);
    this.callbacks.audio.resumeAfterGesture();
    this.callbacks.audio.startSparkler();
  }

  private updateSparklerTarget(pointer: Phaser.Input.Pointer): void {
    pointer.updateWorldPoint(this.cameras.main);
    const boundary = this.sparklerBoundary();
    this.targetX = Phaser.Math.Clamp(pointer.worldX, boundary, this.width - boundary);
    this.targetY = Phaser.Math.Clamp(pointer.worldY, boundary, this.height - boundary);
  }

  private sparklerBoundary(): number {
    return Math.min(
      this.width * 0.25,
      Math.hypot(this.sparkler.displayWidth * 0.5, this.sparkler.displayHeight * 0.65),
    );
  }

  private drawFuseBurn(): Phaser.Math.Vector2 {
    const points = ROCKET_FUSE_PATH.map((point) => new Phaser.Math.Vector2(
      this.rocket.x + (point.x - 0.5) * this.rocket.displayWidth,
      this.rocket.y + (point.y - 0.5) * this.rocket.displayHeight,
    ));
    const lengths = points.slice(1).map((point, index) => Phaser.Math.Distance.BetweenPoints(points[index], point));
    const totalLength = lengths.reduce((sum, length) => sum + length, 0);
    let remaining = totalLength * this.fuseBurnProgress;
    let burnPoint = points[0];

    this.fuseBurn.clear();
    this.fuseBurn.lineStyle(Math.max(2, this.rocket.displayWidth * 0.025), 0x39251f, 0.95);
    this.fuseBurn.beginPath();
    this.fuseBurn.moveTo(points[0].x, points[0].y);
    for (let index = 0; index < lengths.length; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const segmentLength = lengths[index];
      if (remaining >= segmentLength) {
        this.fuseBurn.lineTo(to.x, to.y);
        burnPoint = to;
        remaining -= segmentLength;
        continue;
      }

      const progress = segmentLength === 0 ? 1 : remaining / segmentLength;
      burnPoint = new Phaser.Math.Vector2(
        Phaser.Math.Linear(from.x, to.x, progress),
        Phaser.Math.Linear(from.y, to.y, progress),
      );
      this.fuseBurn.lineTo(burnPoint.x, burnPoint.y);
      break;
    }
    this.fuseBurn.strokePath();
    this.fuseGlow.setPosition(burnPoint.x, burnPoint.y);
    this.fuseFlame.setPosition(burnPoint.x, burnPoint.y);
    return burnPoint;
  }

  private onPointerUp(pointer?: Phaser.Input.Pointer): void {
    if (pointer && this.activePointerId !== null && pointer.id !== this.activePointerId) return;
    this.activePointerId = null;
    this.pointerActive = false;
    this.callbacks.audio.stopSparkler();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.phase !== "sparkler") return;
    const step = Math.max(12, Math.min(this.width, this.height) * 0.035);
    if (event.key === "ArrowLeft") this.targetX = Phaser.Math.Clamp(this.targetX - step, 12, this.width - 12);
    else if (event.key === "ArrowRight") this.targetX = Phaser.Math.Clamp(this.targetX + step, 12, this.width - 12);
    else if (event.key === "ArrowUp") this.targetY = Phaser.Math.Clamp(this.targetY - step, 24, this.height - 18);
    else if (event.key === "ArrowDown") this.targetY = Phaser.Math.Clamp(this.targetY + step, 24, this.height - 18);
    else if (event.code === "Space") {
      this.spaceDown = true;
      this.pointerActive = true;
    } else return;

    event.preventDefault();
    this.callbacks.audio.resumeAfterGesture();
    this.callbacks.audio.startSparkler();
    this.keyboardRelease?.remove(false);
    this.keyboardRelease = this.time.delayedCall(180, () => {
      if (!this.spaceDown) {
        this.pointerActive = false;
        this.callbacks.audio.stopSparkler();
      }
    });
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (event.code === "Space") {
      this.spaceDown = false;
      this.pointerActive = false;
      this.callbacks.audio.stopSparkler();
    }
  }

  private igniteFuse(): void {
    if (this.phase !== "sparkler") return;
    this.phase = "fuse";
    this.pointerActive = false;
    this.activePointerId = null;
    this.fuseElapsed = 0;
    this.fuseBurnProgress = 0;
    this.sparkler.setVisible(false);
    this.callbacks.audio.stopSparkler();
    this.callbacks.audio.playFuse();
    this.fuseGlow.setVisible(true);
    this.fuseFlame.setVisible(true);
    this.drawFuseBurn();
    this.tweens.add({
      targets: this.fuseGlow,
      alpha: { from: 0.65, to: 1 },
      scaleX: { from: 1, to: 1.9 },
      scaleY: { from: 1, to: 1.9 },
      duration: 220,
      yoyo: true,
      repeat: 4,
    });
    this.tweens.add({
      targets: this.fuseFlame,
      alpha: { from: 0.6, to: 1 },
      scaleX: { from: 0.85, to: 1.2 },
      scaleY: { from: 0.9, to: 1.35 },
      duration: 110,
      yoyo: true,
      repeat: -1,
    });
    this.time.delayedCall(FUSE_BURN_DURATION, () => this.launchRocket());
  }

  private launchRocket(): void {
    if (this.phase !== "fuse") return;
    this.phase = "launching";
    this.callbacks.audio.stopEffects();
    this.callbacks.audio.playLaunch();
    this.callbacks.audio.fadeMusic();
    this.fuseGlow.setVisible(false);
    this.fuseFlame.setVisible(false);
    this.tweens.killTweensOf(this.fuseFlame);
    this.fuseBurn.clear();
    this.trailEmitter.start();
    this.launchProgress = 0;
    this.rocketLaunchStartTop = this.rocket.getBounds().top;
    this.launchComplete = false;
    this.blackoutComplete = false;
    this.fadeStarted = false;
    this.blackoutOverlay.setDepth(10).setAlpha(0).setVisible(true);

    this.tweens.add({
      targets: this,
      launchProgress: 1,
      duration: ROCKET_FLIGHT_DURATION,
      ease: "Cubic.easeIn",
      onUpdate: () => {
        this.rocket.y = Phaser.Math.Linear(this.rocketStartY, this.rocketTargetY, this.launchProgress);
        this.updateRocketFade();
        this.trailEmitter.emitParticleAt(
          this.rocket.x,
          this.rocket.y + this.rocket.displayHeight * 0.34,
          this.callbacks.lowPower ? 1 : 2,
        );
      },
      onComplete: () => {
        this.rocket.y = this.rocketTargetY;
        this.updateRocketFade();
        this.launchComplete = true;
        this.trailEmitter.stop();
        this.rocket.setVisible(false);
        this.blackoutComplete = true;
        this.trailEmitter.setDepth(1);
        this.blackoutOverlay.setDepth(2);
        this.tryExplode();
      },
    });
  }

  private rocketTopMargin(): number {
    const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    return (Number.isFinite(rootFontSize) ? rootFontSize : 16) * ROCKET_TOP_MARGIN_REM;
  }

  private updateRocketFade(): void {
    const startTop = this.rocketLaunchStartTop;
    const targetTop = this.rocketTopMargin();
    const travel = startTop - targetTop;
    if (travel <= 0) {
      this.blackoutOverlay.setAlpha(1);
      return;
    }

    const currentTop = this.rocket.getBounds().top;
    const positionProgress = Phaser.Math.Clamp((startTop - currentTop) / travel, 0, 1);
    const fadeProgress = Phaser.Math.Clamp(
      (positionProgress - ROCKET_FADE_START_PROGRESS) / (1 - ROCKET_FADE_START_PROGRESS),
      0,
      1,
    );
    const easedFadeProgress = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
    this.blackoutOverlay.setAlpha(easedFadeProgress);
    if (!this.fadeStarted && positionProgress >= ROCKET_FADE_START_PROGRESS) {
      this.fadeStarted = true;
      this.callbacks.onFade();
    }
  }

  private tryExplode(): void {
    if (this.phase !== "launching" || !this.blackoutComplete || !this.launchComplete) return;
    this.explode();
  }

  private explode(): void {
    if (this.phase !== "launching" || !this.blackoutComplete || !this.launchComplete) return;
    this.phase = "fireworks";
    this.trailEmitter.stop();
    this.rocket.setVisible(false);
    const x = this.rocket.x;
    const y = this.rocket.y;
    this.fireworks.start(x, y);
    this.callbacks.onFireworksStart();
  }

  private tryCompleteFireworksFade(): void {
    if (
      this.phase !== "firework-fade" ||
      !this.fireworkVisualFadeComplete ||
      !this.fireworksAudioFadeComplete
    ) return;
    this.phase = "complete";
    this.callbacks.onGreeting();
  }

  private onShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.off("pointerupoutside", this.onPointerUp, this);
    this.input.keyboard?.off("keydown", this.onKeyDown, this);
    this.input.keyboard?.off("keyup", this.onKeyUp, this);
    this.keyboardRelease?.remove(false);
    this.fireworks.stop();
    this.game.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("blur", this.onInterruption);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.callbacks.audio.stopEffects();
  }
}
