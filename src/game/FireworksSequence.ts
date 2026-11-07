import * as Phaser from "phaser";
import type { GiftAudio } from "../lib/audio";

type FireworkStyle = "silver" | "gold" | "amber" | "cascade";

interface FireworkCue {
  at: number;
  x: number;
  y: number;
  style: FireworkStyle;
  count: number;
  size: number;
}

interface FireworksOptions {
  audio: GiftAudio;
  lowPower: boolean;
  reducedMotion: boolean;
}

const FIREWORKS_SHOW_DURATION = 7000;

const CUES: readonly FireworkCue[] = [
  { at: 350, x: 0.28, y: 0.31, style: "amber", count: 72, size: 0.74 },
  { at: 760, x: 0.76, y: 0.3, style: "gold", count: 88, size: 0.82 },
  { at: 1170, x: 0.54, y: 0.23, style: "silver", count: 120, size: 0.98 },
  { at: 1580, x: 0.2, y: 0.22, style: "gold", count: 88, size: 0.78 },
  { at: 1990, x: 0.79, y: 0.26, style: "amber", count: 94, size: 0.86 },
  { at: 2400, x: 0.36, y: 0.3, style: "silver", count: 118, size: 0.96 },
  { at: 2810, x: 0.69, y: 0.18, style: "cascade", count: 102, size: 0.9 },
  { at: 3220, x: 0.17, y: 0.2, style: "silver", count: 128, size: 1.08 },
  { at: 3630, x: 0.82, y: 0.29, style: "gold", count: 108, size: 0.94 },
  { at: 4040, x: 0.51, y: 0.19, style: "amber", count: 96, size: 0.88 },
  { at: 4450, x: 0.29, y: 0.34, style: "silver", count: 122, size: 1.02 },
  { at: 4860, x: 0.76, y: 0.17, style: "cascade", count: 106, size: 1.02 },
  { at: 5270, x: 0.48, y: 0.29, style: "gold", count: 104, size: 0.92 },
  { at: 5680, x: 0.86, y: 0.19, style: "amber", count: 82, size: 0.76 },
  { at: 6090, x: 0.23, y: 0.25, style: "silver", count: 96, size: 0.84 },
  { at: 6500, x: 0.64, y: 0.16, style: "gold", count: 78, size: 0.7 },
  { at: 6910, x: 0.43, y: 0.22, style: "amber", count: 54, size: 0.58 },
];

type RocketFireworksSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

function isRocketFireworksSound(sound: Phaser.Sound.BaseSound): sound is RocketFireworksSound {
  return "setVolume" in sound && "setMute" in sound && "volume" in sound;
}

export class FireworksSequence {
  private readonly silver: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly gold: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly amber: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly cascade: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly glitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly emitters: Phaser.GameObjects.Particles.ParticleEmitter[];
  private readonly options: FireworksOptions;
  private rocketFireworksSound: RocketFireworksSound | null = null;
  private jethalalFireworksSound: RocketFireworksSound | null = null;
  private burstScale = 1;
  private elapsed = 0;
  private nextCue = 0;
  private started = false;
  private complete = false;

