/**
 * Phase 39: Web Audio playback adapter (MUSIC_PLAYBACK_ADAPTER).
 *
 * Turns the pure MusicDirector state into audible procedural audio via the
 * Web Audio API. Because real art/audio assets are BLOCKED by Phase 38/39,
 * each music context is synthesized from the pure PlaybackTexture descriptors
 * rather than sample files. When real assets land, only `applyContext`
 * changes — the director/bus-mixer contracts stay identical.
 *
 * Boss stem layering (GDD §22.5): when the context is bossPhase, the stem
 * layer (0–3) selects more aggressive textures. Layer changes morph the
 * live oscillator shape, frequency, and detune over 200 ms.
 *
 * Audio never holds gameplay authority: every failure degrades to silence.
 */
import type { MusicContext } from '../../game/content/audio/music-director.js';
import { roundToNearest } from '../../ui/format/rounding.js';
import { textureForContextWithStem, type PlaybackTexture } from '../../game/content/audio/playback-textures.js';
import { effectiveVolume, type BusSettings, type AudioBus } from '../../game/content/audio/bus-settings-store.js';

type AudioContextCtor = new () => AudioContext;

const BUSES: readonly AudioBus[] = ['master', 'music', 'sfx', 'voice', 'ui', 'ambient'];

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class MusicPlaybackAdapter {
  // Exposed for e2e tests to inspect the current music context.
  contextKey: string | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private readonly busGains = new Map<AudioBus, GainNode>();
  private voice: OscillatorNode | null = null;
  private voiceGain: GainNode | null = null;
  private stepTimer: number | null = null;
  private stepIndex = 0;
  private texture: PlaybackTexture | null = null;
  private paused = false;

  get isRunning(): boolean { return this.ctx !== null && this.voice !== null; }

  private ensureContext(): AudioContext | null {
    if (this.ctx !== null) return this.ctx;
    const Ctor = audioContextCtor();
    if (Ctor === null) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    const ctx = this.ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.connect(ctx.destination);
    for (const bus of BUSES) {
      const gain = ctx.createGain();
      gain.connect(this.masterGain);
      this.busGains.set(bus, gain);
    }
    return ctx;
  }

  private stopVoice(): void {
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.voice !== null) {
      try { this.voice.stop(); } catch { /* already stopped */ }
      this.voice.disconnect();
      this.voice = null;
    }
    if (this.voiceGain !== null) {
      this.voiceGain.disconnect();
      this.voiceGain = null;
    }
    this.texture = null;
    this.contextKey = null;
  }

  private startVoice(texture: PlaybackTexture, gainValue: number): void {
    const ctx = this.ensureContext();
    if (ctx === null) return;
    if (texture.gain <= 0 || texture.tempoHz <= 0) {
      this.stopVoice();
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = texture.shape;
    osc.frequency.value = texture.rootHz;
    osc.detune.value = texture.detuneCents;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, gainValue * texture.gain)), now + 0.1);

    const bus = this.busGains.get('music');
    const target = bus ?? this.masterGain;
    if (target === null) return;
    osc.connect(gain);
    gain.connect(target);
    osc.start();

    this.voice = osc;
    this.voiceGain = gain;
    this.texture = texture;
    this.stepIndex = 0;
    this.paused = false;

    if (texture.stepSemitones.length > 1 && texture.tempoHz > 0) {
      const intervalMs = Math.max(80, roundToNearest(1000 / texture.tempoHz));
      this.stepTimer = window.setInterval(() => {
        const voice = this.voice;
        const tex = this.texture;
        const audioCtx = this.ctx;
        if (voice === null || tex === null || audioCtx === null) return;
        this.stepIndex = (this.stepIndex + 1) % tex.stepSemitones.length;
        const semi = tex.stepSemitones[this.stepIndex];
        if (semi === undefined) return;
        const hz = tex.rootHz * 2 ** (semi / 12);
        voice.frequency.setTargetAtTime(hz, audioCtx.currentTime, 0.05);
      }, intervalMs);
    }
  }

  /** Switch texture with a short gain dip as the crossfade. */
  applyContext(ctx: MusicContext, crossfadeMs: number, stemLayer = 0): void {
    const key = typeof ctx === 'string' ? ctx : ctx.kind;
    if (key === this.contextKey) {
      this.setStemLive(stemLayer);
      return;
    }
    const texture = textureForContextWithStem(ctx, stemLayer);
    if (this.ctx === null) {
      this.startVoice(texture, 1);
      this.contextKey = key;
      return;
    }

    const dipMs = Math.max(0, Math.min(crossfadeMs, 300));
    const now = this.ctx.currentTime;
    if (this.voiceGain !== null) {
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, now);
      this.voiceGain.gain.linearRampToValueAtTime(0.0001, now + dipMs / 1000);
    }
    this.stopVoice();
    this.startVoice(texture, 1);
    this.contextKey = key;
  }

  /** Smoothly morph the live oscillator toward the new stem texture. */
  private setStemLive(stemLayer: number): void {
    const voice = this.voice;
    const audioCtx = this.ctx;
    if (voice === null || audioCtx === null) return;
    const tex = textureForContextWithStem({ kind: 'bossPhase', phase: 1 }, stemLayer);
    const now = audioCtx.currentTime;
    voice.type = tex.shape;
    voice.frequency.cancelScheduledValues(now);
    voice.frequency.setTargetAtTime(tex.rootHz, now, 0.1);
    voice.detune.cancelScheduledValues(now);
    voice.detune.setTargetAtTime(tex.detuneCents, now, 0.1);
    this.texture = tex;
  }

  setBusSettings(settings: BusSettings): void {
    const ctx = this.ensureContext();
    if (ctx === null) return;
    const now = ctx.currentTime;
    for (const bus of BUSES) {
      const gain = this.busGains.get(bus);
      if (gain === undefined) continue;
      const vol = effectiveVolume(settings, bus) / 100;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(vol, now, 0.05);
    }
  }

  pause(): void {
    if (this.ctx === null || this.paused) return;
    this.paused = true;
    void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx === null || !this.paused) return;
    this.paused = false;
    void this.ctx.resume();
  }

  dispose(): void {
    this.stopVoice();
    for (const [, gain] of this.busGains) { try { gain.disconnect(); } catch { /* noop */ } }
    this.busGains.clear();
    if (this.ctx !== null) {
      void this.ctx.close().catch(() => { /* noop */ });
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
