import spriteUrl from "../assets/sounds/game_audio_sprite.wav";
import spriteData from "../assets/sounds/game_audio_sprite_wav.json";

/** One region of the audio sprite: a slice of the single .wav, in milliseconds. */
interface SpriteRegion {
  start: number;
  end: number;
  loop: boolean;
}

/** The sprite names available to play (derived from the JSON, so they can't drift). */
export type SoundName = keyof typeof spriteData.spritemap;

const SPRITE = spriteData.spritemap as Record<SoundName, SpriteRegion>;

/** A playing sound; call {@link SoundHandle.stop} to end a loop early. */
export interface SoundHandle {
  stop(): void;
}

/** Returned when audio isn't ready yet, so callers never have to null-check. */
const NOOP_HANDLE: SoundHandle = { stop() {} };

/**
 * A tiny Web Audio sprite player. The whole soundtrack ships as one .wav plus a
 * map of millisecond regions; we decode it once and play sub-regions on demand.
 *
 * Sounds play once by default; only the two background tracks and the win
 * count-up loop. Background music is mutually exclusive — {@link playMusic}
 * swaps tracks. Browsers start the audio context suspended (autoplay policy), so
 * we resume it on the first user gesture; music started before then begins as
 * soon as the context wakes.
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private loadPromise: Promise<void> | null = null;
  private muted = false;
  /** The looping background track currently playing (only one at a time). */
  private music: { name: SoundName; handle: SoundHandle } | null = null;

  /** Fetch + decode the sprite once. Safe to call repeatedly (cached). */
  load(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.doLoad();
    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    // Never reject: audio is non-essential, so a load failure must not block the
    // scene from initializing. play()/playMusic() just no-op until a buffer exists.
    try {
      const ctx = this.context();
      const res = await fetch(spriteUrl);
      const data = await res.arrayBuffer();
      this.buffer = await ctx.decodeAudioData(data);
    } catch (err) {
      console.warn("Audio failed to load — continuing without sound.", err);
    }
  }

  /** Lazily create the audio context + master gain, wiring the autoplay unlock. */
  private context(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 1;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;

    // Resume the (autoplay-suspended) context on the first user gesture, once.
    const resume = (): void => {
      void ctx.resume();
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    return ctx;
  }

  /** Resume the context now (e.g. from the spin click) — safe to call anytime. */
  resume(): void {
    void this.ctx?.resume();
  }

  /**
   * Play a sprite region. Plays once unless `loop` is set, in which case it loops
   * over just that region until the returned handle is stopped.
   */
  play(name: SoundName, opts: { loop?: boolean } = {}): SoundHandle {
    const { ctx, master, buffer } = this;
    const region = SPRITE[name];
    if (!ctx || !master || !buffer || !region) return NOOP_HANDLE;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(master);

    const start = region.start / 1000;
    const end = region.end / 1000;
    if (opts.loop) {
      source.loop = true;
      source.loopStart = start;
      source.loopEnd = end;
      source.start(0, start);
    } else {
      source.start(0, start, end - start);
    }

    let stopped = false;
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        try {
          source.stop();
        } catch {
          // Already stopped/ended — nothing to do.
        }
      },
    };
  }

  /**
   * Switch the looping background music. No-op if `name` is already the current
   * track; otherwise stops the old track and starts the new one looped.
   */
  playMusic(name: SoundName): void {
    if (this.music?.name === name) return;
    this.music?.handle.stop();
    this.music = { name, handle: this.play(name, { loop: true }) };
  }

  /** Stop the background music (if any). */
  stopMusic(): void {
    this.music?.handle.stop();
    this.music = null;
  }

  /** Mute/unmute everything via the master gain. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  get isMuted(): boolean {
    return this.muted;
  }
}

/** Shared sound player for the whole app. */
export const sound = new SoundManager();