  constructor(private readonly scene: Phaser.Scene, options: FireworksOptions) {
    this.options = options;
    this.silver = this.createRadialEmitter({
      speed: this.speedOperation(0.19, 0.76),
      lifespan: { min: 1150, max: 2550 },
      scale: { start: 0.9, end: 0 },
      tint: [0xffffff, 0xf3f4ff, 0xd9dce6],
      gravityY: 72,
      maxParticles: options.lowPower ? 230 : 360,
      maxAliveParticles: options.lowPower ? 145 : 250,
    });
    this.gold = this.createRadialEmitter({
      speed: this.speedOperation(0.16, 0.68),
      lifespan: { min: 1450, max: 2900 },
      scale: { start: 0.78, end: 0 },
      tint: [0xffe6a0, 0xffc64f, 0xffa43a, 0xfff2d0],
      gravityY: 88,
      maxParticles: options.lowPower ? 210 : 330,
      maxAliveParticles: options.lowPower ? 130 : 220,
    });
    this.amber = this.createRadialEmitter({
      speed: this.speedOperation(0.15, 0.62),
      lifespan: { min: 1150, max: 2450 },
      scale: { start: 0.9, end: 0 },
      tint: [0xffd079, 0xffa044, 0xff743d, 0xffe8be],
      gravityY: 96,
      maxParticles: options.lowPower ? 170 : 260,
      maxAliveParticles: options.lowPower ? 105 : 175,
    });
    this.cascade = this.createRadialEmitter({
      speed: this.speedOperation(0.12, 0.54),
      angle: { min: 205, max: 335 },
      lifespan: { min: 1900, max: 3500 },
      scale: { start: 0.92, end: 0 },
      tint: [0xffe5a0, 0xffc858, 0xfff1ce],
      gravityY: 155,
      maxParticles: options.lowPower ? 155 : 245,
      maxAliveParticles: options.lowPower ? 90 : 155,
    });
    this.glitter = this.createRadialEmitter({
      speed: this.speedOperation(0.025, 0.2),
      lifespan: { min: 650, max: 1600 },
      scale: { start: 0.5, end: 0 },
      tint: [0xffffff, 0xffebad, 0xffd36b],
      gravityY: 48,
      maxParticles: options.lowPower ? 180 : 300,
      maxAliveParticles: options.lowPower ? 110 : 190,
    });
    this.embers = this.createRadialEmitter({
      speed: this.speedOperation(0.015, 0.14),
      angle: { min: 35, max: 145 },
      lifespan: { min: 1700, max: 3300 },
      scale: { start: 0.7, end: 0 },
      tint: [0xffd36c, 0xff9b3d, 0xffedb5],
      gravityY: 66,
      maxParticles: options.lowPower ? 120 : 190,
      maxAliveParticles: options.lowPower ? 76 : 128,
    });
    this.emitters = [this.silver, this.gold, this.amber, this.cascade, this.glitter, this.embers];
  }

  get isComplete(): boolean {
    return this.complete;
  }

  setRocketFireworksSound(sound: Phaser.Sound.BaseSound): void {
    if (isRocketFireworksSound(sound)) {
      this.rocketFireworksSound = sound;
    } else {
      sound.destroy();
      console.error("The rocket fireworks audio could not be initialized.");
    }
  }

  setJethalalFireworksSound(sound: Phaser.Sound.BaseSound): void {
    if (isRocketFireworksSound(sound)) {
      this.jethalalFireworksSound = sound;
    } else {
      sound.destroy();
      console.error("The Jethalal Diwali audio could not be initialized.");
    }
  }

  start(x: number, y: number): void {
    if (this.started) return;
    this.started = true;
    this.options.audio.playExplosion();
    if (!this.options.reducedMotion) this.scene.cameras.main.flash(190, 255, 247, 224);

    this.emitBurst("silver", x, y, 190, 1.05);
    this.emitParticles(this.gold, x, y, 42, 0.62);
    this.emitParticles(this.glitter, x, y, 72, 0.8);
    this.addBurstGlow(x, y, "silver", 1.1);
    this.addBurstRing(x, y, 0xe9edf6, 1.1);
    if (this.rocketFireworksSound) {
      this.options.audio.playFireworksAudio(
        this.rocketFireworksSound,
        this.jethalalFireworksSound,
      );
      this.rocketFireworksSound = null;
      this.jethalalFireworksSound = null;
    }
  }

  update(delta: number): void {
    if (!this.started || this.complete) return;
    this.elapsed = Math.min(this.elapsed + Math.min(delta, 250), FIREWORKS_SHOW_DURATION);

    while (this.nextCue < CUES.length && CUES[this.nextCue].at <= this.elapsed) {
      const cue = CUES[this.nextCue];
      this.emitBurst(
        cue.style,
        this.scene.scale.width * cue.x,
        this.scene.scale.height * cue.y,
        cue.count,
        cue.size,
      );
      this.nextCue += 1;
    }

    if (this.elapsed >= FIREWORKS_SHOW_DURATION) this.complete = true;
  }

  stop(): void {
    this.emitters.forEach((emitter) => emitter.stop());
    this.options.audio.stopFireworksAudio();
  }

