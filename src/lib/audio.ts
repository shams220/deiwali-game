import type * as Phaser from "phaser";

interface AudioContextWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

type RocketFireworksSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

export class GiftAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private sparklerSource: AudioBufferSourceNode | null = null;
  private sparklerGain: GainNode | null = null;
  private fuseSource: AudioBufferSourceNode | null = null;
  private fuseGain: GainNode | null = null;
  private musicNodes: Array<{ oscillator: OscillatorNode; gain: GainNode }> = [];
  private rocketFireworksSound: RocketFireworksSound | null = null;
  private rocketFireworksStarted = false;
  private resumeInProgress = false;

  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    const AudioContextConstructor = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
    if (!AudioContextConstructor) return;

    this.context ??= new AudioContextConstructor();
    this.master ??= this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.35;
    this.master.connect(this.context.destination);
    if (this.context.state !== "running") await this.context.resume();
    this.startMusic();
  }

  get supported(): boolean {
    return typeof window !== "undefined" &&
      Boolean(window.AudioContext || (window as AudioContextWindow).webkitAudioContext);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.35, this.context.currentTime, 0.04);
    }
    this.rocketFireworksSound?.setMute(muted);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  resumeAfterGesture(): void {
    if (!this.context || this.context.state === "running" || this.resumeInProgress) return;
    this.resumeInProgress = true;
    void this.context.resume().catch((error: unknown) => {
      console.error("Diwali audio remained suspended after a user gesture.", error);
    }).finally(() => {
      this.resumeInProgress = false;
    });
  }

  startSparkler(): void {
    if (!this.context || !this.master || this.sparklerSource) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.createNoiseBuffer();
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = 2300;
    filter.Q.value = 0.6;
    gain.gain.value = 0.1;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.sparklerSource = source;
    this.sparklerGain = gain;
  }

  stopSparkler(): void {
    this.stopLoop("sparkler");
  }

  playFuse(): void {
    if (!this.context || !this.master) return;
    this.stopSparkler();
    this.stopLoop("fuse");
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.createNoiseBuffer();
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, this.context.currentTime + 0.08);
    gain.gain.setTargetAtTime(0.07, this.context.currentTime + 0.2, 0.45);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    source.stop(this.context.currentTime + 2.5);
    source.onended = () => {
      if (this.fuseSource === source) this.fuseSource = null;
      if (this.fuseGain === gain) this.fuseGain = null;
      source.disconnect();
      gain.disconnect();
      filter.disconnect();
    };
    this.fuseSource = source;
    this.fuseGain = gain;
  }

  playLaunch(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const tone = this.context.createOscillator();
    const toneGain = this.context.createGain();
    source.buffer = this.createNoiseBuffer();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(4200, now + 2.1);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    tone.type = "sine";
    tone.frequency.setValueAtTime(175, now);
    tone.frequency.exponentialRampToValueAtTime(680, now + 2.1);
    toneGain.gain.setValueAtTime(0.001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.035, now + 0.25);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    source.connect(filter).connect(gain).connect(this.master);
    tone.connect(toneGain).connect(this.master);
    source.start(now);
    tone.start(now);
    source.stop(now + 2.25);
    tone.stop(now + 2.25);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    tone.onended = () => {
      tone.disconnect();
      toneGain.disconnect();
    };
  }

  playExplosion(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const lowPass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const bass = this.context.createOscillator();
    const bassGain = this.context.createGain();
    source.buffer = this.createNoiseBuffer();
    lowPass.type = "lowpass";
    lowPass.frequency.setValueAtTime(1400, now);
    lowPass.frequency.exponentialRampToValueAtTime(120, now + 0.65);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.45, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    bass.type = "sine";
    bass.frequency.setValueAtTime(105, now);
    bass.frequency.exponentialRampToValueAtTime(38, now + 0.55);
    bassGain.gain.setValueAtTime(0.001, now);
    bassGain.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    source.connect(lowPass).connect(gain).connect(this.master);
    bass.connect(bassGain).connect(this.master);
    source.start(now);
    bass.start(now);
    source.stop(now + 0.75);
    bass.stop(now + 0.7);
    source.onended = () => {
      source.disconnect();
      lowPass.disconnect();
      gain.disconnect();
    };
    bass.onended = () => {
      bass.disconnect();
      bassGain.disconnect();
    };
  }

  playRocketFireworks(sound: RocketFireworksSound): void {
    if (this.rocketFireworksStarted) {
      sound.destroy();
      return;
    }

    this.rocketFireworksStarted = true;
    this.rocketFireworksSound = sound;
    sound.setVolume(0.8);
    sound.setMute(this.muted);
    if (!sound.play()) {
      console.error("The rocket fireworks audio could not be played.");
      sound.destroy();
      this.rocketFireworksSound = null;
    }
  }

  fadeOutRocketFireworks(
    tweens: Phaser.Tweens.TweenManager,
    duration: number,
  ): Promise<void> {
    const sound = this.rocketFireworksSound;
    if (!sound) return Promise.resolve();

    if (!sound.isPlaying) {
      this.cleanupRocketFireworks(sound);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      tweens.add({
        targets: sound,
        volume: 0,
        duration,
        ease: "Sine.easeInOut",
        onComplete: () => {
          sound.setVolume(0);
          this.cleanupRocketFireworks(sound);
          resolve();
        },
      });
    });
  }

  stopRocketFireworks(): void {
    if (this.rocketFireworksSound) this.cleanupRocketFireworks(this.rocketFireworksSound);
  }

  stopEffects(): void {
    this.stopSparkler();
    this.stopLoop("fuse");
  }

  stopAll(): void {
    this.stopEffects();
    for (const { oscillator, gain } of this.musicNodes) {
      try {
        oscillator.stop();
      } catch {
        // Audio-context interruptions can stop a node before this cleanup runs.
      }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.musicNodes = [];
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.15);
    }
  }

  fadeMusic(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const { oscillator, gain } of this.musicNodes) {
      gain.gain.setTargetAtTime(0, now, 0.35);
      oscillator.stop(now + 1.5);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
    this.musicNodes = [];
  }

  destroy(): void {
    this.stopAll();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  private startMusic(): void {
    if (!this.context || !this.master || this.musicNodes.length) return;
    for (const frequency of [130.81, 196, 261.63]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = frequency === 130.81 ? 0.018 : 0.008;
      oscillator.connect(gain).connect(this.master);
      oscillator.start();
      this.musicNodes.push({ oscillator, gain });
    }
  }

  private createNoiseBuffer(): AudioBuffer {
    const context = this.context;
    if (!context) throw new Error("Audio has not been unlocked.");
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private stopLoop(type: "sparkler" | "fuse"): void {
    const source = type === "sparkler" ? this.sparklerSource : this.fuseSource;
    const gain = type === "sparkler" ? this.sparklerGain : this.fuseGain;
    if (type === "sparkler") {
      this.sparklerSource = null;
      this.sparklerGain = null;
    } else {
      this.fuseSource = null;
      this.fuseGain = null;
    }
    if (!source) return;
    try {
      source.stop();
    } catch {
      // The audio context may have been suspended by the operating system.
    }
    source.disconnect();
    gain?.disconnect();
  }

  private cleanupRocketFireworks(sound: RocketFireworksSound): void {
    sound.stop();
    sound.destroy();
    if (this.rocketFireworksSound === sound) this.rocketFireworksSound = null;
  }
}