  private createRadialEmitter(
    config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    return this.scene.add.particles(0, 0, "gift-spark", {
      ...config,
      angle: config.angle ?? { min: 0, max: 360 },
      accelerationX: (particle: Phaser.GameObjects.Particles.Particle) => -particle.velocityX * 0.3,
      accelerationY: (particle: Phaser.GameObjects.Particles.Particle) => -particle.velocityY * 0.16,
      blendMode: Phaser.BlendModes.ADD,
      frequency: -1,
      radial: true,
    }).setDepth(6);
  }

  private speedOperation(minRatio: number, maxRatio: number): Phaser.Types.GameObjects.Particles.EmitterOpOnEmitCallback {
    return () => {
      const shortSide = Math.min(this.scene.scale.width, this.scene.scale.height);
      return Phaser.Math.Between(
        Math.round(shortSide * minRatio * this.burstScale),
        Math.round(shortSide * maxRatio * this.burstScale),
      );
    };
  }

  private emitBurst(style: FireworkStyle, x: number, y: number, count: number, size: number): void {
    const quality = this.options.reducedMotion ? 0.34 : this.options.lowPower ? 0.58 : 1;
    const particleCount = Math.max(12, Math.round(count * quality));
    const emitter = this[style];
    this.emitParticles(emitter, x, y, particleCount, size);

    const glitterCount = Math.max(5, Math.round(particleCount * (style === "cascade" ? 0.3 : 0.42)));
    this.emitParticles(this.glitter, x, y, glitterCount, Math.min(1, size));
    if (style === "silver" || style === "amber") {
      this.emitParticles(this.gold, x, y, Math.max(5, Math.round(particleCount * 0.18)), size * 0.68);
    }
    if (style === "cascade" || this.elapsed >= FIREWORKS_SHOW_DURATION / 2) {
      this.emitParticles(this.embers, x, y, Math.max(5, Math.round(particleCount * 0.16)), size * 0.72);
    }

    this.addBurstGlow(x, y, style, size);
    this.addBurstRing(x, y, this.colorFor(style), size);
  }

  private emitParticles(
    emitter: Phaser.GameObjects.Particles.ParticleEmitter,
    x: number,
    y: number,
    count: number,
    size: number,
  ): void {
    this.burstScale = size;
    emitter.emitParticleAt(x, y, count);
    this.burstScale = 1;
  }

  private addBurstGlow(x: number, y: number, style: FireworkStyle, size: number): void {
    const shortSide = Math.min(this.scene.scale.width, this.scene.scale.height);
    const color = this.colorFor(style);
    const outer = this.scene.add.circle(x, y, shortSide * 0.045 * size, color, 0.58)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8);
    this.scene.tweens.add({
      targets: outer,
      scaleX: { from: 0.2, to: 2.25 },
      scaleY: { from: 0.2, to: 2.25 },
      alpha: { from: 0.58, to: 0 },
      duration: 460,
      ease: "Cubic.easeOut",
      onComplete: () => outer.destroy(),
    });

    const coreColor = style === "amber" ? 0xffffe0 : 0xffffff;
    const core = this.scene.add.circle(x, y, Math.max(3, shortSide * 0.012 * size), coreColor, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9);
    this.scene.tweens.add({
      targets: core,
      scaleX: { from: 0.5, to: 2.1 },
      scaleY: { from: 0.5, to: 2.1 },
      alpha: { from: 0.95, to: 0 },
      duration: 210,
      ease: "Cubic.easeOut",
      onComplete: () => core.destroy(),
    });
  }

  private addBurstRing(x: number, y: number, color: number, size: number): void {
    const shortSide = Math.min(this.scene.scale.width, this.scene.scale.height);
    const ring = this.scene.add.circle(x, y, 4)
      .setStrokeStyle(Math.max(1.5, shortSide * 0.004), color, 0.8)
      .setFillStyle(color, 0)
      .setDepth(7);
    const targetScale = (shortSide * 0.28 * size) / 4;
    this.scene.tweens.add({
      targets: ring,
      scaleX: { from: 0.15, to: targetScale },
      scaleY: { from: 0.15, to: targetScale },
      alpha: { from: 0.8, to: 0 },
      duration: 1050 + size * 240,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private colorFor(style: FireworkStyle): number {
    if (style === "silver") return 0xf4f5ff;
    if (style === "cascade") return 0xffd46f;
    if (style === "amber") return 0xffa04b;
    return 0xffd477;
  }
}
